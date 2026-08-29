## ADDED Requirements

### Requirement: Users table comes from a TypeORM migration
The system MUST create the `users` table only through a versioned TypeORM migration after the initial schema migration. Schema auto-synchronization MUST remain disabled. The `users` table MUST store UUID primary key `id`, unique `email`, password hash, `createdAt`, and `tokenVersion`. The initial (first) committed migration MUST still not create User, BankAccount, or Transaction tables.

#### Scenario: Users migration creates the table
- **WHEN** a developer runs pending migrations against an empty database that already has the initial migration applied
- **THEN** the database contains a `users` table with unique email and columns for password hash, `createdAt`, and `tokenVersion`

#### Scenario: Auto-sync stays off
- **WHEN** the application DataSource is configured after User persistence is added
- **THEN** schema auto-synchronization is off

### Requirement: User persistence stays in the repository layer
Creating and looking up users MUST go through the application repository layer. HTTP handlers and business-logic services MUST NOT import or call TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs. The application DataSource MUST register the User mapping so migrations and runtime share one schema definition.

#### Scenario: HTTP and services have no TypeORM usage
- **WHEN** a reviewer inspects HTTP request-handling modules and service modules
- **THEN** those modules do not import or invoke TypeORM `DataSource`, TypeORM `Repository`, or query-builder APIs

#### Scenario: DataSource registers User
- **WHEN** the application DataSource is configured
- **THEN** it includes the User entity mapping and does not enable schema auto-synchronization
