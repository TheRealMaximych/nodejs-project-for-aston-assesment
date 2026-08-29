## MODIFIED Requirements

### Requirement: Health, registration, and login stay unauthenticated public routes
The system MUST expose `GET /health` without authentication. The health response status MUST be 200 and the JSON body MUST be `{ "status": "ok" }`. The system MUST expose `POST /auth/register` without authentication as a domain success route when the body is valid and the email is free. The system MUST expose `POST /auth/login` without authentication as a domain success route when the email and password match a persisted User. The system MUST expose `GET /api-docs` without authentication as the Swagger UI (not an unknown path). The system MUST expose `GET /` without authentication as the API check page (not an unknown path). The system MUST expose `POST /auth/logout` as an authenticated domain route (not an unknown path). The system MUST expose `POST /accounts` and `GET /accounts/:id/balance` as authenticated domain routes (not unknown paths). The system MUST expose `POST /transactions` and `GET /transactions/:accountId` as authenticated domain routes (not unknown paths).

#### Scenario: Unauthenticated health check
- **WHEN** a client sends `GET /health` with no credentials
- **THEN** the response status is 200 and the JSON body equals `{ "status": "ok" }`

#### Scenario: Unauthenticated register is not treated as unknown
- **WHEN** a client sends `POST /auth/register` with a unique valid email and a valid password and no credentials
- **THEN** the response is HTTP 201 with `{ "id": string, "email": string }`, not the unknown-path 404 error body

#### Scenario: Unauthenticated login is not treated as unknown
- **WHEN** a client sends `POST /auth/login` with the email and password of an existing User and no credentials
- **THEN** the response is HTTP 200 with `{ "accessToken": string }`, not the unknown-path 404 error body

#### Scenario: Unauthenticated docs UI is not treated as unknown
- **WHEN** a client sends `GET /api-docs` with no credentials
- **THEN** the response is not the unknown-path 404 error body and is not HTTP 401 solely for missing Bearer credentials

#### Scenario: Unauthenticated API check page is not treated as unknown
- **WHEN** a client sends `GET /` with no credentials
- **THEN** the response is not the unknown-path 404 error body and is not HTTP 401 solely for missing Bearer credentials

#### Scenario: Logout without Bearer is not treated as unknown
- **WHEN** a client sends `POST /auth/logout` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

#### Scenario: Account create without Bearer is not treated as unknown
- **WHEN** a client sends `POST /accounts` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

#### Scenario: Account balance without Bearer is not treated as unknown
- **WHEN** a client sends `GET /accounts/:id/balance` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

#### Scenario: Transfer without Bearer is not treated as unknown
- **WHEN** a client sends `POST /transactions` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

#### Scenario: History without Bearer is not treated as unknown
- **WHEN** a client sends `GET /transactions/:accountId` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

### Requirement: Logout, account, transfer, and history routes are protected assignment routes at this stage
`POST /auth/logout`, `POST /accounts`, `GET /accounts/:id/balance`, `POST /transactions`, and `GET /transactions/:accountId` MUST run authentication before their handlers. Authentication MUST NOT be required for `GET /health`, `POST /auth/register`, `POST /auth/login`, `GET /api-docs`, or `GET /`.

#### Scenario: Protected logout is not 404 when authenticated
- **WHEN** a client sends `POST /auth/logout` with a valid current access token
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Protected account create is not 404 when authenticated
- **WHEN** a client sends `POST /accounts` with a valid current access token and a valid body
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Protected account balance is not 404 when authenticated
- **WHEN** a client sends `GET /accounts/:id/balance` with a valid current access token for an account they own
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Protected transfer create is not 404 when authenticated
- **WHEN** a client sends `POST /transactions` with a valid current access token
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Protected history is not 404 when authenticated
- **WHEN** a client sends `GET /transactions/:accountId` with a valid current access token for an account they own
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Public auth routes stay unauthenticated
- **WHEN** a client sends `POST /auth/login` or `POST /auth/register` without an `Authorization` header and with a valid body for that route
- **THEN** the request is not rejected as 401 solely for missing Bearer credentials

#### Scenario: Docs UI stays unauthenticated
- **WHEN** a client sends `GET /api-docs` without an `Authorization` header
- **THEN** the request is not rejected as 401 solely for missing Bearer credentials

#### Scenario: API check page stays unauthenticated
- **WHEN** a client sends `GET /` without an `Authorization` header
- **THEN** the request is not rejected as 401 solely for missing Bearer credentials

### Requirement: JSON is the wire format
The system MUST parse JSON request bodies and MUST send JSON for the health success body and for all error responses. Successful responses for `GET /api-docs` (Swagger UI and its static assets) MAY use HTML or other UI content types. Successful responses for `GET /` (API check page and its static assets) MAY use HTML or other UI content types. Domain API success bodies other than logout's empty 204 MUST remain JSON.

#### Scenario: Health body is JSON
- **WHEN** a client calls `GET /health`
- **THEN** the response `Content-Type` is JSON and the body parses as `{ "status": "ok" }`

#### Scenario: Docs UI is not required to be JSON
- **WHEN** a client calls `GET /api-docs`
- **THEN** the response MAY be HTML and MUST NOT be the unknown-path 404 JSON error body

#### Scenario: API check page is not required to be JSON
- **WHEN** a client calls `GET /`
- **THEN** the response MAY be HTML and MUST NOT be the unknown-path 404 JSON error body
