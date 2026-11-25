// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cookieSecureMode, trustProxySetting } from "./auth-transport";
import { setupAuth, hashPassword } from "./auth";
import { pool } from "./db";
import { storage } from "./storage";
import { stopBackgroundTasks } from "./graceful-shutdown";
import { apiSecurityMiddleware, securityHeaders } from "./security-middleware";

afterEach(() => vi.unstubAllEnvs());

describe("session transport configuration", () => {
  it("defaults to automatic cookie security and one proxy hop", () => {
    expect(cookieSecureMode("")).toBe("auto");
    expect(trustProxySetting("")).toBe(1);
    expect(cookieSecureMode("TRUE")).toBe(true);
    expect(cookieSecureMode("false")).toBe(false);
    expect(() => cookieSecureMode("yes")).toThrow(/COOKIE_SECURE/);
  });
  it("supports disabling trust, fixed hops, and specific proxy networks", () => {
    expect(trustProxySetting("false")).toBe(false);
    expect(trustProxySetting("0")).toBe(0);
    expect(trustProxySetting("2")).toBe(2);
    expect(trustProxySetting("true")).toBe(true);
    expect(trustProxySetting("loopback, 10.20.0.0/24")).toEqual(["loopback", "10.20.0.0/24"]);
    expect(() => trustProxySetting("999999999999")).toThrow(/hop count/);
    expect(() => express().set("trust proxy", trustProxySetting("untrusted-garbage"))).toThrow();
  });
});

describe.runIf(process.env.RUN_DATABASE_INTEGRATION_TESTS === "1")("PostgreSQL-backed HTTP/HTTPS login sessions", () => {
  const username = `transport_${randomUUID().slice(0, 12)}`;
  const password = randomUUID();
  let userId: string | undefined;
  let server: Server | undefined;

  beforeAll(async () => {
    const url = new URL(process.env.VITEST_TEST_DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) ||
        !url.searchParams.get("options")?.includes("test_") ||
        process.env.VITEST_NATIVE_PG !== "1") {
      throw new Error("Session integration tests require the disposable local Vitest PostgreSQL cluster.");
    }
    const user = await storage.createUser({
      username, password: await hashPassword(password), email: null,
      firstName: "Transport", lastName: "Test",
    });
    userId = user.id;
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) =>
      server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
    await stopBackgroundTasks();
  });
  afterAll(async () => {
    if (userId) {
      // The session store follows this connection's isolated test search_path.
      await pool.query(`DELETE FROM sessions WHERE sess::jsonb->'passport'->>'user' = $1`, [userId]);
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  });

  it.each([
    { name: "auto on plain HTTP", mode: "auto", trust: "loopback", forwarded: "", secure: false, cookie: true },
    { name: "auto behind trusted HTTPS proxy", mode: "auto", trust: "loopback", forwarded: "https", secure: true, cookie: true },
    { name: "ignores spoofed HTTPS when proxy trust is disabled", mode: "auto", trust: "false", forwarded: "https", secure: false, cookie: true },
    { name: "explicit HTTP compatibility", mode: "false", trust: "loopback", forwarded: "", secure: false, cookie: true },
    { name: "strict HTTPS behind proxy", mode: "true", trust: "1", forwarded: "https", secure: true, cookie: true },
    { name: "strict HTTPS refuses insecure transport cookies", mode: "true", trust: "loopback", forwarded: "", secure: true, cookie: false },
  ])("$name", async ({ mode, trust, forwarded, secure, cookie }) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", mode);
    vi.stubEnv("TRUST_PROXY", trust);
    const app = express();
    app.use(express.json());
    app.use(securityHeaders);
    app.use("/api", apiSecurityMiddleware());
    setupAuth(app);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (forwarded) headers["x-forwarded-proto"] = forwarded;
    const login = await fetch(`${baseUrl}/api/login`, {
      method: "POST", headers, body: JSON.stringify({ username, password }),
    });
    expect(login.status, await login.clone().text()).toBe(200);
    const setCookie = login.headers.get("set-cookie");
    if (!cookie) {
      expect(setCookie).toBeNull();
      expect((await fetch(`${baseUrl}/api/user`, { headers })).status).toBe(401);
      return;
    }
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    const expires = /Expires=([^;]+)/i.exec(setCookie!)?.[1];
    expect(expires).toBeTruthy();
    expect(Math.abs(new Date(expires!).getTime() - Date.now() - 10 * 60_000)).toBeLessThan(10_000);
    expect(/;\s*Secure\b/i.test(setCookie!)).toBe(secure);
    headers.cookie = setCookie!.split(";")[0];
    const currentUser = await fetch(`${baseUrl}/api/user`, { headers });
    expect(currentUser.status).toBe(200);
    expect(currentUser.headers.get("set-cookie")).toContain("connect.sid=");
    const body = await currentUser.json();
    expect(body.id).toBe(userId);
    expect(body.username).toBe(username);
    expect(body).not.toHaveProperty("password");
    const logout = await fetch(`${baseUrl}/api/logout`, { method: "POST", headers });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    expect((await fetch(`${baseUrl}/api/user`, { headers })).status).toBe(401);
  });
});
