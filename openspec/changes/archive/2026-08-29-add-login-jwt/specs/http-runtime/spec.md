## ADDED Requirements

### Requirement: Health, registration, and login are unauthenticated public routes
The system MUST expose `GET /health` without authentication. The health response status MUST be 200 and the JSON body MUST be `{ "status": "ok" }`. The system MUST expose `POST /auth/register` without authentication as a domain success route when the body is valid and the email is free. The system MUST expose `POST /auth/login` without authentication as a domain success route when the email and password match a persisted User. Other assignment domain paths (`POST /auth/logout`, `/accounts`, `/transactions`) MUST NOT succeed at this stage.

#### Scenario: Unauthenticated health check
- **WHEN** a client sends `GET /health` with no credentials
- **THEN** the response status is 200 and the JSON body equals `{ "status": "ok" }`

#### Scenario: Unauthenticated register is not treated as unknown
- **WHEN** a client sends `POST /auth/register` with a unique valid email and a valid password and no credentials
- **THEN** the response is HTTP 201 with `{ "id": string, "email": string }`, not the unknown-path 404 error body

#### Scenario: Unauthenticated login is not treated as unknown
- **WHEN** a client sends `POST /auth/login` with the email and password of an existing User and no credentials
- **THEN** the response is HTTP 200 with `{ "accessToken": string }`, not the unknown-path 404 error body

#### Scenario: Other domain routes are not available
- **WHEN** a client sends `POST /auth/logout` or another assignment domain path other than `POST /auth/register` and `POST /auth/login`
- **THEN** the response is the uniform error JSON (not a domain success payload)

### Requirement: Process requires a validated JWT signing secret
The system MUST load a non-empty JWT signing secret from validated application configuration before accepting HTTP requests. If that secret is missing or empty, the process MUST NOT serve HTTP.

#### Scenario: Missing JWT secret prevents HTTP
- **WHEN** the process starts without a non-empty validated JWT signing secret
- **THEN** the process MUST exit without serving HTTP

## REMOVED Requirements

### Requirement: Health and registration are unauthenticated public routes
**Reason**: `POST /auth/login` is now a successful unauthenticated domain route; health and register are no longer the only public success paths.
**Migration**: Call `POST /auth/login` for an access token (200/400/401). Keep `GET /health` and `POST /auth/register`. Other `/auth/*` (logout), `/accounts`, and `/transactions` paths remain unavailable.
