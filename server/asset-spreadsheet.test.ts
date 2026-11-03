// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import ExcelJS from "exceljs";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserRoles: vi.fn(),
  getRolesWithDetails: vi.fn(),
  getModuleSetting: vi.fn(),
  getLocations: vi.fn(),
  getDepartments: vi.fn(),
  getAssets: vi.fn(),
  createAsset: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: "tester" } as express.Request["user"];
    req.isAuthenticated = () => true;
    next();
  }),
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAnyPermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}));

import { registerRoutes } from "./routes";

describe("asset spreadsheet compliance round-trip", () => {
  let server: Server;
  let baseUrl: string;
  let saved: Record<string, unknown>[];

  beforeAll(async () => {
    store.getPermissions.mockResolvedValue([
      { id: "ticket-view", name: "ticket_view_all" },
      { id: "ticket-manage", name: "ticket_manage" },
    ]);
    store.getUserPermissions.mockResolvedValue([]);
    store.getUserRoles.mockResolvedValue([]);
    store.getRolesWithDetails.mockResolvedValue([]);
    store.getModuleSetting.mockResolvedValue(undefined);
    const app = express();
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    saved = [];
    store.getLocations.mockResolvedValue([]);
    store.getDepartments.mockResolvedValue([]);
    store.getAssets.mockImplementation(async () => saved);
    store.createAsset.mockImplementation(async (asset: Record<string, unknown>) => {
      const record = { ...asset, id: `asset-${saved.length + 1}` };
      saved.push(record);
      return record;
    });
    store.createAuditLog.mockResolvedValue({});
  });

  it("retires direct workbook writes in favor of module-specific staged validation", async () => {
    const templateResponse = await fetch(`${baseUrl}/api/import/template`);
    expect(templateResponse.status).toBe(410);
    expect(await templateResponse.json()).toMatchObject({ code: "IMPORT_FLOW_RETIRED" });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Assets");
    sheet.addRow(["Name*", "Asset ID", "Type*"]);
    sheet.addRow(["Direct import must not write", "TEST-3", "laptop"]);
    const form = new FormData();
    form.append("file", new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), "assets.xlsx");
    const response = await fetch(`${baseUrl}/api/import/excel`, { method: "POST", body: form });
    expect(response.status).toBe(410);
    const result = await response.json();
    expect(result).toMatchObject({ code: "IMPORT_FLOW_RETIRED" });
    expect(saved).toHaveLength(0);
  });
});