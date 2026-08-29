## Purpose

Serves Swagger UI at `/api-docs` backed by an OpenAPI 3 document that describes every existing assignment HTTP operation (plus `GET /health`) with request/response schemas, applicable 4xx statuses, Bearer JWT on protected routes, and a single error body shape — without documenting routes the API does not implement.

## ADDED Requirements

### Requirement: Swagger UI is served at /api-docs without authentication
The system MUST serve a Swagger / OpenAPI user interface at `GET /api-docs`. That request MUST NOT require a Bearer access token. The response MUST NOT be the unknown-path 404 error body and MUST NOT be HTTP 401 solely because credentials are missing. Static assets required by that UI MAY be served under the `/api-docs` path prefix.

#### Scenario: Unauthenticated GET /api-docs is the docs UI
- **WHEN** a client sends `GET /api-docs` with no `Authorization` header
- **THEN** the response is not HTTP 401, is not the unknown-path 404 body `{ "error": string, "statusCode": 404 }`, and presents the Swagger UI (HTML)

### Requirement: OpenAPI document covers all existing assignment operations and health
The OpenAPI 3 document that drives the UI MUST declare operations for exactly these HTTP routes and no other domain API paths: `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /accounts`, `GET /accounts/{id}/balance`, `POST /transactions`, and `GET /transactions/{accountId}`. Path parameter names in the document MUST correspond to those Express parameters (`id` for balance, `accountId` for history).

#### Scenario: Required paths are present
- **WHEN** the OpenAPI document is inspected
- **THEN** it contains operations for `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /accounts`, `GET /accounts/{id}/balance`, `POST /transactions`, and `GET /transactions/{accountId}`

### Requirement: OpenAPI document must not describe non-existent endpoints
The OpenAPI document MUST NOT declare operations for routes the running API does not implement, including list-accounts (`GET /accounts` without `/balance`), deposit or credit-without-debit, refresh-token, password-reset, or email-verification paths.

#### Scenario: No deposit or list-accounts operation
- **WHEN** the OpenAPI document is inspected
- **THEN** it does not contain `GET /accounts` as a list operation, does not contain a deposit or standalone credit operation, and does not contain refresh-token or password-reset operations

### Requirement: Request and response schemas match existing contracts
Documented request and success-response bodies MUST match the existing JSON contracts: register `{ email, password }` → `{ id, email }`; login `{ email, password }` → `{ accessToken }`; logout success is HTTP 204 with an empty body; create account `{ accountHolder, currency }` → `{ id, accountHolder, balance, currency }`; balance → `{ balance }`; transfer `{ fromAccount, toAccount, amount }` → `{ transactionId, status }`; history is an array of objects with `transactionId`, `fromAccount`, `toAccount`, `amount`, `timestamp`, and `status`. JSON fields that represent money (`balance`, `amount`) MUST be documented as strings, not IEEE numbers. Health success MUST be documented as `{ status: "ok" }`. Schemas MUST NOT include `password` hash, `tokenVersion`, or `userId` on account responses.

#### Scenario: Register and login schemas
- **WHEN** the OpenAPI document is inspected for `POST /auth/register` and `POST /auth/login`
- **THEN** register documents request `{ email, password }` and 201 `{ id, email }`, and login documents request `{ email, password }` and 200 `{ accessToken }`

#### Scenario: Logout has no success JSON body
- **WHEN** the OpenAPI document is inspected for `POST /auth/logout`
- **THEN** success is documented as HTTP 204 without a JSON object body

#### Scenario: Account, transfer, history, and money types
- **WHEN** the OpenAPI document is inspected for accounts, transfers, and history
- **THEN** create-account documents 201 `{ id, accountHolder, balance, currency }`, balance documents 200 `{ balance }`, transfer documents 201 `{ transactionId, status }`, history documents a 200 array of those six keys, and `balance` and `amount` are string schemas

#### Scenario: Health schema
- **WHEN** the OpenAPI document is inspected for `GET /health`
- **THEN** success is documented as HTTP 200 with `{ "status": "ok" }`

### Requirement: Documented errors use the uniform body and applicable statuses
Every documented error response MUST use JSON schema `{ "error": string, "statusCode": number }` where `statusCode` equals the HTTP status. The document MUST include those error responses where they apply: 400 validation (and for transfers also insufficient funds, currency mismatch, and same-account); 401 missing or invalid token (and login wrong credentials); 403 foreign account (balance, history, transfer `fromAccount`); 404 missing entity; 409 duplicate email on register. An example for insufficient funds MUST be `{ "error": "Insufficient funds", "statusCode": 400 }`. The document MUST NOT invent extra 4xx codes that the API does not return for that operation.

#### Scenario: Shared error shape
- **WHEN** the OpenAPI document is inspected for a documented 4xx response
- **THEN** the schema has required properties `error` (string) and `statusCode` (number)

#### Scenario: Register documents 400 and 409
- **WHEN** the OpenAPI document is inspected for `POST /auth/register`
- **THEN** it documents 400 and 409 with body `{ error, statusCode }` and does not require 401, 403, or 404 for that operation

#### Scenario: Login documents 400 and 401
- **WHEN** the OpenAPI document is inspected for `POST /auth/login`
- **THEN** it documents 400 and 401 with body `{ error, statusCode }`

#### Scenario: Protected routes document 401
- **WHEN** the OpenAPI document is inspected for `POST /auth/logout`, `POST /accounts`, `GET /accounts/{id}/balance`, `POST /transactions`, and `GET /transactions/{accountId}`
- **THEN** each of those operations documents 401 with body `{ error, statusCode }`

#### Scenario: Balance and history document 403 and 404
- **WHEN** the OpenAPI document is inspected for `GET /accounts/{id}/balance` and `GET /transactions/{accountId}`
- **THEN** each documents 400, 401, 403, and 404 with body `{ error, statusCode }`

#### Scenario: Transfer documents 400 including insufficient funds, 401, 403, and 404
- **WHEN** the OpenAPI document is inspected for `POST /transactions`
- **THEN** it documents 400, 401, 403, and 404 with body `{ error, statusCode }`, and a 400 example equals `{ "error": "Insufficient funds", "statusCode": 400 }`

### Requirement: Protected operations declare Bearer JWT
`POST /auth/logout`, `POST /accounts`, `GET /accounts/{id}/balance`, `POST /transactions`, and `GET /transactions/{accountId}` MUST be documented with HTTP Bearer JWT security (access token). `GET /health`, `POST /auth/register`, `POST /auth/login`, and `GET /api-docs` MUST NOT require that security scheme. The OpenAPI document MUST NOT embed the signing secret, plaintext passwords, or token values.

#### Scenario: Bearer on protected operations only
- **WHEN** the OpenAPI document is inspected
- **THEN** the five protected assignment operations declare Bearer JWT security and the public health, register, and login operations do not require it

#### Scenario: Secrets are absent from the document
- **WHEN** the OpenAPI document is inspected
- **THEN** it does not contain the JWT signing secret, password hashes, or example access-token values that are real secrets
