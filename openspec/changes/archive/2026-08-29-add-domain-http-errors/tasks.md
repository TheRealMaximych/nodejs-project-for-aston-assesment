## 1. Domain errors

- [x] 1.1 Add `src/domain/errors.ts` with `DomainError` (no `statusCode`) and subclasses `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InsufficientFundsError`, `CurrencyMismatchError`, `SameAccountTransferError`; `InsufficientFundsError` message is exactly `Insufficient funds`; verify TypeScript compiles those exports and none of the classes expose `statusCode`
- [x] 1.2 Remove `src/domain/app-error.ts` and all `AppError` imports; verify `rg AppError src` is empty and `src/domain` has no HTTP status fields

## 2. HTTP mapping

- [x] 2.1 Add a pure mapper in `src/http` that maps each domain subclass to `{ error, statusCode }` (400 / 401 / 403 / 404 / 409 per design table) and returns null for a generic `Error`; verify the mapper unit tests cover every subclass plus generic `Error`
- [x] 2.2 Update `error-handler` to use the mapper: known domain errors send `{ error, statusCode }` without an unhandled log; unknown errors log with existing pino redact and respond 500 `{ "error": "Internal Server Error", "statusCode": 500 }` without echoing `err.message` or stack; verify handler tests assert 500 body has no stack/SQL/internal message
- [x] 2.3 Change `not-found` to `next(new NotFoundError())`; verify `GET /no-such-route` still returns 404 `{ "error": string, "statusCode": 404 }` (via existing app or a focused handler test)

## 3. Tests and build

- [x] 3.1 Point `npm test` at `tsx --test` for `src/**/*.test.ts` (no new production routes); verify `npm test` exits 0 and includes cases for insufficient-funds exact message, each mapped status, and generic `Error` → 500
- [x] 3.2 Run `npm run build` and verify it exits 0 with `strict` compilation; confirm `src/http` still has no TypeORM imports and no domain endpoint routers
