## ADDED Requirements

### Requirement: Bank accounts table comes from a TypeORM migration
The system MUST create the bank accounts table only through a versioned TypeORM migration after the users migration. Schema auto-synchronization MUST remain disabled. The table MUST store UUID primary key `id`, `accountHolder`, `balance` as PostgreSQL `numeric` (not `float`/`double precision`/`real`) with default zero, `currency`, `userId` referencing `users.id`, and `createdAt`. A User MUST be allowed more than one account row. The initial (first) committed migration MUST still not create User, BankAccount, or Transaction tables.

#### Scenario: Accounts migration creates the table
- **WHEN** a developer runs pending migrations against a database that already has the initial and users migrations applied
- **THEN** the database contains a bank accounts table with a UUID primary key, a `numeric` balance defaulting to zero, currency, account holder, `createdAt`, and a foreign key from `userId` to `users.id`

#### Scenario: Auto-sync stays off after accounts
- **WHEN** the application DataSource is configured after BankAccount persistence is added
- **THEN** schema auto-synchronization is off

#### Scenario: Balance column is not floating point
- **WHEN** a reviewer inspects the accounts table definition produced by the migration
- **THEN** the balance column type is `numeric` (or `decimal`) and MUST NOT be `float`, `double precision`, `real`, or an integer type used as money

### Requirement: BankAccount persistence stays in the repository layer
Creating and looking up bank accounts MUST go through the application repository layer. HTTP handlers and business-logic services MUST NOT import or call TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs. The application DataSource MUST register the BankAccount mapping so migrations and runtime share one schema definition. Values loaded for `balance` MUST be application strings (or a decimal type), not IEEE `number`.

#### Scenario: HTTP and services have no TypeORM usage
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: DataSource registers BankAccount
- **WHEN** the application DataSource is configured
- **THEN** it includes the BankAccount entity mapping and does not enable schema auto-synchronization

#### Scenario: Loaded balance is not an IEEE number
- **WHEN** the repository returns a persisted account balance to a service
- **THEN** that balance is a string or decimal type and MUST NOT be a JavaScript `number`
