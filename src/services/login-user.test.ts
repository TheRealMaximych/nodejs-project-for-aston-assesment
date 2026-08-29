import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UnauthorizedError, ValidationError } from "../domain/errors";
import { loginUser, type LoginUserDeps } from "./login-user";

const VALID_EMAIL = "john@example.com";
const VALID_PASSWORD = "password1";
const HASHED_PASSWORD = "hashed-password-value";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN_VERSION = 3;
const ACCESS_TOKEN = "signed-access-token";

type CompareCall = { plaintext: string; passwordHash: string };
type SignCall = { userId: string; tokenVersion: number };

function createDeps(overrides?: {
  authUser?: { id: string; passwordHash: string; tokenVersion: number } | null;
  passwordMatches?: boolean;
}): {
  deps: LoginUserDeps;
  findAuthByEmailCalls: string[];
  compareCalls: CompareCall[];
  signCalls: SignCall[];
  logs: string[];
} {
  const findAuthByEmailCalls: string[] = [];
  const compareCalls: CompareCall[] = [];
  const signCalls: SignCall[] = [];
  const logs: string[] = [];

  const authUser =
    overrides && "authUser" in overrides
      ? overrides.authUser
      : {
          id: USER_ID,
          passwordHash: HASHED_PASSWORD,
          tokenVersion: TOKEN_VERSION,
        };

  const deps: LoginUserDeps = {
    users: {
      findAuthByEmail: async (email) => {
        findAuthByEmailCalls.push(email);
        return authUser;
      },
    },
    comparePassword: async (plaintext, passwordHash) => {
      compareCalls.push({ plaintext, passwordHash });
      return overrides?.passwordMatches ?? true;
    },
    signAccessToken: async (claims) => {
      signCalls.push(claims);
      return ACCESS_TOKEN;
    },
    logger: {
      info: (message) => {
        logs.push(message);
      },
    },
  };

  return { deps, findAuthByEmailCalls, compareCalls, signCalls, logs };
}

describe("loginUser", () => {
  test("returns only accessToken, signs userId and tokenVersion, and logs userId", async () => {
    const { deps, findAuthByEmailCalls, compareCalls, signCalls, logs } = createDeps();

    const result = await loginUser(
      { email: "  John@Example.com ", password: VALID_PASSWORD },
      deps,
    );

    assert.deepEqual(findAuthByEmailCalls, [VALID_EMAIL]);
    assert.equal(compareCalls.length, 1);
    assert.equal(compareCalls[0]?.plaintext, VALID_PASSWORD);
    assert.equal(compareCalls[0]?.passwordHash, HASHED_PASSWORD);
    assert.deepEqual(signCalls, [{ userId: USER_ID, tokenVersion: TOKEN_VERSION }]);
    assert.deepEqual(result, { accessToken: ACCESS_TOKEN });
    assert.deepEqual(Object.keys(result), ["accessToken"]);
    assert.equal(logs.length, 1);
    assert.equal(logs[0], `User login successful: userId=${USER_ID}`);
    assert.equal(logs[0]?.includes(VALID_PASSWORD), false);
    assert.equal(logs[0]?.includes(HASHED_PASSWORD), false);
    assert.equal(logs[0]?.includes(ACCESS_TOKEN), false);
    assert.equal(logs[0]?.includes("tokenVersion"), false);
  });

  test("rejects a wrong password as UnauthorizedError without signing", async () => {
    const { deps, signCalls, logs } = createDeps({ passwordMatches: false });

    await assert.rejects(
      () => loginUser({ email: VALID_EMAIL, password: VALID_PASSWORD }, deps),
      UnauthorizedError,
    );
    assert.equal(signCalls.length, 0);
    assert.equal(logs.length, 0);
  });

  test("rejects an unknown email as UnauthorizedError without signing", async () => {
    const { deps, signCalls, logs } = createDeps({ authUser: null });

    await assert.rejects(
      () => loginUser({ email: VALID_EMAIL, password: VALID_PASSWORD }, deps),
      UnauthorizedError,
    );
    assert.equal(signCalls.length, 0);
    assert.equal(logs.length, 0);
  });

  test("uses the same UnauthorizedError message for unknown email and wrong password", async () => {
    const unknown = createDeps({ authUser: null });
    const wrongPassword = createDeps({ passwordMatches: false });

    const unknownError = await loginUser(
      { email: VALID_EMAIL, password: VALID_PASSWORD },
      unknown.deps,
    ).catch((error: unknown) => error);
    const wrongPasswordError = await loginUser(
      { email: VALID_EMAIL, password: VALID_PASSWORD },
      wrongPassword.deps,
    ).catch((error: unknown) => error);

    assert.ok(unknownError instanceof UnauthorizedError);
    assert.ok(wrongPasswordError instanceof UnauthorizedError);
    assert.equal(unknownError.message, wrongPasswordError.message);
    assert.equal(unknownError.name, wrongPasswordError.name);
    assert.equal(unknown.signCalls.length, 0);
    assert.equal(wrongPassword.signCalls.length, 0);
  });

  test("rejects missing fields as ValidationError without using the repository", async () => {
    const { deps, findAuthByEmailCalls, signCalls } = createDeps();

    await assert.rejects(() => loginUser({ email: VALID_EMAIL }, deps), ValidationError);
    await assert.rejects(
      () => loginUser({ password: VALID_PASSWORD }, deps),
      ValidationError,
    );
    assert.equal(findAuthByEmailCalls.length, 0);
    assert.equal(signCalls.length, 0);
  });

  test("rejects an invalid email as ValidationError without using the repository", async () => {
    const { deps, findAuthByEmailCalls, signCalls } = createDeps();

    await assert.rejects(
      () => loginUser({ email: "not-an-email", password: VALID_PASSWORD }, deps),
      ValidationError,
    );
    assert.equal(findAuthByEmailCalls.length, 0);
    assert.equal(signCalls.length, 0);
  });

  test("rejects an empty password as ValidationError without using the repository", async () => {
    const { deps, findAuthByEmailCalls, signCalls } = createDeps();

    await assert.rejects(
      () => loginUser({ email: VALID_EMAIL, password: "" }, deps),
      ValidationError,
    );
    assert.equal(findAuthByEmailCalls.length, 0);
    assert.equal(signCalls.length, 0);
  });
});
