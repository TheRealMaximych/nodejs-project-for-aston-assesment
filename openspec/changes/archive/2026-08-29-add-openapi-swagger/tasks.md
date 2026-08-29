## 1. Dependencies

- [x] 1.1 Add `swagger-ui-express` and `@types/swagger-ui-express` (and `openapi-types` if needed for `OpenAPIV3.Document` under `strict`); verify `npm install` exits 0 and `package.json` lists `swagger-ui-express`

## 2. OpenAPI document

- [x] 2.1 Add `src/http/openapi/document.ts` as an OpenAPI 3.0 document with operations for `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /accounts`, `GET /accounts/{id}/balance`, `POST /transactions`, and `GET /transactions/{accountId}`; shared `ErrorResponse` `{ error, statusCode }`; Bearer JWT only on the five protected operations; money fields as strings; logout 204 empty; transfer 400 example `{ "error": "Insufficient funds", "statusCode": 400 }`; no `GET /accounts` list, deposit, refresh, or password-reset paths; no JWT secret, password hash, or real token examples; verify the file exists and those path/method keys and the `ErrorResponse` component are present
- [x] 2.2 Add `src/http/openapi/document.test.ts` that imports the document object (no PostgreSQL) and asserts required paths/methods, absence of list-accounts/deposit/refresh, `ErrorResponse` required `error` + `statusCode`, Bearer `security` on protected ops only, string `balance`/`amount`, and the insufficient-funds 400 example; verify `npm test` includes this file and exits 0

## 3. HTTP mount

- [x] 3.1 Mount Swagger UI in `src/http/app.ts` at `/api-docs` with `swaggerUi.serve` + `setup(openApiDocument)` before `notFound`, without `requireAuth`; verify `app.ts` contains `/api-docs`, has no TypeORM imports, and does not wrap the docs mount in `requireAuth`

## 4. Build, layering, and out-of-scope checks

- [x] 4.1 Grep `src/http/openapi/document.ts` for JWT secret values, password hashes, and signed `eyJ` token examples (must be empty) and grep `src/http` for TypeORM `DataSource` / `Repository` / QueryBuilder (must stay empty); verify README is unchanged, `migrations/` has no new file from this change, and no new `src/services/*.test.ts` was added
- [x] 4.2 Run `npm test` and `npm run build` and verify both exit 0 with `strict` compilation
