import express from "express";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contractLifecycle, managedVendorInput, vendorContractInput, vendorPermissions } from "@shared/vendor-contracts";
import { isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { assertAdditiveMigration } from "./startup-migrations";

const mock = vi.hoisted(() => {
  const state = { role: "it_manager", authenticated: true, selects: [] as any[][],
    inserts: [] as any[], updates: [] as any[], deletes: [] as string[], failInsert: "" };
  const query = (rows: any[]) => {
    const q: any = { from: () => q, innerJoin: () => q, leftJoin: () => q, orderBy: () => q, for: () => q,
      groupBy: () => q, where: () => q, returning: () => q,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
    return q;
  };
  const db: any = {
    select: vi.fn(() => query(state.selects.shift() ?? [])),
    insert: (table: any) => ({ values: (values: any) => {
      if (state.failInsert) throw Object.assign(new Error("Constraint conflict"), { code: state.failInsert });
      state.inserts.push({ table: table[Symbol.for("drizzle:Name")], values });
      return query([{ id: "33333333-3333-4333-8333-333333333333", ...values }]);
    } }),
    update: (table: any) => ({ set: (values: any) => {
      state.updates.push({ table: table[Symbol.for("drizzle:Name")], values });
      return query([{ id: "33333333-3333-4333-8333-333333333333", ...values }]);
    } }),
    delete: (table: any) => { state.deletes.push(table[Symbol.for("drizzle:Name")]); return query([]); },
    transaction: vi.fn(async (callback: any) => {
      const before = [state.inserts.length, state.updates.length, state.deletes.length];
      try { return await callback(db); }
      catch (error) {
        state.inserts.length = before[0]; state.updates.length = before[1]; state.deletes.length = before[2];
        throw error;
      }
    }),
  };
  return { state, db };
});
vi.mock("./db", () => ({ db: mock.db }));
vi.mock("./storage", () => ({ storage: {
  getUserRoles: async () => [{ name: mock.state.role }],
  getUserPermissions: async () => mock.state.role === "admin" ? ["system_admin"] : [],
} }));
import { normalizeVendorContacts, registerVendorContractRoutes } from "./vendor-contracts";

const vendorId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const contractId = "33333333-3333-4333-8333-333333333333";
const poId = "44444444-4444-4444-8444-444444444444";
const serverId = "55555555-5555-4555-8555-555555555555";
const input = { vendorId, title: "Enterprise support", contractNumber: "SLA-001", contractType: "SLA Support",
  startDate: "2026-01-01", endDate: "2027-10-21", renewalNoticeDays: 60, cost: 1200.50, currency: "EUR",
  slaTier: "24/7 4hr", status: "Active", assetIds: [assetId], purchaseOrderIds: [poId], serverIds: [serverId] };
const vendor = { id: vendorId, name: "Supplier", status: "active", isActive: "true" };
const oldContract = { id: contractId, ...input, cost: "1200.50" };
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (mock.state.authenticated) (req as any).user = { id: "viewer" }; next(); });
  registerVendorContractRoutes(app, (_req, _res, next) => next());
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => {
  mock.state.role = "it_manager"; mock.state.authenticated = true; mock.state.selects.length = 0;
  mock.state.inserts.length = 0; mock.state.updates.length = 0; mock.state.deletes.length = 0; mock.state.failInsert = "";
  mock.db.transaction.mockClear();
});
const request = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
  method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});

describe("vendor contract lifecycle and data contracts", () => {
  it.each([
    ["2026-12-01", 30, "Active"], ["2026-11-20", 30, "Expiring Soon"],
    ["2026-10-21", 0, "Expiring Soon"], ["2026-10-20", 30, "Expired"],
  ])("derives %s / %s days as %s", (endDate, notice, expected) => {
    expect(contractLifecycle({ endDate, renewalNoticeDays: notice as number, status: "Active" }, "2026-10-21").lifecycleStatus).toBe(expected);
  });
  it("keeps terminated contracts terminated even after expiry", () => {
    expect(contractLifecycle({ endDate: "2025-01-01", renewalNoticeDays: 60, status: "Terminated" }, "2026-10-21").renewalDue).toBe(false);
  });
  it("uses calendar day boundaries instead of elapsed DST hours", () => {
    expect(contractLifecycle({ endDate: "2026-03-30", renewalNoticeDays: 1, status: "Active" }, "2026-03-29").daysUntilExpiry).toBe(1);
  });
  it.each(["2026-02-30", "2026-13-01", "31-12-2026"])("rejects invalid or display-format API date %s", date => {
    expect(vendorContractInput.safeParse({ ...input, startDate: date }).success).toBe(false);
  });
  it("accepts leap days and normalizes currencies and duplicate links", () => {
    expect(vendorContractInput.parse({ ...input, startDate: "2028-02-29", endDate: "2028-12-31", currency: "usd", assetIds: [assetId, assetId] }))
      .toMatchObject({ currency: "USD", assetIds: [assetId] });
  });
  it.each([{ endDate: "2025-01-01" }, { cost: -1 }, { cost: 1.234 }, { cost: Infinity }, { renewalNoticeDays: -1 }, { renewalNoticeDays: 1.5 }, { currency: "US" }, { vendorId: "bogus" }])
    ("rejects invalid dates, amounts, identifiers and notice windows: %j", change => {
      expect(vendorContractInput.safeParse({ ...input, ...change }).success).toBe(false);
    });
  it("requires contact email and website to be valid, preserving procurement fields", () => {
    const valid = { name: "Supplier", code: "SUP-01", category: "Hardware Supplier", website: "https://example.com", address: "Office", paymentTerms: "Net 60", rating: 4 };
    expect(managedVendorInput.parse(valid)).toMatchObject(valid);
    expect(managedVendorInput.safeParse({ ...valid, website: "javascript:alert(1)" }).success).toBe(false);
    expect(managedVendorInput.safeParse({ ...valid, primaryContactEmail: "bad" }).success).toBe(false);
  });
  it("synchronizes canonical and legacy contact/status fields in both directions", () => {
    expect(normalizeVendorContacts({ primaryContactName: "IT Support", primaryContactEmail: null, status: "Inactive", code: " SUP-1 " }))
      .toMatchObject({ contactPerson: "IT Support", email: null, status: "inactive", isActive: "false", code: "SUP-1" });
    expect(normalizeVendorContacts({ contactPerson: "Legacy", phone: "123", isActive: "true" }))
      .toMatchObject({ primaryContactName: "Legacy", primaryContactPhone: "123", status: "active" });
  });
  it("keeps manager write, CAB read and employee deny boundaries", () => {
    expect(vendorPermissions({ roles: [{ name: "it_manager" }] }).canManageContracts).toBe(true);
    expect(vendorPermissions({ roles: [{ name: "cab_member" }] }).canManageContracts).toBe(false);
    expect(isPersonaPageAllowed(["cab_member"], [], "/vendors")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/vendor-contracts", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/vendor-contracts/x", "PUT")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/vendor-management/options", "GET")).toBe(false);
  });
  it("ships an additive migration with restrictive links and normalized uniqueness", async () => {
    const source = await readFile("migrations/onprem/20261105_vendor_sla_contract_lifecycle.sql", "utf8");
    expect(() => assertAdditiveMigration(source, "vendor-sla")).not.toThrow();
    expect(source).toContain("lower(btrim(code))");
    expect(source).toContain("lower(btrim(contract_number))");
    for (const table of ["vendor_contracts", "vendor_contract_assets", "vendor_contract_purchase_orders", "vendor_contract_servers"])
      expect(source).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(source).toContain("REFERENCES contracts(id) ON DELETE RESTRICT");
  });
});

describe("governed vendor and SLA API", () => {
  it("returns 401 without a session and 403 for end users", async () => {
    mock.state.authenticated = false;
    expect((await request("/api/vendor-contracts")).status).toBe(401);
    mock.state.authenticated = true; mock.state.role = "end_user";
    expect((await request("/api/vendor-management/options")).status).toBe(403);
  });
  it("blocks CAB members from mutations", async () => {
    mock.state.role = "cab_member";
    expect((await request("/api/vendor-contracts", "POST", input)).status).toBe(403);
    expect((await request("/api/vendor-management/vendors", "POST", {})).status).toBe(403);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("rejects invalid data before starting a transaction", async () => {
    expect((await request("/api/vendor-contracts", "POST", { ...input, cost: -5 })).status).toBe(400);
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });
  it("creates one financial parent, an SLA extension, all resource links and audit atomically", async () => {
    mock.state.selects.push([vendor], [{ value: "SLA Support" }], [{ id: assetId }], [{ id: poId }], [{ id: serverId }]);
    const response = await request("/api/vendor-contracts", "POST", input);
    expect(response.status).toBe(201);
    const saved = await response.json();
    expect(mock.db.transaction).toHaveBeenCalledTimes(1);
    const parent = mock.state.inserts.find(row => row.table === "contracts").values;
    const sla = mock.state.inserts.find(row => row.table === "vendor_contracts").values;
    expect(parent).toMatchObject({ id: saved.id, currency: "EUR", value: "1200.50", status: "active", renewalDate: "2027-08-22" });
    expect(sla).toMatchObject({ id: saved.id, vendorId, cost: "1200.50", slaTier: "24/7 4hr" });
    expect(mock.state.inserts.find(row => row.table === "vendor_contract_assets").values).toEqual([{ contractId: saved.id, assetId }]);
    expect(mock.state.inserts.find(row => row.table === "vendor_contract_purchase_orders").values).toEqual([{ contractId: saved.id, purchaseOrderId: poId }]);
    expect(mock.state.inserts.find(row => row.table === "vendor_contract_servers").values).toEqual([{ contractId: saved.id, serverId }]);
    expect(JSON.parse(mock.state.inserts.find(row => row.table === "audit_logs").values.newValues)).toMatchObject({ assetIds: [assetId], serverIds: [serverId] });
  });
  it("refuses new contracts for inactive vendors", async () => {
    mock.state.selects.push([{ ...vendor, status: "inactive", isActive: "false" }]);
    expect((await request("/api/vendor-contracts", "POST", input)).status).toBe(400);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("rolls back financial and SLA writes when a referenced asset is missing", async () => {
    mock.state.selects.push([vendor], [{ value: "SLA Support" }], [], [{ id: poId }], [{ id: serverId }]);
    expect((await request("/api/vendor-contracts", "POST", input)).status).toBe(400);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("terminates both records without deleting contract history and records previous links", async () => {
    mock.state.selects.push([{ id: contractId }], [oldContract], [vendor], [{ id: assetId }], [{ id: poId }], [{ id: serverId }],
      [{ id: assetId }], [{ id: poId }], [{ id: serverId }]);
    const response = await request(`/api/vendor-contracts/${contractId}`, "PUT", { ...input, status: "Terminated" });
    expect(response.status).toBe(200);
    expect(mock.state.updates.find(row => row.table === "contracts").values.status).toBe("terminated");
    expect(mock.state.updates.find(row => row.table === "vendor_contracts").values.status).toBe("Terminated");
    expect(mock.state.deletes).not.toContain("contracts");
    const audit = mock.state.inserts.find(row => row.table === "audit_logs").values;
    expect(JSON.parse(audit.oldValues)).toMatchObject({ assetIds: [assetId], purchaseOrderIds: [poId], serverIds: [serverId] });
  });
  it("rejects unknown contract types and maps duplicate identifiers to 409", async () => {
    mock.state.selects.push([vendor], []);
    expect((await request("/api/vendor-contracts", "POST", input)).status).toBe(400);
    mock.state.selects.push([{ value: "Hardware Supplier" }]); mock.state.failInsert = "23505";
    expect((await request("/api/vendor-management/vendors", "POST", { name: "Supplier", code: "S-01", category: "Hardware Supplier" })).status).toBe(409);
  });
  it("creates vendors with canonical fields mirrored into the existing register", async () => {
    mock.state.selects.push([{ value: "Hardware Supplier" }]);
    expect((await request("/api/vendor-management/vendors", "POST", {
      name: "Supplier", code: "SUP-01", category: "Hardware Supplier", primaryContactName: "Helpdesk",
      primaryContactEmail: "support@example.com", status: "inactive",
    })).status).toBe(201);
    expect(mock.state.inserts.find(row => row.table === "vendors").values).toMatchObject({
      contactPerson: "Helpdesk", email: "support@example.com", primaryContactEmail: "support@example.com", isActive: "false", status: "inactive",
    });
  });
  it("derives list badges and returns resource identities without duplicating financial rows", async () => {
    mock.state.selects.push([{ ...oldContract, vendorName: "Supplier", endDate: "2020-01-01" }],
      [{ contractId, id: assetId, name: "Software pool", type: "software", assetTag: "SW-001" }], [], []);
    const response = await request("/api/vendor-contracts");
    expect(response.status).toBe(200);
    expect((await response.json())[0]).toMatchObject({ status: "Expired", lifecycleStatus: "Expired", renewalDue: true, assetIds: [assetId] });
  });
});
