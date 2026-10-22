import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiSecurityMiddleware,
  createSecurityEventLogger,
  securityHeaders,
} from "./security-middleware";

describe("application security middleware", () => {
  let server: Server;
  let baseUrl: string;
  let recordEvent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    recordEvent = vi.fn();
    const app = express();
    app.set("trust proxy", 1);
    app.use(securityHeaders);
    app.use(express.json());
    app.use("/api", apiSecurityMiddleware(recordEvent));
    app.post("/api/probe", (_req, res) => res.status(204).end());
    app.post("/api/denied", (_req, res) => res.status(403).json({ error: "Denied" }));
    app.post("/api/limited", (_req, res) => res.status(429).json({ error: "Try later" }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("sets a restrictive CSP and standard browser security headers on ordinary responses", async () => {
    const response = await fetch(`${baseUrl}/api/probe`, { method: "POST" });

    expect(response.status).toBe(204);
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("allows same-origin browser mutations and non-browser API clients", async () => {
    const sameOrigin = await fetch(`${baseUrl}/api/probe`, {
      method: "POST",
      headers: { Origin: baseUrl, "Sec-Fetch-Site": "same-origin" },
    });
    const apiClient = await fetch(`${baseUrl}/api/probe`, { method: "POST" });

    expect(sameOrigin.status).toBe(204);
    expect(apiClient.status).toBe(204);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("blocks cross-origin writes and records a rule ID without request credentials", async () => {
    const response = await fetch(`${baseUrl}/api/probe`, {
      method: "POST",
      headers: {
        Origin: "https://attacker.invalid",
        "Sec-Fetch-Site": "cross-site",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "must-not-be-recorded" }),
    });
    const responseBody = await response.json();

    expect(response.status).toBe(403);
    expect(responseBody).toEqual({ error: "Cross-origin request blocked" });
    expect(recordEvent).toHaveBeenCalledWith(expect.anything(), "APP-CSRF-ORIGIN", 403);
  });

  it("audits permission denials and rate-limited responses", async () => {
    expect((await fetch(`${baseUrl}/api/denied`, { method: "POST" })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/limited`, { method: "POST" })).status).toBe(429);
    expect(recordEvent.mock.calls.map((call: unknown[]) => call[1])).toEqual([
      "API-ACCESS-DENIED",
      "API-RATE-LIMITED",
    ]);
  });

  it("persists only request metadata and a rule ID in the security audit event", async () => {
    let saved: Record<string, unknown> | undefined;
    const record = createSecurityEventLogger(event => { saved = event; });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      record(req, "TEST-BLOCK", 403);
      res.status(403).end();
    });
    const auditServer = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => auditServer.once("listening", resolve));
    const address = auditServer.address();

    try {
      if (!address || typeof address === "string") throw new Error("Test server did not bind a port");
      await fetch(`http://127.0.0.1:${address.port}/api/private?token=never-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "never-log-this-either" }),
      });
      expect(saved?.action).toBe("SECURITY_BLOCK");
      expect(saved?.recordId).toMatch(/^TEST-BLOCK:/);
      expect(saved?.ipAddress).toBe("127.0.0.1");
      expect(JSON.stringify(saved)).not.toContain("never-log");
      expect(saved?.newValues).toContain("TEST-BLOCK");
    } finally {
      auditServer.closeAllConnections();
      await new Promise<void>(resolve => auditServer.close(() => resolve()));
    }
  });

  it("adds HSTS only for HTTPS requests in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await fetch(`${baseUrl}/api/probe`, {
      method: "POST",
      headers: { "X-Forwarded-Proto": "https" },
    });
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });
});
