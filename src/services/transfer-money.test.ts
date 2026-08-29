import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CurrencyMismatchError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  ValidationError,
} from "../domain/errors";
import {
  transferMoney,
  type BankAccountRecord,
  type TransferMoneyDeps,
} from "./transfer-money";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const FROM_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const TO_ID = "8d9e6679-7425-40de-944b-e07fc1f90ae8";
const TRANSACTION_ID = "9e8e6679-7425-40de-944b-e07fc1f90ae9";
const PASSWORD = "secret-password";
const PASSWORD_HASH = "hashed-password-value";
const ACCESS_TOKEN = "header.payload.signature";

function account(overrides: Partial<BankAccountRecord>): BankAccountRecord {
  return {
    id: FROM_ID,
    accountHolder: "Jane Doe",
    balance: "100.00",
    currency: "USD",
    userId: USER_ID,
    ...overrides,
  };
}

function createDeps(options: {
  from?: BankAccountRecord | null;
  to?: BankAccountRecord | null;
}): {
  deps: TransferMoneyDeps;
  completeCalls: string[];
  sessionCalls: { count: number };
  logs: string[];
} {
  const completeCalls: string[] = [];
  const sessionCalls = { count: 0 };
  const logs: string[] = [];

  const deps: TransferMoneyDeps = {
    withLockedAccounts: async (_fromId, _toId, work) => {
      sessionCalls.count += 1;
      return work({
        from: options.from === undefined ? null : options.from,
        to: options.to === undefined ? null : options.to,
        complete: async (amount) => {
          completeCalls.push(amount);
          return { transactionId: TRANSACTION_ID, status: "Completed" };
        },
      });
    },
    logger: {
      info: (message) => {
        logs.push(message);
      },
    },
  };

  return { deps, completeCalls, sessionCalls, logs };
}

function secretBody(overrides: Record<string, unknown> = {}) {
  return {
    fromAccount: FROM_ID,
    toAccount: TO_ID,
    amount: "10.00",
    password: PASSWORD,
    passwordHash: PASSWORD_HASH,
    accessToken: ACCESS_TOKEN,
    ...overrides,
  };
}

function assertNoSecrets(logs: string[]) {
  const joined = logs.join("\n");
  assert.equal(joined.includes(PASSWORD), false);
  assert.equal(joined.includes(PASSWORD_HASH), false);
  assert.equal(joined.includes(ACCESS_TOKEN), false);
}

describe("transferMoney", () => {
  test("own to own calls complete and returns transactionId and Completed", async () => {
    const { deps, completeCalls, logs } = createDeps({
      from: account({ id: FROM_ID }),
      to: account({ id: TO_ID, accountHolder: "Jane Savings" }),
    });

    const result = await transferMoney(USER_ID, secretBody({ amount: "10" }), deps);

    assert.deepEqual(completeCalls, ["10.00"]);
    assert.equal(typeof completeCalls[0], "string");
    assert.deepEqual(result, { transactionId: TRANSACTION_ID, status: "Completed" });
    assert.deepEqual(Object.keys(result).sort(), ["status", "transactionId"]);
    assert.equal(
      logs[0],
      `Transfer completed: from=${FROM_ID} to=${TO_ID} amount=10.00`,
    );
    assertNoSecrets(logs);
  });

  test("own to foreign same currency calls complete", async () => {
    const { deps, completeCalls } = createDeps({
      from: account({ id: FROM_ID }),
      to: account({ id: TO_ID, userId: OTHER_USER_ID }),
    });

    const result = await transferMoney(USER_ID, secretBody(), deps);

    assert.deepEqual(completeCalls, ["10.00"]);
    assert.deepEqual(result, { transactionId: TRANSACTION_ID, status: "Completed" });
  });

  test("insufficient funds does not complete and logs the reason", async () => {
    const { deps, completeCalls, logs } = createDeps({
      from: account({ id: FROM_ID, balance: "5.00" }),
      to: account({ id: TO_ID }),
    });

    await assert.rejects(
      () => transferMoney(USER_ID, secretBody({ amount: "10.00" }), deps),
      (error: unknown) => {
        assert.ok(error instanceof InsufficientFundsError);
        assert.equal(error.message, "Insufficient funds");
        return true;
      },
    );
    assert.deepEqual(completeCalls, []);
    assert.equal(
      logs[0],
      `Transfer failed: from=${FROM_ID}, reason=insufficient funds`,
    );
    assertNoSecrets(logs);
  });

  test("foreign from is ForbiddenError", async () => {
    const { deps, completeCalls, logs } = createDeps({
      from: account({ id: FROM_ID, userId: OTHER_USER_ID }),
      to: null,
    });

    await assert.rejects(
      () => transferMoney(USER_ID, secretBody(), deps),
      ForbiddenError,
    );
    assert.deepEqual(completeCalls, []);
    assert.equal(logs[0], `Transfer failed: from=${FROM_ID}, reason=forbidden`);
    assertNoSecrets(logs);
  });

  test("different currency is CurrencyMismatchError", async () => {
    const { deps, completeCalls, logs } = createDeps({
      from: account({ id: FROM_ID, currency: "USD" }),
      to: account({ id: TO_ID, currency: "EUR" }),
    });

    await assert.rejects(
      () => transferMoney(USER_ID, secretBody(), deps),
      CurrencyMismatchError,
    );
    assert.deepEqual(completeCalls, []);
    assert.equal(
      logs[0],
      `Transfer failed: from=${FROM_ID}, reason=currency mismatch`,
    );
  });

  test("from equals to is SameAccountTransferError and does not open a session", async () => {
    const { deps, completeCalls, logs, sessionCalls } = createDeps({
      from: account({ id: FROM_ID }),
      to: account({ id: FROM_ID }),
    });

    await assert.rejects(
      () => transferMoney(USER_ID, secretBody({ toAccount: FROM_ID }), deps),
      SameAccountTransferError,
    );
    assert.equal(sessionCalls.count, 0);
    assert.deepEqual(completeCalls, []);
    assert.equal(logs[0], `Transfer failed: from=${FROM_ID}, reason=same account`);
  });

  test("missing from or to is NotFoundError", async () => {
    const missingFrom = createDeps({ from: null, to: account({ id: TO_ID }) });
    await assert.rejects(
      () => transferMoney(USER_ID, secretBody(), missingFrom.deps),
      NotFoundError,
    );
    assert.deepEqual(missingFrom.completeCalls, []);
    assert.equal(
      missingFrom.logs[0],
      `Transfer failed: from=${FROM_ID}, reason=not found`,
    );

    const missingTo = createDeps({ from: account({ id: FROM_ID }), to: null });
    await assert.rejects(
      () => transferMoney(USER_ID, secretBody(), missingTo.deps),
      NotFoundError,
    );
    assert.deepEqual(missingTo.completeCalls, []);
  });

  test("JSON number or non-positive amount is ValidationError", async () => {
    const { deps, completeCalls, sessionCalls } = createDeps({
      from: account({ id: FROM_ID }),
      to: account({ id: TO_ID }),
    });

    await assert.rejects(
      () =>
        transferMoney(
          USER_ID,
          { fromAccount: FROM_ID, toAccount: TO_ID, amount: 10 },
          deps,
        ),
      ValidationError,
    );
    await assert.rejects(
      () => transferMoney(USER_ID, secretBody({ amount: "0" }), deps),
      ValidationError,
    );
    await assert.rejects(
      () => transferMoney(USER_ID, secretBody({ amount: "0.00" }), deps),
      ValidationError,
    );
    await assert.rejects(
      () => transferMoney(USER_ID, secretBody({ amount: "-1.00" }), deps),
      ValidationError,
    );
    assert.equal(sessionCalls.count, 0);
    assert.deepEqual(completeCalls, []);
  });
});
