## Context

Auth middleware (`requireAuth`), JWT `userId` on `req`, and domain errors (`ValidationError`, `ForbiddenError`, `NotFoundError`, `InsufficientFundsError`, `CurrencyMismatchError`, `SameAccountTransferError`) already map to 400/401/403/404. `InsufficientFundsError` already exposes exactly `Insufficient funds`. DataSource registers `User` and `BankAccount`; schema is migration-only (`synchronize: false`). `not-found.test.ts` still treats `POST /transactions` as unknown-path 404. There is no Transaction entity, transfer service, or `/transactions` router. Account balances open at `"0.00"`; there is no deposit API. Motivation: `proposal.md`. Contracts: deltas `money-transfers`, `http-runtime`, `postgres-typeorm`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; money never IEEE `number`; no `process.env` in HTTP/services; no history, seed, deposit, or Swagger.

## Goals / Non-Goals

**Goals:**

- Thin `/transactions` adapter: `requireAuth`, pass `req.userId` + body into a transfer service, JSON `{ transactionId, status }` with `status` `"Completed"`.
- Transaction entity + TypeORM migration; DataSource registers it; `synchronize` stays false.
- Repository-only DB transaction: `SELECT FOR UPDATE` on both account rows (stable lock order), then debit, credit, insert Completed — or rollback on domain throw.
- Injectable transfer deps so `npm test` covers success (including foreign `toAccount`), insufficient funds, foreign `from`, currency mismatch, `from = to`, and not-found without PostgreSQL.
- Persist `numeric` amount and updated balances as application `string`.

**Non-Goals:**

- History route, seed rows, deposit route, HTTP integration against a live DB, Swagger, README.
- Persisting `Failed` rows on rejected attempts (column exists for the model; this change inserts only `Completed`).
- `decimal.js` or other money library.
- Proving races in unit tests (locks live in SQL; service tests mock the session).

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/routes/transactions.ts` — `POST /` with `requireAuth`; `app.use("/transactions", transactionsRouter)` **before** `notFound`. Handler: missing `req.userId` → `UnauthorizedError()`; `transferMoney(userId, req.body)` → `res.status(201).json({ transactionId, status })`. No Zod and no TypeORM in the route. No `GET /:accountId`.
- Service: `src/services/transfer-money.ts` — validate body, `from === to` → `SameAccountTransferError` before DB, then run domain checks inside a locked session, log success/failure, return `{ transactionId, status: "Completed" }`. Injectable deps.
- Repository: extend `src/repositories/bank-account-repository.ts` (or add `src/repositories/transfer-repository.ts` if the file would mix unrelated APIs) with `withLockedAccounts(fromId, toId, work)` that opens a TypeORM query runner, begins a transaction, `SELECT … FOR UPDATE` both rows in UUID-sorted order, invokes `work({ from, to, complete })`, commits on resolve, rolls back on throw. `complete(amount)` updates both balances and inserts the Transaction. HTTP/services never see QueryRunner.
- Entity: `src/entities/transaction.ts`. DataSource `entities: [User, BankAccount, Transaction]`.

**Почему:** слойность; 403 vs 404 и валюта/баланс живут в сервисе на уже заблокированных строках; unit-тесты подменяют `withLockedAccounts` in-memory.

**Альтернатива:** толстый `repository.transfer({ ownerUserId, … })` со всеми правилами внутри repo — ломает «бизнес-логика в service» и усложняет моки ошибок. Отвергнуто.

**Альтернатива:** сервис читает `findById` без лока, потом отдельный UPDATE — гонка между проверкой и списанием. Отвергнуто в пользу lock-сессии.

### 2. Lock session API (no TypeORM in the service)

**Выбор:**

```ts
type BankAccountRecord = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
  userId: string;
};

type TransferSession = {
  from: BankAccountRecord | null;
  to: BankAccountRecord | null;
  complete(amount: string): Promise<{ transactionId: string; status: "Completed" }>;
};

withLockedAccounts(
  fromAccountId: string,
  toAccountId: string,
  work: (session: TransferSession) => Promise<T>,
): Promise<T>
```

Lock order: `ids.sort()` then `SELECT … WHERE id IN (…) FOR UPDATE` (or two finds with `setLock("pessimistic_write")` in that order) to avoid deadlock when A→B and B→A run together. `from`/`to` on the session stay labeled by the request ids, not by lock order.

`complete` MUST run in the same query runner transaction. If `work` throws, the repository rolls back (no partial debit).

**Почему:** спека требует атомарность и блокировку; TypeORM остаётся в repository; сервис остаётся тестируемым.

**Альтернатива:** условный `UPDATE … SET balance = balance - $amount WHERE id = $from AND balance >= $amount`. Тоже закрывает отрицательный баланс. Выбран `SELECT FOR UPDATE`, потому что владелец/валюта/баланс проверяются на одном снимке; условный UPDATE оставить запасным, если lock API окажется неудобен в TypeORM.

### 3. Check order in the service

**Выбор:**

1. Zod: `fromAccount` / `toAccount` `z.uuid()`; `amount` — **строка**, не JSON number.
2. `fromAccount === toAccount` → `SameAccountTransferError` (репозиторий не вызывается).
3. `withLockedAccounts`:
   - `from === null` → `NotFoundError`
   - `from.userId !== actorUserId` → `ForbiddenError` (не 404, даже если `to` отсутствует)
   - `to === null` → `NotFoundError`
   - `from.currency !== to.currency` → `CurrencyMismatchError`
   - source balance < amount (minor units) → `InsufficientFundsError`
   - иначе `complete(normalizedAmount)`
4. Лог успеха или, при доменном throw после появления `fromAccount`, лог неудачи и rethrow.

**Почему:** совпадает со спекой (чужой from = 403, missing = 404, валюта ≠ insufficient funds).

### 4. Money: `numeric(20, 2)` + string + integer minor units

**Выбор:** `amount` колонка `numeric(20, 2)` с тем же string transformer, что у `balance`. Zod принимает десятичную строку с не более чем 2 знаками после точки, нормализует к двум знакам (например `"10"` → `"10.00"`). Сравнение и «amount > 0» через `bigint` минорных единиц (центы), **без** `Number()` / `parseFloat` на деньгах. `complete` пишет нормализованную строку. JSON number `amount` → `ValidationError`.

**Почему:** критерий «не IEEE float»; без нового пакета; scale 2 уже есть на счетах.

**Альтернатива:** `decimal.js` — лишняя зависимость. Отвергнуто.

**Альтернатива:** сравнивать только в SQL — unit-тесты сервиса не смогут проверить insufficient funds без БД. Отвергнуто.

### 5. Transaction table

**Выбор:** table `transactions`:

| DB | Entity | API |
|---|---|---|
| `id` UUID PK `gen_random_uuid()` | `id: string` | `transactionId` |
| `from_account` UUID FK → `bank_accounts.id` ON DELETE RESTRICT | `fromAccount` | never on create response |
| `to_account` UUID FK → `bank_accounts.id` ON DELETE RESTRICT | `toAccount` | never |
| `amount` numeric(20,2) | `amount: string` | never |
| `timestamp` timestamptz default now() | `timestamp` | never |
| `status` varchar CHECK (`Completed` \| `Failed`) | `status` | `"Completed"` on 201 |

Indexes on `from_account` and `to_account` (будущая история). This change inserts only `status = 'Completed'`. `Failed` остаётся в CHECK, строки Failed не пишем при 400/403/404.

**Почему:** модель задания; 201 возвращает только `{ transactionId, status }`; история вне скоупа, поэтому Failed-записи не нужны для контракта.

**Альтернатива:** писать Failed при insufficient funds, затем всё равно отдать 400 без `transactionId`. Лишняя сложность и частичный side effect при ошибке. Отвергнуто.

### 6. Amount validation details

**Выбор:** положительная десятичная строка: optional leading digits, optional `.` + 1–2 fraction digits; reject `""`, `"0"`, `"0.00"`, negative, scientific notation, more than 2 fraction digits. Extra body keys stripped.

**Почему:** спека требует amount > 0 и string; два знака совпадают с `numeric(20,2)`.

### 7. Logs

**Выбор:**

- Success: exactly `Transfer completed: from=<fromId> to=<toId> amount=<normalizedAmount>`
- Failure (when `fromAccount` UUID already parsed): exactly `Transfer failed: from=<fromId>, reason=<reason>` where reason is one of `insufficient funds`, `currency mismatch`, `same account`, `forbidden`, `not found`
- Do not log password, hash, JWT, `accessToken`, or request bodies that could contain secrets

Log failure **before** rethrow so the HTTP mapper still returns the domain status. Validation failures without a UUID `fromAccount` are not required to emit the transfer-failed line.

**Почему:** формулировки из задания; `insufficient funds` как пример reason зафиксирован.

### 8. Tests: node:test, mocked session

**Выбор:** `src/services/transfer-money.test.ts` with a fake `withLockedAccounts` that passes in-memory `{ from, to }` and a `complete` spy:

- success own→own: `complete` called, result `{ transactionId, status: "Completed" }`, log `Transfer completed: from=` … `to=` … `amount=`
- success own→foreign same currency: `complete` called (to.userId ≠ actor)
- insufficient funds: `InsufficientFundsError` with message `Insufficient funds`, `complete` unused, log `reason=insufficient funds`
- foreign from: `ForbiddenError`, `complete` unused
- different currency: `CurrencyMismatchError`, `complete` unused
- from = to: `SameAccountTransferError`, `withLockedAccounts` unused
- from missing / to missing: `NotFoundError`
- JSON number or non-positive amount: `ValidationError`
- log lines contain no password/hash/JWT/`accessToken`

Replace `POST /transactions returns 404` in `not-found.test.ts` with `GET /transactions/:accountId`. Add `POST /transactions` without `Authorization` → 401 `{ error, statusCode }`. Do not start PostgreSQL.

### 9. Migration workflow

**Выбор:** add entity, register on DataSource, then generate `migrations/1700000003000-CreateTransactions.ts` (or `npm run migration:generate` and keep the timestamped file). Do **not** edit `InitialSchema`, `CreateUsers`, or `CreateBankAccounts`. Keep `synchronize: false`, `migrationsRun: false`.

**Почему:** accounts table must exist first for FKs.

## Risks / Trade-offs

- **[Risk]** Сервис вызывает `findById` без лока, затем UPDATE — отрицательный баланс при гонке. **Mitigation:** единственный путь списания — `complete` внутри `withLockedAccounts`; grep в services на `getRepository` / `QueryBuilder` / `FOR UPDATE`.
- **[Risk]** Deadlock A→B vs B→A. **Mitigation:** lock by sorted UUID, not by from-then-to.
- **[Risk]** `Number(amount)` где-то в сравнении. **Mitigation:** minor-unit `bigint`; tests assert `typeof amount === "string"`; grep `parseFloat`/`Number(` on money fields.
- **[Risk]** Тест `POST /transactions` → 404 останется красным. **Mitigation:** заменить путь на `GET /transactions/:accountId`; добавить 401 без Bearer.
- **[Risk]** Unit-тесты не доказывают `SELECT FOR UPDATE`. **Mitigation:** зафиксировать SQL в repository/migration review; критерий гонки — реализация repo, не `npm test`.
- **[Risk]** TypeORM `setLock` без query runner transaction не держит lock. **Mitigation:** `startTransaction` + same runner for find, updates, insert, commit.
- **[Trade-off]** Failed rows не пишутся. История позже сможет вставлять Failed; сейчас 400 не возвращает `transactionId`.
- **[Trade-off]** Стартовый баланс в API по-прежнему 0; успешный перевод в dev потребует ручного UPDATE или будущего seed. Вне скоупа этого change.

## Migration Plan

Locally: entity + DataSource → generate/review SQL → `migration:run` → repository session + service + route → replace transactions-404 test → `npm test` → `npm run build`. No `npm install`. Rollback code: revert the change commit. Rollback schema: `migration:revert` (drops `transactions`; does not restore mutated balances — local DB only). Clients that treated `POST /transactions` as 404 must expect 401 without Bearer and 201 after a valid current token and body.

## Open Questions

Нет: 201 create, string amount, lock session, Completed-only inserts, check order, and service-level tests are fixed above and in the specs.
