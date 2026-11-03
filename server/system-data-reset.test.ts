// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { eq, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable, type AnyPgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@shared/schema";
import { RESET_BUSINESS_TABLES, RESET_PROTECTED_TABLES } from "@shared/system-data-reset";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";
import { registerSystemClearDataRoute } from "./system-clear-data-route";

describe("System data reset policy", () => {
  it("explicitly classifies every schema table and never wipes a protected table", () => {
    const tables = Object.values(s).filter(value => is(value, PgTable));
    const names = tables.map(getTableName);
    const classified = [...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES];
    expect(new Set(classified).size).toBe(classified.length);
    expect([...classified].sort()).toEqual(names.sort());
    const business = new Set<string>(RESET_BUSINESS_TABLES);
    for (const table of tables.filter(table => !business.has(getTableName(table)))) {
      for (const fk of getTableConfig(table).foreignKeys) {
        expect(business.has(getTableName(fk.reference().foreignTable)), `${getTableName(table)} must not depend on reset data`).toBe(false);
      }
    }
  });
});

const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" && process.env.VITEST_NATIVE_PG === "1";
describe.runIf(integrationEnabled)("Password-confirmed system reset in isolated PostgreSQL", () => {
  const schema = `test_clear_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const password = randomUUID();
  const adminId = randomUUID();
  const otherId = randomUUID();
  let setupPool: Pool;
  let appPool: Pool;
  let db: typeof import("./db").db;
  let storage: typeof import("./storage").storage;
  let server: Server;
  let base = "";
  let protectedSnapshot: Record<string, unknown[]>;
  const ids: Record<string, string> = {};

  async function seed(table: AnyPgTable, values: Record<string, unknown>) {
    const name = getTableName(table);
    const id = randomUUID();
    await db.insert(table).values({ id, ...values });
    ids[name] = String(values.id ?? id);
    return ids[name];
  }
  async function snapshot(names: readonly string[]) {
    const result: Record<string, unknown[]> = {};
    for (const name of names) {
      const data = await setupPool.query(`SELECT * FROM "${schema}"."${name}"`);
      result[name] = data.rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return result;
  }
  const request = (body: unknown, user = adminId) => fetch(`${base}/api/system/clear-data`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": user } : {}) },
    body: JSON.stringify(body),
  });

  beforeAll(async () => {
    if (!originalDatabaseUrl) throw new Error("Disposable test database is required");
    const url = new URL(originalDatabaseUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.searchParams.get("options")?.includes("test_full_")) {
      throw new Error("Refusing reset tests outside the disposable full-suite database");
    }
    setupPool = new Pool({ connectionString: originalDatabaseUrl });
    const client = await setupPool.connect();
    try { await initializeTestSchema(client, schema); } finally { client.release(); }
    process.env.DATABASE_URL = testDatabaseUrlForSchema(originalDatabaseUrl, schema);
    const database = await import("./db");
    db = database.db;
    appPool = database.pool;
    expect((await appPool.query("SELECT current_schema() AS name")).rows[0].name).toBe(schema);
    storage = (await import("./storage")).storage;
    const auth = await import("./auth");
    const hash = await auth.hashPassword(password);
    await db.insert(s.users).values([
      { id: adminId, username: "reset-admin", email: "reset-admin@example.test", password: hash, firstName: "Reset", lastName: "Administrator" },
      { id: otherId, username: "reset-user", email: "reset-user@example.test", password: hash, firstName: "Ordinary", lastName: "User" },
    ]);
    const role = await seed(s.roles, { name: "Reset administrator" });
    const permission = await seed(s.permissions, { name: "system_admin" });
    await seed(s.userRoles, { userId: adminId, roleId: role });
    await seed(s.rolePermissions, { roleId: role, permissionId: permission });
    await db.insert(s.sessions).values({ sid: "retained-session", sess: JSON.stringify({ passport: { user: adminId } }), expire: new Date("2099-01-01") });
    await seed(s.cabStreamLeases, { userId: adminId, sessionId: "retained-session", expiresAt: new Date("2099-01-01") });
    await seed(s.systemSettings, { key: "reset-sentinel", value: "preserve" });
    await seed(s.settings, { key: "reset-sentinel", value: "preserve" });
    await db.insert(s.moduleSettings).values({ moduleKey: "reset-sentinel", enabled: true });
    await seed(s.dropdownOptions, { category: "reset-sentinel", value: "preserve", label: "Preserve" });
    await seed(s.locations, { name: "Retained location" });
    await seed(s.departments, { name: "Retained department" });
    await seed(s.warehouseLocations, { name: "Retained warehouse", code: "RESET-WH" });
    await seed(s.slaPolicies, { name: "Retained SLA", priority: "high", responseHours: 1, resolutionHours: 4 });
    await setupPool.query(`CREATE TABLE "${schema}"."_onprem_migrations" (name text PRIMARY KEY)`);
    await setupPool.query(`INSERT INTO "${schema}"."_onprem_migrations" VALUES ('retained-migration')`);

    // Seed EVERY business table, including real cross-module RESTRICT FKs.
    const employee = await seed(s.employees, { firstName: "Fixture", lastName: "Employee", email: "employee@example.test", position: "Analyst" });
    await seed(s.employeeAccessRights, { employeeId: employee, applicationName: "Fixture", privilegeLevel: "Viewer", businessJustification: "Integration fixture" });
    await seed(s.employeeOffboardingClearances, { employeeId: employee, offboardingDate: "2026-10-22", clearanceType: "physical_asset_return", status: "verified", signedBy: adminId });
    const project = await seed(s.projects, { name: "Fixture project" });
    await seed(s.projectManagers, { projectId: project, userId: adminId, isPrimary: true });
    await seed(s.projectTeamMembers, { projectId: project, userId: otherId, roleTitle: "Fixture analyst" });
    await seed(s.projectMilestones, { projectId: project, title: "Fixture milestone", dueDate: new Date("2026-11-01T12:00:00.000Z") });
    const vendor = await seed(s.vendors, { name: "Fixture vendor" });
    const po = await seed(s.purchaseOrders, { poNumber: "RESET-PO", orderDate: "2026-10-22", totalAmount: "10.00", vendorId: vendor });
    const item = await seed(s.purchaseOrderItems, { purchaseOrderId: po, description: "Fixture", unitPrice: "10.00", totalPrice: "10.00" });
    await seed(s.purchaseOrderItemReceipts, { purchaseOrderId: po, purchaseOrderItemId: item });
    await seed(s.budgets, { name: "Fixture budget", fiscalYear: 2026, budgetAmount: "100.00", category: "hardware" });
    const asset = await seed(s.assets, { name: "Fixture asset", type: "laptop", locationId: ids.locations, departmentId: ids.departments });
    await seed(s.projectAssets, { projectId: project, assetId: asset, associationType: "Deployed" });
    await seed(s.softwareLicenseAllocations, { assetId: asset, employeeId: employee });
    const assignment = await seed(s.assignments, { assetId: asset, employeeId: employee, assignedDate: "2026-10-22" });
    await seed(s.assetHandovers, { handoverNumber: "HO-RESET", type: "Issue / Assignment", employeeId: employee, assetId: asset, assignmentId: assignment, handoverDate: "2026-10-22", condition: "New" });
    const maintenance = await seed(s.maintenanceSchedules, { assetId: asset, maintenanceType: "inspection", frequency: "monthly", nextDue: "2026-11-22" });
    await seed(s.maintenanceRecords, { assetId: asset, scheduleId: maintenance, maintenanceDate: "2026-10-22", maintenanceType: "inspection", performedBy: "Fixture technician" });
    await seed(s.assetBookings, { assetId: asset, startDate: "2026-10-22", endDate: "2026-10-23" });
    await seed(s.assetDisposalRecords, { assetId: asset, disposalDate: "2026-10-22", disposalMethod: "recycle" });
    const auditSession = await seed(s.assetAuditSessions, { name: "Fixture audit", startDate: "2026-10-22" });
    await seed(s.assetAuditItems, { sessionId: auditSession, assetId: asset });
    await seed(s.assetRelationships, { parentAssetId: asset, childAssetId: asset });
    await seed(s.assetRequests, { assetType: "laptop", justification: "Integration fixture" });
    await seed(s.assetAttachments, { assetId: asset, fileName: "asset.pdf", originalName: "asset.pdf", filePath: "/fixture/asset.pdf" });
    const consumable = await seed(s.consumables, { name: "Fixture toner", warehouseLocationId: ids.warehouse_locations });
    await seed(s.consumableStockMovements, { consumableId: consumable, movementType: "adjustment", quantity: 1 });
    const catalog = await seed(s.catalogItems, { name: "Fixture service", category: "hardware", consumableId: consumable });
    await seed(s.serviceCatalogItems, { id: catalog, title: "Fixture service", category: "hardware" });
    const requestId = await seed(s.serviceRequests, { requestNumber: "SR-RESET", title: "Fixture request", description: "Fixture", requesterId: otherId, creatorId: adminId, catalogItemId: catalog, serviceCatalogItemId: catalog });
    await seed(s.serviceRequestActivities, { serviceRequestId: requestId, actorId: adminId, action: "created" });
    await seed(s.serviceRequestsApprovals, { ticketId: requestId, approverId: adminId, approverRole: "Manager" });
    await seed(s.consumableDispatchLog, { consumableId: consumable, warehouseLocationId: ids.warehouse_locations, serviceRequestId: requestId, serviceRequestNumber: "SR-RESET", requesterId: otherId, agentId: adminId, quantity: 1 });
    const ticket = await seed(s.tickets, { ticketNumber: "T-RESET", title: "Fixture ticket", description: "Fixture", requesterId: otherId });
    await seed(s.ticketComments, { ticketId: ticket, authorId: adminId, message: "Fixture comment" });
    await seed(s.ticketAttachments, { ticketId: ticket, fileName: "ticket.pdf", originalName: "ticket.pdf", filePath: "/fixture/ticket.pdf" });
    const incident = await seed(s.incidents, { incidentNumber: "INC-RESET", title: "Fixture incident", description: "Fixture", requesterId: otherId, projectId: project });
    await seed(s.incidentActivities, { incidentId: incident, actorId: adminId, action: "created" });
    const problem = await seed(s.problems, { problemNumber: "PRB-RESET", title: "Fixture problem" });
    await seed(s.problemIncidents, { problemId: problem, ticketId: ticket });
    const change = await seed(s.changes, { changeNumber: "CHG-RESET", title: "Fixture change", projectId: project });
    await seed(s.changeApprovals, { changeId: change, approverId: adminId, originalApproverId: adminId, approverLabel: "Reset administrator" });
    await seed(s.changeEnvironmentStages, { changeId: change, environment: "production", order: 1 });
    await seed(s.changePIRs, { changeId: change, summary: "Fixture review" });
    const risk = await seed(s.risks, { title: "Fixture risk", likelihood: 2, impact: 3 });
    await seed(s.changeRiskLinks, { changeRequestId: change, riskId: risk });
    const application = await seed(s.cmdbApplications, { name: "Fixture application", category: "Business", hostingType: "saas", businessOwner: employee });
    const infrastructure = await seed(s.servers, { hostname: "reset-server", osPlatform: "Linux", environment: "production" });
    await seed(s.applicationServerLinks, { applicationId: application, serverId: infrastructure });
    await seed(s.changeCiLinks, { changeRequestId: change, serverId: infrastructure });
    await seed(s.configurationDocuments, { serverId: infrastructure, documentType: "configuration", originalName: "server.conf", fileName: "server.conf", filePath: "/fixture/server.conf" });
    const contract = await seed(s.contracts, { name: "Fixture SLA", vendorId: vendor });
    await seed(s.vendorContracts, { id: contract, vendorId: vendor, title: "Fixture SLA", contractNumber: "CON-RESET", contractType: "SLA Support", startDate: "2026-01-01", endDate: "2026-12-31" });
    await seed(s.vendorContractAssets, { contractId: contract, assetId: asset });
    await seed(s.vendorContractPurchaseOrders, { contractId: contract, purchaseOrderId: po });
    await seed(s.vendorContractServers, { contractId: contract, serverId: infrastructure });
    const zone = await seed(s.networkZones, { name: "Fixture zone", code: "RESET-ZONE" });
    const firewall = await seed(s.networkDevices, { name: "Fixture firewall", deviceType: "firewall", zoneId: zone, assetId: asset });
    const router = await seed(s.networkDevices, { name: "Fixture router", deviceType: "router", zoneId: zone });
    await seed(s.networkDeviceLinks, { sourceDeviceId: firewall, targetDeviceId: router });
    const rule = await seed(s.firewallRules, { name: "Fixture rule", firewallDeviceId: firewall, sourceZoneId: zone, action: "allow", businessJustification: "Required for integration fixture" });
    await seed(s.firewallRuleReviews, { firewallRuleId: rule, outcome: "approved", notes: "Fixture review notes" });
    const backup = await seed(s.backupSchedules, { name: "Fixture backup", serverId: infrastructure, frequency: "daily", retentionDays: 30, destination: "Fixture vault" });
    await seed(s.backupJobRuns, { scheduleId: backup, status: "success", startedAt: new Date(), notes: "Fixture backup evidence", evidenceReference: "fixture://backup" });
    await seed(s.backupRestoreTests, { scheduleId: backup, outcome: "passed", notes: "Fixture restore evidence", evidenceReference: "fixture://restore" });
    await seed(s.itComponentComplianceReviews, { componentType: "asset", componentId: asset, findings: "Fixture finding", remediationNotes: "Fixture remediation" });
    const article = await seed(s.kbArticles, { title: "Fixture policy", content: "Fixture policy body", category: "Policy", authorId: adminId });
    await seed(s.kbArticleVersions, { articleId: article, version: "1.0", snapshot: { title: "Fixture policy" }, changeNote: "Fixture revision" });
    await seed(s.kbArticleAttachments, { articleId: article, articleVersion: "1.0", originalName: "policy.pdf", fileName: "policy.pdf", filePath: "/fixture/policy.pdf" });
    await seed(s.kbArticleControlMappings, { articleId: article, articleVersion: "1.0", framework: "ISO", controlId: "A.5", controlTitle: "Fixture control" });
    await seed(s.kbTicketLinks, { articleId: article, articleVersion: "1.0", incidentId: incident });
    await seed(s.dataMigrationBatches, { moduleKey: "assets", fileName: "fixture.csv", totalRows: 1, validRows: 1, invalidRows: 0, expiresAt: new Date("2099-01-01"), createdById: adminId, previewData: [{ private: "staged employee data" }] });
    await seed(s.auditLogs, { userId: adminId, action: "DATA_MIGRATION", tableName: "data_migration_batches", recordId: ids.data_migration_batches });
    expect(Object.values(await snapshot(RESET_BUSINESS_TABLES)).every(rows => rows.length > 0)).toBe(true);
    protectedSnapshot = await snapshot(RESET_PROTECTED_TABLES);
    const app = express();
    app.use(express.json());
    app.use(async (req, _res, next) => {
      const id = req.get("x-test-user");
      req.user = id ? await storage.getUser(id) : undefined;
      req.isAuthenticated = (() => Boolean(req.user)) as typeof req.isAuthenticated;
      next();
    });
    registerSystemClearDataRoute(app, auth.requireAuth, auth.requirePermission("system_admin"), storage, auth.comparePasswords);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.on("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 120_000);

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await appPool?.end();
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    try { await setupPool?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await setupPool?.end(); }
  });

  it("rejects unauthenticated, unauthorized, invalid and incorrect password requests without changing any table", async () => {
    const before = await snapshot([...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES]);
    expect((await request({ confirmPassword: password }, "")).status).toBe(401);
    expect((await request({ confirmPassword: password }, otherId)).status).toBe(403);
    for (const value of [undefined, "", 123, {}, ["invalid"]]) expect((await request({ confirmPassword: value })).status).toBe(400);
    expect((await request({ confirmPassword: "incorrect-password" })).status).toBe(403);
    await db.update(s.users).set({ isActive: false }).where(eq(s.users.id, adminId));
    try { expect((await request({ confirmPassword: password })).status).toBe(403); }
    finally { await db.update(s.users).set({ isActive: true }).where(eq(s.users.id, adminId)); }
    expect(await snapshot([...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES])).toEqual(before);
  });

  it("rolls back all deletion if the final audit write fails", async () => {
    const before = await snapshot(RESET_BUSINESS_TABLES);
    await setupPool.query(`CREATE FUNCTION "${schema}".reject_reset_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$`);
    await setupPool.query(`CREATE TRIGGER reject_reset_audit BEFORE INSERT ON "${schema}".audit_logs FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_reset_audit()`);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request({ confirmPassword: password });
      expect(response.status).toBe(500);
      expect((await response.json()).message).toContain("no changes were committed");
      expect(await snapshot(RESET_BUSINESS_TABLES)).toEqual(before);
      expect(await snapshot(RESET_PROTECTED_TABLES)).toEqual(protectedSnapshot);
    } finally {
      log.mockRestore();
      await setupPool.query(`DROP TRIGGER reject_reset_audit ON "${schema}".audit_logs`);
      await setupPool.query(`DROP FUNCTION "${schema}".reject_reset_audit()`);
    }
  });

  it("refuses an unexpected dependent table rather than cascading into it", async () => {
    const before = await snapshot(RESET_BUSINESS_TABLES);
    await setupPool.query(`CREATE TABLE "${schema}".reset_guard (asset_id varchar REFERENCES "${schema}".assets(id))`);
    await setupPool.query(`INSERT INTO "${schema}".reset_guard VALUES ($1)`, [ids.assets]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await request({ confirmPassword: password })).status).toBe(500);
      expect(await snapshot(RESET_BUSINESS_TABLES)).toEqual(before);
    } finally {
      log.mockRestore();
      await setupPool.query(`DROP TABLE "${schema}".reset_guard`);
    }
  });

  it("also preserves in-memory accounts, permissions and lookup data", async () => {
    const { MemStorage } = await import("./storage");
    const memory = new MemStorage();
    const user = await memory.createUser({ username: "retained-memory-admin", email: "memory@example.test", password: "fixture-hash", firstName: "Memory", lastName: "Administrator" });
    const role = await memory.createRole({ name: "Retained memory role" });
    const permission = await memory.createPermission({ name: "memory_reset_permission" });
    await memory.assignUserRole(user.id, role.id);
    await memory.assignRolePermission(role.id, permission.id);
    const option = await memory.createDropdownOption({ category: "memory_reset", value: "keep", label: "Keep" });
    const location = await memory.createLocation({ name: "Retained memory location" });
    const department = await memory.createDepartment({ name: "Retained memory department" });
    await memory.createAsset({ name: "Removed memory asset", type: "laptop" });
    const rolesBefore = await memory.getUserRoles(user.id);
    expect(await memory.clearAllData({ userId: user.id, username: user.username })).toBe(true);
    expect(await memory.getUser(user.id)).toEqual(user);
    expect(await memory.getUserRoles(user.id)).toEqual(rolesBefore);
    expect(await memory.getUserPermissions(user.id)).toContain("memory_reset_permission");
    expect(await memory.getDropdownOptions()).toContainEqual(option);
    expect(await memory.getLocations()).toContainEqual(location);
    expect(await memory.getDepartments()).toContainEqual(department);
    expect(await memory.getAssets()).toHaveLength(0);
    expect(await memory.getAuditLogs()).toHaveLength(1);
  });

  it("clears every business table, preserves every protected row and ledger, and writes a fresh audit record", async () => {
    const response = await request({ confirmPassword: password });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result).toMatchObject({ clearedBy: "reset-admin", auditLogRefreshed: true, clearedTables: [...RESET_BUSINESS_TABLES], preservedTables: [...RESET_PROTECTED_TABLES] });
    for (const [name, rows] of Object.entries(await snapshot(RESET_BUSINESS_TABLES))) {
      expect(rows.length, name).toBe(name === "audit_logs" ? 1 : 0);
    }
    expect(await snapshot(RESET_PROTECTED_TABLES)).toEqual(protectedSnapshot);
    expect((await setupPool.query(`SELECT * FROM "${schema}"."_onprem_migrations"`)).rows).toEqual([{ name: "retained-migration" }]);
    const [audit] = await db.select().from(s.auditLogs);
    expect(audit).toMatchObject({ action: "CLEAR_SYSTEM_DATA", userId: adminId, recordId: "clear-data" });
    expect(audit.ipAddress).toBeTruthy();
    expect(audit.timestamp).toBeInstanceOf(Date);
    expect(audit.newValues).not.toContain(password);
    expect(JSON.parse(audit.newValues!)).toMatchObject({ clearedTables: [...RESET_BUSINESS_TABLES] });
    // A repeated reset still leaves the account/permission/session intact.
    expect((await request({ confirmPassword: password })).status).toBe(200);
    expect(await snapshot(RESET_PROTECTED_TABLES)).toEqual(protectedSnapshot);
    expect(await db.select().from(s.auditLogs)).toHaveLength(1);
  });
});
