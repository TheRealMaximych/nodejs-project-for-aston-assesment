## 1. Entity, DataSource, migration

- [x] 1.1 Add `src/entities/bank-account.ts` for table `bank_accounts`: UUID `id`, `accountHolder` (`account_holder` varchar 255), `balance` `numeric(20, 2)` default 0 as TypeScript `string` with a transformer that never uses IEEE `number`, `currency` char(3), `userId` (`user_id` UUID FK to `users.id` ON DELETE RESTRICT, indexed, not unique), `createdAt`; register `BankAccount` on `AppDataSource` next to `User` with `synchronize: false`; verify the entity field type of `balance` is `string` and DataSource `entities` includes `BankAccount` with auto-sync off
- [x] 1.2 Add a versioned TypeORM migration (e.g. `migrations/1700000002000-CreateBankAccounts.ts`) that creates `bank_accounts` with `numeric` balance (not float/double/real), default 0, FK `user_id` → `users.id`, and no unique on `user_id`; do not edit `InitialSchema` or `CreateUsers`; verify the migration SQL uses `numeric` and that the first two migrations still do not create this table

## 2. Repository

- [x] 2.1 Add `src/repositories/bank-account-repository.ts` with `insert({ accountHolder, currency, userId })` that always persists opening balance `"0.00"` and returns `{ id, accountHolder, balance, currency }` only (`balance` string, no `userId`/`createdAt`), and `findById(id)` that returns `{ id, accountHolder, balance, currency, userId } | null` with `balance: string` and does not filter by owner; verify HTTP and service files do not import TypeORM `DataSource` / `Repository` / QueryBuilder

## 3. Create account service and tests

- [x] 3.1 Add `src/services/create-bank-account.ts`: Zod-validate `accountHolder` (trim, min 1, max 255) and `currency` (trim, uppercase, `/^[A-Z]{3}$/`); strip extra keys so body `userId`/`balance` cannot set owner or opening amount; `ValidationError` on failure; `insert` with `userId` from the function argument; log exactly `Account created: accountId=<id>, userId=<userId>` without password/hash/JWT; return public fields including `balance` string `"0.00"`; injectable deps; verify the service does not import TypeORM or `process.env`
- [x] 3.2 Add `src/services/create-bank-account.test.ts` with a mocked repository: success inserts the argument `userId` (not body `userId`), stores holder and uppercase currency, does not pass client balance, returns only public keys with `typeof balance === "string"` representing zero, and logs `Account created: accountId=` plus `userId=` with no password/hash/token; two creates with the same `userId` both call insert; missing/empty holder or invalid currency → `ValidationError` and insert unused; verify `npm test` includes these cases

## 4. Get balance service and tests

- [x] 4.1 Add `src/services/get-account-balance.ts`: validate `accountId` with `z.uuid()` → `ValidationError` without calling the repository; `findById`; `null` → `NotFoundError()`; `account.userId !== requester` → `ForbiddenError()` (not not-found); else `{ balance }` as string; injectable deps; verify the service does not import TypeORM or `process.env` and does not look up by `userId` in the repository
- [x] 4.2 Add `src/services/get-account-balance.test.ts` with a mocked `findById`: own account returns `{ balance }` with `typeof balance === "string"`; foreign `userId` → `ForbiddenError`; missing row → `NotFoundError`; non-UUID id → `ValidationError` and find unused; verify `npm test` exits 0 and covers create, own balance, foreign 403, and missing 404

## 5. HTTP

- [x] 5.1 Add `src/http/routes/accounts.ts` mounted at `/accounts` in `app.ts` before `notFound`: `POST /` and `GET /:id/balance` both use `requireAuth`; create calls `createBankAccount(req.userId, req.body)` and responds 201 with `{ id, accountHolder, balance, currency }`; balance calls `getAccountBalance` and responds 200 with `{ balance }`; missing `req.userId` → `UnauthorizedError()`; no Zod, TypeORM, `process.env`, deposit, or `/transactions` routes; verify `src/http` has no TypeORM and does not coerce `balance` to a JSON number
- [x] 5.2 Replace the `POST /accounts returns 404` assertion in `src/http/middleware/not-found.test.ts` with `POST /transactions`; add a test that `POST /accounts` without `Authorization` returns 401 `{ error, statusCode }` (not 404); verify `npm test` still covers unknown-path 404 and the missing-Bearer 401 case

## 6. Build and layering

- [x] 6.1 Grep `src/http` and `src/services` for `process.env`, TypeORM imports, `parseFloat`/`Number(` on balance, and any `/transactions` or deposit route; verify those greps are empty (account services may import Zod and lazy-load the repository)
- [x] 6.2 Run `npm test` and `npm run build` and verify both exit 0 with `strict` compilation
