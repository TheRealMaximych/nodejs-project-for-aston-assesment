## Purpose

Provides an idempotent CLI seed of two funded bank accounts owned by different users in one currency so a developer can log in as both parties and transfer to a foreign `toAccount` without a deposit API.

## ADDED Requirements

### Requirement: Seed creates two funded accounts of different users
After pending migrations have been applied, running the documented seed command MUST persist at least two User rows and at least two BankAccount rows. The two accounts MUST belong to different users, MUST share one currency code, and MUST each have a balance greater than zero. Balance values MUST be decimal strings (or a decimal type) backed by PostgreSQL `numeric`, not IEEE `number` and not floating-point column types. The seed MUST NOT expose an HTTP deposit endpoint.

#### Scenario: Two owners, same currency, non-zero balances
- **WHEN** a developer runs the documented seed command against a database that already has pending migrations applied
- **THEN** the database contains at least two users and at least two bank accounts, the accounts have different `userId` values, those accounts use the same currency, and each of those accounts has a balance greater than zero stored as a decimal string (or decimal type)

#### Scenario: No deposit route is added
- **WHEN** a client inspects HTTP routes after the seed capability is added
- **THEN** no dedicated deposit endpoint exists that credits an account except as the destination of `POST /transactions`

### Requirement: Seed identifiers are stable and sufficient to transfer
Seeded users MUST have unique emails that `POST /auth/login` accepts. Seeded accounts MUST have stable UUID identifiers that do not change across successful re-runs of the seed, so a client can call `POST /transactions` with one account as `fromAccount` and the other user's account as `toAccount` without a list-accounts endpoint. Demo plaintext passwords MUST exist as seed-source constants so both users can log in; those plaintext values MUST NOT be written to the database.

#### Scenario: Both users can log in after seed
- **WHEN** seed has succeeded and a client sends `POST /auth/login` with each seeded user's email and the corresponding demo password from the seed source
- **THEN** each login responds HTTP 200 with `{ "accessToken": string }`

#### Scenario: Foreign transfer is possible after seed
- **WHEN** seed has succeeded and an authenticated client of the first seeded user sends `POST /transactions` with that user's seeded account as `fromAccount`, the second user's seeded account as `toAccount`, matching currency, and a positive decimal `amount` string that does not exceed the source balance
- **THEN** the response status is 201 and the body is `{ "transactionId": string, "status": "Completed" }`

#### Scenario: Account ids stay the same on re-run
- **WHEN** a developer runs the seed command twice successfully against the same database
- **THEN** the two seeded account UUID values after the second run equal the UUID values after the first run

### Requirement: Seed is idempotent
Re-running the seed command MUST NOT create unbounded duplicate User or BankAccount rows for the demo identities. The seed MUST upsert by fixed emails and/or fixed UUIDs. A successful re-run MUST restore each seeded account's balance to the canonical seeded amount so a later foreign transfer can still succeed after previous debits.

#### Scenario: Second run does not duplicate demo rows
- **WHEN** a developer runs the seed command twice against the same migrated database
- **THEN** there is still exactly one User row per seeded demo email and exactly one BankAccount row per seeded demo account UUID

#### Scenario: Re-run restores funded balances
- **WHEN** a seeded account balance has been reduced by a transfer and the developer then runs the seed command again
- **THEN** that seeded account's balance equals the canonical seeded amount (greater than zero)

### Requirement: Passwords are hashed asynchronously and never logged
The seed MUST persist password hashes, never plaintext. Hashing MUST use asynchronous APIs (`async`/`await`) and MUST NOT use synchronous CPU-bound crypto on the seed process path. Seed logs MUST include identifiers useful for transfers (`userId`, `accountId`, and/or email) and MUST NOT contain plaintext passwords, password hashes, JWT values, or `accessToken`.

#### Scenario: Stored seed credential is a hash
- **WHEN** seed succeeds
- **THEN** each seeded user's persisted password value is a hash of the demo password and is not equal to the plaintext demo password

#### Scenario: Seed logs omit secrets
- **WHEN** seed succeeds
- **THEN** the application log contains the seeded `userId` and `accountId` values (and MAY contain emails) and MUST NOT contain a password, password hash, JWT, or `accessToken`

### Requirement: Seed CLI does not serve HTTP
The documented seed command MUST initialize a database connection using the validated `DATABASE_URL` and MUST persist demo rows without binding the application HTTP port. Failure to connect MUST exit unsuccessfully without serving HTTP.

#### Scenario: Seed does not listen
- **WHEN** a developer runs the documented seed command against a reachable PostgreSQL with a valid `DATABASE_URL`
- **THEN** demo rows are persisted and the process MUST NOT accept HTTP requests on the application port as part of that command

#### Scenario: Unreachable database fails the seed
- **WHEN** PostgreSQL is not reachable and a developer runs the documented seed command
- **THEN** the process exits unsuccessfully and MUST NOT bind the HTTP port
