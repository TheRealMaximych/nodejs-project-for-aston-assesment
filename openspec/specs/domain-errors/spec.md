# domain-errors Specification

## Purpose

Defines typed domain failure kinds for the assignment so business logic can signal validation, auth, ownership, not-found, conflict, and transfer-rule failures without choosing HTTP status codes.

## Requirements

### Requirement: Assignment failures have distinct domain kinds
Business logic MUST signal assignment failures using distinct domain error kinds: validation, unauthorized, forbidden (foreign account), not found, conflict (email already taken), insufficient funds, currency mismatch, and transfer to the same account. Those kinds MUST NOT carry an HTTP status code. A generic runtime error MUST NOT be used for those assignment cases.

#### Scenario: Insufficient funds is its own kind
- **WHEN** a transfer cannot complete because the source account has too little balance
- **THEN** the failure MUST be an insufficient-funds domain error, not a generic validation or not-found kind

#### Scenario: Foreign account is forbidden, not not-found
- **WHEN** the authenticated party attempts balance, history, or a debit from an account they do not own
- **THEN** the failure MUST be a forbidden domain error

#### Scenario: Duplicate email is conflict
- **WHEN** registration cannot proceed because the email is already taken
- **THEN** the failure MUST be a conflict domain error

### Requirement: Insufficient funds message is exact
An insufficient-funds domain error MUST expose the client `error` string `Insufficient funds` and no other wording.

#### Scenario: Exact insufficient funds text
- **WHEN** an insufficient-funds domain error is produced
- **THEN** its message equals `Insufficient funds`

### Requirement: Transfer rule failures are distinct 400 kinds
A transfer with mismatched account currencies MUST be a currency-mismatch domain error. A transfer whose source and destination are the same account MUST be a same-account domain error. Amount not greater than zero and other input problems MUST be a validation domain error. All three kinds are distinct from insufficient funds.

#### Scenario: Different currency is not insufficient funds
- **WHEN** a transfer is rejected because the two accounts use different currencies
- **THEN** the failure MUST be a currency-mismatch domain error, not an insufficient-funds domain error

#### Scenario: Same account is not a generic not-found
- **WHEN** a transfer is rejected because source and destination are the same account
- **THEN** the failure MUST be a same-account domain error
