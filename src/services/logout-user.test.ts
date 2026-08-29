import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UnauthorizedError } from "../domain/errors";
import { authenticateAccessToken } from "./authenticate-access-token";
import { logoutUser, type LogoutUserDeps } from "./logout-user";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const PREVIOUS_TOKEN_VERSION = 3;
const ACCESS_TOKEN = "signed-access-token";
const PASSWORD = "plaintext-password";
const PASSWORD_HASH = "hashed-password-value";

describe("logoutUser", () => {
  test("increments tokenVersion and logs userId without secrets", async () => {
    const incrementCalls: string[] = [];
    const logs: string[] = [];
    const deps: LogoutUserDeps = {
      users: {
        incrementTokenVersion: async (id) => {
          incrementCalls.push(id);
          return true;
        },
      },
      logger: {
        info: (message) => {
          logs.push(message);
        },
      },
    };

    await logoutUser(USER_ID, deps);

    assert.deepEqual(incrementCalls, [USER_ID]);
    assert.equal(logs.length, 1);
    assert.equal(logs[0], `User logout successful: userId=${USER_ID}`);
    assert.equal(logs[0]?.includes(PASSWORD), false);
    assert.equal(logs[0]?.includes(PASSWORD_HASH), false);
    assert.equal(logs[0]?.includes(ACCESS_TOKEN), false);
    assert.equal(logs[0]?.includes("token"), false);
  });

  test("rejects authenticateAccessToken with the previous tokenVersion after increment", async () => {
    let tokenVersion = PREVIOUS_TOKEN_VERSION;
    const users = {
      incrementTokenVersion: async (id: string) => {
        assert.equal(id, USER_ID);
        tokenVersion += 1;
        return true;
      },
      findAuthById: async (id: string) => ({ id, tokenVersion }),
    };

    await logoutUser(USER_ID, {
      users,
      logger: { info: () => undefined },
    });

    await assert.rejects(
      () =>
        authenticateAccessToken(ACCESS_TOKEN, {
          verifyAccessToken: async () => ({
            userId: USER_ID,
            tokenVersion: PREVIOUS_TOKEN_VERSION,
          }),
          users,
        }),
      UnauthorizedError,
    );
  });

  test("rejects zero updated rows as UnauthorizedError without logging", async () => {
    const logs: string[] = [];
    const deps: LogoutUserDeps = {
      users: {
        incrementTokenVersion: async () => false,
      },
      logger: {
        info: (message) => {
          logs.push(message);
        },
      },
    };

    await assert.rejects(() => logoutUser(USER_ID, deps), UnauthorizedError);
    assert.equal(logs.length, 0);
  });
});
