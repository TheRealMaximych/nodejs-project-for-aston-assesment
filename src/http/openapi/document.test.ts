import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { OpenAPIV3 } from "openapi-types";
import { openApiDocument } from "./document";

function pathItem(path: string): OpenAPIV3.PathItemObject {
  const item = openApiDocument.paths?.[path];
  assert.ok(item, `missing path ${path}`);
  return item;
}

function operation(path: string, method: "get" | "post"): OpenAPIV3.OperationObject {
  const op = pathItem(path)[method];
  assert.ok(op, `missing ${method.toUpperCase()} ${path}`);
  return op;
}

function hasBearer(op: OpenAPIV3.OperationObject): boolean {
  return (op.security ?? []).some((requirement) =>
    Object.prototype.hasOwnProperty.call(requirement, "bearerAuth"),
  );
}

function schemaObject(name: string): OpenAPIV3.SchemaObject {
  const schema = openApiDocument.components?.schemas?.[name];
  assert.ok(schema, `missing schema ${name}`);
  assert.ok(!("$ref" in schema), `schema ${name} is a $ref`);
  return schema;
}

function propertyType(schema: OpenAPIV3.SchemaObject, name: string): string | undefined {
  const property = schema.properties?.[name];
  assert.ok(property, `missing property ${name}`);
  assert.ok(!("$ref" in property), `property ${name} is a $ref`);
  const type = property.type;
  return typeof type === "string" ? type : undefined;
}

describe("openApiDocument", () => {
  test("declares required assignment paths and methods", () => {
    operation("/health", "get");
    operation("/auth/register", "post");
    operation("/auth/login", "post");
    operation("/auth/logout", "post");
    operation("/accounts", "post");
    operation("/accounts/{id}/balance", "get");
    operation("/transactions", "post");
    operation("/transactions/{accountId}", "get");
  });

  test("does not declare list-accounts, deposit, or refresh operations", () => {
    assert.equal(pathItem("/accounts").get, undefined);

    const paths = Object.keys(openApiDocument.paths ?? {});
    for (const path of paths) {
      assert.equal(/deposit|refresh|password-reset|forgot-password|verify-email/i.test(path), false);
    }
  });

  test("ErrorResponse requires error and statusCode", () => {
    const errorResponse = schemaObject("ErrorResponse");
    assert.deepEqual(errorResponse.required, ["error", "statusCode"]);
    assert.equal(propertyType(errorResponse, "error"), "string");
    assert.equal(propertyType(errorResponse, "statusCode"), "integer");
  });

  test("Bearer JWT is required only on protected operations", () => {
    assert.equal(hasBearer(operation("/health", "get")), false);
    assert.equal(hasBearer(operation("/auth/register", "post")), false);
    assert.equal(hasBearer(operation("/auth/login", "post")), false);

    assert.equal(hasBearer(operation("/auth/logout", "post")), true);
    assert.equal(hasBearer(operation("/accounts", "post")), true);
    assert.equal(hasBearer(operation("/accounts/{id}/balance", "get")), true);
    assert.equal(hasBearer(operation("/transactions", "post")), true);
    assert.equal(hasBearer(operation("/transactions/{accountId}", "get")), true);
  });

  test("money fields are strings", () => {
    assert.equal(propertyType(schemaObject("AccountResponse"), "balance"), "string");
    assert.equal(propertyType(schemaObject("BalanceResponse"), "balance"), "string");
    assert.equal(propertyType(schemaObject("TransferRequest"), "amount"), "string");
    assert.equal(propertyType(schemaObject("HistoryItem"), "amount"), "string");
  });

  test("transfer 400 example is insufficient funds", () => {
    const response = operation("/transactions", "post").responses["400"];
    assert.ok(response);
    assert.ok(!("$ref" in response));
    const example = response.content?.["application/json"]?.example;
    assert.deepEqual(example, { error: "Insufficient funds", statusCode: 400 });
  });
});
