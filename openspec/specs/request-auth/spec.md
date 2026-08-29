# request-auth Specification

## Purpose

Authenticates incoming HTTP requests with a Bearer JWT access token and the User's persisted `tokenVersion`, so protected handlers receive `userId` and rejected tokens surface as HTTP 401.

## Requirements

### Requirement: Missing or non-Bearer credentials are unauthorized
A protected request MUST include an `Authorization` header whose value is `Bearer` followed by a single access token. A missing header, a scheme other than `Bearer`, or an empty token MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The handler after the guard MUST NOT run.

#### Scenario: No Authorization header is 401
- **WHEN** a client sends a protected request with no `Authorization` header
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Header without Bearer is 401
- **WHEN** a client sends a protected request whose `Authorization` header is not `Bearer` plus a token (for example a raw JWT with no scheme)
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Empty Bearer token is 401
- **WHEN** a client sends a protected request with `Authorization` equal to `Bearer` and no token
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

### Requirement: Invalid or expired access token is unauthorized
An access token that is malformed, has an invalid signature, or is expired MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. Verification MUST use the validated JWT signing secret and token rules from application config. HTTP handlers and business-logic services MUST NOT read `process.env` for that secret.

#### Scenario: Invalid signature is 401
- **WHEN** a client sends a protected request with a Bearer token that is not a valid signature for this system's JWT secret
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Expired token is 401
- **WHEN** a client sends a protected request with a Bearer token whose expiry is in the past
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Secret comes from validated config
- **WHEN** the system verifies an access token
- **THEN** the signing secret is taken from validated application configuration and not from unvalidated environment variables in HTTP or service code

### Requirement: Access token version must match the persisted User
After the token verifies, the system MUST load that User's current `tokenVersion` and MUST compare it to the `tokenVersion` claim. If the User does not exist, or the claim does not equal the persisted value, the request MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. A version mismatch MUST NOT be treated as 403.

#### Scenario: Stale tokenVersion is 401
- **WHEN** a client sends a protected request with a Bearer token whose `userId` exists but whose `tokenVersion` claim is not equal to that User's persisted `tokenVersion`
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Unknown userId in token is 401
- **WHEN** a client sends a protected request with a Bearer token whose signature is valid but whose `userId` does not match a persisted User
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

### Requirement: Successful authentication exposes userId to the handler
When the Bearer token is valid, unexpired, and its `tokenVersion` matches the persisted User, the request MUST proceed and the following handler MUST have that User's `userId` (UUID string). The system MUST NOT attach password, password hash, or the JWT string as data for later handlers.

#### Scenario: Handler receives userId
- **WHEN** a protected request presents a valid current access token for a User
- **THEN** the request continues and the next handler can read that User's `userId`

### Requirement: Authentication does not log the JWT
Logs for authentication success or failure MUST NOT contain the JWT string, the `Authorization` header value, or `accessToken`. Failures MAY be logged without those secrets.

#### Scenario: Token value is absent from logs
- **WHEN** a protected request is authenticated or rejected because of the token
- **THEN** the application log does not contain the JWT, `accessToken`, or the `Authorization` header value
