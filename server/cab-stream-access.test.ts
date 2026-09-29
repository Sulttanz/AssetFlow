// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import type { SessionData } from "express-session";

const store = vi.hoisted(() => ({ getUser: vi.fn(), getModuleSetting: vi.fn() }));
vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({ pool: {} }));

import { cabStreamHasAccess } from "./auth";

describe("CAB stream access", () => {
  let saved: SessionData | null;
  let req: Request;

  beforeEach(() => {
    saved = { passport: { user: "alice" }, cookie: { expires: new Date(Date.now() + 60_000) } } as unknown as SessionData;
    req = {
      sessionID: "session-1",
      sessionStore: {
        get: (_id: string, callback: (error: Error | null, session?: SessionData | null) => void) => callback(null, saved),
      },
    } as unknown as Request;
    store.getUser.mockReset().mockResolvedValue({ id: "alice", isActive: true });
    store.getModuleSetting.mockReset().mockResolvedValue(undefined);
  });

  it("keeps a valid session connected", async () => {
    expect(await cabStreamHasAccess(req, "alice")).toBe(true);
  });

  it("rejects deleted, replaced, and expired sessions", async () => {
    saved = null;
    expect(await cabStreamHasAccess(req, "alice")).toBe(false);
    saved = { passport: { user: "bob" } } as unknown as SessionData;
    expect(await cabStreamHasAccess(req, "alice")).toBe(false);
    saved = { passport: { user: "alice" }, cookie: { expires: new Date(Date.now() - 1) } } as unknown as SessionData;
    expect(await cabStreamHasAccess(req, "alice")).toBe(false);
  });

  it("rejects deactivated accounts and disabled ITSM access", async () => {
    store.getUser.mockResolvedValueOnce({ id: "alice", isActive: false });
    expect(await cabStreamHasAccess(req, "alice")).toBe(false);
    store.getModuleSetting.mockResolvedValueOnce({ enabled: false });
    expect(await cabStreamHasAccess(req, "alice")).toBe(false);
  });

  it("fails closed when session storage is unavailable", async () => {
    req.sessionStore.get = (_id, callback) => callback(new Error("store unavailable"));
    await expect(cabStreamHasAccess(req, "alice")).rejects.toThrow("store unavailable");
  });
});