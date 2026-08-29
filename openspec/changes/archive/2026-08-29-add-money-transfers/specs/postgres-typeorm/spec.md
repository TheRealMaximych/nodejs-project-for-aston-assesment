## ADDED Requirements

### Requirement: Transactions table comes from a TypeORM migration
The system MUST create the transactions table only through a versioned TypeORM migration after the bank accounts migration. Schema auto-synchronization MUST remain disabled. The table MUST store UUID primary key `id`, `fromAccount` and `toAccount` as UUID foreign keys to bank account rows, `amount` as PostgreSQL `numeric` (not `float`/`double precision`/`real`), `timestamp`, and `status` constrained to `Completed` or `Failed`. The initial (first) committed migration MUST still not create User, BankAccount, or Transaction tables.

#### Scenario: Transactions migration creates the table
- **WHEN** a developer runs pending migrations against a database that already has the initial, users, and bank accounts migrations applied
- **THEN** the database contains a transactions table with a UUID primary key, UUID `fromAccount` and `toAccount` foreign keys, a `numeric` amount, a timestamp, and a status limited to `Completed` and `Failed`

#### Scenario: Auto-sync stays off after transactions
- **WHEN** the application DataSource is configured after Transaction persistence is added
- **THEN** schema auto-synchronization is off

#### Scenario: Amount column is not floating point
- **WHEN** a reviewer inspects the transactions table definition produced by the migration
- **THEN** the amount column type is `numeric` (or `decimal`) and MUST NOT be `float`, `double precision`, `real`, or an integer type used as money

### Requirement: Transaction persistence and locked balance updates stay in the repository layer
Creating a transfer MUST go through the application repository layer. Debit, credit, and Transaction insert for one transfer MUST run in a single database transaction. Row-level locks (`SELECT FOR UPDATE`) or a conditional balance `UPDATE` MUST be used only from the repository layer. HTTP handlers and business-logic services MUST NOT import or call TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs. The application DataSource MUST register the Transaction mapping so migrations and runtime share one schema definition. Values loaded for `amount` and updated `balance` MUST be application strings (or a decimal type), not IEEE `number`.

#### Scenario: HTTP and services have no TypeORM usage
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: DataSource registers Transaction
- **WHEN** the application DataSource is configured
- **THEN** it includes the Transaction entity mapping and does not enable schema auto-synchronization

#### Scenario: Loaded amount is not an IEEE number
- **WHEN** the repository returns a persisted transfer amount to a service
- **THEN** that amount is a string or decimal type and MUST NOT be a JavaScript `number`
