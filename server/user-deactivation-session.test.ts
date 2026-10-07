// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import session from "express-session";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authTestState = vi.hoisted(() => ({
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  query: vi.fn(async (sql: string, values: unknown[] = []) => {
    if (!sql.includes('DELETE FROM "sessions"')) throw new Error("Unexpected database query");
    const userId = values[0];
    let rowCount = 0;
    for (const [id, savedSession] of authTestState.sessions) {
      if (savedSession.passport?.user === userId) {
        authTestState.sessions.delete(id);
        rowCount++;
      }
    }
    return { rows: [], rowCount };
  }),
}));

vi.mock("./storage", () => ({
  storage: {
    getUser: vi.fn(async (id: string) => authTestState.users.get(id)),
    getUserByUsername: vi.fn(async (username: string) =>
      Array.from(authTestState.users.values()).find(user => user.username === username),
    ),
    getUserRoles: vi.fn(async () => []),
    getUserPermissions: vi.fn(async () => ["user_update", "user_view"]),
    getPermissions: vi.fn(async () => []),
    getRolesWithDetails: vi.fn(async () => []),
    createAuditLog: vi.fn(async () => undefined),
    updateUser: vi.fn(async (id: string, update: Record<string, unknown>) => {
      const user = authTestState.users.get(id);
      if (!user) return undefined;
      const updatedUser = { ...user, ...update };
      authTestState.users.set(id, updatedUser);
      return updatedUser;
    }),
  },
}));

vi.mock("./db", () => ({ pool: { query: authTestState.query }, db: {} }));

vi.mock("connect-pg-simple", () => ({
  default: (expressSession: typeof session) =>
    class TestSessionStore extends expressSession.Store {
      get(id: string, callback: (error: Error | null, savedSession?: any) => void) {
        callback(null, authTestState.sessions.get(id));
      }

      set(id: string, savedSession: any, callback?: (error?: Error | null) => void) {
        authTestState.sessions.set(id, savedSession);
        callback?.(null);
      }

      touch(id: string, savedSession: any, callback?: (error?: Error | null) => void) {
        // Match connect-pg-simple: touching a deleted row must not recreate it.
        if (authTestState.sessions.has(id)) authTestState.sessions.set(id, savedSession);
        callback?.(null);
      }

      destroy(id: string, callback?: (error?: Error | null) => void) {
        authTestState.sessions.delete(id);
        callback?.(null);
      }
    },
}));

import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";

describe("user deactivation session revocation", () => {
  let server: Server;
  let baseUrl: string;
  let passwordHash: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET ||= "deactivation-test-session-secret";
    passwordHash = await hashPassword("correct horse battery staple");

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    authTestState.sessions.clear();
    authTestState.users.clear();
    authTestState.query.mockClear();
    for (const [id, username] of [["admin", "admin"], ["target", "target"]]) {
      authTestState.users.set(id, {
        id,
        username,
        email: `${username}@example.test`,
        password: passwordHash,
        firstName: username,
        lastName: "Test",
        isActive: true,
      });
    }
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve()),
      );
    }
  });

  async function signIn(username: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "correct horse battery staple" }),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    return cookie!;
  }

  async function setAccountActive(cookie: string, isActive: boolean) {
    return fetch(`${baseUrl}/api/users/target`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
  }

  it("revokes every old session permanently across deactivation and reactivation", async () => {
    const firstOldSession = await signIn("target");
    const secondOldSession = await signIn("target");
    const adminSession = await signIn("admin");

    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: firstOldSession } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: secondOldSession } })).status).toBe(200);

    const deactivation = await setAccountActive(adminSession, false);
    expect(deactivation.status).toBe(200);
    expect(authTestState.query).toHaveBeenCalledWith(
      `DELETE FROM "sessions" WHERE sess->'passport'->>'user' = $1`,
      ["target"],
    );
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(false);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: firstOldSession } })).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: secondOldSession } })).status).toBe(401);

    const reactivation = await setAccountActive(adminSession, true);
    expect(reactivation.status).toBe(200);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: firstOldSession } })).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: secondOldSession } })).status).toBe(401);

    const freshSession = await signIn("target");
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: freshSession } })).status).toBe(200);
  });
});
