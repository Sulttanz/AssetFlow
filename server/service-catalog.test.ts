// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { canManageServiceCatalog, catalogDecisionInput, serviceApprovalRoles, structuredCatalogInput, validateCatalogValues, type CatalogField } from "@shared/service-catalog";
import { isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { assertAdditiveMigration } from "./startup-migrations";

const mock = vi.hoisted(() => {
  const state = { role: "end_user", employeeId: "employee-1" as string | null, selects: [] as any[][], filters: [] as any[], inserts: [] as any[], updates: [] as any[] };
  const query = (rows: any[]) => {
    const q: any = {
      from: () => q, innerJoin: () => q, leftJoin: () => q, orderBy: () => q, for: () => q,
      where: (condition: any) => { state.filters.push(condition); return q; },
      returning: () => q, onConflictDoNothing: () => q,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    };
    return q;
  };
  const db: any = {
    select: vi.fn(() => query(state.selects.shift() ?? [])),
    insert: (table: any) => ({ values: (values: any) => {
      const name = table[Symbol.for("drizzle:Name")];
      state.inserts.push({ table: name, values });
      return query([{ id: name === "service_requests" ? "request-1" : "approval-1", ...values }]);
    } }),
    update: (table: any) => ({ set: (values: any) => {
      state.updates.push({ table: table[Symbol.for("drizzle:Name")], values });
      return query([{ id: "approval-1", ...values }]);
    } }),
    transaction: vi.fn(async (callback: any) => callback(db)),
  };
  return { state, db };
});
vi.mock("./db", () => ({ db: mock.db }));
vi.mock("./storage", () => ({ storage: {
  getUserRoles: async () => [{ name: mock.state.role }],
  getUserPermissions: async () => mock.state.role === "admin" ? ["system_admin"] : [],
  getUser: async () => ({ employeeId: mock.state.employeeId }),
} }));
import { catalogMutationError, registerServiceCatalogRoutes } from "./service-catalog";

const fields: CatalogField[] = [
  { key: "tier", label: "Software tier", type: "select", options: ["Standard", "Pro"], required: true },
  { key: "reason", label: "Justification", type: "textarea", required: true },
  { key: "needed", label: "Needed date", type: "date", required: true },
  { key: "count", label: "Quantity", type: "number", min: 1, max: 10, required: false },
  { key: "confirm", label: "Confirmation", type: "checkbox", required: false },
];
const answers = { tier: "Pro", reason: "Project delivery", needed: "2028-02-29", count: 2, confirm: false };
const item = { id: "item-1", title: "Software access", category: "Software", status: "Active", customFieldsSchema: fields, requiresApproval: true, approverRole: "Manager", slaHours: 24 };
const ticket = { id: "request-1", requesterId: "employee-other", catalogItemId: "item-1", serviceCatalogItemId: "item-1", approvalStatus: "pending", fulfillmentStage: "Pending Approval", fulfillmentStatus: "Submitted" };
const approval = { id: "approval-1", ticketId: "request-1", approverRole: "Manager", status: "Pending" };
const input = { ...item, id: undefined, description: "Configured service", icon: "Package" };

describe("structured catalog policy", () => {
  it.each(["admin", "it_manager"])("allows %s to manage catalog and both approval roles", role => {
    expect(canManageServiceCatalog({ roles: [{ name: role }] })).toBe(true);
    expect(serviceApprovalRoles({ roles: [{ name: role }] })).toEqual(["Manager", "IT Director"]);
  });
  it("separates agents, line managers, and directors", () => {
    expect(serviceApprovalRoles({ roles: [{ name: "cab_member" }] })).toEqual(["Manager"]);
    for (const role of ["end_user", "it_agent", "auditor"]) {
      expect(serviceApprovalRoles({ roles: [{ name: role }] })).toEqual([]);
      expect(canManageServiceCatalog({ roles: [{ name: role }] })).toBe(false);
    }
  });
  it("grants employee request access without approval or catalog management rights", () => {
    expect(isPersonaApiAllowed(["end_user"], [], "/service-catalog/items", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/service-catalog/items/i/request", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/service-catalog/items", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/service-catalog/approvals", "GET")).toBe(false);
    expect(isPersonaPageAllowed(["cab_member"], [], "/service-catalog?tab=approvals")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/service-catalog/approvals/a/decision", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/service-requests/a/catalog-approval", "GET")).toBe(true);
  });
  it("keeps submitted answers typed, allows optional false, and preserves calendar dates", () => {
    expect(validateCatalogValues(fields, answers)).toEqual(answers);
  });
  it.each([
    { tier: "Unknown" }, { reason: "" }, { needed: "2026-02-30" }, { needed: "31-12-2026" },
    { count: "2" }, { count: 11 }, { count: NaN }, { confirm: "yes" }, { surprise: "injected" },
  ])("rejects invalid or unknown answers: %j", change => {
    expect(() => validateCatalogValues(fields, { ...answers, ...change })).toThrow();
  });
  it("requires affirmative confirmation for required checkboxes", () => {
    expect(() => validateCatalogValues([{ key: "agree", label: "Terms", type: "checkbox", required: true }], { agree: false })).toThrow();
  });
  it("validates schema uniqueness, approver policy, and decision notes", () => {
    const { id: _id, ...payload } = input;
    expect(structuredCatalogInput.safeParse(payload).success).toBe(true);
    expect(structuredCatalogInput.safeParse({ ...payload, approverRole: null }).success).toBe(false);
    expect(structuredCatalogInput.safeParse({ ...payload, customFieldsSchema: [fields[0], fields[0]] }).success).toBe(false);
    expect(structuredCatalogInput.safeParse({ ...payload, customFieldsSchema: [{ ...fields[0], options: [] }] }).success).toBe(false);
    expect(catalogDecisionInput.safeParse({ decision: "Approved", comments: "ok" }).success).toBe(false);
  });
  it("blocks status and catalog-identity bypasses on generic ticket APIs", () => {
    expect(catalogMutationError(ticket as any, { approvalStatus: "approved" })).toMatch(/workbench/);
    expect(catalogMutationError(ticket as any, { fulfillmentStage: "Approved" })).toMatch(/before approval/);
    expect(catalogMutationError(ticket as any, { fulfillmentStatus: "Fulfilling" })).toMatch(/before approval/);
    expect(catalogMutationError(ticket as any, { fulfilledAssetId: "asset-1" })).toMatch(/before approval/);
    expect(catalogMutationError(ticket as any, { catalogItemId: null })).toMatch(/cannot be changed/);
    expect(catalogMutationError({ ...ticket, approvalStatus: "approved" } as any, { fulfillmentStage: "In Procurement" })).toBeNull();
    expect(catalogMutationError({ ...ticket, serviceCatalogItemId: null } as any, { approvalStatus: "approved" })).toBeNull();
  });
  it("uses an additive migration preserving legacy catalog identifiers", async () => {
    const migration = await readFile("migrations/onprem/20261104_structured_service_catalog.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "service catalog")).not.toThrow();
    expect(migration).toContain("FROM catalog_items ON CONFLICT DO NOTHING");
  });
});

describe("catalog HTTP workflow", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { if (req.get("x-anonymous") !== "yes") req.user = { id: "viewer" } as any; next(); });
    registerServiceCatalogRoutes(app, (req, res, next) => req.user ? next() : void res.sendStatus(401));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => { vi.clearAllMocks(); Object.assign(mock.state, { role: "end_user", employeeId: "employee-1", selects: [], filters: [], inserts: [], updates: [] }); });
  const request = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  it("filters inactive items for employees even when includeInactive is requested", async () => {
    mock.state.selects.push([]);
    expect((await request("/api/service-catalog/items?includeInactive=true")).status).toBe(200);
    expect(new PgDialect().sqlToQuery(mock.state.filters[0]).params).toContain("Active");
  });
  it("hides hardware inventory services from accounts not linked to an employee", async () => {
    mock.state.employeeId = null;
    mock.state.selects.push([
      { ...item, category: "Software", consumableId: null },
      { ...item, id: "hardware-item", title: "Laptop", category: "Hardware", consumableId: "stock-1" },
    ]);
    const response = await request("/api/service-catalog/items");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({ category: "Software" })]);
  });
  it("does not allow a direct request for an employee-only hardware catalog item", async () => {
    mock.state.employeeId = null;
    mock.state.selects.push([{ ...item, category: "Hardware" }], [{ consumableId: null }]);
    const response = await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: answers });
    expect(response.status).toBe(404);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("creates one real request plus pending approval, activity, audit, and schema snapshot in one transaction", async () => {
    mock.state.selects.push([item], [{ fulfillmentTeam: "IT" }]);
    const response = await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: answers });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.request).toMatchObject({ requesterId: "viewer", creatorId: "viewer", approvalStatus: "pending", fulfillmentStage: "Pending Approval", assignmentGroup: null, customFieldValues: answers, catalogSchemaSnapshot: fields });
    expect(body.approval.status).toBe("Pending");
    expect(mock.db.transaction).toHaveBeenCalledTimes(1);
    expect(mock.state.inserts.map(row => row.table)).toEqual(["service_requests", "service_requests_approvals", "service_request_activities", "audit_logs"]);
    expect(mock.state.inserts.some(row => row.table === "tickets")).toBe(false);
  });
  it("skips approval and routes no-approval services straight to the fulfillment team", async () => {
    mock.state.selects.push([{ ...item, requiresApproval: false, approverRole: null }], [{ fulfillmentTeam: "IT" }]);
    const response = await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: answers });
    const body = await response.json();
    expect(body.request).toMatchObject({ approvalStatus: "approved", fulfillmentStage: "Submitted", assignmentGroup: "IT" });
    expect(body.approval).toBeNull();
    expect(mock.state.inserts.some(row => row.table === "service_requests_approvals")).toBe(false);
  });
  it.each([{ ...item, status: "Inactive" }, undefined])("rejects inactive or missing services without writes", async value => {
    mock.state.selects.push(value ? [value] : []);
    expect((await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: answers })).status).toBe(404);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("validates required answers and refuses requester/status spoofing before writes", async () => {
    mock.state.selects.push([item]);
    expect((await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: {} })).status).toBe(400);
    expect(mock.state.inserts).toHaveLength(0);
    expect((await request("/api/service-catalog/items/item-1/request", "POST", { fieldValues: answers, requesterId: "other", approvalStatus: "approved" })).status).toBe(400);
  });
  it("prevents employees from requesting for another user through the intake compatibility fields", async () => {
    mock.state.selects.push([item]);
    expect((await request("/api/service-catalog/items/item-1/request", "POST", {
      fieldValues: answers, requesterId: "11111111-1111-4111-8111-111111111111",
    })).status).toBe(403);
    expect(mock.state.inserts).toHaveLength(0);
  });
  it("preserves staff on-behalf-of attribution, quantity, project, target date and cost from full-page intake", async () => {
    mock.state.role = "it_agent";
    const requesterId = "11111111-1111-4111-8111-111111111111";
    const projectId = "22222222-2222-4222-8222-222222222222";
    mock.state.selects.push([item], [{ id: requesterId }], [{ id: projectId }], [{ fulfillmentTeam: "IT" }]);
    const response = await request("/api/service-catalog/items/item-1/request", "POST", {
      title: "Requested software for project team", description: "Phone request captured by IT", requesterId,
      fieldValues: answers, projectId, cost: 200, requestedQuantity: 3, targetFulfillmentDate: "2027-10-21",
    });
    expect(response.status).toBe(201);
    expect((await response.json()).request).toMatchObject({
      requesterId, creatorId: "viewer", projectId, requestedQuantity: 3, cost: 200,
      title: "Requested software for project team", targetFulfillmentDate: "2027-10-21",
      approvalStatus: "pending", customFieldValues: answers,
    });
  });
  it.each(["end_user", "it_agent", "auditor"])("denies %s approval and management APIs", async role => {
    mock.state.role = role;
    expect((await request("/api/service-catalog/approvals")).status).toBe(403);
    expect((await request("/api/service-catalog/approvals/approval-1/decision", "POST", { decision: "Approved", comments: "Authorized business need" })).status).toBe(403);
    expect((await request("/api/service-catalog/items", "POST", {})).status).toBe(403);
    expect(mock.state.updates).toHaveLength(0);
  });
  it.each(["Approved", "Rejected"])("records %s with actor, note, decision timestamp, ticket transition, activity and audit", async decision => {
    mock.state.role = "it_manager";
    mock.state.selects.push([{ ticketId: ticket.id }], [ticket], [approval], [{ fulfillmentTeam: "IT" }]);
    const response = await request("/api/service-catalog/approvals/approval-1/decision", "POST", { decision, comments: "Reviewed business justification" });
    expect(response.status).toBe(200);
    expect(mock.state.updates[0]).toMatchObject({ table: "service_requests_approvals", values: { status: decision, comments: "Reviewed business justification", approverId: "viewer", decidedAt: expect.any(Date) } });
    expect(mock.state.updates[1]).toMatchObject({ table: "service_requests", values: { approvalStatus: decision.toLowerCase(), fulfillmentStage: decision } });
    expect(mock.state.inserts.map(row => row.table)).toEqual(["service_request_activities", "audit_logs"]);
  });
  it.each([
    { request: ticket, approval: { ...approval, approverRole: "IT Director" }, status: 403, role: "cab_member" },
    { request: { ...ticket, requesterId: "viewer" }, approval, status: 403, role: "it_manager" },
    { request: ticket, approval: { ...approval, status: "Approved" }, status: 409, role: "it_manager" },
    { request: { ...ticket, fulfillmentStage: "Cancelled" }, approval, status: 409, role: "it_manager" },
  ])("protects role/self/duplicate/closed decision boundary (%j)", async example => {
    mock.state.role = example.role;
    mock.state.selects.push([{ ticketId: ticket.id }], [example.request], [example.approval]);
    expect((await request("/api/service-catalog/approvals/approval-1/decision", "POST", { decision: "Approved", comments: "Business need confirmed" })).status).toBe(example.status);
    expect(mock.state.updates).toHaveLength(0);
  });
  it("does not expose another employee's approval evidence", async () => {
    mock.state.selects.push([ticket]);
    expect((await request("/api/service-requests/request-1/catalog-approval")).status).toBe(403);
  });
  it("requires authentication", async () => {
    const response = await fetch(`${base}/api/service-catalog/items`, { headers: { "x-anonymous": "yes" } });
    expect(response.status).toBe(401);
  });
});
