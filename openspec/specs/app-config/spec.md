# app-config Specification

## Purpose

Validated runtime configuration is the only source of environment-backed settings, so the process can start without PostgreSQL and HTTP or business layers never depend on raw, unvalidated environment access.

## Requirements

### Requirement: Required environment is validated before serving HTTP
The system MUST validate required environment settings before it binds an HTTP port. `PORT` MUST be a positive integer. `NODE_ENV` MUST be one of `development`, `test`, or `production`. If a required value is missing or invalid, the process MUST fail to start and MUST NOT accept HTTP requests.

#### Scenario: Valid required settings allow startup
- **WHEN** `PORT` is a positive integer and `NODE_ENV` is `development`, `test`, or `production`
- **THEN** the process starts and listens for HTTP requests on that port

#### Scenario: Invalid PORT prevents startup
- **WHEN** `PORT` is missing, empty, zero, negative, or not an integer
- **THEN** the process MUST exit without serving HTTP

#### Scenario: Invalid NODE_ENV prevents startup
- **WHEN** `NODE_ENV` is missing or is not `development`, `test`, or `production`
- **THEN** the process MUST exit without serving HTTP

### Requirement: Database URL and JWT secret are optional until later stages
The system MUST start when `DATABASE_URL` and `JWT_SECRET` are absent. An empty string for either variable MUST be treated as absent (not as a configured URL or secret). Absence MUST NOT be a startup error at this stage. A non-empty value, if provided, MUST be accepted as a string for later stages and MUST NOT be used to open a database connection on this stage.

#### Scenario: Startup without database or JWT
- **WHEN** `DATABASE_URL` and `JWT_SECRET` are unset and required settings are valid
- **THEN** the process starts successfully without connecting to PostgreSQL

#### Scenario: Empty optional placeholders do not block startup
- **WHEN** `JWT_SECRET` and/or `DATABASE_URL` are set to an empty string and required settings are valid
- **THEN** the process starts successfully and MUST NOT connect to PostgreSQL

### Requirement: Request handling and business logic use validated config only
HTTP request handling and business-logic layers MUST use the validated configuration object for runtime settings. Those layers MUST NOT read unvalidated environment variables.

#### Scenario: Config is the source of PORT
- **WHEN** the HTTP server binds a listen port
- **THEN** the port MUST come from validated configuration, not from ad-hoc environment reads in HTTP or service code

### Requirement: Expected environment variables are documented
The project MUST include an example environment file that lists `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`, and MUST indicate that `DATABASE_URL` and `JWT_SECRET` are optional for this stage.

#### Scenario: Example env lists current and future keys
- **WHEN** a developer inspects the example environment file
- **THEN** it includes `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`
