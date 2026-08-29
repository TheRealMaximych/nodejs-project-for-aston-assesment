## MODIFIED Requirements

### Requirement: Migration commands are documented as npm scripts
The project MUST provide npm scripts to generate a migration, run pending migrations, and revert the last migration. The project MUST also provide an npm script named `migrate` that applies pending migrations on the database configured by the validated `DATABASE_URL`. Running `migrate` MUST have the same effect as the existing migration-run script. Running the apply script MUST make pending migrations take effect on the configured database.

#### Scenario: Pending migrations apply
- **WHEN** a developer runs the documented migration run script against a running PostgreSQL with a valid `DATABASE_URL`
- **THEN** pending migrations are applied and the command exits successfully

#### Scenario: Last migration can be reverted
- **WHEN** a developer runs the documented migration revert script after at least one migration has been applied
- **THEN** the last applied migration is reverted

#### Scenario: migrate script applies pending migrations
- **WHEN** a developer runs `npm run migrate` against a running PostgreSQL with a valid `DATABASE_URL`
- **THEN** pending migrations are applied and the command exits successfully
