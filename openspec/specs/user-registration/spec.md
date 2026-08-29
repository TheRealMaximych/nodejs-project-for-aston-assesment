# user-registration Specification

## Purpose

Lets an unauthenticated client create a User with a unique email and a stored password hash, returning only public identity fields.

## Requirements

### Requirement: Unauthenticated registration creates a user
The system MUST accept `POST /auth/register` without credentials. A valid JSON body `{ "email": string, "password": string }` MUST create a persisted User and MUST respond with HTTP 201 and JSON `{ "id": string, "email": string }`. The `id` MUST be the User UUID encoded as a JSON string. The `email` in the response MUST equal the stored unique email for that User.

#### Scenario: Successful registration
- **WHEN** a client sends `POST /auth/register` with a unique valid email and a valid password and no authentication
- **THEN** the response status is 201 and the body is `{ "id": string, "email": string }` whose `email` matches the registered address and whose `id` is a UUID string

#### Scenario: User is persisted
- **WHEN** registration succeeds
- **THEN** a User row exists with that email, a password hash, a `createdAt` timestamp, and a `tokenVersion` suitable for later logout

### Requirement: Response omits secrets and internal fields
A successful registration response MUST contain only `id` and `email`. It MUST NOT include `password`, the password hash, or `tokenVersion`.

#### Scenario: Sensitive fields are absent
- **WHEN** registration returns 201
- **THEN** the JSON object has keys `id` and `email` only and does not include `password`, hash, or `tokenVersion`

### Requirement: Password is stored as an asynchronous hash
The system MUST persist a password hash, never plaintext. Hashing on the request path MUST use asynchronous APIs (`async`/`await`) and MUST NOT use synchronous CPU-bound crypto that blocks the event loop. The plaintext password MUST NOT be written to the database.

#### Scenario: Stored credential is a hash
- **WHEN** registration succeeds
- **THEN** the persisted password value is a hash of the submitted password and is not equal to the plaintext password

#### Scenario: Hashing does not use sync crypto
- **WHEN** a password is hashed during registration
- **THEN** the hash operation is awaited asynchronously and MUST NOT be a synchronous crypto/hash call on the request path

### Requirement: Duplicate email is a conflict
When the email is already taken (including after case-normalizing the address), registration MUST fail with a conflict domain error so the client receives HTTP 409 and body `{ "error": string, "statusCode": 409 }`. A second User with that email MUST NOT be created.

#### Scenario: Repeated email is rejected
- **WHEN** a client registers with an email that already belongs to a User
- **THEN** the response status is 409, the body is `{ "error": string, "statusCode": 409 }`, and no additional User is persisted for that email

### Requirement: Invalid registration body is validation
Missing `email` or `password`, an empty password, a password shorter than 8 characters, or a value that is not an email address MUST be a validation domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. No User MUST be persisted for that request.

#### Scenario: Missing fields
- **WHEN** a client sends `POST /auth/register` with a body that omits `email` or `password`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no User is created

#### Scenario: Invalid email
- **WHEN** a client sends `POST /auth/register` with a `password` of at least 8 characters and an `email` that is not an email address
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no User is created

#### Scenario: Password too short
- **WHEN** a client sends `POST /auth/register` with a valid unique email and a `password` shorter than 8 characters
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no User is created

### Requirement: Registration is logged without secrets
On successful registration the system MUST write a log line whose message is `User registered: email=<email>` using the registered email. Logs for this operation MUST NOT contain the plaintext password, the password hash, or `tokenVersion`.

#### Scenario: Success log includes email only
- **WHEN** registration succeeds for a given email
- **THEN** the application log contains `User registered: email=` followed by that email and does not contain the password, hash, or `tokenVersion`
