## ADDED Requirements

### Requirement: HTTP server becomes ready after database connection
The system MUST listen for HTTP requests using the validated `PORT` only after a successful database connection using the validated `DATABASE_URL`. If that connection fails, the process MUST NOT accept HTTP requests.

#### Scenario: Health after connected start
- **WHEN** PostgreSQL is reachable with the validated `DATABASE_URL` and the process has started
- **THEN** `GET /health` returns HTTP 200 and body `{ "status": "ok" }`

#### Scenario: Unreachable database prevents HTTP
- **WHEN** PostgreSQL is not reachable and the process attempts to start with valid required config including `DATABASE_URL`
- **THEN** the process MUST exit without serving HTTP

## REMOVED Requirements

### Requirement: HTTP server becomes ready without PostgreSQL
**Reason**: The process now initializes a database connection before binding a port; a down database is no longer a supported ready state.
**Migration**: Start PostgreSQL (Compose) and apply migrations before running the app; do not expect `GET /health` if the process failed to connect.
