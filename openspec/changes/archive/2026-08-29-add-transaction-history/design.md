## Context

Auth middleware (`requireAuth`), JWT `userId` on `req`, and domain errors (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`) already map to 400/401/403/404. Transaction entity, `transactions` table, and indexes on `from_account` / `to_account` already exist. `POST /transactions` is mounted; `GET /:accountId` is not. `not-found.test.ts` still treats `GET /transactions/:accountId` as unknown-path 404. `getAccountBalance` already does find-by-id then 403 vs 404. Motivation: `proposal.md`. Contracts: deltas `transaction-history`, `http-runtime`, `money-transfers`.

Constraints: HTTP → service → repository; TypeORM only in `src/repositories` and `src/config`; money never IEEE `number`; no `process.env` in HTTP/services; no seed, Swagger, README, deposit, or new endpoints.

## Goals / Non-Goals

**Goals:**

- Thin `GET /:accountId` on the existing `/transactions` router: `requireAuth`, pass `req.userId` + param into a history service, JSON array with assignment field names.
- Reuse `bankAccountRepository.findById` for ownership; list matching Transaction rows only after the owner check.
- Injectable deps so `npm test` covers own history with operations, foreign 403, missing 404, and empty `[]` without PostgreSQL.
- Map `id` → `transactionId`, `amount` as string, `timestamp` as ISO 8601 string; SQL order `timestamp DESC`.

**Non-Goals:**

- New migration, seed rows, deposit route, HTTP integration against a live DB, Swagger, README.
- Pagination, filters, or writing `Failed` rows (history returns whatever is stored; transfers still insert only `Completed`).
- A new required log line (assignment does not list one for history).

## Decisions

### 1. Layers and files

**Выбор:**

- HTTP: `src/http/routes/transactions.ts` — add `GET /:accountId` with `requireAuth` next to existing `POST /`. Handler: missing `req.userId` → `UnauthorizedError()`; `getAccountHistory({ userId, accountId: req.params.accountId })` → `res.status(200).json(items)`. No Zod and no TypeORM in the route. Router stays mounted at `/transactions` before `notFound`.
- Service: `src/services/get-account-history.ts` — validate UUID, load account, 404/403, then list, map to public items. Injectable deps.
- Repository: `src/repositories/transaction-repository.ts` — `listByAccountId(accountId)` returns persisted rows where `fromAccount` or `toAccount` equals the id, ordered by `timestamp DESC` (and `id DESC` as a stable tie-breaker). `amount` is `string`. Do not put list queries into `transfer-repository.ts` (lock session stays transfer-only). Reuse `bankAccountRepository.findById`; do not add a second account lookup API.

**Почему:** слойность как у баланса; 403 vs 404 живёт в сервисе; unit-тесты мокают `findById` и `listByAccountId`.

**Альтернатива:** `listByAccountIdAndUserId` в одном SQL JOIN — чужой счёт легко превратить в 404. Отвергнуто.

**Альтернатива:** список внутри `transfer-repository.ts` — смешивает lock-сессию и read-model. Отвергнуто.

### 2. Ownership check order

**Выбор:** same as `getAccountBalance`:

1. Zod `z.uuid()` on `:accountId` → `ValidationError` (400); repository unused.
2. `accounts.findById(accountId)`; `null` → `NotFoundError`.
3. `account.userId !== actorUserId` → `ForbiddenError`; `listByAccountId` unused.
4. Else `transactions.listByAccountId(accountId)` and map rows (empty array is success).

**Почему:** спека требует 403 на чужой, 404 только если счёта нет, 200 `[]` если свой счёт без операций.

### 3. Query and sort

**Выбор:** TypeORM QueryBuilder (repository only): `WHERE from_account = :id OR to_account = :id`, `ORDER BY timestamp DESC, id DESC`. No pagination. Include both `Completed` and `Failed` if present. Duplicate rows MUST NOT appear if a row somehow matched both sides (OR, not UNION of two selects without DISTINCT).

**Почему:** индексы уже есть; сортировка по timestamp DESC зафиксирована в spec; `id DESC` делает tie-breaker детерминированным для тестов без изменения наблюдаемого порядка при разных timestamp.

**Альтернатива:** сортировать в сервисе — лишняя работа и риск забыть ORDER BY. Отвергнуто.

### 4. Public item mapping

**Выбор:** service maps each row to:

```ts
{
  transactionId: row.id,
  fromAccount: row.fromAccount,
  toAccount: row.toAccount,
  amount: row.amount, // string
  timestamp: row.timestamp.toISOString(),
  status: row.status,
}
```

HTTP returns that array as-is. Do not expose entity `id`. Do not coerce `amount` with `Number` / `parseFloat`. Repository may return `timestamp` as `Date`; ISO string is produced in the service so unit tests assert the contract without Express.

**Почему:** контракт задания; JSON Date иначе зависит от `res.json` сериализации.

### 5. Tests: node:test, mocked repositories

**Выбор:** `src/services/get-account-history.test.ts` with fakes:

- owned account + two rows (outgoing and incoming, different timestamps) → array of two items, newest first, keys exactly the six contract fields, `amount` is string, `transactionId` is the row id
- owned account + `listByAccountId` returns `[]` → `[]`; list is called
- foreign account → `ForbiddenError`; list unused
- `findById` returns `null` → `NotFoundError`; list unused
- non-UUID `accountId` → `ValidationError`; find and list unused

Replace `GET /transactions/:accountId returns 404` in `not-found.test.ts` with 401 without `Authorization` (`{ error, statusCode }`). Keep unknown-path 404 and `POST /transactions` 401. Do not start PostgreSQL.

### 6. Schema

**Выбор:** no new migration. Entity, DataSource, and `CreateTransactions` stay unchanged. `synchronize` stays false.

**Почему:** таблица и индексы уже покрывают from/to lookup.

## Risks / Trade-offs

- **[Risk]** `find({ where: { id, userId } })` или JOIN с owner в list даст 404 на чужой счёт. **Mitigation:** `findById` без userId; ownership only in the service; tests assert list unused on 403/404.
- **[Risk]** Route forgotten → test still expects 404 and stays green for the wrong reason. **Mitigation:** change that HTTP test to 401 without Bearer.
- **[Risk]** `amount` becomes JSON number via `Number()`. **Mitigation:** keep transformer string; tests `typeof amount === "string"`; grep `parseFloat`/`Number(` on amount.
- **[Risk]** Sort only in memory after unordered SELECT. **Mitigation:** ORDER BY in repository; service test asserts descending timestamps from the mapped result using a fake that already returns DESC (document that SQL order is the production guarantee).
- **[Risk]** GET `/:accountId` shadows a future `GET /` — none exists. **Mitigation:** do not add extra transaction collection routes.
- **[Trade-off]** No pagination: full history in one response. Acceptable for the assessment; out of scope to page.
- **[Trade-off]** No history log line. Assignment lists logs for register/login/account/transfer only.

## Migration Plan

Locally: `listByAccountId` + history service + GET route → replace history-404 test with 401 → `npm test` → `npm run build`. No `npm install`, no `migration:run`. Rollback: revert the change commit (schema unchanged). Clients that treated `GET /transactions/:accountId` as 404 must expect 401 without Bearer and 200 (array) after a valid current token for an owned account.

## Open Questions

Нет: 200 array contract, timestamp DESC, empty `[]`, 403 vs 404, ISO timestamp string, and service-level tests are fixed above and in the specs.
