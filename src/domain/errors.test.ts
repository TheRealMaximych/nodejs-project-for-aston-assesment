import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ConflictError,
  CurrencyMismatchError,
  DomainError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  UnauthorizedError,
  ValidationError,
} from "./errors";

const domainErrors: DomainError[] = [
  new ValidationError(),
  new UnauthorizedError(),
  new ForbiddenError(),
  new NotFoundError(),
  new ConflictError(),
  new InsufficientFundsError(),
  new CurrencyMismatchError(),
  new SameAccountTransferError(),
];

describe("domain errors", () => {
  test("none of the classes expose statusCode", () => {
    for (const err of domainErrors) {
      assert.equal("statusCode" in err, false, `${err.name} must not expose statusCode`);
    }
  });

  test("InsufficientFundsError message is exactly Insufficient funds", () => {
    assert.equal(new InsufficientFundsError().message, "Insufficient funds");
  });
});
