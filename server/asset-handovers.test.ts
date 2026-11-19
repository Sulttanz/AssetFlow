import express from "express";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { insertAssetHandoverSchema } from "@shared/schema";
import { isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { assertAdditiveMigration } from "./startup-migrations";

const mock = vi.hoisted(() => {
  const state = {
    selects: [] as any[][],
    inserts: [] as Array<{ table: string; values: any }>,
    updates: [] as Array<{ table: string; values: any }>,
    execute: [] as unknown[],
    authenticated: true,
    user: { id: "user-1", email: "alex@example.test" },
  };
  const query = (rows: any[] = []) => {
    const q: any = {
      from: () => q, innerJoin: () => q, leftJoin: () => q, where: () => q,
      orderBy: () => q, groupBy: () => q, limit: () => q, for: () => q,
      returning: () => q,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    };
    return q;
  };
  const db: any = {
    select: vi.fn(() => query(state.selects.shift() ?? [])),
    insert: (table: any) => ({ values: (values: any) => {
      state.inserts.push({ table: table[Symbol.for("drizzle:Name")], values });
      return query([{ id: "handover-id", ...values }]);
    } }),
    update: (table: any) => ({ set: (values: any) => {
      state.updates.push({ table: table[Symbol.for("drizzle:Name")], values });
      return query([{ id: "handover-id", ...values }]);
    } }),
    execute: vi.fn(async (query: unknown) => { state.execute.push(query); return { rows: [] }; }),
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(db)),
  };
  const next = (_req: any, _res: any, done: any) => done();
  return { state, db, next };
});

vi.mock("./db", () => ({ db: mock.db }));
vi.mock("./auth", () => ({
  requireAuth: (req: any, res: any, next: any) => mock.state.authenticated
    ? next()
    : res.status(401).json({ message: "Authentication required" }),
  requirePermission: () => mock.next,
  requireAnyPermission: () => mock.next,
}));
import { registerAssetHandoverRoutes } from "./asset-handovers";

const employeeId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const handoverInput = {
  type: "Issue / Assignment",
  employeeId,
  assetId,
  handoverDate: "2026-10-22",
  condition: "Excellent",
  includedAccessories: ["Power adapter", "Mouse"],
  notes: "Laptop issued with standard kit",
};
const employee = {
  id: employeeId,
  employeeId: "EMP-001",
  firstName: "Alex",
  lastName: "Morgan",
  email: "alex@example.test",
  status: "active",
  offboardedDate: null,
};
const asset = { id: assetId, name: "Laptop", assetTag: "ASSET-0001", type: "laptop", status: "available" };
let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (mock.state.authenticated) (req as any).user = { ...mock.state.user };
    next();
  });
  registerAssetHandoverRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => {
  mock.state.selects.length = 0;
  mock.state.inserts.length = 0;
  mock.state.updates.length = 0;
  mock.state.execute.length = 0;
  mock.state.authenticated = true;
  mock.state.user = { id: "user-1", email: "alex@example.test" };
  mock.db.transaction.mockClear();
});

const request = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe("asset handover contracts and access policy", () => {
  it("validates the required handover fields and prevents unsupported types", () => {
    expect(insertAssetHandoverSchema.safeParse(handoverInput).success).toBe(true);
    expect(insertAssetHandoverSchema.safeParse({ ...handoverInput, condition: "Broken" }).success).toBe(false);
    expect(insertAssetHandoverSchema.safeParse({ ...handoverInput, includedAccessories: Array(31).fill("Cable") }).success).toBe(false);
    expect(isPersonaPageAllowed(["it_agent"], [], "/asset-handovers")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/id/acknowledge", "POST", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/id/acknowledge", "DELETE", "employee-1")).toBe(false);
  });

  it("blocks personal custody access without a linked employee and scopes linked receipts by employee ID", async () => {
    let response = await request("/api/my/asset-handovers");
    expect(response.status).toBe(403);

    mock.state.user = { id: "user-1", email: "alex@example.test", employeeId };
    mock.state.selects.push([]);
    response = await request("/api/my/asset-handovers");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);

    mock.state.user = { id: "user-1", email: "alex@example.test" };
    response = await request("/api/my/asset-handovers/handover-id/acknowledge", "POST", { confirmed: true });
    expect(response.status).toBe(403);
  });

  it("ships an additive migration with a durable receipt record, check constraints, and dropdown seeds", async () => {
    const source = await readFile("migrations/onprem/20261106_asset_handovers.sql", "utf8");
    expect(() => assertAdditiveMigration(source, "asset-handovers")).not.toThrow();
    expect(source).toContain("CREATE TABLE IF NOT EXISTS asset_handovers");
    expect(source).toContain("REFERENCES employees(id) ON DELETE RESTRICT");
    expect(source).toContain("REFERENCES assets(id) ON DELETE RESTRICT");
    expect(source).toContain("REFERENCES assignments(id) ON DELETE RESTRICT");
    expect(source).toContain("asset_handovers_acknowledgement_check");
    expect(source).toContain("'handover_type'");
    expect(source).toContain("'asset_condition'");
  });
});

describe("custody receipt lifecycle API", () => {
  it("rejects invalid calendar dates before opening a transaction", async () => {
    const response = await request("/api/asset-handovers", "POST", { ...handoverInput, handoverDate: "2026-02-30" });
    expect(response.status).toBe(400);
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });

  it("creates an assignment, sets the employee as asset owner, and audits the receipt atomically", async () => {
    mock.state.selects.push(
      [asset],
      [employee],
      [{ value: "Excellent" }],
      [{ value: "Issue / Assignment" }],
      [],
      [],
    );
    const response = await request("/api/asset-handovers", "POST", handoverInput);
    expect(response.status).toBe(201);
    const receipt = await response.json();
    expect(receipt).toMatchObject({ handoverNumber: "HO-2026-0001", employeeId, assetId, type: "Issue / Assignment" });
    expect(mock.db.transaction).toHaveBeenCalledTimes(1);
    expect(mock.state.inserts.find(row => row.table === "assignments")?.values).toMatchObject({
      assetId, employeeId, assignedDate: "2026-10-22",
    });
    expect(mock.state.updates.find(row => row.table === "assets")?.values).toMatchObject({
      status: "assigned",
      assetOwner: "Alex Morgan",
    });
    const audit = mock.state.inserts.find(row => row.table === "audit_logs")?.values;
    expect(audit).toMatchObject({ action: "CREATE", tableName: "asset_handovers", recordName: "HO-2026-0001" });
  });

  it("returns equipment to stock and records the returned condition", async () => {
    const activeAssignment = {
      id: "assignment-1", assetId, employeeId, assignedDate: "2026-10-01", returnedDate: null,
    };
    mock.state.selects.push(
      [{ ...asset, status: "assigned" }],
      [employee],
      [{ value: "Fair" }],
      [{ value: "Return / Offboarding" }],
      [activeAssignment],
      [],
    );
    const response = await request("/api/asset-handovers", "POST", {
      ...handoverInput,
      type: "Return / Offboarding",
      condition: "Fair",
      handoverDate: "2026-10-22",
    });
    expect(response.status).toBe(201);
    expect(mock.state.updates.find(row => row.table === "assignments")?.values.returnedDate).toBe("2026-10-22");
    expect(mock.state.updates.find(row => row.table === "assets")?.values).toMatchObject({
      status: "available",
      assetOwner: null,
      assetCondition: "Fair",
    });
  });

  it("routes a damaged return to maintenance instead of stock", async () => {
    const activeAssignment = {
      id: "assignment-1", assetId, employeeId, assignedDate: "2026-10-01", returnedDate: null,
    };
    mock.state.selects.push(
      [{ ...asset, status: "assigned" }],
      [employee],
      [{ value: "Needs Repair" }],
      [{ value: "Return / Offboarding" }],
      [activeAssignment],
      [],
    );
    const response = await request("/api/asset-handovers", "POST", {
      ...handoverInput,
      type: "Return / Offboarding",
      condition: "Needs Repair",
    });
    expect(response.status).toBe(201);
    expect(mock.state.updates.find(row => row.table === "assets")?.values.status).toBe("maintenance");
  });
});
