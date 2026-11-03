// @vitest-environment node
import express, { type RequestHandler } from "express";
import { getTableName } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  select: vi.fn(),
  settings: vi.fn(),
  queriedTables: [] as string[],
}));
vi.mock("./db", () => ({ db: { select: state.select } }));
vi.mock("./storage", () => ({
  storage: {
    getModuleSetting: state.settings,
    getUserRoles: vi.fn(async () => [{ id: "admin", name: "admin" }]),
    getUserPermissions: vi.fn(async () => ["system_admin", "project_manage", "project_view"]),
  },
}));

import { registerProjectManagementRoutes } from "./project-management";
import { isFeatureEnabled, sendFeatureNotEnabled } from "./module-access";

describe("Project-only module isolation", () => {
  const app = express();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    app.use(express.json());
    const auth: RequestHandler = (req, _res, next) => {
      (req as any).user = { id: "manager-1" };
      next();
    };
    registerProjectManagementRoutes(app, auth, key => async (_req, res, next) => {
      if (await isFeatureEnabled(key)) next();
      else sendFeatureNotEnabled(res, key);
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.on("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  beforeEach(() => {
    state.queriedTables = [];
    state.settings.mockImplementation(async key => ({ moduleKey: key, enabled: key === "project_management" }));
    state.select.mockImplementation(() => {
      let tableName = "";
      const query: any = {
        from(table: Parameters<typeof getTableName>[0]) {
          tableName = getTableName(table);
          state.queriedTables.push(tableName);
          if (["assets", "project_assets", "incidents", "changes", "risks", "servers", "cmdb_applications"].includes(tableName)) {
            throw new Error(`Disabled-module table queried: ${tableName}`);
          }
          return query;
        },
        then(resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          const rows = tableName === "projects"
            ? [{ id: "project-1", title: "Standalone project", name: "Standalone project" }]
            : tableName === "users"
              ? [{ id: "manager-1", username: "manager", firstName: "Project", lastName: "Manager", isActive: true }]
              : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      for (const method of ["where", "limit", "orderBy", "innerJoin", "leftJoin"]) query[method] = () => query;
      return query;
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("returns user options and no asset options without querying ITAM", async () => {
    const response = await fetch(`${baseUrl}/api/projects/options`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ assets: [], assetsAvailable: false });
    expect(state.queriedTables).toEqual(["users"]);
  });

  it("loads a project with empty optional asset links when ITAM is disabled", async () => {
    const response = await fetch(`${baseUrl}/api/projects/project-1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: "Standalone project", assets: [] });
    expect(state.queriedTables).not.toContain("project_assets");
  });

  it.each(["tasks", "risks", "changes", "documents"])("loads project %s without ITSM, GRC, or CMDB", async resource => {
    const response = await fetch(`${baseUrl}/api/projects/project-1/${resource}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("rejects new asset links with the standard feature response before any write", async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Standalone project", status: "Planning", healthStatus: "On Track",
        startDate: "2026-01-01", targetEndDate: "2026-12-31", budget: 100,
        managerIds: ["manager-1"], primaryManagerId: "manager-1", teamMembers: [], milestones: [],
        assets: [{ assetId: "asset-1", associationType: "Deployed" }],
      }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "Feature Not Enabled", code: "FEATURE_NOT_ENABLED", moduleKey: "asset_management" });
    expect(state.queriedTables).toEqual([]);
  });
});
