// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getRolesWithDetails: vi.fn(),
  getModuleSetting: vi.fn(),
  updateModuleSetting: vi.fn(),
  getChangeApprovals: vi.fn(),
  getChange: vi.fn(),
  updateChangeApproval: vi.fn(),
  updateChange: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: store }));
const notificationQuery = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("./db", () => ({ db: {}, pool: { query: notificationQuery } }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => {
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      const userId = req.header("x-test-user");
      if (userId) {
        req.user = { id: userId } as express.Request["user"];
        req.isAuthenticated = () => true;
      } else {
        req.isAuthenticated = () => false;
      }
      next();
    });
  },
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}));

import { registerRoutes } from "./routes";

type Vote = {
  id: string;
  changeId: string;
  approverId: string | null;
  decision: string | null;
  comments: string | null;
  decidedAt: Date | null;
};

describe("CAB change routes", () => {
  let server: Server;
  let baseUrl: string;
  let votes: Vote[];
  const path = "/api/changes/change-1/approvals/vote-1";

  beforeAll(async () => {
    store.getPermissions.mockResolvedValue([
      { id: "ticket-view", name: "ticket_view_all" },
      { id: "ticket-manage", name: "ticket_manage" },
    ]);
    store.getRolesWithDetails.mockResolvedValue([]);
    store.getModuleSetting.mockResolvedValue(undefined);
    store.updateModuleSetting.mockResolvedValue({ moduleKey: "itsm", enabled: true });
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    votes = [{ id: "vote-1", changeId: "change-1", approverId: "alice", decision: "pending", comments: null, decidedAt: null }];
    store.getModuleSetting.mockResolvedValue(undefined);
    store.updateModuleSetting.mockResolvedValue({ moduleKey: "itsm", enabled: true });
    store.getChangeApprovals.mockImplementation(async (changeId: string) => votes.filter(v => v.changeId === changeId));
    store.updateChangeApproval.mockImplementation(async (changeId: string, id: string, decision: string, comments?: string) => {
      const vote = votes.find(v => v.changeId === changeId && v.id === id && v.approverId !== null && (v.decision === "pending" || v.decision === null));
      if (!vote) return undefined;
      Object.assign(vote, { decision, comments: comments ?? null, decidedAt: new Date() });
      return { ...vote };
    });
    store.updateChange.mockResolvedValue(undefined);
  });

  async function cast(decision: unknown, user = "alice", url = path) {
    const response = await fetch(baseUrl + url, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": user },
      body: JSON.stringify({ decision, comments: "Reviewed" }),
    });
    return { status: response.status, body: await response.json() };
  }

  it("publishes an ITSM-enabled signal after a successful enable update", async () => {
    notificationQuery.mockClear();

    const response = await fetch(`${baseUrl}/api/module-settings/itsm`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": "admin" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(response.status).toBe(200);
    expect(notificationQuery).toHaveBeenCalledWith(
      "SELECT pg_notify($1, $2)",
      ["cab_access", expect.any(String)],
    );
  });

  it("signals paused clients when an enabled ITSM setting is saved again", async () => {
    store.getModuleSetting.mockResolvedValueOnce({ moduleKey: "itsm", enabled: true });
    notificationQuery.mockClear();

    const response = await fetch(`${baseUrl}/api/module-settings/itsm`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": "admin" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(response.status).toBe(200);
    expect(notificationQuery).toHaveBeenCalledWith(
      "SELECT pg_notify($1, $2)",
      ["cab_access", expect.any(String)],
    );
  });

  it("does not send restoration signals when ITSM is disabled", async () => {
    store.getModuleSetting.mockResolvedValueOnce({ moduleKey: "itsm", enabled: true });
    store.updateModuleSetting.mockResolvedValueOnce({ moduleKey: "itsm", enabled: false });
    notificationQuery.mockClear();

    const response = await fetch(`${baseUrl}/api/module-settings/itsm`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": "admin" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(response.status).toBe(200);
    expect(notificationQuery).not.toHaveBeenCalled();
  });

  it("returns active, deleted-account, and removed CAB history from GET /api/changes/:id", async () => {
    const details = {
      id: "change-1",
      approvals: [
        {
          id: "active-vote",
          changeId: "change-1",
          approverId: "active-user",
          originalApproverId: "active-user",
          approverLabel: "Alex Active",
          decision: "pending",
          comments: null,
          createdAt: "2026-06-01T10:15:00.000Z",
          removedAt: null,
          approver: { id: "active-user", username: "active", firstName: "Alex", lastName: "Active" },
        },
        {
          id: "deleted-account-vote",
          changeId: "change-1",
          approverId: null,
          originalApproverId: "deleted-user",
          approverLabel: "Casey Deleted",
          decision: "approved",
          comments: "Approved before account deletion",
          createdAt: "2026-06-01T11:15:00.000Z",
          decidedAt: "2026-06-02T11:15:00.000Z",
          removedAt: null,
          approver: undefined,
        },
      ],
      removedApproverIds: ["removed-user"],
      removedApprovals: [
        {
          id: "removed-assignment",
          changeId: "change-1",
          approverId: null,
          originalApproverId: "removed-user",
          approverLabel: "Morgan Former",
          decision: "pending",
          comments: null,
          createdAt: "2026-06-01T12:15:00.000Z",
          removedAt: "2026-06-03T12:15:00.000Z",
          removedById: null,
          removedByLabel: "Taylor Manager",
          approver: undefined,
        },
      ],
    };
    store.getChange.mockResolvedValue(details);

    const response = await fetch(`${baseUrl}/api/changes/change-1`, {
      headers: { "x-test-user": "alice" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(store.getChange).toHaveBeenCalledWith("change-1");
    expect(body.approvals).toMatchObject([
      { id: "active-vote", approverId: "active-user", originalApproverId: "active-user", approverLabel: "Alex Active" },
      { id: "deleted-account-vote", approverId: null, originalApproverId: "deleted-user", approverLabel: "Casey Deleted", decision: "approved" },
    ]);
    expect(body.removedApproverIds).toEqual(["removed-user"]);
    expect(body.removedApprovals).toMatchObject([
      { id: "removed-assignment", approverId: null, originalApproverId: "removed-user", approverLabel: "Morgan Former", removedByLabel: "Taylor Manager" },
    ]);
  });

  it("rejects a different authenticated approver without altering the vote", async () => {
    const result = await cast("approved", "bob");
    expect(result.status).toBe(403);
    expect(votes[0].decision).toBe("pending");
    expect(votes[0].decidedAt).toBeNull();
    expect(store.updateChangeApproval).not.toHaveBeenCalled();
    expect(store.updateChange).not.toHaveBeenCalled();
  });

  it.each(["approved", "rejected"])("returns 409 when an existing %s vote is cast again", async decision => {
    votes[0].decision = decision;
    expect((await cast("approved")).status).toBe(409);
    expect(votes[0].decision).toBe(decision);
    expect(store.updateChangeApproval).not.toHaveBeenCalled();
  });

  it.each([["pending", "approved"], [null, "rejected"]] as const)(
    "lets the owner cast a %s vote once, then refuses to change it",
    async (initial, decision) => {
      votes[0].decision = initial;
      const first = await cast(decision);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ id: "vote-1", approverId: "alice", decision, comments: "Reviewed" });
      expect(votes[0].decidedAt).toBeInstanceOf(Date);
      expect((await cast(decision === "approved" ? "rejected" : "approved")).status).toBe(409);
      expect(votes[0].decision).toBe(decision);
      expect(store.updateChangeApproval).toHaveBeenCalledTimes(1);
    },
  );

  it("returns 400 for an invalid decision without saving anything", async () => {
    expect((await cast("abstain")).status).toBe(400);
    expect(votes[0].decision).toBe("pending");
    expect(store.updateChangeApproval).not.toHaveBeenCalled();
  });

  it("returns 404 when the approval belongs to another change", async () => {
    expect((await cast("approved", "alice", "/api/changes/change-2/approvals/vote-1")).status).toBe(404);
    expect(votes[0].decision).toBe("pending");
    expect(store.updateChangeApproval).not.toHaveBeenCalled();
  });

  it("returns 409 if another request records the decision between lookup and update", async () => {
    store.updateChangeApproval.mockImplementationOnce(async () => {
      votes[0].decision = "rejected";
      return undefined;
    });
    expect((await cast("approved")).status).toBe(409);
    expect(votes[0].decision).toBe("rejected");
    expect(store.updateChange).not.toHaveBeenCalled();
  });
});