## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Unhandled failures are client-safe 500s
When a request fails due to an unexpected/unhandled error, the system MUST respond with HTTP 500 and body `{ "error": string, "statusCode": 500 }`. The `error` string MUST NOT include a stack trace, file paths, SQL, or other internal implementation details. Recognized domain error kinds MUST NOT be treated as unhandled: they MUST use the assignment status mapping instead of 500.

#### Scenario: Unhandled error hides internals
- **WHEN** a request handler throws or rejects with an unexpected error that includes a stack trace or internal message
- **THEN** the client receives HTTP 500 with `{ "error": string, "statusCode": 500 }` and the `error` value does not contain a stack trace or those internal details

#### Scenario: Generic Error is unhandled
- **WHEN** a request handler throws or rejects with a generic `Error` that is not a recognized domain error kind
- **THEN** the client receives HTTP 500 with `{ "error": string, "statusCode": 500 }` and the `error` value does not echo the original internal message
