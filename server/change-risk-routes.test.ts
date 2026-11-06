// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  permissions: new Map<string, string[]>(),
  risk: null as Record<string, any> | null,
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(async () => undefined),
  },
  storage: {
    getPermissions: vi.fn(),
    createPermission: vi.fn(),
    getRolesWithDetails: vi.fn(),
    createRole: vi.fn(),
    assignRolePermission: vi.fn(),
    getModuleSetting: vi.fn(),
    getUserPermissions: vi.fn(),
    getUserRoles: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));

vi.mock("./db", () => ({ db: state.db, pool: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));
vi.mock("./storage", () => ({ storage: state.storage }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => app.use((req, _res, next) => {
    const id = req.get("x-test-user");
    if (id) {
      req.user = { id } as Express.User;
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  }),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: (permission: string) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = (req.user as any)?.id;
    if (!(state.permissions.get(id) ?? []).includes(permission)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  },
  requireAnyPermission: (...permissions: string[]) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const granted = state.permissions.get((req.user as any)?.id) ?? [];
    if (!permissions.some(permission => granted.includes(permission))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  },
  hashPassword: vi.fn(),
}));

import { registerRoutes } from "./routes";

describe("change risk routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    state.storage.getPermissions.mockResolvedValue([]);
    state.storage.createPermission.mockImplementation(async (permission: { name: string }) => ({
      id: permission.name, ...permission,
    }));
    state.storage.getRolesWithDetails.mockResolvedValue([]);
    state.storage.createRole.mockResolvedValue({ id: "role" });
    state.storage.assignRolePermission.mockResolvedValue(undefined);
    state.storage.getModuleSetting.mockImplementation(async (moduleKey: string) => ({ moduleKey, enabled: true }));
    state.storage.getUserRoles.mockResolvedValue([]);
    state.storage.createAuditLog.mockResolvedValue({});

    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.permissions = new Map([
      ["change-manager", ["change_manage"]],
      ["risk-register-only", ["risk_manage"]],
      ["member", []],
    ]);
    state.risk = null;
    state.storage.getUserPermissions.mockImplementation(async (id: string) => state.permissions.get(id) ?? []);

    state.db.select.mockImplementation((projection?: Record<string, unknown>) => {
      let result: unknown[] = [];
      const query: any = {
        from: () => {
          if (projection && "risk" in projection) {
            result = state.risk ? [{
              risk: { ...state.risk },
              linkedOwnerId: state.risk.ownerId,
              linkedOwnerUsername: "risk-owner",
              linkedOwnerFirstName: "Risk",
              linkedOwnerLastName: "Owner",
              linkedChangeId: state.risk.changeId,
              linkedChangeNumber: "CHG-123",
              linkedChangeTitle: "Planned database upgrade",
            }] : [];
          }
          return query;
        },
        where: () => {
          result = state.risk ? [{ ...state.risk }] : [];
          return query;
        },
        leftJoin: () => query,
        then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });
    state.db.insert.mockImplementation(() => {
      let values: Record<string, unknown> = {};
      return {
        values(input: Record<string, unknown>) {
          values = input;
          return this;
        },
        returning: async () => {
          state.risk = { id: "risk-1", ...values };
          return [{ ...state.risk }];
        },
      };
    });
    state.db.update.mockImplementation(() => {
      let values: Record<string, unknown> = {};
      const query: any = {
        set(input: Record<string, unknown>) {
          values = input;
          return query;
        },
        where: () => query,
        returning: async () => {
          if (!state.risk) return [];
          state.risk = { ...state.risk, ...values };
          return [{ ...state.risk }];
        },
        then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve([]).then(resolve, reject),
      };
      return query;
    });
  });

  async function request(method: "POST" | "PUT", body: Record<string, unknown>, actor = "change-manager") {
    return fetch(`${baseUrl}/api/risks${method === "PUT" ? "/risk-1" : ""}`, {
      method,
      headers: { "content-type": "application/json", "x-test-user": actor },
      body: JSON.stringify(body),
    });
  }

  const validRisk = {
    title: "Production database upgrade",
    category: "availability",
    likelihood: 3,
    impact: 4,
    ownerId: "risk-owner",
    changeId: "change-123",
  };

  it("allows change managers to create and update risks without losing their linked change or owner", async () => {
    const created = await request("POST", validRisk);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      id: "risk-1",
      changeId: "change-123",
      ownerId: "risk-owner",
      riskScore: 12,
    });

    const updated = await request("PUT", { title: "Production database upgrade with failover" });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      title: "Production database upgrade with failover",
      changeId: "change-123",
      ownerId: "risk-owner",
    });

    const list = await fetch(`${baseUrl}/api/risks`, { headers: { "x-test-user": "change-manager" } });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject([{
      changeId: "change-123",
      change: { id: "change-123", changeNumber: "CHG-123", title: "Planned database upgrade" },
      owner: { id: "risk-owner", username: "risk-owner" },
    }]);
  });

  it.each(["member", "risk-register-only"])("blocks risk creation and editing without change-management permission (%s)", async actor => {
    state.risk = { id: "risk-1", ...validRisk, status: "identified" };
    expect((await request("POST", validRisk, actor)).status).toBe(403);
    expect((await request("PUT", { title: "Unauthorized edit" }, actor)).status).toBe(403);
    expect(state.db.insert).not.toHaveBeenCalled();
    expect(state.db.update).not.toHaveBeenCalled();
  });

  it.each([
    ["likelihood below 1", { likelihood: 0 }],
    ["impact above 5", { impact: 6 }],
    ["residual likelihood below 1", { residualLikelihood: 0 }],
    ["residual impact above 5", { residualImpact: 6 }],
    ["invalid status", { status: "approved" }],
    ["accepted without a reason", { status: "accepted" }],
    ["accepted with a blank reason", { status: "accepted", acceptanceReason: "  " }],
  ])("rejects invalid risk creation: %s", async (_label, invalidFields) => {
    const response = await request("POST", { ...validRisk, ...invalidFields });
    expect(response.status).toBe(400);
    expect(state.db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["likelihood below 1", { likelihood: 0 }],
    ["impact above 5", { impact: 6 }],
    ["residual likelihood below 1", { residualLikelihood: 0 }],
    ["residual impact above 5", { residualImpact: 6 }],
    ["invalid status", { status: "approved" }],
    ["accepted without a reason", { status: "accepted" }],
    ["accepted with a blank reason", { status: "accepted", acceptanceReason: "  " }],
  ])("rejects invalid risk updates: %s", async (_label, invalidFields) => {
    state.risk = { id: "risk-1", ...validRisk, status: "identified", acceptanceReason: null };
    const response = await request("PUT", invalidFields);
    expect(response.status).toBe(400);
    expect(state.db.update).not.toHaveBeenCalled();
  });

  it("rejects clearing the acceptance reason while an existing risk remains accepted", async () => {
    state.risk = {
      id: "risk-1", ...validRisk, status: "accepted", acceptanceReason: "Residual risk approved",
    };
    const response = await request("PUT", { acceptanceReason: null });
    expect(response.status).toBe(400);
    expect(state.db.update).not.toHaveBeenCalled();
  });
});
