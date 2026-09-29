// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import ExcelJS from "exceljs";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
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

  async function readWorkbook(response: Response) {
    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
    return workbook;
  }

  async function importWorkbook(workbook: ExcelJS.Workbook) {
    const form = new FormData();
    form.append("file", new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), "assets.xlsx");
    const response = await fetch(`${baseUrl}/api/import/excel`, { method: "POST", body: form });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    return result;
  }

  it("imports both values, exports them under the same headers, and reimports unchanged", async () => {
    const template = await readWorkbook(await fetch(`${baseUrl}/api/import/template`));
    const sheet = template.getWorksheet("Assets")!;
    // The example is replaced with a test asset; remove the other sheets.
    template.removeWorksheet(template.getWorksheet("Employees")!.id);
    template.removeWorksheet(template.getWorksheet("Assignments")!.id);
    sheet.getRow(2).getCell(1).value = "Audit laptop";
    sheet.getRow(2).getCell(2).value = "TEST-ASSET";
    sheet.getRow(2).getCell(21).value = "under-review";
    sheet.getRow(2).getCell(30).value = 46553; // Raw Excel serial date, without date formatting.
    expect((await importWorkbook(template)).imported.assets).toBe(1);
    expect(saved[0]).toMatchObject({ complianceStatus: "under-review", nextAuditDate: "2027-06-15" });

    const exported = await readWorkbook(await fetch(`${baseUrl}/api/import/assets-export`));
    const exportedSheet = exported.getWorksheet("Assets")!;
    expect(exportedSheet.getRow(1).getCell(21).value).toBe("Compliance Status");
    expect(exportedSheet.getRow(1).getCell(30).value).toBe("Next Audit Date");
    expect(exportedSheet.getRow(2).getCell(21).value).toBe("under-review");
    expect(exportedSheet.getRow(2).getCell(30).value).toBe("2027-06-15");

    saved = [];
    expect((await importWorkbook(exported)).imported.assets).toBe(1);
    expect(saved[0]).toMatchObject({ complianceStatus: "under-review", nextAuditDate: "2027-06-15" });
  });

  it("leaves missing compliance fields unset instead of inventing vendor values", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Assets");
    sheet.addRow(["Name*", "Asset ID", "Type*"]);
    sheet.addRow(["No audit yet", "TEST-2", "laptop"]);
    expect((await importWorkbook(workbook)).imported.assets).toBe(1);
    expect(saved[0].complianceStatus).toBeUndefined();
    expect(saved[0].nextAuditDate).toBeUndefined();
  });

  it("reports invalid audit dates rather than silently dropping them", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Assets");
    sheet.addRow(["Name*", "Asset ID", "Type*"]);
    const row = sheet.addRow(["Invalid date", "TEST-3", "laptop"]);
    row.getCell(30).value = "not-a-date";
    const form = new FormData();
    form.append("file", new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), "assets.xlsx");
    const response = await fetch(`${baseUrl}/api/import/excel`, { method: "POST", body: form });
    const result = await response.json();
    expect(result.imported.assets).toBe(0);
    expect(result.errors).toEqual([expect.stringContaining("Invalid Next Audit Date")]);
    expect(saved).toHaveLength(0);
  });
});