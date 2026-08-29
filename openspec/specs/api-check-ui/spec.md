# api-check-ui Specification

## Purpose

Gives a developer one same-origin HTML page to exercise the existing REST API by hand: forms for every assignment endpoint, in-memory Bearer after login, and visible HTTP status plus raw JSON for success and errors.

## Requirements

### Requirement: Check page is a single same-origin HTML document
The system MUST serve one HTML page that a browser can open at `GET /` on the same origin as the REST API. The page MUST be static HTML with a small amount of CSS and vanilla JavaScript. It MUST NOT require a separate development server, a frontend framework, a bundler, or a separate npm package for the UI.

#### Scenario: Page opens on the API origin
- **WHEN** a developer starts the API with `npm run dev` and opens `GET /` in a browser with no `Authorization` header (example port from `.env.example`: `http://localhost:3000/`)
- **THEN** the response is an HTML page for checking the API, not the unknown-path 404 JSON body, and not HTTP 401 solely because Bearer credentials are missing

### Requirement: Check page exposes a form for each existing HTTP operation
The page MUST include a distinct control block for each of these operations and no other domain API operations: `GET /health`, `POST /auth/register` with `{ email, password }`, `POST /auth/login` with `{ email, password }`, `POST /auth/logout`, `POST /accounts` with `{ accountHolder, currency }`, `GET /accounts/:id/balance`, `POST /transactions` with `{ fromAccount, toAccount, amount }`, and `GET /transactions/:accountId`. Each block MUST provide fields for that operation's path parameters and JSON body fields, a Send control, and a place that shows the HTTP status and the raw response body.

#### Scenario: All assignment operations are present
- **WHEN** a developer inspects the check page
- **THEN** there is a Send control for health, register, login, logout, create account, balance, transfer, and history, and there is no form for list-accounts, deposit, refresh-token, or other unimplemented domain routes

#### Scenario: Path and body fields match the contract
- **WHEN** a developer fills the balance, history, register, login, create-account, and transfer blocks
- **THEN** balance uses an account `id` path field, history uses `accountId`, register and login use `email` and `password`, create account uses `accountHolder` and `currency`, and transfer uses `fromAccount`, `toAccount`, and `amount`

### Requirement: Transfer amount is submitted as a JSON string
The transfer form MUST send `amount` in the JSON body as a string, not as an IEEE number.

#### Scenario: Amount is a string on the wire
- **WHEN** a developer sends `POST /transactions` from the check page with amount text `10.50`
- **THEN** the request JSON has `"amount": "10.50"` (a string), not a JSON number

### Requirement: Access token is kept in page memory and attached to protected requests
After a successful `POST /auth/login` whose JSON body contains `accessToken`, the page MUST store that token in memory (a JavaScript variable is sufficient; persistent storage is not required). While that in-memory token is set, the page MUST send `Authorization: Bearer <token>` on requests from the logout, create-account, balance, transfer, and history blocks. `GET /health`, `POST /auth/register`, and `POST /auth/login` MUST NOT require a Bearer header from the page.

#### Scenario: Login stores the token for protected calls
- **WHEN** a developer sends `POST /auth/login` from the page with a seeded demo email and password and then sends `POST /accounts` from the page
- **THEN** the create-account request includes `Authorization: Bearer` with the `accessToken` from the login response

#### Scenario: Public forms do not require a stored token
- **WHEN** a developer sends `GET /health` or `POST /auth/login` from the page with no stored token
- **THEN** those requests are sent without requiring Bearer credentials

### Requirement: Logout clears the in-memory token
After the logout block is sent and the API responds with HTTP 204, the page MUST forget the in-memory access token. A later protected request from the page MUST be sent without Bearer credentials.

#### Scenario: Protected call after logout is unauthenticated
- **WHEN** a developer logs in from the page, sends `POST /auth/logout` and receives HTTP 204, then sends `GET /accounts/:id/balance` from the page
- **THEN** the balance request has no `Authorization: Bearer` header and the API response is HTTP 401 with `{ "error": string, "statusCode": 401 }`

### Requirement: Success and error bodies are visible
When a request from the page completes, the page MUST display the HTTP status code and the response body text. JSON success bodies and `{ "error": string, "statusCode": number }` error bodies MUST be shown as received (pretty-printed JSON is allowed). An empty body (HTTP 204) MUST still show the status and MUST NOT be presented as a silent client-side failure. A failed `fetch` MUST be shown as a visible error on the page.

#### Scenario: Error JSON is shown
- **WHEN** a developer sends a protected operation from the page without a stored token
- **THEN** the page shows HTTP 401 and the raw JSON `{ "error": string, "statusCode": 401 }`

#### Scenario: Empty logout body still shows status
- **WHEN** a developer sends `POST /auth/logout` from the page with a valid stored token and the API returns HTTP 204
- **THEN** the page shows status 204 and does not treat the empty body as a silent failure

### Requirement: Demo placeholders and a link to OpenAPI
The page MUST include placeholders or hints for the seed demo email and demo password. Path fields for account identifiers MUST hint that the value is a UUID. The page MUST include a link to `/api-docs`.

#### Scenario: Hints and docs link are present
- **WHEN** a developer inspects the check page
- **THEN** register/login fields hint the seeded demo email and password, account id fields hint a UUID, and a link to `/api-docs` is present
