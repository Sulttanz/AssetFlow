// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import session from "express-session";
import type { Server } from "node:http";
import { publishCabChange } from "./cab-events";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  createPermission: vi.fn(),
  getRolesWithDetails: vi.fn(),
  getModuleSetting: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserRoles: vi.fn(),
  getChanges: vi.fn(),
  getChangesPage: vi.fn(),
  getPendingCabAlertChanges: vi.fn(),
  getDisabledCabAlertChanges: vi.fn(),
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
const alertDb = vi.hoisted(() => ({ select: vi.fn() }));
const streamAccess = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const cabLeases = vi.hoisted(() => [] as Array<{
  id: string;
  userId: string;
  sessionId: string;
  expiresAt: Date;
}>);
const leaseQuery = vi.hoisted(() => vi.fn());

vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({
  db: alertDb,
  pool: {
    query: notify,
    connect: async () => ({ query: leaseQuery, release: vi.fn() }),
  },
}));
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
  requireAnyPermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
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
    store.createPermission.mockImplementation(async (permission: { name: string }) => ({
      ...permission,
      id: `permission-${permission.name}`,
    }));
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
    cabLeases.length = 0;
    alertDb.select.mockImplementation(() => {
      const query: any = {};
      query.from = vi.fn(() => query);
      query.where = vi.fn(() => query);
      query.orderBy = vi.fn(() => query);
      query.limit = vi.fn().mockResolvedValue([]);
      return query;
    });
    leaseQuery.mockImplementation(async (sql: string, parameters: any[] = []) => {
      const statement = sql.replace(/\s+/g, " ").trim();
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement) ||
          statement.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [], rowCount: 0 };
      if (statement.startsWith("DELETE FROM cab_stream_leases WHERE user_id =")) {
        const [userId, now] = parameters as [string, Date];
        const before = cabLeases.length;
        cabLeases.splice(0, cabLeases.length, ...cabLeases.filter(lease =>
          lease.userId !== userId || lease.expiresAt > now));
        return { rows: [], rowCount: before - cabLeases.length };
      }
      if (statement.startsWith("SELECT COUNT(*)::int AS user_count")) {
        const [userId, sessionId, now] = parameters as [string, string, Date];
        const active = cabLeases.filter(lease => lease.userId === userId && lease.expiresAt > now);
        return {
          rows: [{
            user_count: active.length,
            session_count: active.filter(lease => lease.sessionId === sessionId).length,
          }],
          rowCount: 1,
        };
      }
      if (statement.startsWith("INSERT INTO cab_stream_leases")) {
        const [id, userId, sessionId, expiresAt] = parameters as [string, string, string, Date];
        cabLeases.push({ id, userId, sessionId, expiresAt });
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected CAB lease query: ${statement}`);
    });
    approvals = [];
    change = { id: "change-1", changeNumber: "CHG-000001", title: "Upgrade network", type: "normal", status: "draft" };
    store.getModuleSetting.mockImplementation(async (moduleKey: string) =>
      moduleKey === "cmdb" ? { moduleKey, enabled: false } : undefined,
    );
    store.getUserPermissions.mockImplementation(async (id: string) => id === "manager" ? ["change_manage", "ticket_view_all"] : ["ticket_view_all"]);
    store.getUserRoles.mockResolvedValue([]);
    store.createAuditLog.mockResolvedValue({});
    notify.mockImplementation(async (sql: string, parameters: any[] = []) => {
      const statement = sql.replace(/\s+/g, " ").trim();
      if (statement.startsWith("UPDATE cab_stream_leases SET expires_at")) {
        const [id, expiresAt, now] = parameters as [string, Date, Date];
        const lease = cabLeases.find(item => item.id === id && item.expiresAt > now);
        if (lease) lease.expiresAt = expiresAt;
        return { rows: lease ? [{ id }] : [], rowCount: lease ? 1 : 0 };
      }
      if (statement.startsWith("DELETE FROM cab_stream_leases WHERE id =")) {
        const [id] = parameters as [string];
        const before = cabLeases.length;
        cabLeases.splice(0, cabLeases.length, ...cabLeases.filter(lease => lease.id !== id));
        return { rows: [], rowCount: before - cabLeases.length };
      }
      return { rows: [], rowCount: 0 };
    });
    for (const method of ["getAssets", "getMaintenanceSchedules", "getBudgets", "getTickets"]) {
      store[method as "getAssets"].mockResolvedValue([]);
    }
    const active = () => approvals.filter(a => !a.removedAt);
    store.getChanges.mockImplementation(async () => [{ ...change, approvals: active().map(a => ({ ...a })) }]);
    store.getChangesPage.mockImplementation(async () => ({ changes: [{ ...change, approvals: active().map(a => ({ ...a })) }], total: 1 }));
    store.getPendingCabAlertChanges.mockImplementation(async (userId: string) =>
      approvals.some(a => a.approverId === userId && !a.removedAt && (a.decision === "pending" || a.decision === null))
        ? [{ id: change.id, changeNumber: change.changeNumber, title: change.title, type: change.type }]
        : []);
    store.getDisabledCabAlertChanges.mockResolvedValue([]);
    store.getChange.mockImplementation(async () => ({ ...change, approvals: active().map(a => ({ ...a })) }));
    store.getChangeApprovals.mockImplementation(async () => active().map(a => ({ ...a })));
    store.getAllChangeApprovalRecords.mockImplementation(async () => approvals.map(a => ({ ...a })));
    store.createChangeApproval.mockImplementation(async ({ changeId, approverId, decision }: { changeId: string; approverId: string; decision: string }) => {
      const history = approvals.filter(a =>
        a.changeId === changeId && (a.originalApproverId === approverId || a.approverId === approverId));
      if (history.some(a => a.removedAt)) {
        throw Object.assign(new Error("This CAB member was removed from the change and cannot be re-added"), {
          code: "CAB_APPROVER_REMOVED",
        });
      }
      if (history.length > 0) {
        throw Object.assign(new Error("This CAB member is already assigned to the change"), {
          code: "CAB_APPROVER_DUPLICATE",
        });
      }
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

  it("builds CAB alerts from the signed-in user's pending-change projection, not the full change history", async () => {
      const alice = await login("alice");
    change.type = "emergency";
    store.getPendingCabAlertChanges.mockResolvedValueOnce([
      { id: change.id, changeNumber: change.changeNumber, title: change.title, type: change.type },
    ]);

    const response = await request("/api/alerts", alice);

    expect(response.status).toBe(200);
    expect((await response.json()).filter((alert: { type: string }) => alert.type === "cab")).toEqual([
      {
        type: "cab",
        severity: "high",
        title: "CAB Vote Pending: CHG-000001",
        message: "Upgrade network is waiting for your CAB decision",
        changeId: "change-1",
        link: "/changes?approval=change-1",
      },
    ]);
    expect(store.getPendingCabAlertChanges).toHaveBeenCalledWith("alice");
    expect(store.getChanges).not.toHaveBeenCalled();
  });

  it("shows blocked pending CAB assignments to change managers only", async () => {
    const manager = await login("manager");
    store.getDisabledCabAlertChanges.mockResolvedValueOnce([
      {
        id: change.id,
        changeNumber: change.changeNumber,
        title: change.title,
        type: change.type,
        approverLabel: "Disabled Reviewer",
        approverAccountStatus: "disabled",
      },
      {
        id: change.id,
        changeNumber: change.changeNumber,
        title: change.title,
        type: change.type,
        approverLabel: "Former Reviewer",
        approverAccountStatus: "deleted",
      },
    ]);

    const response = await request("/api/alerts", manager);

    expect(response.status).toBe(200);
    expect((await response.json()).filter((alert: { title: string }) => alert.title.startsWith("Blocked CAB:"))).toEqual([
      {
        type: "cab",
        severity: "high",
        title: "Blocked CAB: CHG-000001",
        message: "CHG-000001 — Upgrade network is blocked by a pending assignment for disabled CAB approver Disabled Reviewer and deleted CAB approver Former Reviewer. Remove the assignment and add an active approver.",
        changeId: "change-1",
        link: "/changes?approval=change-1",
      },
    ]);
    expect(store.getDisabledCabAlertChanges).toHaveBeenCalledTimes(1);
    expect(store.getDisabledCabAlertChanges).toHaveBeenCalledWith();

    const ordinaryUser = await login("alice");
    await request("/api/alerts", ordinaryUser);
    expect(store.getDisabledCabAlertChanges).toHaveBeenCalledTimes(1);
  });

  it("clears the manager blocker alert after an approver is re-enabled without changing assignments", async () => {
    const manager = await login("manager");
    let approverIsActive = false;
    const assignedApproval: Approval = {
      id: "approval-disabled-alice",
      changeId: change.id,
      approverId: "alice",
      originalApproverId: "alice",
      decision: "pending",
      removedAt: null,
      removedById: null,
      decidedAt: null,
    };
    const unrelatedCabAlert = {
      id: "change-2",
      changeNumber: "CHG-000002",
      title: "Other CAB review",
      type: "emergency",
    };
    approvals.push(assignedApproval);
    store.getPendingCabAlertChanges.mockImplementation(async (userId: string) =>
      userId === "manager" ? [unrelatedCabAlert] : []);
    store.getDisabledCabAlertChanges.mockImplementation(async () => approverIsActive ? [] : [{
      id: change.id,
      changeNumber: change.changeNumber,
      title: change.title,
      type: change.type,
      approverLabel: "Disabled Reviewer",
      approverAccountStatus: "disabled",
    }]);

    const blockedResponse = await request("/api/alerts", manager);
    expect(blockedResponse.status).toBe(200);
    expect((await blockedResponse.json()).filter((alert: { type: string }) => alert.type === "cab")).toMatchObject([
      {
        title: "CAB Vote Pending: CHG-000002",
        changeId: "change-2",
        link: "/changes?approval=change-2",
      },
      {
        title: "Blocked CAB: CHG-000001",
        changeId: "change-1",
        link: "/changes?approval=change-1",
      },
    ]);

    approverIsActive = true;
    const refreshedResponse = await request("/api/alerts", manager);
    expect(refreshedResponse.status).toBe(200);
    expect((await refreshedResponse.json()).filter((alert: { type: string }) => alert.type === "cab")).toMatchObject([
      {
        type: "cab",
        severity: "high",
        title: "CAB Vote Pending: CHG-000002",
        message: "Other CAB review is waiting for your CAB decision",
        changeId: "change-2",
        link: "/changes?approval=change-2",
      },
    ]);
    expect(store.getDisabledCabAlertChanges).toHaveBeenCalledTimes(2);

    const changesResponse = await request("/api/changes?page=1&pageSize=25", manager);
    expect(changesResponse.status).toBe(200);
    expect((await changesResponse.json()).changes[0].approvals).toMatchObject([{
      id: assignedApproval.id,
      approverId: "alice",
      decision: "pending",
      removedAt: null,
    }]);
  });

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

    const duplicate = await request(path, manager, "POST", { approverId: "alice" });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ code: "CAB_APPROVER_DUPLICATE" });
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

  it.each(["expired", "missing"] as const)("closes a stream when its shared lease is %s", async leaseState => {
    const realSetTimeout = setTimeout;
    const timeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(
      ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
        realSetTimeout(callback, delay === 25_000 ? 10 : delay, ...args)) as typeof setTimeout,
    );
    try {
      const cookie = await login("alice");
      const stream = await openStream(cookie);
      const lease = cabLeases.find(item => item.userId === "alice");
      expect(lease).toBeDefined();
      if (leaseState === "expired") {
        lease!.expiresAt = new Date(Date.now() - 1);
      } else {
        cabLeases.splice(cabLeases.indexOf(lease!), 1);
      }

      await Promise.race([
        stream.closed,
        new Promise((_, reject) => realSetTimeout(() => reject(new Error("CAB stream with an invalid lease stayed open")), 1000)),
      ]);
      expect(leaseQuery).toHaveBeenCalled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("closes a stream after lease renewal fails and still enforces the shared stream limit", async () => {
    const realSetTimeout = setTimeout;
    const timeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(
      ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
        realSetTimeout(callback, delay === 25_000 ? 1000 : delay, ...args)) as typeof setTimeout,
    );
    const activeStreams: Awaited<ReturnType<typeof openStream>>[] = [];
    try {
      const cookies = await Promise.all(Array.from({ length: 6 }, () => login("manager")));
      activeStreams.push(...await Promise.all(cookies.map(openStream)));
      expect(cabLeases).toHaveLength(6);

      const failedLease = cabLeases[0];
      const normalNotify = notify.getMockImplementation()!;
      notify.mockImplementation(async (sql: string, parameters: any[] = []) => {
        const statement = sql.replace(/\s+/g, " ").trim();
        if (statement.startsWith("UPDATE cab_stream_leases SET expires_at") && parameters[0] === failedLease.id) {
          throw new Error("Lease renewal database failure");
        }
        if (statement.startsWith("DELETE FROM cab_stream_leases WHERE id =") && parameters[0] === failedLease.id) {
          throw new Error("Lease release database failure");
        }
        return normalNotify(sql, parameters);
      });

      await Promise.race([
        activeStreams[0].closed,
        new Promise((_, reject) => realSetTimeout(() => reject(new Error("CAB stream stayed open after lease renewal failed")), 2000)),
      ]);

      const excessCookie = await login("manager");
      const excessResponse = await request("/api/changes/events", excessCookie);
      expect(excessResponse.status).toBe(429);
      expect(excessResponse.headers.get("retry-after")).toBe("5");
      await excessResponse.body?.cancel();
      expect(cabLeases).toHaveLength(6);
    } finally {
      activeStreams.forEach(stream => stream.abort());
      timeoutSpy.mockRestore();
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
