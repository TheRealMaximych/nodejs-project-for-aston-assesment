import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../domain/errors";
import { app } from "../app";
import { notFound } from "./not-found";

describe("notFound", () => {
  test("passes NotFoundError to next", () => {
    let passed: unknown;
    const next = ((err?: unknown) => {
      passed = err;
    }) as NextFunction;

    notFound({} as Request, {} as Response, next);

    assert.ok(passed instanceof NotFoundError);
  });

  test("GET /no-such-route returns 404 { error, statusCode }", async () => {
    const server = app.listen(0);
    await once(server, "listening");

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/no-such-route`);
      const body: unknown = await response.json();

      assert.equal(response.status, 404);
      assert.ok(body !== null && typeof body === "object");
      assert.equal((body as { statusCode: unknown }).statusCode, 404);
      assert.equal(typeof (body as { error: unknown }).error, "string");
      assert.ok(((body as { error: string }).error as string).length > 0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  test("POST /accounts returns 404 { error, statusCode }", async () => {
    const server = app.listen(0);
    await once(server, "listening");

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/accounts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body: unknown = await response.json();

      assert.equal(response.status, 404);
      assert.ok(body !== null && typeof body === "object");
      assert.equal((body as { statusCode: unknown }).statusCode, 404);
      assert.equal(typeof (body as { error: unknown }).error, "string");
      assert.ok(((body as { error: string }).error as string).length > 0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  test("POST /auth/logout without Authorization returns 401 { error, statusCode }", async () => {
    const server = app.listen(0);
    await once(server, "listening");

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/auth/logout`, {
        method: "POST",
      });
      const body: unknown = await response.json();

      assert.equal(response.status, 401);
      assert.ok(body !== null && typeof body === "object");
      assert.equal((body as { statusCode: unknown }).statusCode, 401);
      assert.equal(typeof (body as { error: unknown }).error, "string");
      assert.ok(((body as { error: string }).error as string).length > 0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
