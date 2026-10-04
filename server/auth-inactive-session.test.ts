// @vitest-environment node
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authTestState = vi.hoisted(() => ({
  user: null as any,
  sessions: new Map<string, any>(),
}));

vi.mock("./storage", () => ({
  storage: {
    getUser: vi.fn(async () => authTestState.user),
    getUserByUsername: vi.fn(async () => authTestState.user),
    getUserRoles: vi.fn(async () => []),
    getUserPermissions: vi.fn(async () => []),
  },
}));

vi.mock("./db", () => ({ pool: {} }));

vi.mock("connect-pg-simple", () => ({
  default: (session: any) =>
    class TestSessionStore extends session.Store {
      get(id: string, callback: (error: Error | null, session?: any) => void) {
        callback(null, authTestState.sessions.get(id));
      }

      set(id: string, session: any, callback?: (error?: Error | null) => void) {
        authTestState.sessions.set(id, session);
        callback?.(null);
      }

      touch(id: string, session: any, callback?: (error?: Error | null) => void) {
        authTestState.sessions.set(id, session);
        callback?.(null);
      }

      destroy(id: string, callback?: (error?: Error | null) => void) {
        authTestState.sessions.delete(id);
        callback?.(null);
      }
    },
}));

import { requireAuth, setupAuth, hashPassword } from "./auth";

describe("inactive accounts with an existing session", () => {
  let server: import("node:http").Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET ||= "auth-test-session-secret";

    const app = express();
    app.use(express.json());
    setupAuth(app);
    app.get("/protected", requireAuth, (_req, res) => res.sendStatus(200));

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    authTestState.sessions.clear();
    authTestState.user = {
      id: "alice",
      username: "alice",
      password: await hashPassword("correct horse battery staple"),
      isActive: true,
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("removes access from a previously signed-in account after deactivation", async () => {
    const signIn = async () => {
      const response = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "correct horse battery staple" }),
      });
      const body = await response.text();
      expect(response.status, body).toBe(200);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toBeTruthy();
      return cookie!;
    };
    const protectedRouteCookie = await signIn();
    const userEndpointCookie = await signIn();

    const activeRouteResponse = await fetch(`${baseUrl}/protected`, { headers: { cookie: protectedRouteCookie } });
    const activeUserResponse = await fetch(`${baseUrl}/api/user`, { headers: { cookie: userEndpointCookie } });
    expect(activeRouteResponse.status).toBe(200);
    expect(activeUserResponse.status).toBe(200);

    authTestState.user.isActive = false;

    const inactiveRouteResponse = await fetch(`${baseUrl}/protected`, { headers: { cookie: protectedRouteCookie } });
    const inactiveUserResponse = await fetch(`${baseUrl}/api/user`, { headers: { cookie: userEndpointCookie } });
    expect(inactiveRouteResponse.status).toBe(401);
    expect(inactiveUserResponse.status).toBe(401);
  });
});