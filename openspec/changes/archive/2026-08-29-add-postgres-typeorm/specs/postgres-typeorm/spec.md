## Purpose

Connects the HTTP process to PostgreSQL with a migration-only schema workflow so the application can start against a live database without auto-synchronizing tables or introducing domain entities yet.

## ADDED Requirements

### Requirement: Compose runs PostgreSQL only
The project MUST provide a Docker Compose file that starts PostgreSQL. That Compose file MUST NOT define an application image or application service.

#### Scenario: Postgres is available via Compose
- **WHEN** a developer starts the Compose stack
- **THEN** PostgreSQL accepts connections on the published database port using the credentials documented in the example environment file

#### Scenario: Compose has no application service
- **WHEN** a developer inspects the Compose file
- **THEN** it contains a PostgreSQL service and does not contain a service that builds or runs this Node.js application

### Requirement: Schema changes only through migrations
The system MUST apply database schema changes only through versioned migrations. Schema auto-synchronization MUST be disabled. The first committed migration MUST NOT create `User`, `BankAccount`, or `Transaction` tables.

#### Scenario: Auto-sync is disabled
- **WHEN** the application DataSource is configured
- **THEN** schema auto-synchronization is off

#### Scenario: Initial migration has no domain tables
- **WHEN** the first migration is applied to an empty database
- **THEN** the database MUST NOT contain tables for User, BankAccount, or Transaction domain entities

### Requirement: Migration commands are documented as npm scripts
The project MUST provide npm scripts to generate a migration, run pending migrations, and revert the last migration. Running the apply script MUST make pending migrations take effect on the configured database.

#### Scenario: Pending migrations apply
- **WHEN** a developer runs the documented migration run script against a running PostgreSQL with a valid `DATABASE_URL`
- **THEN** pending migrations are applied and the command exits successfully

#### Scenario: Last migration can be reverted
- **WHEN** a developer runs the documented migration revert script after at least one migration has been applied
- **THEN** the last applied migration is reverted

### Requirement: Process connects before serving HTTP
The system MUST initialize a database connection with the validated `DATABASE_URL` before it binds the HTTP port. HTTP handlers and business-logic layers MUST NOT open that connection themselves or read unvalidated environment variables for it.

#### Scenario: Listen happens after initialize
- **WHEN** the database connection initializes successfully
- **THEN** the process binds the HTTP port afterward

### Requirement: Connection failures are logged without secrets
If database initialization fails, the system MUST log the failure and MUST NOT write passwords, JWT secrets, or a connection string (including userinfo) to the log.

#### Scenario: Failed initialize is logged without secrets
- **WHEN** database initialization fails (for example PostgreSQL is down or credentials are wrong)
- **THEN** the application log records a connection failure and MUST NOT contain the password, `JWT_SECRET`, or `DATABASE_URL`

### Requirement: Persistence APIs stay out of HTTP
Database DataSource, repository, and query-builder APIs MUST be used only from the configuration and repository layers. HTTP handlers MUST NOT import or call those APIs.

#### Scenario: HTTP layer has no DataSource usage
- **WHEN** a reviewer inspects HTTP request-handling modules
- **THEN** those modules do not import or invoke DataSource, repository, or query-builder APIs
