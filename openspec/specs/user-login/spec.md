# user-login Specification

## Purpose

Lets an unauthenticated client exchange a registered email and password for a JWT access token whose payload carries `userId` and `tokenVersion` for later logout.

## Requirements

### Requirement: Unauthenticated login issues an access token
The system MUST accept `POST /auth/login` without credentials. A JSON body `{ "email": string, "password": string }` that matches a persisted User MUST respond with HTTP 200 and JSON `{ "accessToken": string }`. The `accessToken` MUST be a JWT access token (not a refresh token). Email matching MUST use the same case-normalized address stored at registration (trim and lowercase).

#### Scenario: Successful login
- **WHEN** a client sends `POST /auth/login` with the email and password of an existing User and no authentication
- **THEN** the response status is 200 and the body is `{ "accessToken": string }` whose `accessToken` is a non-empty JWT string

#### Scenario: Email is matched case-insensitively
- **WHEN** a client logs in with the same address as a registered User except for letter case or surrounding whitespace
- **THEN** the response status is 200 and the body contains `accessToken`

### Requirement: Login response contains only the access token
A successful login response MUST contain only `accessToken`. It MUST NOT include `id`, `email`, `password`, the password hash, `tokenVersion`, or a refresh token.

#### Scenario: Response keys are only accessToken
- **WHEN** login returns 200
- **THEN** the JSON object has the key `accessToken` only and does not include `id`, `email`, `password`, hash, `tokenVersion`, or a refresh token field

### Requirement: Access token payload includes userId and tokenVersion
The issued JWT MUST include claims `userId` (the User UUID as a string) and `tokenVersion` (the User's current token version). The token MUST be signed with the validated JWT signing secret and MUST expire according to the validated token lifetime from application config. HTTP handlers and business-logic services MUST NOT read `process.env` for the JWT secret or token lifetime.

#### Scenario: Payload carries identity and version
- **WHEN** login succeeds for a User
- **THEN** the access token payload contains that User's `userId` and that User's `tokenVersion`

#### Scenario: Secret and lifetime come from validated config
- **WHEN** the system signs an access token
- **THEN** the signing secret and expiry are taken from validated application configuration and not from unvalidated environment variables in HTTP or service code

### Requirement: Wrong email or password is unauthorized without enumeration
When no User exists for the (normalized) email, or the password does not match the stored hash, login MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The `error` string MUST be the same for unknown email and wrong password. The response MUST NOT indicate whether the email is registered.

#### Scenario: Unknown email is 401
- **WHEN** a client sends `POST /auth/login` with a well-formed email that is not registered and a password
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Wrong password is 401
- **WHEN** a client sends `POST /auth/login` with a registered email and a password that does not match the stored hash
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

#### Scenario: Failure message does not distinguish the cause
- **WHEN** one client uses an unknown email and another uses a registered email with a wrong password
- **THEN** both responses have status 401 and the same `error` string

### Requirement: Invalid login body is validation
Missing `email` or `password`, an empty password, or a value that is not an email address MUST be a validation domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. The system MUST NOT issue an access token for that request.

#### Scenario: Missing fields
- **WHEN** a client sends `POST /auth/login` with a body that omits `email` or `password`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no access token is issued

#### Scenario: Invalid email
- **WHEN** a client sends `POST /auth/login` with a `password` and an `email` that is not an email address
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no access token is issued

#### Scenario: Empty password
- **WHEN** a client sends `POST /auth/login` with a valid email format and an empty `password`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no access token is issued

### Requirement: Password comparison is asynchronous
Verifying the password on the request path MUST use an asynchronous comparison against the stored hash (`async`/`await`) and MUST NOT use a synchronous CPU-bound crypto/compare call that blocks the event loop. The stored hash MUST NOT be returned to the client.

#### Scenario: Compare is awaited
- **WHEN** a password is checked during login
- **THEN** the comparison is awaited asynchronously and MUST NOT be a synchronous crypto/compare call on the request path

### Requirement: Login is logged without secrets
On successful login the system MUST write a log line whose message is `User login successful: userId=<userId>` using the User UUID. Logs for this operation MUST NOT contain the plaintext password, the password hash, the JWT value, or `accessToken`. Failed login MUST NOT log the password, hash, or token.

#### Scenario: Success log includes userId only
- **WHEN** login succeeds for a given User
- **THEN** the application log contains `User login successful: userId=` followed by that User's id and does not contain the password, hash, JWT, or `accessToken`
