# http-runtime Specification

## Purpose

An HTTP JSON process starts after a successful database connection and without banking domain routes, exposing only a health check and returning every error in a single client-safe body shape.

## Requirements

### Requirement: HTTP server becomes ready after database connection
The system MUST listen for HTTP requests using the validated `PORT` only after a successful database connection using the validated `DATABASE_URL`. If that connection fails, the process MUST NOT accept HTTP requests.

#### Scenario: Health after connected start
- **WHEN** PostgreSQL is reachable with the validated `DATABASE_URL` and the process has started
- **THEN** `GET /health` returns HTTP 200 and body `{ "status": "ok" }`

#### Scenario: Unreachable database prevents HTTP
- **WHEN** PostgreSQL is not reachable and the process attempts to start with valid required config including `DATABASE_URL`
- **THEN** the process MUST exit without serving HTTP

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

### Requirement: Logout is the only protected assignment route at this stage
`POST /auth/logout` MUST run authentication before the logout handler. Account and transfer assignment routes MUST still be absent. Authentication MUST NOT be required for `GET /health`, `POST /auth/register`, or `POST /auth/login`.

#### Scenario: Protected logout is not 404 when authenticated
- **WHEN** a client sends `POST /auth/logout` with a valid current access token
- **THEN** the response is not the unknown-path 404 error body

#### Scenario: Public auth routes stay unauthenticated
- **WHEN** a client sends `POST /auth/login` or `POST /auth/register` without an `Authorization` header and with a valid body for that route
- **THEN** the request is not rejected as 401 solely for missing Bearer credentials

### Requirement: Process requires a validated JWT signing secret
The system MUST load a non-empty JWT signing secret from validated application configuration before accepting HTTP requests. If that secret is missing or empty, the process MUST NOT serve HTTP.

#### Scenario: Missing JWT secret prevents HTTP
- **WHEN** the process starts without a non-empty validated JWT signing secret
- **THEN** the process MUST exit without serving HTTP

### Requirement: JSON is the wire format
The system MUST parse JSON request bodies and MUST send JSON for the health success body and for all error responses.

#### Scenario: Health body is JSON
- **WHEN** a client calls `GET /health`
- **THEN** the response `Content-Type` is JSON and the body parses as `{ "status": "ok" }`

### Requirement: Uniform error response body
Every error response MUST use the JSON body `{ "error": string, "statusCode": number }`. The `statusCode` field MUST equal the HTTP status code of that response.

#### Scenario: Unknown path
- **WHEN** a client requests a path that is not a defined route (for example `GET /no-such-route`)
- **THEN** the HTTP status is 404 and the body is `{ "error": string, "statusCode": 404 }` with a non-empty `error` string

### Requirement: Known domain failures map to assignment HTTP statuses
When request handling fails with a recognized domain error kind, the HTTP response MUST use body `{ "error": string, "statusCode": number }` and the status code MUST match that kind: 400 for validation, insufficient funds, currency mismatch, and same-account transfer; 401 for missing or invalid token; 403 for a foreign account (balance, history, or debit source); 404 for a missing entity; 409 for an email that is already taken. The `statusCode` field MUST equal the HTTP status. The insufficient-funds `error` field MUST be `Insufficient funds`.

#### Scenario: Validation maps to 400
- **WHEN** request handling fails with a validation domain error
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` with a non-empty `error` string

#### Scenario: Insufficient funds maps to 400 with fixed message
- **WHEN** request handling fails with an insufficient-funds domain error
- **THEN** the response status is 400 and the body is `{ "error": "Insufficient funds", "statusCode": 400 }`

#### Scenario: Currency mismatch maps to 400
- **WHEN** request handling fails with a currency-mismatch domain error
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`

#### Scenario: Same-account transfer maps to 400
- **WHEN** request handling fails with a same-account domain error
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`

#### Scenario: Unauthorized maps to 401
- **WHEN** request handling fails with an unauthorized domain error (missing or invalid token)
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Forbidden foreign account maps to 403
- **WHEN** request handling fails with a forbidden domain error for a foreign account
- **THEN** the response status is 403 and the body is `{ "error": string, "statusCode": 403 }`

#### Scenario: Missing entity maps to 404
- **WHEN** request handling fails with a not-found domain error for a missing entity
- **THEN** the response status is 404 and the body is `{ "error": string, "statusCode": 404 }`

#### Scenario: Duplicate email maps to 409
- **WHEN** request handling fails with a conflict domain error because the email is already taken
- **THEN** the response status is 409 and the body is `{ "error": string, "statusCode": 409 }`

### Requirement: Unhandled failures are client-safe 500s
When a request fails due to an unexpected/unhandled error, the system MUST respond with HTTP 500 and body `{ "error": string, "statusCode": 500 }`. The `error` string MUST NOT include a stack trace, file paths, SQL, or other internal implementation details. Recognized domain error kinds MUST NOT be treated as unhandled: they MUST use the assignment status mapping instead of 500.

#### Scenario: Unhandled error hides internals
- **WHEN** a request handler throws or rejects with an unexpected error that includes a stack trace or internal message
- **THEN** the client receives HTTP 500 with `{ "error": string, "statusCode": 500 }` and the `error` value does not contain a stack trace or those internal details

#### Scenario: Generic Error is unhandled
- **WHEN** a request handler throws or rejects with a generic `Error` that is not a recognized domain error kind
- **THEN** the client receives HTTP 500 with `{ "error": string, "statusCode": 500 }` and the `error` value does not echo the original internal message

### Requirement: Errors are logged without secrets
The system MUST log unhandled request errors. Log output MUST NOT contain passwords, password hashes, JWT values, access tokens, or other token secrets.

#### Scenario: Unhandled error is logged
- **WHEN** an unhandled error occurs while handling a request
- **THEN** the error is written to the application log

#### Scenario: Secrets are not logged
- **WHEN** an error is logged and the related request or error object could contain `password`, password hash, JWT, or token fields
- **THEN** those secret values MUST NOT appear in the log output

### Requirement: Strict TypeScript build
Application TypeScript MUST compile with `strict` enabled. The documented `build` script MUST succeed on the application sources of this stage.

#### Scenario: Production compile
- **WHEN** a developer runs the documented `build` script
- **THEN** TypeScript compilation completes successfully with `strict` type checking
