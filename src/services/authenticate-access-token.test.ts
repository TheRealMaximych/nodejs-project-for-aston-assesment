import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UnauthorizedError } from "../domain/errors";
import {
  authenticateAccessToken,
  type AuthenticateAccessTokenDeps,
} from "./authenticate-access-token";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "access-token-value";
const TOKEN_VERSION = 3;

function createDeps(overrides?: {
  claims?: { userId: string; tokenVersion: number };
  user?: { id: string; tokenVersion: number } | null;
  verifyError?: Error;
}): {
  deps: AuthenticateAccessTokenDeps;
  findAuthByIdCalls: string[];
  verifyCalls: string[];
} {
  const findAuthByIdCalls: string[] = [];
  const verifyCalls: string[] = [];

  const deps: AuthenticateAccessTokenDeps = {
    verifyAccessToken: async (token) => {
      verifyCalls.push(token);
      if (overrides?.verifyError) {
        throw overrides.verifyError;
      }
      return (
        overrides?.claims ?? { userId: USER_ID, tokenVersion: TOKEN_VERSION }
      );
    },
    users: {
      findAuthById: async (id) => {
        findAuthByIdCalls.push(id);
        if (overrides && "user" in overrides) {
          return overrides.user;
        }
        return { id: USER_ID, tokenVersion: TOKEN_VERSION };
      },
    },
  };

  return { deps, findAuthByIdCalls, verifyCalls };
}

describe("authenticateAccessToken", () => {
  test("returns userId when tokenVersion matches the persisted user", async () => {
    const { deps, findAuthByIdCalls, verifyCalls } = createDeps();

    const result = await authenticateAccessToken(TOKEN, deps);

    assert.deepEqual(verifyCalls, [TOKEN]);
    assert.deepEqual(findAuthByIdCalls, [USER_ID]);
    assert.deepEqual(result, { userId: USER_ID });
  });

  test("rejects a stale tokenVersion as UnauthorizedError", async () => {
    const { deps, findAuthByIdCalls } = createDeps({
      claims: { userId: USER_ID, tokenVersion: TOKEN_VERSION },
      user: { id: USER_ID, tokenVersion: TOKEN_VERSION + 1 },
    });

    await assert.rejects(
      () => authenticateAccessToken(TOKEN, deps),
      UnauthorizedError,
    );
    assert.deepEqual(findAuthByIdCalls, [USER_ID]);
  });

  test("rejects an unknown userId as UnauthorizedError", async () => {
    const { deps } = createDeps({ user: null });

    await assert.rejects(
      () => authenticateAccessToken(TOKEN, deps),
      UnauthorizedError,
    );
  });

  test("rejects a failed verify as UnauthorizedError without loading the user", async () => {
    const { deps, findAuthByIdCalls } = createDeps({
      verifyError: new UnauthorizedError(),
    });

    await assert.rejects(
      () => authenticateAccessToken(TOKEN, deps),
      UnauthorizedError,
    );
    assert.equal(findAuthByIdCalls.length, 0);
  });
});
