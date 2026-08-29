## REMOVED Requirements

### Requirement: There is no deposit API and no transfer history in this capability
**Reason**: History is specified by the `transaction-history` capability. This capability still MUST NOT expose a deposit endpoint.
**Migration**: Keep the no-deposit rule here. Treat `GET /transactions/:accountId` as the history domain route defined by `transaction-history`.

## ADDED Requirements

### Requirement: There is no deposit API in this capability
The system MUST NOT expose an HTTP endpoint that credits an existing BankAccount except as the destination of this transfer.

#### Scenario: No deposit route
- **WHEN** a client attempts to credit an account without a matching `POST /transactions` debit from another account
- **THEN** no dedicated deposit route exists that increases that account's balance
