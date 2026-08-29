## Purpose

Gives a new developer a launch-only README that starts PostgreSQL, migrates, seeds, runs the API, obtains a JWT, and opens Swagger UI — without architecture text or committed secrets.

## ADDED Requirements

### Requirement: README is launch-only and lives at the repository root
The project MUST include a `README.md` at the repository root. That file MUST contain the commands and values needed to start the API locally. It MUST NOT describe architecture, layering, stack justification, or copy the content of `AGENTS.md`.

#### Scenario: Root README exists
- **WHEN** a developer inspects the repository root
- **THEN** a `README.md` file is present

#### Scenario: README does not duplicate AGENTS.md
- **WHEN** a developer reads `README.md`
- **THEN** it does not explain HTTP/service/repository layering, does not justify the technology stack, and does not reproduce `AGENTS.md`

### Requirement: README documents environment setup without committing secrets
The README MUST instruct the developer to copy `.env.example` to a local `.env` and to set required keys including `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`. The README MUST tell the developer not to commit `.env` or a production `JWT_SECRET`. The README MUST NOT embed a real signing secret or a real access token.

#### Scenario: Env copy is documented
- **WHEN** a developer follows `README.md` environment instructions
- **THEN** those instructions say to copy `.env.example` to `.env` and mention `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`

#### Scenario: Secrets stay out of git
- **WHEN** a developer follows `README.md`
- **THEN** the instructions say not to commit `.env` and not to commit a real `JWT_SECRET`, and the README itself does not contain a production secret or a signed JWT

### Requirement: README documents Compose PostgreSQL, migrate, seed, and npm scripts
The README MUST document starting PostgreSQL with the project's Docker Compose file (database service only). The README MUST document `npm run migrate` to apply pending migrations, `npm run seed` to load demo data, `npm run dev` to start the API, `npm run build` to compile, and `npm test` to run tests. The documented sequence MUST be: environment file, Compose database, migrate, seed, then start the API.

#### Scenario: Compose is documented as database-only
- **WHEN** a developer follows the Compose section of `README.md`
- **THEN** the documented command starts the Compose PostgreSQL service and does not instruct building or running an application container

#### Scenario: Required npm scripts are listed
- **WHEN** a developer reads the scripts section of `README.md`
- **THEN** it lists `dev`, `build`, `test`, `migrate`, and `seed`

#### Scenario: Launch order is migrate then seed then API
- **WHEN** a developer follows the startup sequence in `README.md` on a fresh machine with Docker and npm available
- **THEN** the sequence creates `.env`, starts PostgreSQL via Compose, applies migrations with `npm run migrate`, loads demo data with `npm run seed`, and then starts the HTTP API with `npm run dev` (or the documented start command)

### Requirement: README documents how to obtain a JWT and where to open OpenAPI
The README MUST document `POST /auth/login` with `{ "email", "password" }` as the way to obtain `{ "accessToken" }`. The README MUST include the demo emails and demo plaintext password that the seed command persists (as hashes). The README MUST document the Swagger UI path as `GET /api-docs` on the host and `PORT` from the environment example (so a developer can open it in a browser after `npm run dev`).

#### Scenario: JWT via login is documented
- **WHEN** a developer follows the JWT section of `README.md` after seed and API start
- **THEN** the instructions specify `POST /auth/login` with a seeded email and the documented demo password, and state that the JSON response contains `accessToken`

#### Scenario: Swagger UI path is documented
- **WHEN** a developer follows the OpenAPI section of `README.md` after the API has started with `PORT` from `.env.example`
- **THEN** the instructions give the Swagger UI URL using path `/api-docs` (for the example port, `http://localhost:3000/api-docs`)
