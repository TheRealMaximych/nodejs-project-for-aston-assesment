## Context

HTTP app (`src/http/app.ts`) mounts JSON parser, `GET /health`, `/auth`, `/accounts`, `/transactions`, then unknown-path 404 and the domain-error mapper. There is no OpenAPI document or Swagger UI; `GET /api-docs` is currently 404. Zod schemas live in **services**, not HTTP. Motivation: `proposal.md`. Contracts: deltas `openapi-swagger`, `http-runtime`.

Constraints: TypeORM stays out of HTTP; no new domain routes; no README; no migrations; JWT secret must not appear in the document.

## Goals / Non-Goals

**Goals:**

- Mount Swagger UI at `/api-docs` without `requireAuth`.
- One OpenAPI 3 document in the HTTP layer that matches existing route contracts (including `GET /health`) and the uniform `{ error, statusCode }` error schema.
- A unit test that inspects the document object (paths, error schema, Bearer on protected ops) without PostgreSQL.

**Non-Goals:**

- Generating OpenAPI from Zod (schemas stay in services; no DTO extraction in this change).
- Changing handlers, services, repositories, seed, or README.
- Serving a separately advertised public URL such as `/openapi.json` (the UI may load the spec internally).
- HTTP/browser integration tests against a live server.

## Decisions

### 1. Library: `swagger-ui-express` + typed OpenAPI object

**Выбор:** dependencies `swagger-ui-express` (Express 5 peer is already supported) and `@types/swagger-ui-express`. Document is a TypeScript `OpenAPIV3.Document` (types from `openapi-types` if needed for `strict`). Mount:

```ts
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
```

before `notFound`. No `requireAuth` on this path.

**Почему:** стандартный UI для оценки; путь `/api-docs` фиксируется спекой; статические ассеты UI остаются под префиксом `/api-docs`.

**Альтернатива:** `swagger-jsdoc` + JSDoc на роутерах — дублирует контракты и легко расходится с Zod. Отвергнуто.

**Альтернатива:** YAML-файл — нет проверки структуры компилятором. Отвергнуто.

**Альтернатива:** `@asteasolutions/zod-to-openapi` из service-схем — тянет генерацию доков в services или требует выноса DTO. Вне скоупа. Отвергнуто.

**Альтернатива:** `swagger-ui-dist` вручную + `GET /openapi.json` — больше кода и лишний публичный JSON-URL. Запасной путь только если `swagger-ui-express` не соберётся со `strict`/Express 5 (cast middleware to compatible Express types if needed).

### 2. Document location and layering

**Выбор:** `src/http/openapi/document.ts` exporting the spec object. `src/http/app.ts` only mounts UI. No TypeORM, no `process.env`, no JWT secret in the document. Example `accessToken` if present MUST be a non-secret placeholder (e.g. empty description, not a real JWT).

**Почему:** документация — HTTP-контракт; бизнес-логика не меняется.

**Альтернатива:** JSDoc в `routes/*.ts` — смешивает описание с хендлерами. Отвергнуто.

### 3. OpenAPI content

**Выбор:** OpenAPI **3.0.x**. Shared component `ErrorResponse`: required `error` (string) + `statusCode` (integer). Security scheme `bearerAuth`: HTTP bearer, JWT. Apply it only to logout, accounts, balance, transfer, history.

Per-operation responses (no extra 4xx):

| Operation | Success | Errors |
|---|---|---|
| `GET /health` | 200 `{ status: ok }` | none required |
| `POST /auth/register` | 201 `{ id, email }` | 400, 409 |
| `POST /auth/login` | 200 `{ accessToken }` | 400, 401 |
| `POST /auth/logout` | 204 empty | 401 |
| `POST /accounts` | 201 account object | 400, 401 |
| `GET /accounts/{id}/balance` | 200 `{ balance }` string | 400, 401, 403, 404 |
| `POST /transactions` | 201 `{ transactionId, status }` | 400 (incl. example `"Insufficient funds"`), 401, 403, 404 |
| `GET /transactions/{accountId}` | 200 history array | 400, 401, 403, 404 |

Money fields: `type: string`. `status` enum `Completed` \| `Failed` on history; transfer success `Completed`. Do not add `GET /accounts`, deposit, refresh, or other missing routes. Do not document 500 on every operation (unhandled; already in `http-runtime`).

**Почему:** совпадает с AGENTS.md и существующими specs; «где применимо» — не копировать 403/404 на register.

### 4. Tests

**Выбор:** `src/http/openapi/document.test.ts` (`node:test` like existing service tests) asserting: required path+method keys exist; `GET /accounts` list and deposit paths are absent; `ErrorResponse` has `error` + `statusCode`; protected ops have `security`; `amount`/`balance` are strings; transfer 400 example is `{ error: "Insufficient funds", statusCode: 400 }`. No new service tests. `npm test` and `npm run build` must pass.

**Почему:** критерий покрытия документа проверяется без БД и без браузера.

**Альтернатива:** supertest `GET /api-docs` — полезно, но требует поднимать app; не обязателен, если unit документа зелёный. Ручная проверка UI локально.

### 5. README and config

**Выбор:** не менять README. Не добавлять env vars. `synchronize` остаётся выключенным; миграций нет.

## Risks / Trade-offs

- **[Risk]** Документ расходится с хендлерами. **Mitigation:** unit-тест обязательных paths/схем; контракты копируются из существующих specs, не из памяти.
- **[Risk]** Реальный JWT в `example`. **Mitigation:** не вставлять signed tokens; описание Bearer без значения секрета.
- **[Risk]** `swagger-ui-express` types vs Express 5. **Mitigation:** `serve`/`setup` с узким type assertion если `@types` отстают; fallback `swagger-ui-dist` only if compile fails.
- **[Risk]** `GET /api-docs` vs `/api-docs/`. **Mitigation:** mount at `/api-docs` so both the prefix and trailing slash served by the library work; unknown other paths stay 404.
- **[Trade-off]** Ручной OpenAPI не генерируется из Zod — приемлемо для восьми операций; меньше связности слоёв.

## Migration Plan

Locally: `npm install swagger-ui-express` (+ types) → add document + mount → `npm test` / `npm run build`. Manual: start app, open `/api-docs`, confirm operations and Authorize Bearer. Rollback: remove mount and dependency; no DB revert. Clients: domain JSON unchanged; only `/api-docs` stops being 404.

## Open Questions

None: UI path `/api-docs`, public access, hand-written OpenAPI 3, and README-out-of-scope are fixed.
