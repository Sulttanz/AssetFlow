// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import type { Response } from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiErrorMiddleware, respondWithApiError } from "./api-error-handler";

function respond(error: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  respondWithApiError(res as unknown as Response, error, "Test operation");
  expect(log).toHaveBeenCalledWith(expect.stringContaining("[API "), error);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

afterEach(() => vi.restoreAllMocks());

describe("safe API error responses", () => {
  it.each([
    ["employees_employee_id_unique", "DUPLICATE_EMPLOYEE_ID", "employee number"],
    ["employees_email_unique", "DUPLICATE_EMPLOYEE_EMAIL", "email address"],
    ["employees_employee_id_key", "DUPLICATE_EMPLOYEE_ID", "employee number"],
    ["employees_email_key", "DUPLICATE_EMPLOYEE_EMAIL", "email address"],
  ])("handles wrapped PostgreSQL uniqueness violations for %s", (constraint, code, message) => {
    const error = new Error("Failed query: INSERT INTO employees with private values", {
      cause: Object.assign(new Error("duplicate key with private employee data"), { code: "23505", constraint }),
    });
    const result = respond(error);
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code, message: expect.stringContaining(message) });
    expect(result.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(result.body)).not.toMatch(/private|INSERT|constraint|stack/);
  });

  it("returns field-specific Zod details without echoing submitted values", () => {
    const parsed = z.object({ firstName: z.string(), email: z.email() }).safeParse({
      email: "private invalid email",
    });
    if (parsed.success) throw new Error("Expected invalid fixture");
    const result = respond(parsed.error);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("VALIDATION_ERROR");
    expect(result.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "firstName", code: "invalid_type" }),
      expect.objectContaining({ path: "email" }),
    ]));
    expect(JSON.stringify(result.body)).not.toContain("private invalid email");
  });

  it.each([
    ["23505", 409, "DUPLICATE_RECORD"],
    ["23503", 409, "RELATED_RECORD_CONFLICT"],
    ["23502", 400, "REQUIRED_FIELD_MISSING"],
    ["22P02", 400, "INVALID_FIELD_VALUE"],
    ["22007", 400, "INVALID_FIELD_VALUE"],
    ["23514", 400, "INVALID_FIELD_VALUE"],
    ["40P01", 409, "DATABASE_RETRYABLE_CONFLICT"],
    ["57P01", 503, "DATABASE_UNAVAILABLE"],
    ["08006", 503, "DATABASE_UNAVAILABLE"],
    ["ECONNREFUSED", 503, "DATABASE_UNAVAILABLE"],
    ["57014", 503, "DATABASE_TIMEOUT"],
    ["42703", 500, "DATABASE_SCHEMA_ERROR"],
  ])("maps %s to a useful, safe error code", (databaseCode, status, code) => {
    const result = respond(Object.assign(new Error("private database details"), { code: databaseCode }));
    expect(result.status).toBe(status);
    expect(result.body.code).toBe(code);
    expect(JSON.stringify(result.body)).not.toContain("private database details");
  });

  it("logs unexpected exceptions and returns a reference without internal details", () => {
    const error = new Error("postgresql://private-connection-string");
    const result = respond(error);
    expect(result).toMatchObject({
      status: 500,
      body: { code: "INTERNAL_SERVER_ERROR", message: "Test operation", requestId: expect.any(String) },
    });
    expect(JSON.stringify(result.body)).not.toContain("postgresql://");
  });

  it("bounds traversal of circular causes", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(respond(error).status).toBe(500);
  });
});

describe("Express global error middleware", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.post("/body", (_req, res) => res.json({ ok: true }));
    app.get("/failure", (_req, _res, next) => next(new Error("secret database query")));
    app.use(apiErrorMiddleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("returns JSON for uncaught errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetch(`${base}/failure`);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "INTERNAL_SERVER_ERROR", requestId: expect.any(String) });
  });

  it("preserves malformed-JSON 400 errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetch(`${base}/body`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{bad",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "HTTP_400", message: expect.stringContaining("invalid JSON") });
  });

  it("preserves oversized-body 413 errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetch(`${base}/body`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(2000) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "HTTP_413" });
  });

  it("delegates after headers have already been sent", () => {
    const next = vi.fn();
    const error = new Error("stream failed");
    apiErrorMiddleware(error, {} as express.Request, { headersSent: true } as Response, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
