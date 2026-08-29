## Context

Registration already persists User with `passwordHash` and `tokenVersion`. `POST /auth/login` is still unknown-path 404 (`not-found.test.ts` asserts that). `JWT_SECRET` is optional and unused. `UnauthorizedError` already maps to 401. `findByEmail` returns `{ id, email }` only. Motivation: `proposal.md`. Contracts: deltas `user-login`, `http-runtime`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; no `process.env` in HTTP/services; async password compare only; no password/hash/JWT in JSON or logs; logout and auth middleware out of scope.

## Goals / Non-Goals

**Goals:**

- Thin `POST /auth/login` adapter; validation, compare, JWT sign, and logging in the service.
- Required `JWT_SECRET` plus token lifetime on the exported config object; services read `config`, never `process.env`.
- Repository lookup that can return hash + `tokenVersion` without those fields reaching the HTTP JSON.
- Injectable deps so `npm test` covers success and invalid credentials without PostgreSQL or real JWT signing.

**Non-Goals:**

- Verifying tokens, logout/`tokenVersion` increment, auth middleware, HTTP/integration tests beyond fixing the existing login-404 assertion, Swagger, README, schema migration.

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/routes/auth.ts` — add `POST /login` next to register. Handler passes `req.body` into the service and `res.status(200).json({ accessToken })`. No Zod and no `process.env` in the route.
- Service: `src/services/login-user.ts` — validate, lookup credentials, `await comparePassword`, `await signAccessToken({ userId, tokenVersion })`, `logger.info("User login successful: userId=" + userId)`, return `{ accessToken }`.
- Hasher: extend `src/services/password-hasher.ts` with `comparePassword(plaintext, passwordHash)` using `await bcrypt.compare` (`compareSync` forbidden).
- Tokens: `src/services/access-token.ts` — sign HS256 JWT from `config.jwtSecret` and `config.jwtExpiresIn`.
- Repository: add `findAuthByEmail` returning `{ id, passwordHash, tokenVersion } | null`. Keep existing `findByEmail` as `{ id, email }` for registration.

**Почему:** слойность и unit-тесты сервиса; регистрация не должна начать таскать хэш в public-типе.

**Альтернатива:** один `findByEmail` со всеми полями — легче случайно отдать хэш в JSON. Отвергнуто.

### 2. jsonwebtoken, claims `userId` + `tokenVersion`, HS256

**Выбор:** пакет `jsonwebtoken` + `@types/jsonwebtoken`. Payload `{ userId, tokenVersion }` (не `sub`). Algorithm default HS256. Sign through the callback API wrapped in a Promise so the service `await`s; never fire-and-forget sync `jwt.sign` without a callback. No refresh token, no `jsonwebtoken` verify in this change.

**Почему:** задание требует именно этих claim names для будущего logout; HS256 достаточно при секрете на сервере.

**Альтернатива:** `jose` (WebCrypto async) — чище относительно Event Loop, лишняя смена стека для J3. Отвергнуто.

**Альтернатива:** claim `sub` вместо `userId` — не совпадает с формулировкой задания. Отвергнуто.

Сервис принимает `signAccessToken` в deps (default — реальный signer), чтобы тесты не зависели от секрета.

### 3. JWT_SECRET required; TTL constant on config

**Выбор:** в `env.ts` `JWT_SECRET` — обязательная непустая строка (`trim().min(1)`), экспорт `jwtSecret`. Срок жизни — константа на том же объекте, например `jwtExpiresIn: "1h"`, не отдельная env-переменная. HTTP/services читают только `config`. `.env.example` документирует обязательный `JWT_SECRET` (без реального секрета в git).

**Почему:** пользователь указал секрет как `JWT_SECRET`; TTL всё равно из валидированного конфига, без раздувания env. Пустой секрет больше не даёт стартовать процесс.

**Альтернатива:** `JWT_EXPIRES_IN` в env — гибче, не нужно для оценки. Отвергнуто, пока не попросили.

`login-user` и `access-token` не импортируют `config` на верхнем уровне: секрет подставляется в `loadDefaultDeps` / внутри signer function (как динамический import репозитория в register), чтобы unit-тесты с инжектом deps не грузили env.

### 4. Same 401 for unknown email and wrong password; dummy compare

**Выбор:** оба случая `throw new UnauthorizedError()` (дефолтное сообщение `"Unauthorized"` → mapper 401). Перед throw для неизвестного email всё равно `await comparePassword` против константного dummy bcrypt-хэша, чтобы не отличаться по времени от неверного пароля. `signAccessToken` не вызывается. Сообщение не содержит «user not found» / «invalid password».

**Почему:** spec запрещает enumeration; dummy compare закрывает грубый timing leak.

**Альтернатива:** сразу 401 без compare, если пользователя нет — проще, но быстрее отвечает на неизвестный email. Отвергнуто.

### 5. Login validation vs credentials

**Выбор:** Zod в сервисе: email trim + lowercase + `email()`; password `string().min(1)` (пустой → 400). Нет `min(8)` на логине: короткий пароль при существующем email идёт в compare и даёт 401, не 400. Невалидный email / нет полей → `ValidationError` (400), репозиторий не вызывается.

**Почему:** таблица ошибок проекта: валидация 400, неверные credentials 401. Criteria «невалидные данные — 401» относятся к credentials, не к сломанному JSON-телу.

**Альтернатива:** любой провал логина как 401 — смешивает валидацию с auth и ломает единообразие с register. Отвергнуто.

### 6. Tests: node:test, mocked repository

**Выбор:** `src/services/login-user.test.ts`. Fake `users.findAuthByEmail`, `comparePassword`, `signAccessToken`, logger. Обязательные случаи:

- успех: compare true; `signAccessToken` вызван с `{ userId, tokenVersion }`; результат `{ accessToken }` only; лог точно `User login successful: userId=<id>`; лог без пароля/хэша/токена
- неверный пароль: compare false → `UnauthorizedError`; sign не вызван
- неизвестный email: `UnauthorizedError` с тем же классом/смыслом; sign не вызван

Валидация тела — желательно тем же файлом (400 без репозитория), не вместо двух обязательных кейсов.

Удалить или заменить тест `POST /auth/login returns 404` в `not-found.test.ts` на другой unavailable path (`POST /auth/logout`), иначе `npm test` красный. Не поднимать PostgreSQL и не проверять подпись JWT в HTTP в этом change.

### 7. No schema migration

**Выбор:** таблица `users` уже имеет `token_version`. Новых миграций нет. `findAuthByEmail` делает `select` id / passwordHash / tokenVersion.

**Почему:** spec postgres-typeorm не меняется на уровне схемы.

## Risks / Trade-offs

- **[Risk]** После обязательного `JWT_SECRET` локальный `.env` с пустым значением валит старт. **Mitigation:** обновить `.env.example`; в apply напомнить заполнить `.env`.
- **[Risk]** Импорт `config` на top-level из login-модуля роняет unit-тесты, если секрет пустой. **Mitigation:** deps + lazy default load; тесты всегда передают deps.
- **[Risk]** `jwt.sign` без callback считает HMAC на Event Loop. **Mitigation:** только callback/`await`; HMAC не bcrypt-уровня. Не использовать `compareSync`/`hashSync`.
- **[Risk]** Вернуть сущность User в JSON — утечка хэша/`tokenVersion`. **Mitigation:** сервис возвращает только `{ accessToken }`; тесты проверяют ключи.
- **[Risk]** Разные 401 messages → enumeration. **Mitigation:** один `UnauthorizedError()` без аргументов.
- **[Trade-off]** Dummy compare на неизвестный email тратит ~bcrypt cost даже для опечаток. Приемлемо для оценки и anti-enumeration.
- **[Trade-off]** TTL зашит `"1h"` в config, не в env. Меняется одним местом; отдельная переменная не нужна, пока не попросили.

## Migration Plan

Locally: `npm install` (jsonwebtoken) → set non-empty `JWT_SECRET` in `.env` → implement service/repo/route → replace login-404 test → `npm test` → `npm run build`. Rollback: revert the change commit; schema unchanged. Clients that treated `POST /auth/login` as 404 must expect 200/400/401. Process start now requires `JWT_SECRET`.

## Open Questions

Нет: 400 vs 401, claim names, HS256, TTL `"1h"`, dummy compare, and `jsonwebtoken` are fixed above and in the specs.
