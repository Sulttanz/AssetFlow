// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { incidents, projects } from "@shared/schema";

const state = vi.hoisted(() => ({
  disabled: new Set<string>(),
  reads: [] as Array<{ table: unknown; fields: string[]; sql?: string; params?: unknown[] }>,
  db: { select: vi.fn(), selectDistinct: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  storage: {
    getPermissions: vi.fn(), getRolesWithDetails: vi.fn(),
    getUserRoles: vi.fn(), getUserPermissions: vi.fn(), getModuleSetting: vi.fn(),
  },
}));
vi.mock("./db", () => ({ db: state.db, pool: { query: vi.fn().mockResolvedValue({ rows: [] }) } }));
vi.mock("./storage", () => ({ storage: state.storage }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => app.use((req, _res, next) => {
    const id = req.get("x-test-user");
    if (id) req.user = { id } as Express.User;
    req.isAuthenticated = (() => Boolean(id)) as typeof req.isAuthenticated;
    next();
  }),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAnyPermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}));
import { registerRoutes } from "./routes";

describe("executive dashboard reporting controls", () => {
  const dialect = new PgDialect();
  let server: Server;
  let base: string;
  beforeAll(async () => {
    state.storage.getPermissions.mockResolvedValue([]);
    state.storage.getRolesWithDetails.mockResolvedValue([]);
    state.storage.getUserRoles.mockImplementation(async (id: string) => [{ name: id === "admin" ? "system_admin" : "end_user" }]);
    state.storage.getUserPermissions.mockImplementation(async (id: string) => id === "admin" ? ["system_admin"] : []);
    state.storage.getModuleSetting.mockImplementation(async (moduleKey: string) => ({ moduleKey, enabled: !state.disabled.has(moduleKey) }));
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  beforeEach(() => {
    state.disabled.clear();
    state.reads = [];
    const select = (selection: Record<string, unknown>) => {
      const fields = Object.keys(selection);
      let rows: unknown[] = [];
      let read: typeof state.reads[number];
      const query: any = {
        from(table: unknown) {
          read = { table, fields };
          state.reads.push(read);
          rows = table === projects ? [{ total: 17 }] :
            table === incidents && fields.includes("withinSla") ? [{ withinSla: 2, breached: 1 }] : [];
          return query;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          const compiled = dialect.sqlToQuery(condition);
          Object.assign(read, { sql: compiled.sql, params: compiled.params });
          return query;
        },
        innerJoin() { return query; },
        orderBy() { return query; },
        limit() { return query; },
        then(resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return query;
    };
    state.db.select.mockImplementation(select);
    state.db.selectDistinct.mockImplementation(select);
  });
  const get = (query = "", actor = "admin") => fetch(`${base}/api/dashboard/executive${query}`, {
    headers: actor ? { "x-test-user": actor } : {},
  });

  it.each([7, 30, 90])("bounds SLA resolution dates to the selected %i-day period", async days => {
    const response = await get(`?days=${days}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projects.totalProjects).toBe(17);
    expect(body.reportingWindow.days).toBe(days);
    expect(new Date(body.reportingWindow.through).getTime() - new Date(body.reportingWindow.from).getTime())
      .toBe(days * 86_400_000);
    const resolutions = state.reads.find(read => read.fields.includes("withinSla"))!;
    expect(resolutions.sql).toContain('"incidents"."resolved_at" >=');
    expect(resolutions.sql).toContain('"incidents"."resolved_at" <=');
    const dates = resolutions.params?.map(value => value instanceof Date ? value.toISOString() : value);
    expect(dates).toContain(body.reportingWindow.from);
    expect(dates).toContain(body.reportingWindow.through);
    const openQueue = state.reads.find(read => read.table === incidents && read.fields.includes("P1"))!;
    expect(openQueue.sql).toBeUndefined(); // Backlog snapshots must not hide older open incidents.
  });
  it("retains the existing all-time API behavior when no period is supplied", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reportingWindow.days).toBeNull();
    expect(body.reportingWindow.from).toBeNull();
    expect(state.reads.find(read => read.fields.includes("withinSla"))?.sql).not.toContain(">=");
  });
  it.each(["0", "-7", "8", "abc", "7&days=30"])("rejects invalid or ambiguous period %s before any data reads", async days => {
    expect((await get(`?days=${days}`)).status).toBe(400);
    expect(state.reads).toHaveLength(0);
  });
  it("returns zero projects and never queries that table when Project Management is disabled", async () => {
    state.disabled.add("project_management");
    const response = await get("?days=30");
    expect(response.status).toBe(200);
    expect((await response.json()).projects.totalProjects).toBe(0);
    expect(state.reads.some(read => read.table === projects)).toBe(false);
  });
  it("continues enforcing sign-in and executive role boundaries", async () => {
    expect((await get("", "")).status).toBe(401);
    expect((await get("?days=30", "end-user")).status).toBe(403);
    expect(state.reads).toHaveLength(0);
  });
});
