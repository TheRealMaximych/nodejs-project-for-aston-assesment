## Purpose

Lets an authenticated client create BankAccount rows owned by the JWT `userId` and read the balance of an account they own, using decimal money that is never an IEEE floating-point JSON number.

## ADDED Requirements

### Requirement: Authenticated create opens an account for the JWT user
The system MUST accept `POST /accounts` only after successful request authentication. A valid JSON body `{ "accountHolder": string, "currency": string }` MUST create a persisted BankAccount whose `userId` is the authenticated User's UUID (not a client-supplied owner) and MUST respond with HTTP 201 and JSON `{ "id": string, "accountHolder": string, "balance": string, "currency": string }`. The `id` MUST be the account UUID encoded as a JSON string. Opening `balance` MUST represent zero. A User MUST be allowed to own more than one BankAccount.

#### Scenario: Successful create
- **WHEN** a client sends `POST /accounts` with a valid Bearer access token and a valid `{ "accountHolder", "currency" }` body
- **THEN** the response status is 201 and the body is `{ "id": string, "accountHolder": string, "balance": string, "currency": string }` whose `accountHolder` and `currency` match the stored account and whose `id` is a UUID string

#### Scenario: Owner is the authenticated user
- **WHEN** account creation succeeds for an authenticated User
- **THEN** the persisted BankAccount `userId` equals that User's id and MUST NOT equal a `userId` value from the request body if one was sent

#### Scenario: Opening balance is zero
- **WHEN** account creation succeeds
- **THEN** the persisted balance represents zero and the response `balance` represents zero even if the client sent a non-zero `balance` field

#### Scenario: Multiple accounts per user
- **WHEN** the same authenticated User successfully creates two accounts
- **THEN** both rows persist with distinct `id` values and the same `userId`

### Requirement: Create response omits owner and timestamps
A successful create response MUST contain only `id`, `accountHolder`, `balance`, and `currency`. It MUST NOT include `userId` or `createdAt`.

#### Scenario: Internal fields are absent
- **WHEN** account creation returns 201
- **THEN** the JSON object has keys `id`, `accountHolder`, `balance`, and `currency` only and does not include `userId` or `createdAt`

### Requirement: Balance in JSON is a decimal string not an IEEE number
JSON fields that represent money (`balance` on create and on the balance endpoint) MUST be JSON strings of a decimal amount. Those fields MUST NOT be JSON numbers (IEEE-754 `number`).

#### Scenario: Create balance is a string
- **WHEN** account creation returns 201
- **THEN** `typeof` of the JSON `balance` value is string and that string represents the stored decimal amount

#### Scenario: Get-balance payload is a string
- **WHEN** a successful balance read returns 200
- **THEN** the body is `{ "balance": string }` and `balance` is not a JSON number

### Requirement: Authenticated owner can read their account balance
The system MUST accept `GET /accounts/:id/balance` only after successful request authentication. When `:id` identifies a persisted BankAccount whose `userId` is the authenticated User, the system MUST respond with HTTP 200 and JSON `{ "balance": string }` whose value equals that account's stored decimal balance.

#### Scenario: Successful own balance
- **WHEN** a client sends `GET /accounts/:id/balance` with a valid Bearer access token for the User who owns that account
- **THEN** the response status is 200 and the body is `{ "balance": string }` matching the stored balance

### Requirement: Foreign account balance is forbidden
When `:id` identifies a persisted BankAccount whose `userId` is not the authenticated User, the system MUST fail with a forbidden domain error so the client receives HTTP 403 and body `{ "error": string, "statusCode": 403 }`. The failure MUST NOT be treated as not-found.

#### Scenario: Other user's account is 403
- **WHEN** an authenticated client requests `GET /accounts/:id/balance` for an account that exists and belongs to a different User
- **THEN** the response status is 403 and the body is `{ "error": string, "statusCode": 403 }`

### Requirement: Missing account is not found
When `:id` does not identify a persisted BankAccount, the system MUST fail with a not-found domain error so the client receives HTTP 404 and body `{ "error": string, "statusCode": 404 }`.

#### Scenario: Unknown account id is 404
- **WHEN** an authenticated client requests `GET /accounts/:id/balance` with a well-formed UUID that matches no BankAccount
- **THEN** the response status is 404 and the body is `{ "error": string, "statusCode": 404 }`

### Requirement: Account routes without a Bearer token are unauthorized
When `POST /accounts` or `GET /accounts/:id/balance` has no Bearer access token, the system MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The response MUST NOT be the unknown-path 404 body. No BankAccount MUST be created for that request.

#### Scenario: Missing Bearer on create is 401
- **WHEN** a client sends `POST /accounts` with no `Authorization` header
- **THEN** the response status is 401, the body is `{ "error": string, "statusCode": 401 }`, and no BankAccount is persisted

#### Scenario: Missing Bearer on balance is 401
- **WHEN** a client sends `GET /accounts/:id/balance` with no `Authorization` header
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

### Requirement: Invalid create body is validation
Missing `accountHolder` or `currency`, an empty or whitespace-only `accountHolder`, or a `currency` that is not a three-letter ISO 4217 alphabetic code MUST be a validation domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. No BankAccount MUST be persisted for that request. Currency MUST be stored as uppercase ISO 4217 (for example `USD`). A `:id` that is not a UUID on `GET /accounts/:id/balance` MUST be a validation domain error (HTTP 400), not 404.

#### Scenario: Missing fields
- **WHEN** an authenticated client sends `POST /accounts` with a body that omits `accountHolder` or `currency`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no BankAccount is created

#### Scenario: Empty accountHolder
- **WHEN** an authenticated client sends `POST /accounts` with a non-empty valid `currency` and an `accountHolder` that is empty or only whitespace
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no BankAccount is created

#### Scenario: Invalid currency
- **WHEN** an authenticated client sends `POST /accounts` with a non-empty `accountHolder` and a `currency` that is not a three-letter ISO 4217 alphabetic code
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no BankAccount is created

#### Scenario: Non-UUID account id is 400
- **WHEN** an authenticated client sends `GET /accounts/:id/balance` with an `:id` that is not a UUID
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`

### Requirement: Account creation is logged without secrets
On successful account creation the system MUST write a log line whose message is `Account created: accountId=<accountId>, userId=<userId>` using the new account UUID and the owner User UUID. Logs for this operation MUST NOT contain passwords, password hashes, JWT values, or `accessToken`.

#### Scenario: Success log includes accountId and userId
- **WHEN** account creation succeeds for a given User
- **THEN** the application log contains `Account created: accountId=` followed by that account id and `userId=` followed by that User's id and does not contain a password, hash, JWT, or `accessToken`

### Requirement: There is no deposit API in this capability
The system MUST NOT expose an HTTP endpoint that credits an existing BankAccount. New accounts MUST open at zero balance; non-zero demo balances are out of scope for this change.

#### Scenario: Create is the only way to open a zero-balance account
- **WHEN** a client creates an account through `POST /accounts`
- **THEN** the stored balance is zero and no separate deposit route exists for changing that balance
