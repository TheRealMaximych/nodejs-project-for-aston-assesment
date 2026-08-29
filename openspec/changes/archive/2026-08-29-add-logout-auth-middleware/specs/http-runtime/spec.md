## MODIFIED Requirements

### Requirement: Health, registration, and login are unauthenticated public routes
The system MUST expose `GET /health` without authentication. The health response status MUST be 200 and the JSON body MUST be `{ "status": "ok" }`. The system MUST expose `POST /auth/register` without authentication as a domain success route when the body is valid and the email is free. The system MUST expose `POST /auth/login` without authentication as a domain success route when the email and password match a persisted User. The system MUST expose `POST /auth/logout` as an authenticated domain route (not an unknown path). Other assignment domain paths (`/accounts`, `/transactions`) MUST NOT succeed at this stage.

#### Scenario: Unauthenticated health check
- **WHEN** a client sends `GET /health` with no credentials
- **THEN** the response status is 200 and the JSON body equals `{ "status": "ok" }`

#### Scenario: Unauthenticated register is not treated as unknown
- **WHEN** a client sends `POST /auth/register` with a unique valid email and a valid password and no credentials
- **THEN** the response is HTTP 201 with `{ "id": string, "email": string }`, not the unknown-path 404 error body

#### Scenario: Unauthenticated login is not treated as unknown
- **WHEN** a client sends `POST /auth/login` with the email and password of an existing User and no credentials
- **THEN** the response is HTTP 200 with `{ "accessToken": string }`, not the unknown-path 404 error body

#### Scenario: Logout without Bearer is not treated as unknown
- **WHEN** a client sends `POST /auth/logout` with no `Authorization` header
- **THEN** the response is HTTP 401 with `{ "error": string, "statusCode": 401 }`, not the unknown-path 404 error body

#### Scenario: Account and transfer routes are not available
- **WHEN** a client sends an assignment domain path under `/accounts` or `/transactions`
- **THEN** the response is the uniform error JSON (not a domain success payload)

## ADDED Requirements

### Requirement: Logout is the only protected assignment route at this stage
`POST /auth/logout` MUST run authentication before the logout handler. Account and transfer assignment routes MUST still be absent. Authentication MUST NOT be required for `GET /health`, `POST /auth/register`, or `POST /auth/login`.

#### Scenario: Protected logout is not 404 when authenticated
- **WHEN** a client sends `POST /auth/logout` with a valid current access token
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Public auth routes stay unauthenticated
- **WHEN** a client sends `POST /auth/login` or `POST /auth/register` without an `Authorization` header and with a valid body for that route
- **THEN** the request is not rejected as 401 solely for missing Bearer credentials
