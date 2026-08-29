import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ConflictError,
  CurrencyMismatchError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  UnauthorizedError,
  ValidationError,
} from "../domain/errors";
import { mapDomainError } from "./map-domain-error";

describe("mapDomainError", () => {
  test("maps each domain subclass to the assignment status body", () => {
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
      assert.deepEqual(mapDomainError(err), { error, statusCode });
    }
  });

  test("returns null for a generic Error", () => {
    assert.equal(mapDomainError(new Error("stack / sql / secret")), null);
  });
});
