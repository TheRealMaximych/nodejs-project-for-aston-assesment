## MODIFIED Requirements

### Requirement: Required environment is validated before serving HTTP
The system MUST validate required environment settings before it binds an HTTP port. `PORT` MUST be a positive integer. `NODE_ENV` MUST be one of `development`, `test`, or `production`. `DATABASE_URL` MUST be a non-empty connection string. If a required value is missing or invalid (including an empty `DATABASE_URL`), the process MUST fail to start and MUST NOT accept HTTP requests.

#### Scenario: Valid required settings allow startup
- **WHEN** `PORT` is a positive integer, `NODE_ENV` is `development`, `test`, or `production`, and `DATABASE_URL` is a non-empty connection string
- **THEN** validated configuration loads successfully (HTTP listen still depends on a successful database connection)

#### Scenario: Invalid PORT prevents startup
- **WHEN** `PORT` is missing, empty, zero, negative, or not an integer
- **THEN** the process MUST exit without serving HTTP

#### Scenario: Invalid NODE_ENV prevents startup
- **WHEN** `NODE_ENV` is missing or is not `development`, `test`, or `production`
- **THEN** the process MUST exit without serving HTTP

#### Scenario: Missing or empty DATABASE_URL prevents startup
- **WHEN** `DATABASE_URL` is missing or is an empty string
- **THEN** the process MUST exit without serving HTTP

### Requirement: Expected environment variables are documented
The project MUST include an example environment file that lists `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`. The example MUST provide a non-empty `DATABASE_URL` that matches the Compose PostgreSQL service (host, port, user, password, database). The example MUST list `JWT_SECRET` as a placeholder for a later auth stage, not as a secret consumed by this stage.

#### Scenario: Example env lists current and future keys
- **WHEN** a developer inspects the example environment file
- **THEN** it includes `PORT`, `NODE_ENV`, a non-empty `DATABASE_URL`, and `JWT_SECRET`

## ADDED Requirements

### Requirement: JWT secret remains optional and unused
The system MUST start when `JWT_SECRET` is absent. An empty string for `JWT_SECRET` MUST be treated as absent. Absence MUST NOT be a startup error at this stage. A non-empty value, if provided, MUST be accepted as a string on the validated configuration object and MUST NOT be used to sign or verify tokens at this stage.

#### Scenario: Startup without JWT secret
- **WHEN** `JWT_SECRET` is unset or empty and required settings including `DATABASE_URL` are valid
- **THEN** configuration loads successfully with respect to `JWT_SECRET`

## REMOVED Requirements

### Requirement: Database URL and JWT secret are optional until later stages
**Reason**: This stage connects to PostgreSQL, so `DATABASE_URL` is required. `JWT_SECRET` stays optional under a dedicated requirement until auth.
**Migration**: Put a non-empty `DATABASE_URL` in `.env` matching Compose. Do not rely on an empty `DATABASE_URL` placeholder.
