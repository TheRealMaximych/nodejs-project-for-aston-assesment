## Purpose

Lets an authenticated client read the persisted operations of a BankAccount they own, including both outgoing and incoming transfers, without exposing another user's history.

## ADDED Requirements

### Requirement: Authenticated owner can read their account history
The system MUST accept `GET /transactions/:accountId` only after successful request authentication. When `:accountId` identifies a persisted BankAccount whose `userId` is the authenticated User, the system MUST respond with HTTP 200 and a JSON array of history items for that account.

#### Scenario: Successful own history with operations
- **WHEN** a client sends `GET /transactions/:accountId` with a valid Bearer access token for the User who owns that account and that account has at least one persisted Transaction as `fromAccount` or `toAccount`
- **THEN** the response status is 200 and the body is a JSON array whose length equals the number of matching Transaction rows and each element includes that account as `fromAccount` or `toAccount`

### Requirement: History item fields match the assignment contract
Each history item MUST be a JSON object with exactly the keys `transactionId`, `fromAccount`, `toAccount`, `amount`, `timestamp`, and `status`. `transactionId`, `fromAccount`, and `toAccount` MUST be UUID strings. `amount` MUST be a JSON string of a decimal amount (not an IEEE `number`). `timestamp` MUST be an ISO 8601 date-time string. `status` MUST be `Completed` or `Failed` as stored. The object MUST NOT include an `id` key in place of `transactionId`.

#### Scenario: Item keys and types
- **WHEN** a successful history read returns 200 with a non-empty array
- **THEN** each element has only those six keys, `transactionId` / `fromAccount` / `toAccount` are UUID strings, `typeof amount` is string, `timestamp` is an ISO 8601 string, and `status` is `Completed` or `Failed`

#### Scenario: Amount is a string not an IEEE number
- **WHEN** a successful history read returns 200 with a non-empty array
- **THEN** each item's `amount` is a JSON string of the stored decimal amount and MUST NOT be a JSON number

### Requirement: History includes outgoing and incoming transactions
The result MUST include every persisted Transaction whose `fromAccount` equals `:accountId` or whose `toAccount` equals `:accountId`. A Transaction that matches both (same-account) MUST appear once. Transactions that involve neither side MUST NOT appear.

#### Scenario: Outgoing and incoming are both listed
- **WHEN** an owned account is the `fromAccount` of one Transaction and the `toAccount` of a different Transaction
- **THEN** the 200 array contains both Transaction rows (two items) and no Transaction that does not involve that account

### Requirement: History is sorted by timestamp descending
The JSON array MUST be ordered by Transaction `timestamp` in descending order (newest first). This ordering is required, not optional.

#### Scenario: Newer operation appears first
- **WHEN** an owned account has two matching Transactions with different timestamps
- **THEN** the first array element has the later `timestamp` and the second has the earlier `timestamp`

### Requirement: Empty own history is an empty array
When `:accountId` identifies a persisted BankAccount owned by the authenticated User and no Transaction has that account as `fromAccount` or `toAccount`, the system MUST respond with HTTP 200 and JSON `[]`. The response MUST NOT be 404 solely because the history is empty.

#### Scenario: Own account with no operations
- **WHEN** an authenticated client requests history for an account they own that has no matching Transaction rows
- **THEN** the response status is 200 and the body is `[]`

### Requirement: Foreign account history is forbidden
When `:accountId` identifies a persisted BankAccount whose `userId` is not the authenticated User, the system MUST fail with a forbidden domain error so the client receives HTTP 403 and body `{ "error": string, "statusCode": 403 }`. The failure MUST NOT be treated as not-found. The response MUST NOT include another user's Transaction rows.

#### Scenario: Other user's account is 403
- **WHEN** an authenticated client requests `GET /transactions/:accountId` for an account that exists and belongs to a different User
- **THEN** the response status is 403 and the body is `{ "error": string, "statusCode": 403 }`

### Requirement: Missing account is not found
When `:accountId` does not identify a persisted BankAccount, the system MUST fail with a not-found domain error so the client receives HTTP 404 and body `{ "error": string, "statusCode": 404 }`.

#### Scenario: Unknown account id is 404
- **WHEN** an authenticated client requests `GET /transactions/:accountId` with a well-formed UUID that matches no BankAccount
- **THEN** the response status is 404 and the body is `{ "error": string, "statusCode": 404 }`

### Requirement: History without a Bearer token is unauthorized
When `GET /transactions/:accountId` has no Bearer access token, the system MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The response MUST NOT be the unknown-path 404 body.

#### Scenario: Missing Bearer on history is 401
- **WHEN** a client sends `GET /transactions/:accountId` with no `Authorization` header
- **THEN** the response status is 401 and the body is `{ "error": string, "statusCode": 401 }`

### Requirement: Non-UUID account id is validation
A `:accountId` that is not a UUID MUST be a validation domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`, not 404.

#### Scenario: Non-UUID account id is 400
- **WHEN** an authenticated client sends `GET /transactions/:accountId` with an `:accountId` that is not a UUID
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`
