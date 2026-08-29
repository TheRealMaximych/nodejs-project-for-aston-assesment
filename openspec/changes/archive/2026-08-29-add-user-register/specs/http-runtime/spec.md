## ADDED Requirements

### Requirement: Health and registration are unauthenticated public routes
The system MUST expose `GET /health` without authentication. The health response status MUST be 200 and the JSON body MUST be `{ "status": "ok" }`. The system MUST expose `POST /auth/register` without authentication as a domain success route when the body is valid and the email is free. Other assignment domain paths (`POST /auth/login`, `POST /auth/logout`, `/accounts`, `/transactions`) MUST NOT succeed at this stage.

#### Scenario: Unauthenticated health check
- **WHEN** a client sends `GET /health` with no credentials
- **THEN** the response status is 200 and the JSON body equals `{ "status": "ok" }`

#### Scenario: Unauthenticated register is not treated as unknown
- **WHEN** a client sends `POST /auth/register` with a unique valid email and a valid password and no credentials
- **THEN** the response is HTTP 201 with `{ "id": string, "email": string }`, not the unknown-path 404 error body

#### Scenario: Other domain routes are not available
- **WHEN** a client sends `POST /auth/login` or another assignment domain path other than `POST /auth/register`
- **THEN** the response is the uniform error JSON (not a domain success payload)

## REMOVED Requirements

### Requirement: Health check is the only successful public route
**Reason**: `POST /auth/register` is now a successful unauthenticated domain route; health is no longer the only public success path.
**Migration**: Call `POST /auth/register` for user creation (201/400/409). Keep `GET /health` as `{ "status": "ok" }`. Other `/auth/*`, `/accounts`, and `/transactions` paths remain unavailable.
