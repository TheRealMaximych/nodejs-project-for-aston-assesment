## Context

Login already signs HS256 JWT `{ userId, tokenVersion }` via `src/services/access-token.ts`. User rows have `token_version`. `POST /auth/logout` is asserted as unknown-path 404 in `not-found.test.ts`. There is no `jwt.verify`, no auth middleware, and no repository method to read or increment `tokenVersion` by id. `UnauthorizedError` already maps to 401. Motivation: `proposal.md`. Contracts: deltas `request-auth`, `user-logout`, `http-runtime`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; no `process.env` in HTTP/services; verify/sign only via callback + `await`; never log JWT / `Authorization` / `accessToken`; no accounts or transfers.

## Goals / Non-Goals

**Goals:**

- Thin `requireAuth` middleware: parse `Authorization: Bearer`, call the authenticate service, set `req.userId`, pass domain errors to `next`.
- Authenticate and logout logic in services with injectable deps so `npm test` covers increment and stale `tokenVersion` without PostgreSQL or a real JWT secret in those tests.
- Atomic `tokenVersion` increment in the repository (`UPDATE … SET token_version = token_version + 1`), not read-modify-write in the service.
- Apply auth only on `POST /auth/logout` in this change.

**Non-Goals:**

- Global auth on all `/auth` routes, HTTP integration tests beyond replacing the logout-404 assertion, Swagger, README, schema migration, refresh tokens, JWT denylist.

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/middleware/require-auth.ts` — read `Authorization`, require scheme `Bearer` and a non-empty token, `await authenticateAccessToken(token)`, assign `req.userId`, `next()`. Missing/non-Bearer → `next(new UnauthorizedError())`. Do not log the header or token. No Zod and no `process.env` in the middleware.
- HTTP: `src/http/routes/auth.ts` — `POST /logout` **after** `requireAuth`. Handler calls `logoutUser(req.userId)` and `res.status(204).end()`. Register and login stay unauthenticated and before this middleware.
- Service: `src/services/authenticate-access-token.ts` — `await verifyAccessToken` → load `{ id, tokenVersion }` by `userId` → equal versions → return `{ userId }`; otherwise `UnauthorizedError()`. Injectable deps.
- Service: `src/services/logout-user.ts` — `incrementTokenVersion(userId)`; log exactly `User logout successful: userId=<id>`; void return. If increment affects 0 rows → `UnauthorizedError()` (user vanished after auth). Injectable deps.
- Tokens: extend `src/services/access-token.ts` with `verifyAccessToken(token)` wrapping `jwt.verify` callback, `algorithms: ["HS256"]`, lazy `config.jwtSecret`. Map verify failures (including expiry) to `UnauthorizedError()` without putting the JWT or jwt error internals in logs.
- Repository: `findAuthById(id)` → `{ id, tokenVersion } | null` (select those columns only). `incrementTokenVersion(id)` → SQL/TypeORM increment by 1, return whether a row was updated. Keep `findAuthByEmail` for login.

**Почему:** слойность; unit-тесты сервиса покрывают «logout поднимает версию» и «старый tokenVersion отклоняется»; заголовок остаётся HTTP-деталью.

**Альтернатива:** вся проверка JWT в middleware без сервиса — тогда stale `tokenVersion` нельзя покрыть обязательными service-тестами. Отвергнуто.

**Альтернатива:** таблица сессий / denylist — вне скоупа; `tokenVersion` уже в схеме. Отвергнуто.

### 2. Express `Request.userId`

**Выбор:** module augmentation `Express.Request` с `userId?: string` (например `src/http/types.ts` imported from the middleware). Logout handler uses `req.userId` after `requireAuth`; if it is missing, throw `UnauthorizedError()` (defensive, should not happen).

**Почему:** пользователь требует `userId` на `req` для следующих хендлеров; optional поле не ломает публичные маршруты.

**Альтернатива:** `res.locals.userId` — тоже работает, но формулировка задания — `req`. Отвергнуто.

### 3. jwt.verify callback, HS256 only, claims shape

**Выбор:** `jwt.verify(token, secret, { algorithms: ["HS256"] }, callback)` обёрнут в Promise. После verify проверить, что payload — объект с непустым строковым `userId` и целым `tokenVersion` (`Number.isInteger`); иначе `UnauthorizedError()`. Не принимать `alg: none` и не использовать синхронный `jwt.verify` без callback.

**Почему:** тот же пакет и claims, что при login; явный HS256 закрывает algorithm confusion; callback не блокирует Event Loop ожиданием в стиле fire-and-forget sync HMAC на критическом пути без `await`.

**Альтернатива:** декодировать без verify (`jwt.decode`) — небезопасно. Отвергнуто.

Authenticate-сервис принимает `verifyAccessToken` в deps (default — реальный verifier), чтобы тесты stale version не зависели от секрета.

### 4. Increment, not session delete

**Выбор:** `UPDATE users SET token_version = token_version + 1 WHERE id = $userId` в repository. Logout не читает текущую версию в сервисе. Auth сравнивает claim с `findAuthById`. Новой миграции нет.

**Почему:** AGENTS.md / пользователь предпочли `tokenVersion`; колонка уже есть; инкремент атомарно инвалидирует все ранее выданные токены этой версии (для оценки достаточно одного access token).

**Альтернатива:** `tokenVersion = tokenVersion + 1` в памяти после `find` — гонка двух logout. Отвергнуто.

### 5. 204 empty body

**Выбор:** успешный logout — HTTP 204 и `end()` без JSON. Ошибки по-прежнему `{ error, statusCode }`.

**Почему:** задание не задаёт тело успеха; 204 не тащит `tokenVersion` в JSON.

**Альтернатива:** 200 `{}` — тоже валидно, лишний JSON. Отвергнуто в пользу 204.

### 6. Tests: node:test, mocked repository

**Выбор:**

- `src/services/logout-user.test.ts`: fake `incrementTokenVersion`; успех вызывает increment с `userId`, лог точно `User logout successful: userId=<id>`, лог без пароля/хэша/токена; 0 updated rows → `UnauthorizedError`.
- `src/services/authenticate-access-token.test.ts`: fake `verifyAccessToken` и `findAuthById`; совпадение версий → `{ userId }`; claim `tokenVersion` меньше/не равен БД → `UnauthorizedError`; пользователь не найден → `UnauthorizedError`; verify бросает/невалиден → `UnauthorizedError`. Обязательный сценарий «после increment старая версия отклоняется» можно собрать в одном тесте с in-memory version (logout затем authenticate со старым claim).

Заменить `POST /auth/logout returns 404` в `not-found.test.ts` на другой unavailable path (`POST /accounts`). Не поднимать PostgreSQL и не требовать полного HTTP round-trip login→logout в этом change (критерии «без Bearer — 401» и «после logout токен не проходит middleware» закрываются контрактом middleware + service tests; опциональный HTTP-тест не блокер).

### 7. Scope of middleware

**Выбор:** вешать `requireAuth` только на `POST /logout`, не на весь `authRouter` и не глобально на `app`.

**Почему:** register/login должны остаться без 401 за отсутствие Bearer; счетов ещё нет.

## Risks / Trade-offs

- **[Risk]** Логирование `err` из `jsonwebtoken` может содержать токен. **Mitigation:** не логировать raw token; на verify failure сразу `UnauthorizedError()` без `logger.error({ token })`. Pino уже redact `authorization` / `accessToken` / `jwt`.
- **[Risk]** Top-level import `config` в authenticate-модуле роняет unit-тесты без env. **Mitigation:** deps + lazy default load (как login); тесты всегда передают deps.
- **[Risk]** Синхронный `jwt.verify` без callback считает HMAC на Event Loop. **Mitigation:** только callback/`await`.
- **[Risk]** Тест `logout → 404` останется красным. **Mitigation:** заменить путь в `not-found.test.ts`.
- **[Risk]** Handler читает `req.userId` до middleware. **Mitigation:** порядок аргументов `requireAuth` затем handler.
- **[Trade-off]** Logout инвалидирует все access tokens этой версии, не только текущий JWT. Для одного access token без refresh это совпадает с заданием.
- **[Trade-off]** Нет обязательного HTTP-теста 401 без Bearer. Service + thin middleware; при apply можно добавить узкий HTTP-тест, если останется время, без счетов.

## Migration Plan

Locally: implement verify + repository increment + services + `requireAuth` + logout route → replace logout-404 test → `npm test` → `npm run build`. Schema unchanged; no `npm install`. Rollback: revert the change commit. Clients that treated `POST /auth/logout` as 404 must expect 401 without Bearer and 204 after a valid current token. After logout the previous `accessToken` is 401.

## Open Questions

Нет: Bearer, 401 vs 403 on version mismatch, `tokenVersion` increment, 204, and service-level tests are fixed above and in the specs.
