# user-logout Specification

## Purpose

Lets an authenticated client invalidate the current JWT access token on the server by raising the User's `tokenVersion`, so that same token cannot be used again.

## Requirements

### Requirement: Authenticated logout invalidates the current access token
The system MUST accept `POST /auth/logout` only after successful request authentication. A successful logout MUST increase that User's persisted `tokenVersion` so the access token used on the request is no longer valid. The response MUST be HTTP 204 with an empty body. The response MUST NOT include `accessToken`, `password`, the password hash, or `tokenVersion`.

#### Scenario: Successful logout
- **WHEN** a client sends `POST /auth/logout` with a valid Bearer access token whose `tokenVersion` matches the User
- **THEN** the response status is 204 with an empty body and that User's persisted `tokenVersion` is greater than the value in the token

#### Scenario: Response has no secrets
- **WHEN** logout returns 204
- **THEN** the body does not include `accessToken`, `password`, hash, or `tokenVersion`

### Requirement: Logout without a Bearer token is unauthorized not unknown
When `POST /auth/logout` has no Bearer access token, the system MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The response MUST NOT be the unknown-path 404 body. The User's `tokenVersion` MUST NOT change.

#### Scenario: Missing Bearer on logout is 401
- **WHEN** a client sends `POST /auth/logout` with no `Authorization` header
- **THEN** the response status is 401, the body is `{ "error": string, "statusCode": 401 }`, and no User `tokenVersion` is increased

### Requirement: The same access token is rejected after logout
After a successful logout, presenting the same access token on a protected request (including another `POST /auth/logout`) MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. A later login MAY issue a new access token with the updated `tokenVersion`.

#### Scenario: Reused token after logout is 401
- **WHEN** a client successfully logs out and then sends `POST /auth/logout` again with the same `accessToken`
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Stale tokenVersion is rejected by authentication
- **WHEN** authentication is attempted with claims whose `tokenVersion` is the value from before a successful logout for that User
- **THEN** authentication fails with an unauthorized domain error and MUST NOT treat the request as authenticated

### Requirement: Logout is logged without secrets
On successful logout the system MUST write a log line whose message is `User logout successful: userId=<userId>` using the User UUID. Logs for this operation MUST NOT contain the plaintext password, the password hash, the JWT value, or `accessToken`.

#### Scenario: Success log includes userId only
- **WHEN** logout succeeds for a given User
- **THEN** the application log contains `User logout successful: userId=` followed by that User's id and does not contain the password, hash, JWT, or `accessToken`
