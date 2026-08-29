import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ConflictError, ValidationError } from "../domain/errors";
import { registerUser, type RegisterUserDeps } from "./register-user";

const VALID_EMAIL = "john@example.com";
const VALID_PASSWORD = "password1";
const HASHED_PASSWORD = "hashed-password-value";
const USER_ID = "11111111-1111-1111-1111-111111111111";

type InsertCall = { email: string; passwordHash: string };

function createDeps(overrides?: {
  existingEmail?: string | null;
  insert?: RegisterUserDeps["users"]["insert"];
}): {
  deps: RegisterUserDeps;
  insertCalls: InsertCall[];
  findByEmailCalls: string[];
  logs: string[];
} {
  const insertCalls: InsertCall[] = [];
  const findByEmailCalls: string[] = [];
  const logs: string[] = [];

  const deps: RegisterUserDeps = {
    users: {
      findByEmail: async (email) => {
        findByEmailCalls.push(email);
        if (overrides?.existingEmail && overrides.existingEmail === email) {
          return { id: USER_ID, email };
        }
        return null;
      },
      insert: async (user) => {
        insertCalls.push(user);
        if (overrides?.insert) {
          return overrides.insert(user);
        }
        return { id: USER_ID, email: user.email };
      },
    },
    hashPassword: async (plaintext) => {
      assert.equal(plaintext, VALID_PASSWORD);
      return HASHED_PASSWORD;
    },
    logger: {
      info: (message) => {
        logs.push(message);
      },
    },
  };

  return { deps, insertCalls, findByEmailCalls, logs };
}

describe("registerUser", () => {
  test("creates a user with a hash and logs the registered email", async () => {
    const { deps, insertCalls, findByEmailCalls, logs } = createDeps();

    const result = await registerUser(
      { email: "  John@Example.com ", password: VALID_PASSWORD },
      deps,
    );

    assert.deepEqual(findByEmailCalls, [VALID_EMAIL]);
    assert.deepEqual(result, { id: USER_ID, email: VALID_EMAIL });
    assert.deepEqual(Object.keys(result).sort(), ["email", "id"]);
    assert.equal(insertCalls.length, 1);
    assert.equal(insertCalls[0]?.email, VALID_EMAIL);
    assert.equal(insertCalls[0]?.passwordHash, HASHED_PASSWORD);
    assert.notEqual(insertCalls[0]?.passwordHash, VALID_PASSWORD);
    assert.equal(logs.length, 1);
    assert.equal(logs[0], `User registered: email=${VALID_EMAIL}`);
    assert.equal(logs[0]?.includes(VALID_PASSWORD), false);
    assert.equal(logs[0]?.includes(HASHED_PASSWORD), false);
    assert.equal(logs[0]?.includes("tokenVersion"), false);
  });

  test("rejects a duplicate email without inserting", async () => {
    let insertCalled = false;
    const { deps } = createDeps({
      existingEmail: VALID_EMAIL,
      insert: async () => {
        insertCalled = true;
        return { id: USER_ID, email: VALID_EMAIL };
      },
    });

    await assert.rejects(
      () => registerUser({ email: VALID_EMAIL, password: VALID_PASSWORD }, deps),
      ConflictError,
    );
    assert.equal(insertCalled, false);
  });

  test("rejects missing fields as ValidationError without using the repository", async () => {
    const { deps, insertCalls, findByEmailCalls } = createDeps();

    await assert.rejects(() => registerUser({ email: VALID_EMAIL }, deps), ValidationError);
    await assert.rejects(
      () => registerUser({ password: VALID_PASSWORD }, deps),
      ValidationError,
    );
    assert.equal(findByEmailCalls.length, 0);
    assert.equal(insertCalls.length, 0);
  });

  test("rejects an invalid email as ValidationError", async () => {
    const { deps, insertCalls, findByEmailCalls } = createDeps();

    await assert.rejects(
      () => registerUser({ email: "not-an-email", password: VALID_PASSWORD }, deps),
      ValidationError,
    );
    assert.equal(findByEmailCalls.length, 0);
    assert.equal(insertCalls.length, 0);
  });

  test("rejects a password shorter than 8 characters as ValidationError", async () => {
    const { deps, insertCalls, findByEmailCalls } = createDeps();

    await assert.rejects(
      () => registerUser({ email: VALID_EMAIL, password: "short" }, deps),
      ValidationError,
    );
    assert.equal(findByEmailCalls.length, 0);
    assert.equal(insertCalls.length, 0);
  });
});
