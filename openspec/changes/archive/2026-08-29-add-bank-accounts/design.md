## Context

Auth middleware (`requireAuth`), JWT `userId` on `req`, and domain errors (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`) already map to 400/401/403/404. DataSource registers only `User`; schema is migration-only (`synchronize: false`). `not-found.test.ts` still treats `POST /accounts` as unknown-path 404. There is no BankAccount entity, repository, or `/accounts` router. Motivation: `proposal.md`. Contracts: deltas `bank-accounts`, `http-runtime`, `postgres-typeorm`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; money never IEEE `number`; no `process.env` in HTTP/services; no transfers, seed, deposit, or Swagger.

## Goals / Non-Goals

**Goals:**

- Thin `/accounts` adapter: `requireAuth`, pass `req.userId` + body/`id` into services, JSON with `balance` as string.
- BankAccount entity + TypeORM migration; DataSource registers it; `synchronize` stays false.
- Injectable account repository so `npm test` covers create, own balance, foreign 403, missing 404 without PostgreSQL.
- Persist `numeric` balance as application `string`; opening balance always zero.

**Non-Goals:**

- Transfer/history services, Transaction table, seed rows, deposit route, HTTP integration against a live DB, Swagger, README.
- Currency allowlist of assigned ISO codes (format `AAA` only).
- `decimal.js` or other money library.

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/routes/accounts.ts` — `POST /` and `GET /:id/balance`, both `requireAuth`; `app.use("/accounts", accountsRouter)` **before** `notFound`. Create handler: missing `req.userId` → `UnauthorizedError()`; `createBankAccount(userId, req.body)` → `res.status(201).json({ id, accountHolder, balance, currency })`. Balance handler: `getAccountBalance({ userId, accountId: req.params.id })` → `res.status(200).json({ balance })`. No Zod and no TypeORM in the routes.
- Service: `src/services/create-bank-account.ts` — validate body, persist with `userId` from the argument (never from body), log exactly `Account created: accountId=<id>, userId=<userId>`, return public fields. Injectable deps.
- Service: `src/services/get-account-balance.ts` — validate UUID `accountId`, `findById`, missing → `NotFoundError()`, `userId` mismatch → `ForbiddenError()`, else `{ balance }`. Injectable deps.
- Repository: `src/repositories/bank-account-repository.ts` — `insert({ accountHolder, currency, userId })` always stores opening balance `"0.00"`; `findById(id)` returns `{ id, accountHolder, balance, currency, userId } | null` with `balance: string`.
- Entity: `src/entities/bank-account.ts`. DataSource `entities: [User, BankAccount]`.

**Почему:** слойность; 403 vs 404 живёт в сервисе (lookup по id, затем owner); unit-тесты мокают репозиторий.

**Альтернатива:** `findByIdAndUserId` и 404 на чужой счёт — нарушает спеку (чужой = 403). Отвергнуто.

**Альтернатива:** один сервис-модуль на оба действия — хуже для узких тестов. Отвергнуто.

### 2. Money: PostgreSQL `numeric(20, 2)` + TypeScript `string`

**Выбор:** колонка `balance numeric(20, 2) NOT NULL DEFAULT 0` (не `float`/`double precision`/`real`). Entity field `balance: string` with a column transformer that `String()`s driver values on read and writes the string as-is. Repository and JSON always expose `string`. Canonical opening value `"0.00"`. Do not `parseFloat` / `Number()` the balance.

**Почему:** критерий «не IEEE float»; `pg` + TypeORM `numeric` и так часто отдаёт string, transformer фиксирует тип; scale 2 достаточно до переводов; без нового пакета.

**Альтернатива:** `decimal.js` — лишняя зависимость при нулевых суммах. Отвергнуто до этапа переводов.

**Альтернатива:** JSON number — запрещено спекой. Отвергнуто.

### 3. Table, FK, multiple accounts

**Выбор:** table `bank_accounts`:

| DB | Entity | API |
|---|---|---|
| `id` UUID PK `gen_random_uuid()` | `id: string` | yes |
| `account_holder` varchar(255) | `accountHolder` | yes |
| `balance` numeric(20,2) default 0 | `balance: string` | yes (string) |
| `currency` char(3) | `currency` | yes |
| `user_id` UUID FK → `users.id` ON DELETE RESTRICT, index | `userId` | never |
| `created_at` timestamptz | `createdAt` | never |

No unique constraint on `user_id` (несколько счетов). `ManyToOne` User only for the FK mapping; services never load the User graph. `insert` returns `{ id, accountHolder, balance, currency }` only (no `userId`/`createdAt`).

**Почему:** модель задания; FK не даёт сирот; index для будущих выборок по владельцу.

**Альтернатива:** ON DELETE CASCADE — молча сносит счета при удалении user, удаления user нет в API. RESTRICT проще рассуждать. Выбрано RESTRICT.

### 4. Currency and accountHolder validation in the service

**Выбор:** Zod in `create-bank-account`: `accountHolder` trim, min 1, max 255; `currency` trim + uppercase + `/^[A-Z]{3}$/` (ISO 4217 *format*, not an assigned-code table). Extra keys stripped (Zod default), so client `userId` / `balance` cannot set owner or opening amount. Failure → `ValidationError`. `get-account-balance`: `accountId` via `z.uuid()`; invalid → `ValidationError` (400), not 404.

**Почему:** спека требует uppercase ISO 4217 и 400 на пустой holder / кривую валюту / не-UUID; валидация на сервисе покрывается unit-тестами.

**Альтернатива:** полный ISO-справочник валют — вне задания, хрупко. Отвергнуто.

### 5. Ownership check order

**Выбор:** `findById(accountId)` without filtering by `userId`. `null` → `NotFoundError`. Else if `account.userId !== requesterUserId` → `ForbiddenError`. Else return balance.

**Почему:** иначе чужой счёт неотличим от отсутствующего (404), а задание и speка требуют 403.

### 6. Tests: node:test, mocked repository

**Выбор:**

- `src/services/create-bank-account.test.ts`: fake `insert`; success calls insert with `userId` from the argument (not body), `accountHolder`, uppercase currency, and does not pass a client balance; result keys only public fields; `balance` is string `"0.00"` (or equivalent zero string); log exactly `Account created: accountId=..., userId=...` without password/hash/JWT; missing/empty holder, invalid currency → `ValidationError` and insert unused; two creates with same `userId` both call insert.
- `src/services/get-account-balance.test.ts`: fake `findById`; own account → `{ balance }` string; other `userId` → `ForbiddenError`; `null` → `NotFoundError`; non-UUID id → `ValidationError` without calling find.

Replace `POST /accounts returns 404` in `not-found.test.ts` with `POST /transactions`. Add `POST /accounts` without `Authorization` → 401 `{ error, statusCode }` (same style as logout). Do not start PostgreSQL.

### 7. Migration workflow

**Выбор:** add entity, register on DataSource, then generate `migrations/1700000002000-CreateBankAccounts.ts` (or `npm run migration:generate` and keep the timestamped file). Do **not** edit `InitialSchema` or `CreateUsers`. Keep `synchronize: false`, `migrationsRun: false`.

**Почему:** postgres-typeorm already documents generate after entities exist; users table must exist first for the FK.

## Risks / Trade-offs

- **[Risk]** TypeORM/`pg` отдаёт `numeric` как string, но transformer забыт → где-то уйдёт `number`. **Mitigation:** transformer + tests assert `typeof balance === "string"`; grep `parseFloat`/`Number(` on balance.
- **[Risk]** `find({ where: { id, userId } })` случайно даст 404 на чужой счёт. **Mitigation:** repository only `findById`; ownership only in `get-account-balance`.
- **[Risk]** Handler кладёт `req.body.userId` в insert. **Mitigation:** service signature `(userId, body)`; tests assert insert userId from first argument.
- **[Risk]** Тест `POST /accounts` → 404 останется красным. **Mitigation:** заменить путь на `/transactions`; добавить 401 без Bearer.
- **[Risk]** `res.json({ balance: 0 })` сериализует JSON number. **Mitigation:** never coerce; return repository string.
- **[Trade-off]** Currency — только формат `AAA`, не реестр ISO. Для оценки достаточно; невалидный `"usd"` нормализуется в `"USD"`.
- **[Trade-off]** Opening `"0.00"` vs `"0"`: фиксируем `"0.00"` под `numeric(20,2)` чтобы тесты были стабильны.

## Migration Plan

Locally: entity + DataSource → generate/review SQL → `migration:run` → services + routes → replace accounts-404 test → `npm test` → `npm run build`. No `npm install`. Rollback code: revert the change commit. Rollback schema: `migration:revert` (drops `bank_accounts`). Clients that treated `POST /accounts` as 404 must expect 401 without Bearer and 201 after a valid current token and body.

## Open Questions

Нет: 201 create, `"0.00"` string balance, ISO format-only currency, find-by-id then 403, and service-level tests are fixed above and in the specs.
