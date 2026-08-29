## Context

`src/http/app.ts` mounts JSON parser, domain routers, Swagger at `/api-docs`, then `notFound` / `errorHandler`. `GET /` currently hits unknown-path 404. There is no `public/` directory. README already documents Compose, migrate, seed, `dev`, JWT, and `/api-docs`. Motivation: `proposal.md`. Contracts: deltas `api-check-ui`, `http-runtime`, `runbook-readme`.

Constraints: HTTP → service → repository unchanged; TypeORM stays out of HTTP; money never IEEE `number`; no `process.env` in HTTP/services; no new domain routes; OpenAPI document unchanged.

## Goals / Non-Goals

**Goals:**

- Serve one static check page at `GET /` from the same Express process, with vanilla JS `fetch` to existing REST paths.
- Keep Bearer only in page memory; attach it to protected forms; clear it after logout 204.
- Show HTTP status and raw body (including 204 empty and `{ error, statusCode }`).
- One README line with the UI URL.

**Non-Goals:**

- Changing handlers, services, repositories, migrations, seed, or OpenAPI schemas.
- A frontend framework, bundler, CORS, second port, or UI unit tests.
- Copying static files into `dist/` or documenting architecture.

## Decisions

### 1. Static files via `express.static`, after API routes

**Выбор:** каталог `public/` в корне репозитория. В `app.ts` после `/api-docs` и до `notFound`:

```ts
app.use(express.static(path.join(__dirname, "..", "..", "public")));
```

`index: true` (дефолт) отдаёт `index.html` на `GET /`. Fallthrough по умолчанию: неизвестный путь без файла → `notFound`. `requireAuth` на статику не вешать. Новых npm-пакетов нет.

**Почему:** `__dirname` указывает на `src/http` при `tsx` и на `dist/http` после `tsc`; `../..` — корень репо, `public/` не копируется в `dist`. Маршруты `/health`, `/auth`, `/accounts`, `/transactions`, `/api-docs` регистрируются раньше и не перекрываются.

**Альтернатива:** `process.cwd() + "/public"` — ломается, если процесс стартовали не из корня. Отвергнуто.

**Альтернатива:** отдельный `GET /` handler, читающий файл через `fs` — лишний sync/async I/O в хендлере; `express.static` уже решает caching/MIME. Отвергнуто.

**Альтернатива:** смонтировать статику первой — риск тени файла над API, если появится `public/health`. Порядок «API, потом static» безопаснее.

### 2. One HTML document, no bundler

**Выбор:** один документ `public/index.html` с небольшим встроенным CSS и одним встроенным `<script>` (vanilla JS). При необходимости вынести скрипт в `public/check.js` тем же `express.static` без bundler. Без React/Vue/Vite/Webpack, без CSS-фреймворка.

**Почему:** критерий — максимально простая обвязка; отдельный TS-бандл UI запрещён запросом.

**Альтернатива:** SPA с клиентским роутингом — продукт, не check-page. Отвергнуто.

### 3. Same-origin `fetch`, no CORS

**Выбор:** относительные URL (`/health`, `/auth/login`, …). `Content-Type: application/json` на POST с телом. Для GET — без тела.

**Почему:** UI и API на одном origin; CORS не нужен.

**Альтернатива:** хардкод `http://localhost:3000` — ломается при другом `PORT`. Отвергнуто.

### 4. Shared request helper: status + text, then optional pretty JSON

**Выбор:** один хелпер: `fetch` → `response.status` + `response.text()`. Если текст пустой (204), показать status и пометку empty body. Если текст парсится как JSON — `JSON.stringify(parsed, null, 2)` в `<pre>`. Ошибка `fetch` (сеть) — видимый текст в том же блоке ответа, не `console`-only. Не использовать только `response.json()` (упадёт на 204).

**Почему:** спека требует видимый status и сырое тело; тихий fail запрещён.

**Альтернатива:** полагаться на `response.ok` и глотать 4xx — скрывает `{ error, statusCode }`. Отвергнуто.

### 5. Token in a page-scoped variable

**Выбор:** `let accessToken = null`. После login, если HTTP 200 и JSON содержит непустой `accessToken` (строка), записать в переменную. Пока переменная задана, logout / accounts / balance / transfer / history добавляют `Authorization: Bearer ${accessToken}`. Health / register / login — без этого заголовка. После logout с HTTP 204: `accessToken = null`. `localStorage` не использовать. Не логировать токен/`password` через `console.log` и не слать их на отдельные серверные лог-эндпоинты (их нет).

**Почему:** спека явно допускает память JS; после reload токен пропадает — приемлемо для check-page. Сервер по-прежнему инвалидирует JWT через `tokenVersion` на logout.

**Альтернатива:** `localStorage` — удобнее между перезагрузками, но не требуется и увеличивает риск оставить JWT в диске. Опционально, не делаем.

### 6. Amount field is text; JSON string

**Выбор:** поле `amount` — `<input type="text">` (не `type="number"`). В теле: `{ fromAccount, toAccount, amount }` где `amount` — строка из input as-is (например `"10.50"`). Не `Number(...)` / `parseFloat`.

**Почему:** контракт перевода — decimal string; `type="number"` даёт JSON number.

### 7. Placeholders from seed; no list-accounts API

**Выбор:** placeholder email `alice.demo@example.com`, пароль `DemoPass12`. Для `id` / `accountId` / `fromAccount` / `toAccount` — UUID-подсказка; допустимо подставить фиксированные seed UUID из `seeds/demo.ts` (Alice `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, Bob `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`) как hint «перевод на чужой seed-счёт». Поля остаются редактируемыми. Ссылка `<a href="/api-docs">` на Swagger. Кнопки Send. Язык подписей — русский; имена полей JSON — как в контракте.

**Почему:** acceptance — login demo-юзером и перевод на чужой seed-счёт без нового API списка счетов.

**Альтернатива:** `GET /accounts` для подстановки id — запрещённый доменный эндпоинт. Отвергнуто.

### 8. OpenAPI document stays unchanged

**Выбор:** не добавлять `GET /` в `src/http/openapi/document.ts`. Публичность UI фиксируется `http-runtime` + `express.static`, как HTML у `/api-docs` уже описан отдельно от JSON-операций.

**Почему:** пользователь запретил менять OpenAPI-схемы, кроме того чтобы путь UI не был 404/401; это не операция предметной области. Существующий `document.test.ts` остаётся зелёным.

**Альтернатива:** описать `GET /` в OpenAPI как HTML — раздувает документ и не помогает оценке API. Отвергнуто.

### 9. README: one URL line

**Выбор:** в секции старта API (рядом с `/health` и `/api-docs`) одна строка: проверка API в браузере — `http://localhost:3000/` при `PORT=3000`. Без описания слоёв и без SPA.

**Почему:** delta `runbook-readme`; остальной runbook уже есть.

### 10. Tests

**Выбор:** не добавлять `public/**/*.test.ts` и не поднимать Playwright. Проверка UI — ручной чеклист в tasks (health → login → счёт / баланс / перевод / история → logout → 401). `npm test` и `npm run build` должны остаться 0.

**Почему:** unit-тесты в проекте — service-слой; фронтовых тестов в запросе нет.

## Risks / Trade-offs

- **[Risk]** `GET /` перехватывает будущий «корневой» API. **Mitigation:** доменных маршрутов на `/` нет; health остаётся `/health`.
- **[Risk]** Статика перекрывает неизвестный путь только если появится одноимённый файл. **Mitigation:** в `public/` только check-page файлы; не класть `health`, `auth`, `accounts`.
- **[Risk]** JWT в памяти JS виден в DevTools. **Mitigation:** это локальный check-page, не продукт; не persist; сервер не логирует токен из UI.
- **[Risk]** Placeholder UUID seed разойдётся, если seed изменят. **Mitigation:** поля редактируемые; README по-прежнему указывает, что `accountId` печатает seed-лог.
- **[Trade-off]** Reload страницы сбрасывает токен — нужно снова login. Приемлемо.
- **[Trade-off]** Нет клиентской валидации «как в банке» — ошибки видны как JSON API. Это цель.

## Migration Plan

Implement: add `public/index.html` → mount `express.static` in `app.ts` → one README line → `npm test` / `npm run build`. No DB migration. Rollback: remove `public/`, static middleware, and the README line; API contracts unchanged.

## Open Questions

None: `GET /` from `public/`, in-memory Bearer, amount as string, no OpenAPI edit, no UI tests.
