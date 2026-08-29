# http-runtime Specification

## Purpose

An HTTP JSON process starts without a database and without banking domain routes, exposing only a health check and returning every error in a single client-safe body shape.

## Requirements

### Requirement: HTTP server becomes ready without PostgreSQL
The system MUST listen for HTTP requests using the validated `PORT`. Becoming ready MUST NOT require a running PostgreSQL instance or any database driver connection.

#### Scenario: Health works when the database is down
- **WHEN** PostgreSQL is not running and the process has started with valid required config
- **THEN** `GET /health` still returns HTTP 200

### Requirement: Health check is the only successful public route
The system MUST expose `GET /health` without authentication. The response status MUST be 200 and the JSON body MUST be `{ "status": "ok" }`. Domain banking routes from the assignment (`/auth/*`, `/accounts`, `/transactions`) MUST NOT succeed at this stage.

#### Scenario: Unauthenticated health check
- **WHEN** a client sends `GET /health` with no credentials
- **THEN** the response status is 200 and the JSON body equals `{ "status": "ok" }`

#### Scenario: Domain routes are not available
- **WHEN** a client sends `POST /auth/register` or another assignment domain path
- **THEN** the response is the uniform error JSON (not a domain success payload)

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

### Requirement: Unhandled failures are client-safe 500s
When a request fails due to an unexpected/unhandled error, the system MUST respond with HTTP 500 and body `{ "error": string, "statusCode": 500 }`. The `error` string MUST NOT include a stack trace, file paths, SQL, or other internal implementation details.

#### Scenario: Unhandled error hides internals
- **WHEN** a request handler throws or rejects with an unexpected error that includes a stack trace or internal message
- **THEN** the client receives HTTP 500 with `{ "error": string, "statusCode": 500 }` and the `error` value does not contain a stack trace or those internal details

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
