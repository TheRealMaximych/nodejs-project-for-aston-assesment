## Purpose

Lets an authenticated client move decimal funds from a BankAccount they own to any other BankAccount of the same currency, persisting an atomic Transaction without a deposit API or a history endpoint.

## ADDED Requirements

### Requirement: Authenticated transfer moves funds and records a completed transaction
The system MUST accept `POST /transactions` only after successful request authentication. A valid JSON body `{ "fromAccount": string, "toAccount": string, "amount": string }` MUST debit the source BankAccount, credit the destination BankAccount, persist a Transaction with status `Completed`, and MUST respond with HTTP 201 and JSON `{ "transactionId": string, "status": "Completed" }`. `transactionId` MUST be the Transaction UUID encoded as a JSON string. The destination account MAY belong to a different User than the authenticated User. `amount` in the request and in persistence MUST be a decimal string, not a JSON number.

#### Scenario: Successful transfer to own account
- **WHEN** an authenticated client sends `POST /transactions` with a valid Bearer access token, a `fromAccount` they own, a different `toAccount` they also own, matching currencies, and an `amount` string greater than zero that does not exceed the source balance
- **THEN** the response status is 201 and the body is `{ "transactionId": string, "status": "Completed" }` whose `transactionId` is a UUID string

#### Scenario: Successful transfer to another user's account
- **WHEN** an authenticated client sends `POST /transactions` with a `fromAccount` they own, a `toAccount` owned by a different User, matching currencies, and a sufficient positive `amount` string
- **THEN** the response status is 201, the body is `{ "transactionId": string, "status": "Completed" }`, the source balance decreases by `amount`, and the destination balance increases by `amount`

#### Scenario: Amount is a decimal string not an IEEE number
- **WHEN** transfer creation returns 201
- **THEN** the stored Transaction `amount` is a decimal string (or decimal type) and MUST NOT be a JavaScript `number`, and a request whose `amount` is a JSON number MUST be rejected as validation (HTTP 400)

### Requirement: Transfer response contains only transactionId and status
A successful transfer response MUST contain only `transactionId` and `status`. It MUST NOT include `fromAccount`, `toAccount`, `amount`, or `timestamp`.

#### Scenario: Internal and extra fields are absent
- **WHEN** transfer creation returns 201
- **THEN** the JSON object has keys `transactionId` and `status` only

### Requirement: Source account must belong to the authenticated user
When `fromAccount` identifies a persisted BankAccount whose `userId` is not the authenticated User, the system MUST fail with a forbidden domain error so the client receives HTTP 403 and body `{ "error": string, "statusCode": 403 }`. The failure MUST NOT be treated as not-found. The destination owner MUST NOT be required to match the authenticated User.

#### Scenario: Foreign fromAccount is 403
- **WHEN** an authenticated client requests a transfer whose `fromAccount` exists and belongs to a different User
- **THEN** the response status is 403, the body is `{ "error": string, "statusCode": 403 }`, no balances change, and no Completed Transaction is persisted

### Requirement: Missing account is not found
When `fromAccount` or `toAccount` does not identify a persisted BankAccount, the system MUST fail with a not-found domain error so the client receives HTTP 404 and body `{ "error": string, "statusCode": 404 }`. If `fromAccount` exists but is foreign, the system MUST use 403 and MUST NOT use 404 for that source.

#### Scenario: Unknown fromAccount is 404
- **WHEN** an authenticated client sends a well-formed UUID `fromAccount` that matches no BankAccount
- **THEN** the response status is 404 and the body is `{ "error": string, "statusCode": 404 }`

#### Scenario: Unknown toAccount is 404
- **WHEN** an authenticated client sends a transfer whose `fromAccount` they own and whose `toAccount` is a well-formed UUID that matches no BankAccount
- **THEN** the response status is 404 and the body is `{ "error": string, "statusCode": 404 }`

### Requirement: Amount must be greater than zero
Missing `fromAccount`, `toAccount`, or `amount`; an `amount` that is not a positive decimal string; or account ids that are not UUIDs MUST be a validation domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. `amount` MUST be greater than zero. Zero, negative, empty, and non-decimal `amount` values MUST be validation failures. No balances MUST change and no Completed Transaction MUST be persisted.

#### Scenario: Missing fields
- **WHEN** an authenticated client sends `POST /transactions` with a body that omits `fromAccount`, `toAccount`, or `amount`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`

#### Scenario: Non-positive amount
- **WHEN** an authenticated client sends `amount` `"0"`, `"0.00"`, or a negative decimal string with otherwise valid account ids
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no Completed Transaction is persisted

#### Scenario: Non-UUID account id is 400
- **WHEN** an authenticated client sends a `fromAccount` or `toAccount` that is not a UUID
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }`

### Requirement: Same-account transfer is rejected
A transfer whose `fromAccount` and `toAccount` are the same id MUST fail with a same-account domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. No balances MUST change.

#### Scenario: from equals to
- **WHEN** an authenticated client sends `POST /transactions` with the same UUID for `fromAccount` and `toAccount`
- **THEN** the response status is 400 and the body is `{ "error": string, "statusCode": 400 }` and no Completed Transaction is persisted

### Requirement: Currencies of source and destination must match
When both accounts exist and `fromAccount` belongs to the authenticated User, but the accounts' currencies differ, the system MUST fail with a currency-mismatch domain error so the client receives HTTP 400 and body `{ "error": string, "statusCode": 400 }`. The failure MUST NOT be an insufficient-funds error.

#### Scenario: Different currency is 400
- **WHEN** an authenticated client transfers from an owned account in one currency to an existing account in a different currency
- **THEN** the response status is 400, the body is `{ "error": string, "statusCode": 400 }`, and no balances change

### Requirement: Insufficient funds uses the exact error message
When both accounts exist, `fromAccount` belongs to the authenticated User, currencies match, `from` ≠ `to`, and `amount` is a valid positive decimal string that exceeds the source balance, the system MUST fail with an insufficient-funds domain error so the client receives HTTP 400 and body `{ "error": "Insufficient funds", "statusCode": 400 }`. The `error` field MUST be exactly `Insufficient funds`. No balances MUST change and no Completed Transaction MUST be persisted.

#### Scenario: Insufficient funds is 400 with fixed message
- **WHEN** an authenticated client transfers an amount greater than the owned source account's balance to a valid same-currency destination
- **THEN** the response status is 400, the body is `{ "error": "Insufficient funds", "statusCode": 400 }`, and the source balance is unchanged

### Requirement: Debit, credit, and transaction row are atomic
A successful transfer MUST debit the source, credit the destination, and persist the Completed Transaction inside a single database transaction. Concurrent transfers that debit the same source MUST NOT leave that source with a negative balance. The system MUST enforce this with row-level locks (`SELECT FOR UPDATE`) or a conditional balance `UPDATE` that only succeeds when the remaining balance is sufficient. If the protected debit cannot apply, the client MUST receive the insufficient-funds response and neither balance MUST change.

#### Scenario: Completed transfer updates both balances and inserts one row
- **WHEN** a transfer succeeds
- **THEN** the source balance is reduced by `amount`, the destination balance is increased by `amount`, and exactly one Transaction with status `Completed` is stored for that request

#### Scenario: Concurrent debits cannot go negative
- **WHEN** two authenticated transfers debit the same source concurrently and the combined amounts exceed the locked source balance
- **THEN** at most one transfer that would overdraw is rejected with insufficient funds, the source balance is never negative, and a rejected attempt does not credit the destination

### Requirement: Transfer routes without a Bearer token are unauthorized
When `POST /transactions` has no Bearer access token, the system MUST fail with an unauthorized domain error so the client receives HTTP 401 and body `{ "error": string, "statusCode": 401 }`. The response MUST NOT be the unknown-path 404 body. No balances MUST change.

#### Scenario: Missing Bearer on transfer is 401
- **WHEN** a client sends `POST /transactions` with no `Authorization` header
- **THEN** the response status is 401, the body is `{ "error": string, "statusCode": 401 }`, and no Transaction is persisted

### Requirement: Transfers are logged without secrets
On a successful transfer the system MUST write a log line whose message is `Transfer completed: from=<fromAccount> to=<toAccount> amount=<amount>` using the source UUID, destination UUID, and the decimal amount string. On a failed transfer attempt the system MUST write a log line whose message is `Transfer failed: from=<fromAccount>, reason=<reason>` (for insufficient funds the reason MUST be `insufficient funds`). Logs for this operation MUST NOT contain passwords, password hashes, JWT values, or `accessToken`.

#### Scenario: Success log includes from, to, and amount
- **WHEN** a transfer succeeds between two accounts
- **THEN** the application log contains `Transfer completed: from=` followed by the source id, `to=` followed by the destination id, and `amount=` followed by the amount, and does not contain a password, hash, JWT, or `accessToken`

#### Scenario: Insufficient funds is logged as failed
- **WHEN** a transfer is rejected because of insufficient funds
- **THEN** the application log contains `Transfer failed: from=` followed by the source id and `reason=insufficient funds` and does not contain a password, hash, JWT, or `accessToken`

### Requirement: There is no deposit API and no transfer history in this capability
The system MUST NOT expose an HTTP endpoint that credits an existing BankAccount except as the destination of this transfer. The system MUST NOT expose `GET /transactions/:accountId` as a history success route in this capability.

#### Scenario: No deposit route
- **WHEN** a client attempts to credit an account without a matching `POST /transactions` debit from another account
- **THEN** no dedicated deposit route exists that increases that account's balance

#### Scenario: History remains unavailable
- **WHEN** a client sends `GET /transactions/:accountId`
- **THEN** the response is not a domain success history payload
