## 1. HTTP static mount

- [x] 1.1 Mount `express.static` on `path.join(__dirname, "..", "..", "public")` in `src/http/app.ts` after `/api-docs` and before `notFound`, without `requireAuth` and without new npm packages; verify `GET /` with no `Authorization` header returns HTML (not HTTP 401 and not the unknown-path 404 JSON body) and `GET /health` still returns 200 `{ "status": "ok" }`

## 2. Check page UI

- [x] 2.1 Add `public/index.html` (optional extra static file only if the script is split, still no bundler) with eight Send blocks for `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /accounts`, `GET /accounts/:id/balance`, `POST /transactions`, and `GET /transactions/:accountId`, and with no list-accounts or deposit form; verify those eight operations are present and grepping the page for deposit / `GET /accounts` list controls finds nothing
- [x] 2.2 Add field placeholders `alice.demo@example.com` and `DemoPass12`, UUID hints for account ids (seed Alice/Bob account UUIDs allowed as editable hints), and a link to `/api-docs`; verify those strings and `href="/api-docs"` exist in `public/`
- [x] 2.3 Implement vanilla JS `fetch` with relative URLs, `Content-Type: application/json` on POST bodies, transfer `amount` as a JSON string from `<input type="text">` (no `type="number"`, no `Number`/`parseFloat` on amount), in-memory `accessToken` after login 200, `Authorization: Bearer` only on logout/accounts/balance/transfer/history, clear the variable after logout 204, and display HTTP status plus body text (pretty JSON when parseable; empty body still shows 204; failed `fetch` visible on the page); verify the script stores a page-scoped token variable, does not write `localStorage`, and the transfer payload uses a string `amount`

## 3. README

- [x] 3.1 Add one short line to root `README.md` that the API check page is `http://localhost:3000/` after `npm run dev` when `PORT=3000`; verify that URL is present and README still has no architecture / layering section

## 4. Guardrails and existing tests

- [x] 4.1 Leave services, repositories, entities, migrations, seed, and `src/http/openapi/document.ts` unchanged in this change (existing seed with two funded same-currency accounts and existing Swagger stay as they are; no new TypeORM migration, no new service tests, no UI unit tests); verify `git diff` for `src/services`, `src/repositories`, `src/entities`, `migrations/`, `seeds/`, and `src/http/openapi/document.ts` is empty
- [x] 4.2 Run `npm test` and `npm run build` and verify both exit 0

## 5. Manual acceptance

- [x] 5.1 With Compose Postgres, migrate, seed, and `npm run dev`, from `GET /` run health → login as `alice.demo@example.com` → create account and/or balance of Alice's seed account → transfer a string amount to Bob's seed account → history → logout → a following protected Send shows HTTP 401 and `{ "error", "statusCode": 401 }` on the page (not a silent fail)
