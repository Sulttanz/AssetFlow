// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import session from "express-session";
import type { Server } from "node:http";
import { publishCabChange } from "./cab-events";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getRolesWithDetails: vi.fn(),
  getModuleSetting: vi.fn(),
  getUserPermissions: vi.fn(),
  getChanges: vi.fn(),
  getChangesPage: vi.fn(),
  getChange: vi.fn(),
  getChangeApprovals: vi.fn(),
  getAllChangeApprovalRecords: vi.fn(),
  createChangeApproval: vi.fn(),
  removeChangeApproval: vi.fn(),
  updateChangeApproval: vi.fn(),
  updateChange: vi.fn(),
  createAuditLog: vi.fn(),
  getAssets: vi.fn(),
  getMaintenanceSchedules: vi.fn(),
  getBudgets: vi.fn(),
  getTickets: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());
const streamAccess = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({ db: {}, pool: { query: notify } }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => {
    app.use(session({ secret: "integration-test-only", resave: false, saveUninitialized: false }));
    app.post("/test/login", (req, res) => {
      if (!["manager", "alice", "bob"].includes(req.body.userId)) return res.sendStatus(400);
      (req.session as session.Session & { userId?: string }).userId = req.body.userId;
      res.sendStatus(204);
    });
    app.use((req, _res, next) => {
      const id = (req.session as session.Session & { userId?: string }).userId;
      req.isAuthenticated = () => !!id;
      if (id) req.user = { id } as express.Request["user"];
      next();
    });
  },
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
  cabStreamHasAccess: streamAccess,
}));

import { registerRoutes } from "./routes";

type Approval = {
  id: string;
  changeId: string;
  approverId: string | null;
  originalApproverId: string;
  decision: string | null;
  removedAt: Date | null;
  removedById: string | null;
  decidedAt: Date | null;
};

describe("CAB route notifications across signed-in sessions", () => {
  let server: Server;
  let baseUrl: string;
  let approvals: Approval[];
  let change: { id: string; changeNumber: string; title: string; type: string; status: string };
  const streams: Array<{ abort: () => void; closed: Promise<void> }> = [];

  beforeAll(async () => {
    store.getPermissions.mockResolvedValue([
      { id: "ticket-view", name: "ticket_view_all" },
      { id: "ticket-manage", name: "ticket_manage" },
    ]);
    store.getRolesWithDetails.mockResolvedValue([]);
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    streams.forEach(stream => stream.abort());
    await Promise.all(streams.map(stream => stream.closed));
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    approvals = [];
    change = { id: "change-1", changeNumber: "CHG-000001", title: "Upgrade network", type: "normal", status: "draft" };
    store.getModuleSetting.mockResolvedValue(undefined);
    store.getUserPermissions.mockImplementation(async (id: string) => id === "manager" ? ["change_manage"] : []);
    store.createAuditLog.mockResolvedValue({});
    notify.mockResolvedValue({});
    for (const method of ["getAssets", "getMaintenanceSchedules", "getBudgets", "getTickets"]) {
      store[method as "getAssets"].mockResolvedValue([]);
    }
    const active = () => approvals.filter(a => !a.removedAt);
    store.getChanges.mockImplementation(async () => [{ ...change, approvals: active().map(a => ({ ...a })) }]);
    store.getChangesPage.mockImplementation(async () => ({ changes: [{ ...change, approvals: active().map(a => ({ ...a })) }], total: 1 }));
    store.getChange.mockImplementation(async () => ({ ...change, approvals: active().map(a => ({ ...a })) }));
    store.getChangeApprovals.mockImplementation(async () => active().map(a => ({ ...a })));
    store.getAllChangeApprovalRecords.mockImplementation(async () => approvals.map(a => ({ ...a })));
    store.createChangeApproval.mockImplementation(async ({ changeId, approverId, decision }: { changeId: string; approverId: string; decision: string }) => {
      const record: Approval = {
        id: `approval-${approvals.length + 1}`, changeId, approverId, originalApproverId: approverId,
        decision, removedAt: null, removedById: null, decidedAt: null,
      };
      approvals.push(record);
      return { ...record };
    });
    store.removeChangeApproval.mockImplementation(async (id: string, removedById: string) => {
      const record = active().find(a => a.id === id && a.decision === "pending");
      if (!record) return undefined;
      record.removedAt = new Date();
      record.removedById = removedById;
      record.approverId = null;
      return { ...record };
    });
    store.updateChangeApproval.mockImplementation(async (_changeId: string, id: string, decision: string) => {
      const record = active().find(a => a.id === id && a.decision === "pending");
      if (!record) return undefined;
      record.decision = decision;
      record.decidedAt = new Date();
      if (active().every(a => a.decision === "approved")) change.status = "approved";
      return { ...record };
    });
    store.updateChange.mockImplementation(async (_id: string, patch: { status: string }) => {
      change.status = patch.status;
      return { ...change };
    });
  });

  async function login(userId: string) {
    const response = await fetch(`${baseUrl}/test/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }),
    });
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toBeTruthy();
    return cookie!.split(";")[0];
  }

  function request(path: string, cookie: string, method = "GET", body?: object) {
    return fetch(baseUrl + path, {
      method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function openStream(cookie: string) {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/changes/events`, {
      headers: { cookie }, signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let signals = 0;
    let consumed = 0;
    let wake: (() => void) | undefined;
    const closed = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary: number;
          while ((boundary = pending.indexOf("\n\n")) !== -1) {
            const event = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            if (event.startsWith("event: cab-change\n")) {
              signals++;
              wake?.();
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    })();
    const stream = {
      get count() { return signals; },
      async next() {
        const expected = consumed + 1;
        if (signals < expected) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              wake = undefined;
              reject(new Error("CAB signal timed out"));
            }, 1000);
            wake = () => { clearTimeout(timeout); resolve(); };
            if (signals >= expected) wake();
          });
        }
        consumed = expected;
        wake = undefined;
      },
      abort: () => controller.abort(),
      closed,
    };
    streams.push(stream);
    return stream;
  }

  async function view(cookie: string) {
    const [alerts, changes] = await Promise.all([
      request("/api/alerts", cookie), request("/api/changes?page=1&pageSize=25", cookie),
    ]);
    expect(alerts.status).toBe(200);
    expect(changes.status).toBe(200);
    return { alerts: (await alerts.json()) as Array<{ type: string; changeId: string; link: string }>,
      changes: ((await changes.json()) as { changes: Array<{ status: string; approvals: Approval[] }> }).changes };
  }

  it("authenticates streams and refreshes authoritative alerts and changes after successful writes only", async () => {
    expect((await fetch(`${baseUrl}/api/changes/events`)).status).toBe(401);
    const manager = await login("manager");
    const alice = await login("alice");
    const bob = await login("bob");
    expect(new Set([manager, alice, bob]).size).toBe(3);
    const aliceStream = await openStream(alice);
    const bobStream = await openStream(bob);
    const path = "/api/changes/change-1/approvals";
    expect((await view(alice)).alerts.filter(a => a.type === "cab")).toEqual([]);

    // A forbidden write cannot notify either open session.
    expect((await request(path, bob, "POST", { approverId: "alice" })).status).toBe(403);
    expect(aliceStream.count).toBe(0);
    expect(bobStream.count).toBe(0);
    expect(notify).not.toHaveBeenCalled();

    let enteredWrite!: () => void;
    let finishWrite!: () => void;
    const writing = new Promise<void>(resolve => { enteredWrite = resolve; });
    const release = new Promise<void>(resolve => { finishWrite = resolve; });
    const saveApproval = store.createChangeApproval.getMockImplementation()!;
    store.createChangeApproval.mockImplementationOnce(async (...args: Parameters<typeof saveApproval>) => {
      enteredWrite();
      await release;
      return saveApproval(...args);
    });
    const addRequest = request(path, manager, "POST", { approverId: "alice" });
    await writing;
    expect(aliceStream.count).toBe(0);
    expect(bobStream.count).toBe(0);
    expect(notify).not.toHaveBeenCalled();
    finishWrite();
    const add = await addRequest;
    expect(add.status).toBe(201);
    const aliceApproval = (await add.json()) as Approval;
    await aliceStream.next();
    expect(bobStream.count).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
    let current = await view(alice);
    expect(current.alerts.filter(a => a.type === "cab")).toMatchObject([
      { changeId: "change-1", link: "/changes?approval=change-1" },
    ]);
    expect(current.changes[0].approvals).toMatchObject([{ id: aliceApproval.id, approverId: "alice", decision: "pending" }]);
    expect((await view(bob)).alerts.filter(a => a.type === "cab")).toEqual([]);

    expect((await request(path, manager, "POST", { approverId: "alice" })).status).toBe(409);
    expect(aliceStream.count).toBe(1);
    expect(bobStream.count).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);

    const removePath = `${path}/${aliceApproval.id}`;
    expect((await request(removePath, bob, "DELETE")).status).toBe(403);
    expect(aliceStream.count).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect((await request(removePath, manager, "DELETE")).status).toBe(200);
    await aliceStream.next();
    expect(bobStream.count).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
    current = await view(alice);
    expect(current.alerts.filter(a => a.type === "cab")).toEqual([]);
    expect(current.changes[0].approvals).toEqual([]);
    expect((await request(removePath, manager, "DELETE")).status).toBe(404);
    expect(aliceStream.count).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);

    const addBob = await request(path, manager, "POST", { approverId: "bob" });
    expect(addBob.status).toBe(201);
    const bobApproval = (await addBob.json()) as Approval;
    await bobStream.next();
    expect(aliceStream.count).toBe(3);
    expect((await view(bob)).alerts.filter(a => a.type === "cab")).toHaveLength(1);

    const votePath = `${path}/${bobApproval.id}`;
    expect((await request(votePath, alice, "PUT", { decision: "approved" })).status).toBe(403);
    expect(bobStream.count).toBe(3);
    expect(notify).toHaveBeenCalledTimes(3);
    expect((await request(votePath, bob, "PUT", { decision: "approved" })).status).toBe(200);
    await bobStream.next();
    expect(aliceStream.count).toBe(4);
    expect(notify).toHaveBeenCalledTimes(4);
    current = await view(bob);
    expect(current.alerts.filter(a => a.type === "cab")).toEqual([]);
    expect(current.changes[0]).toMatchObject({
      status: "approved", approvals: [{ id: bobApproval.id, decision: "approved" }],
    });
    expect((await request(votePath, bob, "PUT", { decision: "rejected" })).status).toBe(409);
    expect(bobStream.count).toBe(4);
    expect(notify).toHaveBeenCalledTimes(4);
  });

  it("closes a revoked stream at the next heartbeat and keeps an authorized one open", async () => {
    const realSetTimeout = setTimeout;
    const timeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(
      ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
        realSetTimeout(callback, delay === 25_000 ? 10 : delay, ...args)) as typeof setTimeout,
    );
    try {
      const alice = await login("alice");
      const bob = await login("bob");
      const aliceStream = await openStream(alice);
      const bobStream = await openStream(bob);
      await vi.waitFor(() => expect(streamAccess.mock.calls.filter(call => call[1] === "alice").length).toBeGreaterThan(0));
      let bobClosed = false;
      void bobStream.closed.then(() => { bobClosed = true; });
      expect(bobClosed).toBe(false);
      streamAccess.mockImplementation(async (_req: express.Request, id: string) => id !== "alice");
      await Promise.race([
        aliceStream.closed,
        new Promise((_, reject) => realSetTimeout(() => reject(new Error("Revoked CAB stream stayed open")), 1000)),
      ]);
      expect(bobClosed).toBe(false);
    } finally {
      timeoutSpy.mockRestore();
      streamAccess.mockResolvedValue(true);
    }
  });

  it("keeps two tabs on the same cookie live while refusing excess account connections", async () => {
    const cookies = await Promise.all(Array.from({ length: 6 }, () => login("manager")));
    const [firstTab, secondTab, ...others] = await Promise.all([
      openStream(cookies[0]), openStream(cookies[0]),
      ...cookies.slice(1, 5).map(openStream),
    ]);
    const denied = await request("/api/changes/events", cookies[5]);
    expect(denied.status).toBe(429);
    expect(denied.headers.get("retry-after")).toBe("5");
    expect(denied.headers.get("content-type")).not.toContain("text/event-stream");
    await denied.body?.cancel();

    const bob = await login("bob");
    const bobStream = await openStream(bob);
    await publishCabChange();
    await Promise.all([firstTab.next(), secondTab.next(), ...others.map(stream => stream.next()), bobStream.next()]);
    firstTab.abort();
    secondTab.abort();
    others.forEach(stream => stream.abort());
    bobStream.abort();
  });
});