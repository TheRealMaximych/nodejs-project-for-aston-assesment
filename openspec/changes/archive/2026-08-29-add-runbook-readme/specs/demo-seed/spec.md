## ADDED Requirements

### Requirement: README lists demo login credentials
The project README MUST list each seeded demo user's email and the plaintext demo password from the seed source so a developer can call `POST /auth/login` without reading seed source files. Those plaintext values MUST still not be written to the database and MUST still not appear in application logs.

#### Scenario: README contains demo emails and password
- **WHEN** a developer reads the project README after this change
- **THEN** it includes the seeded demo emails and the demo plaintext password that `POST /auth/login` accepts after a successful seed

#### Scenario: README credentials still are not stored or logged as secrets in the app
- **WHEN** seed succeeds after this change
- **THEN** persisted passwords remain hashes (not plaintext) and application logs still MUST NOT contain the demo plaintext password, password hashes, JWT values, or `accessToken`
