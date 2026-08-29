import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../config/logger";
import {
  ConflictError,
  CurrencyMismatchError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors";
import { errorHandler } from "./error-handler";

type MockRes = Pick<Response, "status" | "json" | "statusCode"> & {
  body?: unknown;
};

function createRes(): MockRes {
  const res: MockRes = {
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(body: unknown) {
      this.body = body;
      return this as Response;
    },
  };
  return res;
}

function invoke(err: unknown, res: MockRes): void {
  const req = { method: "POST", url: "/transactions" } as Request;
  const next = (() => undefined) as NextFunction;
  errorHandler(err, req, res as Response, next);
}

describe("errorHandler", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test("maps each domain error without an unhandled log", () => {
    const spy = mock.method(logger, "error", () => undefined);
    const cases = [
      { err: new ValidationError("bad input"), statusCode: 400, error: "bad input" },
      {
        err: new InsufficientFundsError(),
        statusCode: 400,
        error: "Insufficient funds",
      },
      { err: new CurrencyMismatchError("USD vs EUR"), statusCode: 400, error: "USD vs EUR" },
      {
        err: new SameAccountTransferError("same account"),
        statusCode: 400,
        error: "same account",
      },
      { err: new UnauthorizedError("no token"), statusCode: 401, error: "no token" },
      { err: new ForbiddenError("foreign account"), statusCode: 403, error: "foreign account" },
      { err: new NotFoundError("missing"), statusCode: 404, error: "missing" },
      { err: new ConflictError("email taken"), statusCode: 409, error: "email taken" },
    ];

    for (const { err, statusCode, error } of cases) {
      const res = createRes();
      invoke(err, res);
      assert.equal(res.statusCode, statusCode);
      assert.deepEqual(res.body, { error, statusCode });
    }

    assert.equal(spy.mock.callCount(), 0);
  });

  test("generic Error is 500 without stack, SQL, or internal message", () => {
    const spy = mock.method(logger, "error", () => undefined);
    const internal = "SELECT * FROM users at /app/src/db.ts:12:3 secret-token";
    const res = createRes();

    invoke(new Error(internal), res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: "Internal Server Error", statusCode: 500 });

    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes("SELECT"), false);
    assert.equal(serialized.includes("/app/src/db.ts"), false);
    assert.equal(serialized.includes(internal), false);
    assert.equal(serialized.includes("stack"), false);

    assert.equal(spy.mock.callCount(), 1);
  });

  test("malformed JSON body is 400 Invalid JSON without an unhandled log", () => {
    const spy = mock.method(logger, "error", () => undefined);
    const err = Object.assign(new SyntaxError("Unexpected token"), {
      status: 400,
      type: "entity.parse.failed",
      body: "{not-json",
    });
    const res = createRes();

    invoke(err, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Invalid JSON", statusCode: 400 });
    assert.equal(JSON.stringify(res.body).includes("{not-json"), false);
    assert.equal(spy.mock.callCount(), 0);
  });

  test("oversized JSON body is 413 without an unhandled log", () => {
    const spy = mock.method(logger, "error", () => undefined);
    const err = Object.assign(new Error("request entity too large"), {
      status: 413,
      type: "entity.too.large",
    });
    const res = createRes();

    invoke(err, res);

    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.body, { error: "Request body too large", statusCode: 413 });
    assert.equal(spy.mock.callCount(), 0);
  });
});
