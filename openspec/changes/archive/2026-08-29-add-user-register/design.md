## Context

HTTP already parses JSON, maps `ValidationError` → 400 and `ConflictError` → 409, and 404s unknown paths. `AppDataSource` has `synchronize: false`, `entities: []`, and a no-op first migration. `src/entities`, `src/services`, and `src/repositories` are empty. Motivation: `proposal.md`. Contracts: deltas `user-registration`, `http-runtime`, `postgres-typeorm`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; async hashing only; no password/hash/`tokenVersion` in JSON or logs; login/JWT/Swagger/README out of scope.

## Goals / Non-Goals

**Goals:**

- Thin `POST /auth/register` adapter; all validation, hashing, uniqueness, and logging in the service.
- User entity + TypeORM migration for `users`; DataSource registers User; `synchronize` stays false.
- Injectable repository and hasher so `npm test` covers success / duplicate email / validation without PostgreSQL.
- Persist hash + `tokenVersion` (default 0) without exposing them.

**Non-Goals:**

- `compare`/login, JWT middleware, `tokenVersion` increment, HTTP/integration tests, Swagger, README, seed.
- Changing existing error mapper table (409 already maps `ConflictError`).

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/routes/auth.ts` — `POST /register`, `app.use("/auth", authRouter)` **before** `notFound`. Handler passes `req.body` into the service and `res.status(201).json({ id, email })`. No Zod in the route. Express 5 forwards async rejections to `errorHandler`.
- Service: `src/services/register-user.ts` — validate, `await hashPassword`, persist, `logger.info("User registered: email=" + email)`, return `{ id, email }`.
- Hasher: `src/services/password-hasher.ts` — `await bcrypt.hash(plaintext, 10)` only (`hashSync` forbidden).
- Repository: `src/repositories/user-repository.ts` — `findByEmail`, `insert`; wraps TypeORM, never imported from HTTP.
- Entity: `src/entities/user.ts`. DataSource `entities: [User]`.

**Почему:** спека и слойность требуют, чтобы TypeORM не жил в HTTP/service, а unit-тесты били сервис.

**Альтернатива:** валидация только в HTTP — тогда service-тесты не покрывают 400. Отвергнуто (tasks требуют validation на сервисе).

### 2. bcrypt, not argon2; cost 10; password 8–72

**Выбор:** пакет `bcrypt` + `@types/bcrypt`. Только `bcrypt.hash` (Promise / callback), cost **10**. Zod: password `min(8)` (spec) and `max(72)` (bcrypt truncates beyond 72 bytes). Never `bcrypt.hashSync`.

**Почему:** задание разрешает bcrypt или argon2; bcrypt.hash уходит в libuv threadpool и не крутит CPU на Event Loop. Cost 10 — обычный баланс для оценки.

**Альтернатива:** argon2 — тоже async native; лишняя смена стека без выигрыша для J3. Отвергнуто.

**Альтернатива:** `bcryptjs` — ставится без native, но «async» хэш часто считает на main thread. Отвергнуто, пока `bcrypt` ставится. Если native build на Windows падает — зафиксировать в apply и тогда рассмотреть `@node-rs/bcrypt` (prebuilds), не `hashSync`.

Сервис принимает `hashPassword` в deps (default — реальный hasher), чтобы тесты не ждали bcrypt.

### 3. Email normalize + unique column

**Выбор:** trim + lowercase до uniqueness и persist. Column `email` `varchar(255)` **UNIQUE**. Zod `email()` after normalize. `A@x.com` and `a@x.com` collide → 409.

**Почему:** unique без нормализации даёт два «одинаковых» ящика; spec требует case-normalizing.

**Альтернатива:** unique index on `LOWER(email)` without normalizing writes — сложнее для lookup на login. Отвергнуто.

### 4. Uniqueness: lookup + DB constraint

**Выбор:** service `findByEmail` → if exists `throw new ConflictError()` (default message `"Email already taken"`). `insert` maps PostgreSQL `23505` / TypeORM unique failure to `ConflictError` so a race still 409. Unique constraint is source of truth.

**Почему:** тесты мокают `findByEmail`; гонка не даёт 500.

**Альтернатива:** только 23505 — unit-тест должен эмулировать драйвер. Хуже. Отвергнуто как единственный путь.

Репозиторий **не** бросает HTTP; только `ConflictError`.

### 5. Entity columns vs JSON

**Выбор:** table `users`:

| DB | Entity | API |
|---|---|---|
| `id` UUID PK `gen_random_uuid()` / `@PrimaryGeneratedColumn("uuid")` | `id: string` | yes |
| `email` unique | `email` | yes |
| `password_hash` varchar | `passwordHash` | never |
| `token_version` int NOT NULL DEFAULT 0 | `tokenVersion` | never |
| `created_at` timestamptz | `createdAt` `@CreateDateColumn` | never |

`insert` returns `{ id, email }` only. Service never `JSON.stringify`s the entity. No class-transformer.

**Почему:** колонка не называется `password`, меньше шанс отдать plaintext-looking field; `tokenVersion` готов к logout.

**Альтернатива:** колонка `password` как в модели задания — допустима, но легче случайно включить в объект ответа. Отвергнуто.

### 6. Validation lives in the service

**Выбор:** Zod schema in the service (or `src/services/register-user.schema.ts`). Failure → `ValidationError` (existing mapper → 400). Input type `unknown`. Extra keys stripped (Zod default), not 400.

**Почему:** spec фиксирует missing fields, invalid email, password shorter than 8. HTTP остаётся адаптером.

### 7. Tests: node:test, mocked repository

**Выбор:** `src/services/register-user.test.ts` via existing `tsx --test`. Fake `users` + `hashPassword` (+ optional logger). Cases:

- success: `insert` called with `passwordHash` from hasher (not plaintext); result `{ id, email }` only; log `User registered: email=...`
- email taken: `findByEmail` returns a user → `ConflictError`; `insert` not called
- validation: missing/invalid email, short password → `ValidationError`; repo unused

Do not start Express or PostgreSQL in this change. Do not add `compare` tests.

### 8. Migration workflow

**Выбор:** add entity, register on DataSource, then `npm run migration:generate -- migrations/CreateUsers` (or equivalent timestamped name). Do **not** edit the no-op `InitialSchema`. Keep `synchronize: false`, `migrationsRun: false`.

**Почему:** postgres-typeorm already documents generate after entities exist.

## Risks / Trade-offs

- **[Risk]** Native `bcrypt` fails to install on Windows. **Mitigation:** try install in apply; if it fails, switch to a prebuilt async bcrypt (`@node-rs/bcrypt`) without `hashSync`.
- **[Risk]** Unique race without 23505 mapping → 500. **Mitigation:** map unique violation in the repository.
- **[Risk]** Returning the entity leaks `passwordHash`/`tokenVersion`. **Mitigation:** repository returns `{ id, email }`; tests assert keys.
- **[Risk]** Sync hash slips in. **Mitigation:** grep `hashSync` / `pbkdf2Sync` / `scryptSync`; only `await bcrypt.hash`.
- **[Risk]** Logging `{ user }` or `req.body`. **Mitigation:** string message only; existing pino redact as backstop.
- **[Trade-off]** Password max 72 is bcrypt-specific, not in the assignment text. Needed so bcrypt does not silently truncate. Spec still only requires min 8.
- **[Trade-off]** No HTTP test for 201 — spec is HTTP-visible; this change verifies via service + thin handler. A later auth change can add supertest.

## Migration Plan

Locally: `npm install` (bcrypt) → entity + DataSource → `migration:generate` / review SQL → `migration:run` → `npm test` → `npm run build`. Rollback code: revert the change commit. Rollback schema: `migration:revert` (drops `users`). Existing health clients unchanged; clients that treated `POST /auth/register` as 404 must expect 201/400/409.

## Open Questions

Нет: min password 8, case-fold email, bcrypt cost 10, and `tokenVersion` default 0 are fixed above and in the specs.
