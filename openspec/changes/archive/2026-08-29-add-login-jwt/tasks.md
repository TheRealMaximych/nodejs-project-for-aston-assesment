## 1. Dependencies

- [x] 1.1 Add `jsonwebtoken` and `@types/jsonwebtoken`; verify `npm install` exits 0 and `package.json` lists `jsonwebtoken`

## 2. Config

- [x] 2.1 Make `JWT_SECRET` a required non-empty trimmed string in `src/config/env.ts` and export `jwtSecret` plus `jwtExpiresIn: "1h"` on the config object; verify empty/`undefined` `JWT_SECRET` fails schema parse (process does not serve HTTP) and HTTP/service files still do not read `process.env`
- [x] 2.2 Update `.env.example` so `JWT_SECRET` is documented as required (placeholder only, not a real secret) and the “unused until auth” comment is gone; verify the example file contains a non-empty placeholder pattern and no production secret

## 3. Repository

- [x] 3.1 Add `findAuthByEmail` on `src/repositories/user-repository.ts` returning `{ id, passwordHash, tokenVersion } | null` (select those columns only); keep `findByEmail` as `{ id, email }`; verify HTTP and service files do not import TypeORM `DataSource` / `Repository` / QueryBuilder

## 4. Service and unit tests

- [x] 4.1 Add `comparePassword` to `src/services/password-hasher.ts` using `await bcrypt.compare` (never `compareSync` / `hashSync`); verify the hasher file contains `compare` and has no `compareSync` / `hashSync` / `pbkdf2Sync` / `scryptSync`
- [x] 4.2 Add `src/services/access-token.ts` that `await`s `jsonwebtoken` callback `sign` of `{ userId, tokenVersion }` with `config.jwtSecret` and `config.jwtExpiresIn` (HS256); lazy-load config (no top-level `process.env`); verify the module does not import `process.env` and does not call `jwt.sign` without a callback
- [x] 4.3 Add `src/services/login-user.ts`: Zod-validate unknown input (trim/lowercase email, email format, password `min(1)`) → `ValidationError`; `findAuthByEmail`; unknown user → dummy `await comparePassword` then `UnauthorizedError`; wrong password → `UnauthorizedError` (same default message); success → `await signAccessToken({ userId, tokenVersion })`, log exactly `User login successful: userId=<id>` without password/hash/JWT, return `{ accessToken }`; injectable deps; no top-level config import; verify the service does not import TypeORM or `process.env`
- [x] 4.4 Add `src/services/login-user.test.ts` with a mocked repository: success (`signAccessToken` called with `userId` and `tokenVersion`; result keys only `accessToken`; log `User login successful: userId=`; log has no password/hash/token); wrong password (`UnauthorizedError`, sign not called); unknown email (`UnauthorizedError`, sign not called, same error class/message as wrong password); optional validation cases (`ValidationError`, repo unused); verify `npm test` exits 0 and includes these credential cases

## 5. HTTP

- [x] 5.1 Add `POST /login` on `src/http/routes/auth.ts` (no auth): pass `req.body` to the login service, respond 200 with `{ accessToken }`; verify `src/http` has no TypeORM imports, no `process.env`, no logout/accounts routes, and no Zod in the route
- [x] 5.2 Replace the `POST /auth/login returns 404` assertion in `src/http/middleware/not-found.test.ts` with an still-unavailable path (`POST /auth/logout`); verify that test no longer expects login 404 and `npm test` still covers unknown-path 404

## 6. Build and layering

- [x] 6.1 Grep `src/http` and `src/services` for `process.env`, `compareSync`, `hashSync`, `pbkdf2Sync`, `scryptSync`, and TypeORM imports outside `src/config` and `src/repositories`; verify those greps are empty (hasher may import `bcrypt`; access-token may import `jsonwebtoken` and lazy `config`)
- [x] 6.2 Run `npm run build` and verify it exits 0 with `strict` compilation
