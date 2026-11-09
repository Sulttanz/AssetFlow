// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { PgDialect } from "drizzle-orm/pg-core";
import { changeBlackouts, changes } from "@shared/schema";

const state = vi.hoisted(() => ({
  permissions: new Map<string, string[]>(),
  plannedChanges: [] as Record<string, unknown>[],
  blackouts: [] as Record<string, any>[],
  selectReads: [] as { table: unknown; sql?: string; params?: unknown[] }[],
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  storage: {
    getPermissions: vi.fn(),
    getRolesWithDetails: vi.fn(),
    getUserRoles: vi.fn(),
    getUserPermissions: vi.fn(),
    getModuleSetting: vi.fn(),
  },
}));

vi.mock("./db", () => ({ db: state.db, pool: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));
vi.mock("./storage", () => ({ storage: state.storage }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const id = req.get("x-test-user");
    if (id) {
      req.user = { id } as express.Request["user"];
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  }),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: (permission: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = (req.user as any)?.id;
    if (!(state.permissions.get(id) ?? []).includes(permission)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  },
  requireAnyPermission: (...permissions: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const granted = state.permissions.get((req.user as any)?.id) ?? [];
    if (!permissions.some(permission => granted.includes(permission))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  },
  hashPassword: vi.fn(),
}));

import { registerRoutes } from "./routes";

describe("change calendar routes", () => {
  const dialect = new PgDialect();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    state.storage.getPermissions.mockResolvedValue([]);
    state.storage.getRolesWithDetails.mockResolvedValue([]);
    state.storage.getUserRoles.mockResolvedValue([]);
    state.storage.getModuleSetting.mockImplementation(async (moduleKey: string) => ({ moduleKey, enabled: true }));
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
    state.permissions = new Map([["manager", ["change_manage"]], ["member", []]]);
    state.storage.getUserPermissions.mockImplementation(async (id: string) => state.permissions.get(id) ?? []);
    state.storage.getUserRoles.mockResolvedValue([]);
    state.storage.getModuleSetting.mockImplementation(async (moduleKey: string) => ({ moduleKey, enabled: true }));
    state.plannedChanges = [{
      id: "change-1",
      changeNumber: "CHG-2026-001",
      title: "Database maintenance",
      status: "approved",
      type: "normal",
      scheduledStart: new Date("2026-11-12T09:00:00.000Z"),
      scheduledEnd: new Date("2026-11-12T10:00:00.000Z"),
      risk: "medium",
    }];
    state.blackouts = [{
      id: "blackout-1",
      title: "Quarter-end freeze",
      reason: "Financial close",
      startDate: "2026-11-12",
      endDate: "2026-11-14",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
    }];
    state.selectReads = [];

    state.db.select.mockImplementation(() => {
      let table: unknown;
      let rows: Record<string, unknown>[] = [];
      const query: any = {
        from(source: unknown) {
          table = source;
          rows = source === changes ? state.plannedChanges : source === changeBlackouts ? state.blackouts : [];
          return query;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          const compiled = dialect.sqlToQuery(condition);
          state.selectReads.push({ table, sql: compiled.sql, params: compiled.params });
          return query;
        },
        orderBy() { return query; },
        then(resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return query;
    });
    state.db.insert.mockImplementation(() => {
      let values: Record<string, unknown> = {};
      return {
        values(input: Record<string, unknown>) { values = input; return this; },
        returning: async () => {
          const row = { id: "blackout-created", createdAt: new Date(), updatedAt: new Date(), ...values };
          state.blackouts.push(row);
          return [row];
        },
      };
    });
    state.db.update.mockImplementation(() => {
      let values: Record<string, unknown> = {};
      let id = "";
      const query: any = {
        set(input: Record<string, unknown>) { values = input; return query; },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          id = String(dialect.sqlToQuery(condition).params[0] ?? "");
          return query;
        },
        returning: async () => {
          const index = state.blackouts.findIndex(row => row.id === id);
          if (index < 0) return [];
          state.blackouts[index] = { ...state.blackouts[index], ...values };
          return [state.blackouts[index]];
        },
      };
      return query;
    });
    state.db.delete.mockImplementation(() => {
      let id = "";
      const query: any = {
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          id = String(dialect.sqlToQuery(condition).params[0] ?? "");
          return query;
        },
        returning: async () => {
          const index = state.blackouts.findIndex(row => row.id === id);
          if (index < 0) return [];
          return [state.blackouts.splice(index, 1)[0]];
        },
      };
      return query;
    });
  });

  const request = (method: string, path: string, body?: Record<string, unknown>, user = "manager") =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { "x-test-user": user, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  it("returns planned changes and overlapping configured blackout periods for managers", async () => {
    const response = await request("GET", "/api/changes/calendar?from=2026-11-01&to=2026-11-30");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      changes: [{ id: "change-1", status: "approved", title: "Database maintenance" }],
      blackouts: [{ id: "blackout-1", title: "Quarter-end freeze", startDate: "2026-11-12" }],
    });
    expect(state.selectReads).toHaveLength(2);
    expect(state.selectReads[0].params).toEqual(expect.arrayContaining(["submitted", "approved", "in_progress"]));
    expect(state.selectReads[1].params).toEqual(expect.arrayContaining(["2026-11-01", "2026-11-30"]));
  });

  it.each([
    ["invalid date", "/api/changes/calendar?from=2026-02-30&to=2026-03-01"],
    ["reversed range", "/api/changes/calendar?from=2026-11-30&to=2026-11-01"],
    ["oversized range", "/api/changes/calendar?from=2026-01-01&to=2026-03-31"],
  ])("rejects an %s without querying calendar records", async (_label, path) => {
    const response = await request("GET", path);

    expect(response.status).toBe(400);
    expect(state.db.select).not.toHaveBeenCalled();
  });

  it("allows managers to create, edit, and remove blackout periods", async () => {
    const body = {
      title: "Release freeze",
      reason: "Quarter-end close",
      startDate: "2026-12-20",
      endDate: "2026-12-31",
    };
    const created = await request("POST", "/api/change-blackouts", body);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "blackout-created", ...body, createdById: "manager" });

    const updated = await request("PUT", "/api/change-blackouts/blackout-created", {
      ...body,
      title: "Extended release freeze",
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: "blackout-created", title: "Extended release freeze" });

    const deleted = await request("DELETE", "/api/change-blackouts/blackout-created");
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true });
    expect(state.blackouts.some(row => row.id === "blackout-created")).toBe(false);
  });

  it.each([
    ["reversed dates", { title: "Freeze", startDate: "2026-12-31", endDate: "2026-12-20" }],
    ["invalid calendar date", { title: "Freeze", startDate: "2026-02-30", endDate: "2026-03-01" }],
    ["empty title", { title: "  ", startDate: "2026-12-20", endDate: "2026-12-31" }],
  ])("rejects blackout creation with %s", async (_label, body) => {
    const response = await request("POST", "/api/change-blackouts", body);

    expect(response.status).toBe(400);
    expect(state.db.insert).not.toHaveBeenCalled();
  });

  it("keeps calendar and blackout management restricted to change managers", async () => {
    expect((await request("GET", "/api/changes/calendar?from=2026-11-01&to=2026-11-30", undefined, "member")).status).toBe(403);
    expect((await request("POST", "/api/change-blackouts", {
      title: "Unauthorized freeze", startDate: "2026-12-01", endDate: "2026-12-02",
    }, "member")).status).toBe(403);
    expect(state.db.select).not.toHaveBeenCalled();
    expect(state.db.insert).not.toHaveBeenCalled();
  });
});
