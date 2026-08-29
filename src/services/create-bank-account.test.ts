import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "../domain/errors";
import {
  createBankAccount,
  type CreateBankAccountDeps,
} from "./create-bank-account";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const ACCOUNT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ACCOUNT_ID_TWO = "8d9e6679-7425-40de-944b-e07fc1f90ae8";
const PASSWORD = "secret-password";
const PASSWORD_HASH = "hashed-password-value";
const ACCESS_TOKEN = "header.payload.signature";

type InsertCall = {
  accountHolder: string;
  currency: string;
  userId: string;
};

function createDeps(overrides?: {
  insert?: CreateBankAccountDeps["accounts"]["insert"];
}): {
  deps: CreateBankAccountDeps;
  insertCalls: InsertCall[];
  logs: string[];
} {
  const insertCalls: InsertCall[] = [];
  const logs: string[] = [];
  let insertCount = 0;

  const deps: CreateBankAccountDeps = {
    accounts: {
      insert: async (account) => {
        insertCalls.push(account);
        if (overrides?.insert) {
          return overrides.insert(account);
        }
        insertCount += 1;
        const id = insertCount === 1 ? ACCOUNT_ID : ACCOUNT_ID_TWO;
        return {
          id,
          accountHolder: account.accountHolder,
          balance: "0.00",
          currency: account.currency,
        };
      },
    },
    logger: {
      info: (message) => {
        logs.push(message);
      },
    },
  };

  return { deps, insertCalls, logs };
}

describe("createBankAccount", () => {
  test("inserts the argument userId, stores holder and uppercase currency, and logs without secrets", async () => {
    const { deps, insertCalls, logs } = createDeps();

    const result = await createBankAccount(
      USER_ID,
      {
        accountHolder: "  Jane Doe  ",
        currency: "usd",
        userId: OTHER_USER_ID,
        balance: "999.00",
        password: PASSWORD,
        passwordHash: PASSWORD_HASH,
        accessToken: ACCESS_TOKEN,
      },
      deps,
    );

    assert.equal(insertCalls.length, 1);
    assert.deepEqual(insertCalls[0], {
      accountHolder: "Jane Doe",
      currency: "USD",
      userId: USER_ID,
    });
    assert.notEqual(insertCalls[0]?.userId, OTHER_USER_ID);
    assert.equal("balance" in insertCalls[0]!, false);
    assert.deepEqual(Object.keys(result).sort(), [
      "accountHolder",
      "balance",
      "currency",
      "id",
    ]);
    assert.equal(typeof result.balance, "string");
    assert.equal(result.balance, "0.00");
    assert.equal(result.id, ACCOUNT_ID);
    assert.equal(result.accountHolder, "Jane Doe");
    assert.equal(result.currency, "USD");
    assert.equal(logs.length, 1);
    assert.equal(logs[0], `Account created: accountId=${ACCOUNT_ID}, userId=${USER_ID}`);
    assert.match(logs[0] ?? "", /Account created: accountId=/);
    assert.match(logs[0] ?? "", /userId=/);
    assert.equal(logs[0]?.includes(PASSWORD), false);
    assert.equal(logs[0]?.includes(PASSWORD_HASH), false);
    assert.equal(logs[0]?.includes(ACCESS_TOKEN), false);
    assert.equal(logs[0]?.includes("token"), false);
  });

  test("allows two creates for the same userId", async () => {
    const { deps, insertCalls } = createDeps();
    const body = { accountHolder: "Jane Doe", currency: "USD" };

    const first = await createBankAccount(USER_ID, body, deps);
    const second = await createBankAccount(USER_ID, body, deps);

    assert.equal(insertCalls.length, 2);
    assert.equal(insertCalls[0]?.userId, USER_ID);
    assert.equal(insertCalls[1]?.userId, USER_ID);
    assert.notEqual(first.id, second.id);
  });

  test("rejects missing, empty holder, or invalid currency without inserting", async () => {
    const { deps, insertCalls } = createDeps();

    await assert.rejects(
      () => createBankAccount(USER_ID, { currency: "USD" }, deps),
      ValidationError,
    );
    await assert.rejects(
      () => createBankAccount(USER_ID, { accountHolder: "Jane Doe" }, deps),
      ValidationError,
    );
    await assert.rejects(
      () => createBankAccount(USER_ID, { accountHolder: "   ", currency: "USD" }, deps),
      ValidationError,
    );
    await assert.rejects(
      () => createBankAccount(USER_ID, { accountHolder: "Jane Doe", currency: "US" }, deps),
      ValidationError,
    );
    await assert.rejects(
      () =>
        createBankAccount(USER_ID, { accountHolder: "Jane Doe", currency: "USDD" }, deps),
      ValidationError,
    );
    assert.equal(insertCalls.length, 0);
  });
});
