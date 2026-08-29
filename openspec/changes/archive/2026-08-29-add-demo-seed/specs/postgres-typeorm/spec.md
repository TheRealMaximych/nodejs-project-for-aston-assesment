## ADDED Requirements

### Requirement: Seed command is an npm script
The project MUST provide an npm script named `seed` that runs the demo seed against the database configured by the validated `DATABASE_URL`. Running that script MUST persist or upsert the demo users and funded accounts required to exercise a foreign `POST /transactions`. This change MUST NOT add a new TypeORM migration; schema auto-synchronization MUST remain disabled.

#### Scenario: Seed script upserts demo data
- **WHEN** a developer runs the documented `seed` npm script against a running PostgreSQL that already has pending migrations applied and a valid `DATABASE_URL`
- **THEN** the command exits successfully and the database contains the demo users and funded same-currency accounts from the demo-seed capability

#### Scenario: Seed does not require a new migration
- **WHEN** a reviewer inspects migrations added in this change
- **THEN** no new migration file is required for seed rows, and schema auto-synchronization remains off

### Requirement: Seed CLI may use TypeORM
The demo seed CLI MUST be allowed to use TypeORM `DataSource`, `Repository`, and query-builder APIs from the `seeds/` directory in order to insert or upsert User and BankAccount rows. HTTP handlers and business-logic services MUST still NOT import or call those APIs. Seed writes MUST use the same application DataSource mapping as runtime (User and BankAccount registered, `synchronize` off). Values written for `balance` MUST be decimal strings (or a decimal type), not IEEE `number`.

#### Scenario: Seeds directory may call TypeORM
- **WHEN** a reviewer inspects modules under `seeds/`
- **THEN** those modules MAY import and invoke TypeORM `DataSource`, `Repository`, or query-builder APIs

#### Scenario: HTTP and services still have no TypeORM
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules after the seed CLI is added
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: Seeded balance is not an IEEE number
- **WHEN** the seed CLI persists a demo account balance
- **THEN** that balance is a string or decimal type and MUST NOT be a JavaScript `number`

## MODIFIED Requirements

### Requirement: Persistence APIs stay out of HTTP
Database DataSource, repository, and query-builder APIs MUST be used only from the configuration layer, the repository layer, and the demo seed CLI under `seeds/`. HTTP handlers MUST NOT import or call those APIs.

#### Scenario: HTTP layer has no DataSource usage
- **WHEN** a reviewer inspects HTTP request-handling modules
- **THEN** those modules do not import or invoke DataSource, repository, or query-builder APIs

### Requirement: User persistence stays in the repository layer
Creating and looking up users for HTTP request handling MUST go through the application repository layer. The demo seed CLI MAY insert or upsert User rows using TypeORM `DataSource` or `Repository` APIs from `seeds/`. HTTP handlers and business-logic services MUST NOT import or call TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs. The application DataSource MUST register the User mapping so migrations, seed, and runtime share one schema definition.

#### Scenario: HTTP and services have no TypeORM usage
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: DataSource registers User
- **WHEN** the application DataSource is configured
- **THEN** it includes the User entity mapping and does not enable schema auto-synchronization

### Requirement: BankAccount persistence stays in the repository layer
Creating and looking up bank accounts for HTTP request handling MUST go through the application repository layer. The demo seed CLI MAY insert or upsert BankAccount rows using TypeORM `DataSource` or `Repository` APIs from `seeds/`, including non-zero balances. HTTP handlers and business-logic services MUST NOT import or call TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs. The application DataSource MUST register the BankAccount mapping so migrations, seed, and runtime share one schema definition. Values loaded for `balance` MUST be application strings (or a decimal type), not IEEE `number`.

#### Scenario: HTTP and services have no TypeORM usage
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: DataSource registers BankAccount
- **WHEN** the application DataSource is configured
- **THEN** it includes the BankAccount entity mapping and does not enable schema auto-synchronization

#### Scenario: Loaded balance is not an IEEE number
- **WHEN** the repository returns a persisted account balance to a service
- **THEN** that balance is a string or decimal type and MUST NOT be a JavaScript `number`
