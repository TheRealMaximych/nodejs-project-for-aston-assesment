import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";
import { getAccountBalance, type GetAccountBalanceDeps } from "./get-account-balance";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const ACCOUNT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

type StoredAccount = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
  userId: string;
};

function createDeps(account: StoredAccount | null): {
  deps: GetAccountBalanceDeps;
  findByIdCalls: string[];
} {
  const findByIdCalls: string[] = [];

  const deps: GetAccountBalanceDeps = {
    accounts: {
      findById: async (id) => {
        findByIdCalls.push(id);
        return account;
      },
    },
  };

  return { deps, findByIdCalls };
}

describe("getAccountBalance", () => {
  test("returns the stored balance string for an owned account", async () => {
    const { deps, findByIdCalls } = createDeps({
      id: ACCOUNT_ID,
      accountHolder: "Jane Doe",
      balance: "0.00",
      currency: "USD",
      userId: USER_ID,
    });

    const result = await getAccountBalance(
      { userId: USER_ID, accountId: ACCOUNT_ID },
      deps,
    );

    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
    assert.deepEqual(result, { balance: "0.00" });
    assert.equal(typeof result.balance, "string");
  });

  test("rejects a foreign account as ForbiddenError", async () => {
    const { deps, findByIdCalls } = createDeps({
      id: ACCOUNT_ID,
      accountHolder: "Jane Doe",
      balance: "0.00",
      currency: "USD",
      userId: OTHER_USER_ID,
    });

    await assert.rejects(
      () => getAccountBalance({ userId: USER_ID, accountId: ACCOUNT_ID }, deps),
      ForbiddenError,
    );
    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
  });

  test("rejects a missing account as NotFoundError", async () => {
    const { deps, findByIdCalls } = createDeps(null);

    await assert.rejects(
      () => getAccountBalance({ userId: USER_ID, accountId: ACCOUNT_ID }, deps),
      NotFoundError,
    );
    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
  });

  test("rejects a non-UUID account id as ValidationError without calling find", async () => {
    const { deps, findByIdCalls } = createDeps(null);

    await assert.rejects(
      () => getAccountBalance({ userId: USER_ID, accountId: "not-a-uuid" }, deps),
      ValidationError,
    );
    assert.equal(findByIdCalls.length, 0);
  });
});
