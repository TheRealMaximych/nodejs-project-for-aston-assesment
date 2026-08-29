## 1. Repository list

- [x] 1.1 Add `src/repositories/transaction-repository.ts` with `listByAccountId(accountId)` that queries `transactions` where `fromAccount` or `toAccount` equals the id, `ORDER BY timestamp DESC, id DESC`, returns `amount` as `string` and `timestamp` as `Date`, and does not filter by `userId`; do not edit `transfer-repository.ts`, entities, DataSource, or migrations; verify HTTP and service files still do not import TypeORM `DataSource` / `Repository` / QueryBuilder and that the list method has no owner join

## 2. History service and tests

- [x] 2.1 Add `src/services/get-account-history.ts`: Zod-validate `accountId` as UUID (`ValidationError` otherwise); `accounts.findById` then missing → `NotFoundError`, foreign `userId` → `ForbiddenError` without calling list; owned account → `transactions.listByAccountId` and map each row to `{ transactionId, fromAccount, toAccount, amount, timestamp, status }` with `transactionId` = row `id`, `amount` a string (no `Number`/`parseFloat`), `timestamp` = `toISOString()`; empty list → `[]`; injectable deps that default to `bankAccountRepository` and the new transaction repository; verify the service does not import TypeORM or `process.env`
- [x] 2.2 Add `src/services/get-account-history.test.ts` with mocked `findById` and `listByAccountId`: owned account with outgoing and incoming rows of different timestamps returns two items newest-first with exactly the six contract keys, string `amount`, and `transactionId` equal to row id; owned account with empty list returns `[]` and still calls list; foreign account → `ForbiddenError` and list unused; missing account → `NotFoundError` and list unused; non-UUID id → `ValidationError` and neither repository method called; verify `npm test` includes these cases

## 3. HTTP

- [x] 3.1 Add `GET /:accountId` on `src/http/routes/transactions.ts` with `requireAuth`: handler calls `getAccountHistory({ userId: req.userId, accountId: req.params.accountId })` and responds 200 with the array; missing `req.userId` → `UnauthorizedError()`; no Zod, TypeORM, `process.env`, deposit, or extra routes; verify `src/http` has no TypeORM and does not coerce `amount` to a JSON number
- [x] 3.2 Replace the `GET /transactions/:accountId returns 404` assertion in `src/http/middleware/not-found.test.ts` with a test that `GET /transactions/:accountId` without `Authorization` returns 401 `{ error, statusCode }` (not 404); keep unknown-path 404 and `POST /transactions` 401; verify `npm test` still covers those cases

## 4. Build and layering

- [x] 4.1 Grep `src/http` and `src/services` for `process.env`, TypeORM imports, `parseFloat`/`Number(` on amount, deposit routes, and seed/Swagger/README edits in this change; verify those greps are empty (the history service may import Zod and lazy-load repositories) and that no new migration file was added
- [x] 4.2 Run `npm test` and `npm run build` and verify both exit 0 with `strict` compilation
