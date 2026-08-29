## 1. Repository

- [x] 1.1 Add `findAuthById` on `src/repositories/user-repository.ts` returning `{ id, tokenVersion } | null` (select those columns only) and `incrementTokenVersion(id)` that atomically does `token_version = token_version + 1` and reports whether a row was updated; keep `findByEmail` / `findAuthByEmail`; verify HTTP and service files do not import TypeORM `DataSource` / `Repository` / QueryBuilder

## 2. Token verify and authenticate service

- [x] 2.1 Add `verifyAccessToken` to `src/services/access-token.ts` that `await`s `jsonwebtoken` callback `verify` with `algorithms: ["HS256"]` and `config.jwtSecret` (lazy config, no top-level `process.env`); reject missing/non-integer claims with `UnauthorizedError`; map verify/expiry failures to `UnauthorizedError` without logging the JWT; verify the module does not call `jwt.verify` without a callback and does not read `process.env`
- [x] 2.2 Add `src/services/authenticate-access-token.ts`: `await verifyAccessToken` → `findAuthById` → matching `tokenVersion` returns `{ userId }`; missing user or version mismatch → `UnauthorizedError()` (not forbidden); injectable deps; no top-level config import; verify the service does not import TypeORM or `process.env`
- [x] 2.3 Add `src/services/authenticate-access-token.test.ts` with mocked verify and repository: matching version returns `{ userId }`; stale `tokenVersion` → `UnauthorizedError`; unknown `userId` → `UnauthorizedError`; failed verify → `UnauthorizedError`; verify `npm test` includes these cases

## 3. Logout service and unit tests

- [x] 3.1 Add `src/services/logout-user.ts`: `incrementTokenVersion(userId)`; 0 updated rows → `UnauthorizedError()`; success logs exactly `User logout successful: userId=<id>` without password/hash/JWT; injectable deps; verify the service does not import TypeORM or `process.env`
- [x] 3.2 Add `src/services/logout-user.test.ts` with a mocked repository: success calls increment with that `userId` and logs `User logout successful: userId=` with no password/hash/token; after increment, `authenticateAccessToken` with the previous `tokenVersion` throws `UnauthorizedError`; 0 rows → `UnauthorizedError`; verify `npm test` exits 0 and covers logout invalidation plus stale version

## 4. HTTP

- [x] 4.1 Add Express `Request.userId?: string` augmentation and `src/http/middleware/require-auth.ts`: missing/non-Bearer/empty token → `next(UnauthorizedError)`; otherwise `await authenticateAccessToken` and set `req.userId`; do not log JWT or `Authorization`; verify the middleware does not import TypeORM or `process.env` and does not write the token to logs
- [x] 4.2 Add `POST /logout` on `src/http/routes/auth.ts` with `requireAuth` only on that route (register/login remain unauthenticated): call `logoutUser(req.userId)`, respond 204 with empty body; verify `src/http` has no TypeORM, no `process.env`, no `/accounts` or `/transactions` routes, and no Zod in the logout handler
- [x] 4.3 Replace the `POST /auth/logout returns 404` assertion in `src/http/middleware/not-found.test.ts` with an still-unavailable path (`POST /accounts`); add a test that `POST /auth/logout` without `Authorization` returns 401 `{ error, statusCode }` (not 404); verify `npm test` still covers unknown-path 404 and the missing-Bearer 401 case

## 5. Build and layering

- [x] 5.1 Grep `src/http` and `src/services` for `process.env`, `compareSync`, `hashSync`, `jwt.verify(` used without a callback, and TypeORM imports outside `src/config` and `src/repositories`; verify those greps are empty (access-token may import `jsonwebtoken` and lazy `config`)
- [x] 5.2 Run `npm test` and `npm run build` and verify both exit 0 with `strict` compilation
