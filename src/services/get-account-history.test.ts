import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";
import {
  getAccountHistory,
  type GetAccountHistoryDeps,
  type HistoryItem,
} from "./get-account-history";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const ACCOUNT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER_ACCOUNT_ID = "8d0f7780-8536-51ef-a55c-f18fd2a01bf8";

const NEWER_TX_ID = "11111111-1111-4111-8111-111111111111";
const OLDER_TX_ID = "22222222-2222-4222-8222-222222222222";

const CONTRACT_KEYS = [
  "amount",
  "fromAccount",
  "status",
  "timestamp",
  "toAccount",
  "transactionId",
] as const;

type StoredAccount = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
  userId: string;
};

type StoredTransaction = {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: string;
  timestamp: Date;
  status: "Completed" | "Failed";
};

function createDeps(
  account: StoredAccount | null,
  rows: StoredTransaction[],
): {
  deps: GetAccountHistoryDeps;
  findByIdCalls: string[];
  listByAccountIdCalls: string[];
} {
  const findByIdCalls: string[] = [];
  const listByAccountIdCalls: string[] = [];

  const deps: GetAccountHistoryDeps = {
    accounts: {
      findById: async (id) => {
        findByIdCalls.push(id);
        return account;
      },
    },
    transactions: {
      listByAccountId: async (accountId) => {
        listByAccountIdCalls.push(accountId);
        return rows;
      },
    },
  };

  return { deps, findByIdCalls, listByAccountIdCalls };
}

function ownedAccount(): StoredAccount {
  return {
    id: ACCOUNT_ID,
    accountHolder: "Jane Doe",
    balance: "100.00",
    currency: "USD",
    userId: USER_ID,
  };
}

function assertContractItem(item: HistoryItem, row: StoredTransaction): void {
  assert.deepEqual(Object.keys(item).sort(), [...CONTRACT_KEYS]);
  assert.equal(item.transactionId, row.id);
  assert.equal(item.fromAccount, row.fromAccount);
  assert.equal(item.toAccount, row.toAccount);
  assert.equal(item.amount, row.amount);
  assert.equal(typeof item.amount, "string");
  assert.equal(item.timestamp, row.timestamp.toISOString());
  assert.equal(item.status, row.status);
  assert.equal("id" in item, false);
}

describe("getAccountHistory", () => {
  test("returns outgoing and incoming items newest-first for an owned account", async () => {
    const newer: StoredTransaction = {
      id: NEWER_TX_ID,
      fromAccount: ACCOUNT_ID,
      toAccount: OTHER_ACCOUNT_ID,
      amount: "25.50",
      timestamp: new Date("2026-08-29T18:00:00.000Z"),
      status: "Completed",
    };
    const older: StoredTransaction = {
      id: OLDER_TX_ID,
      fromAccount: OTHER_ACCOUNT_ID,
      toAccount: ACCOUNT_ID,
      amount: "10.00",
      timestamp: new Date("2026-08-28T12:00:00.000Z"),
      status: "Completed",
    };
    const { deps, findByIdCalls, listByAccountIdCalls } = createDeps(
      ownedAccount(),
      [newer, older],
    );

    const result = await getAccountHistory(
      { userId: USER_ID, accountId: ACCOUNT_ID },
      deps,
    );

    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
    assert.deepEqual(listByAccountIdCalls, [ACCOUNT_ID]);
    assert.equal(result.length, 2);
    assertContractItem(result[0] as HistoryItem, newer);
    assertContractItem(result[1] as HistoryItem, older);
    assert.ok(result[0]!.timestamp > result[1]!.timestamp);
  });

  test("returns an empty array for an owned account with no operations and still lists", async () => {
    const { deps, findByIdCalls, listByAccountIdCalls } = createDeps(
      ownedAccount(),
      [],
    );

    const result = await getAccountHistory(
      { userId: USER_ID, accountId: ACCOUNT_ID },
      deps,
    );

    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
    assert.deepEqual(listByAccountIdCalls, [ACCOUNT_ID]);
    assert.deepEqual(result, []);
  });

  test("rejects a foreign account as ForbiddenError without listing", async () => {
    const { deps, findByIdCalls, listByAccountIdCalls } = createDeps(
      {
        id: ACCOUNT_ID,
        accountHolder: "Jane Doe",
        balance: "100.00",
        currency: "USD",
        userId: OTHER_USER_ID,
      },
      [
        {
          id: NEWER_TX_ID,
          fromAccount: ACCOUNT_ID,
          toAccount: OTHER_ACCOUNT_ID,
          amount: "1.00",
          timestamp: new Date("2026-08-29T18:00:00.000Z"),
          status: "Completed",
        },
      ],
    );

    await assert.rejects(
      () => getAccountHistory({ userId: USER_ID, accountId: ACCOUNT_ID }, deps),
      ForbiddenError,
    );
    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
    assert.equal(listByAccountIdCalls.length, 0);
  });

  test("rejects a missing account as NotFoundError without listing", async () => {
    const { deps, findByIdCalls, listByAccountIdCalls } = createDeps(null, []);

    await assert.rejects(
      () => getAccountHistory({ userId: USER_ID, accountId: ACCOUNT_ID }, deps),
      NotFoundError,
    );
    assert.deepEqual(findByIdCalls, [ACCOUNT_ID]);
    assert.equal(listByAccountIdCalls.length, 0);
  });

  test("rejects a non-UUID account id as ValidationError without calling repositories", async () => {
    const { deps, findByIdCalls, listByAccountIdCalls } = createDeps(null, []);

    await assert.rejects(
      () => getAccountHistory({ userId: USER_ID, accountId: "not-a-uuid" }, deps),
      ValidationError,
    );
    assert.equal(findByIdCalls.length, 0);
    assert.equal(listByAccountIdCalls.length, 0);
  });
});
