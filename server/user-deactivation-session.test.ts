// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import session from "express-session";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authTestState = vi.hoisted(() => ({
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  sessionDeleteError: null as Error | null,
  lookupGate: null as null | { username: string; entered: () => void; wait: Promise<void> },
  sessionSaveGate: null as null | { entered: () => void; wait: Promise<void>; saved: () => void },
  lockWaitEntered: null as null | (() => void),
  advisoryLocks: new Map<string, { locked: boolean; waiters: Array<() => void> }>(),
  query: vi.fn(async (sql: string, values: unknown[] = []) => {
    if (!sql.includes('DELETE FROM "sessions"')) throw new Error("Unexpected database query");
    if (authTestState.sessionDeleteError) throw authTestState.sessionDeleteError;
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
  acquireAdvisoryLock: async (key: string) => {
    let lock = authTestState.advisoryLocks.get(key);
    if (!lock) {
      lock = { locked: false, waiters: [] };
      authTestState.advisoryLocks.set(key, lock);
    }
    if (lock.locked) {
      await new Promise<void>(resolve => {
        lock!.waiters.push(resolve);
        authTestState.lockWaitEntered?.();
      });
    }
    lock.locked = true;
  },
  releaseAdvisoryLock: (key: string) => {
    const lock = authTestState.advisoryLocks.get(key);
    if (!lock) throw new Error(`No advisory lock held for ${key}`);
    const next = lock.waiters.shift();
    if (next) next();
    else {
      lock.locked = false;
      authTestState.advisoryLocks.delete(key);
    }
  },
}));

vi.mock("./storage", () => ({
  storage: {
    getUser: vi.fn(async (id: string) => authTestState.users.get(id)),
    getUserByUsername: vi.fn(async (username: string) => {
      const user = Array.from(authTestState.users.values()).find(user => user.username === username);
      const gate = authTestState.lookupGate;
      if (gate?.username === username) {
        gate.entered();
        await gate.wait;
      }
      return user;
    }),
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

vi.mock("./db", () => ({
  pool: {
    query: authTestState.query,
    connect: vi.fn(async () => {
      const heldLocks = new Set<string>();
      return {
        query: async (sql: string, values: unknown[] = []) => {
          const key = String(values[0]);
          if (sql.includes("pg_advisory_lock(")) {
            await authTestState.acquireAdvisoryLock(key);
            heldLocks.add(key);
            return { rows: [{ pg_advisory_lock: true }] };
          }
          if (sql.includes("pg_advisory_unlock(")) {
            if (!heldLocks.delete(key)) throw new Error(`Connection does not hold lock ${key}`);
            authTestState.releaseAdvisoryLock(key);
            return { rows: [{ pg_advisory_unlock: true }] };
          }
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release: vi.fn(),
      };
    }),
  },
  db: {},
}));

vi.mock("connect-pg-simple", () => ({
  default: (expressSession: typeof session) =>
    class TestSessionStore extends expressSession.Store {
      get(id: string, callback: (error: Error | null, savedSession?: any) => void) {
        callback(null, authTestState.sessions.get(id));
      }

      set(id: string, savedSession: any, callback?: (error?: Error | null) => void) {
        const gate = authTestState.sessionSaveGate;
        if (gate) {
          gate.entered();
          void gate.wait.then(() => {
            authTestState.sessions.set(id, savedSession);
            gate.saved();
            callback?.(null);
          });
          return;
        }
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
    authTestState.sessionDeleteError = null;
    authTestState.advisoryLocks.clear();
    authTestState.lookupGate = null;
    authTestState.sessionSaveGate = null;
    authTestState.lockWaitEntered = null;
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

  it("keeps the account active and its session valid when stored sessions cannot be revoked", async () => {
    const targetSession = await signIn("target");
    const adminSession = await signIn("admin");
    authTestState.sessionDeleteError = new Error("Session store unavailable");

    const deactivation = await setAccountActive(adminSession, false);

    expect(deactivation.status).toBe(500);
    expect(await deactivation.json()).toEqual({ message: "Failed to update user" });
    expect(authTestState.query).toHaveBeenCalledWith(
      `DELETE FROM "sessions" WHERE sess->'passport'->>'user' = $1`,
      ["target"],
    );
    expect(authTestState.users.get("target")?.isActive).toBe(true);
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(true);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: targetSession } })).status).toBe(200);
  });

  it("does not persist a sign-in that looked up the account before deactivation", async () => {
    const adminSession = await signIn("admin");
    let lookupStarted!: () => void;
    const lookupReached = new Promise<void>(resolve => { lookupStarted = resolve; });
    let resumeLookup!: () => void;
    const lookupGate = new Promise<void>(resolve => { resumeLookup = resolve; });
    authTestState.lookupGate = {
      username: "target",
      entered: lookupStarted,
      wait: lookupGate,
    };

    const pendingLogin = fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "target", password: "correct horse battery staple" }),
    });
    await lookupReached;

    const deactivation = await setAccountActive(adminSession, false);
    expect(deactivation.status).toBe(200);
    authTestState.lookupGate = null;
    resumeLookup();

    const loginResponse = await pendingLogin;
    expect(loginResponse.status).toBe(401);
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(false);

    const reactivation = await setAccountActive(adminSession, true);
    expect(reactivation.status).toBe(200);
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(false);
  });

  it("revokes a session saved by a sign-in already holding the account lock", async () => {
    const adminSession = await signIn("admin");
    let saveStarted!: () => void;
    const saveReached = new Promise<void>(resolve => { saveStarted = resolve; });
    let resumeSave!: () => void;
    const saveGate = new Promise<void>(resolve => { resumeSave = resolve; });
    let sessionSaved!: () => void;
    const savedSession = new Promise<void>(resolve => { sessionSaved = resolve; });
    authTestState.sessionSaveGate = {
      entered: saveStarted,
      wait: saveGate,
      saved: sessionSaved,
    };

    const pendingLogin = fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "target", password: "correct horse battery staple" }),
    });
    await saveReached;

    let deactivationCompleted = false;
    let lockWaitStarted!: () => void;
    const lockWaitReached = new Promise<void>(resolve => { lockWaitStarted = resolve; });
    authTestState.lockWaitEntered = lockWaitStarted;
    const deactivation = setAccountActive(adminSession, false).then(response => {
      deactivationCompleted = true;
      return response;
    });
    await lockWaitReached;

    expect(deactivationCompleted).toBe(false);
    expect(authTestState.users.get("target")?.isActive).toBe(true);
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(false);

    authTestState.sessionSaveGate = null;
    resumeSave();
    await savedSession;
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(true);
    expect(deactivationCompleted).toBe(false);

    const loginResponse = await pendingLogin;
    expect(loginResponse.status).toBe(200);
    const oldCookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
    expect(oldCookie).toBeTruthy();

    const deactivationResponse = await deactivation;
    expect(deactivationResponse.status).toBe(200);
    expect(Array.from(authTestState.sessions.values()).some(saved => saved.passport?.user === "target")).toBe(false);

    const reactivation = await setAccountActive(adminSession, true);
    expect(reactivation.status).toBe(200);
    expect((await fetch(`${baseUrl}/api/user`, { headers: { cookie: oldCookie! } })).status).toBe(401);
  });
});
