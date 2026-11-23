// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { and, eq, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable, type AnyPgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@shared/schema";
import { RESET_BUSINESS_TABLES, RESET_PROTECTED_TABLES } from "@shared/system-data-reset";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";
import { registerSystemClearDataRoute } from "./system-clear-data-route";
import { seedDefaultAssignmentGroupsInTransaction, seedDefaultCatalogsInTransaction } from "./default-catalogs";

describe("System data reset policy", () => {
  it("explicitly classifies every schema table and never wipes a protected table", () => {
    const tables = Object.values(s).filter(value => is(value, PgTable));
    const names = tables.map(getTableName);
    const classified = [...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES];
    expect(new Set(classified).size).toBe(classified.length);
    expect([...classified].sort()).toEqual(names.sort());
    const business = new Set<string>(RESET_BUSINESS_TABLES);
    const safeCatalogDetaches = new Map([
      ["users->employees", "set null"],
      ["catalog_items->consumables", "set null"],
      ["service_catalog_items->projects", "set null"],
      ["incident_catalog_items->projects", "restrict"],
    ]);
    for (const table of tables.filter(table => !business.has(getTableName(table)))) {
      for (const fk of getTableConfig(table).foreignKeys) {
        const sourceTable = getTableName(table);
        const targetTable = getTableName(fk.reference().foreignTable);
        if (business.has(targetTable)) {
          const expectedOnDelete = safeCatalogDetaches.get(`${sourceTable}->${targetTable}`);
          expect(expectedOnDelete, `${sourceTable} -> ${targetTable} must have a reset detach policy`).toBeDefined();
          expect(fk.onDelete).toBe(expectedOnDelete);
          continue;
        }
        expect(business.has(targetTable), `${sourceTable} must not depend on reset data`).toBe(false);
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
  let manualDirectory = "";
  let systemGuideId = "";
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
  async function snapshotSystemGuides() {
    const result: Record<string, unknown[]> = {};
    for (const name of ["kb_articles", "kb_article_versions", "kb_article_attachments", "kb_article_control_mappings"]) {
      const condition = name === "kb_articles"
        ? "is_system_guide = true"
        : "article_id IN (SELECT id FROM " + `"${schema}".kb_articles WHERE is_system_guide = true` + ")";
      const data = await setupPool.query(`SELECT * FROM "${schema}"."${name}" WHERE ${condition}`);
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
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "Getting Started & Platform Overview"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "Employee Support"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "My Assets & ITAM / CMDB"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "Project Management & Governance"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "ITIL Service Operation & Change Management"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    expect(await db.select().from(s.dropdownOptions).where(and(
      eq(s.dropdownOptions.category, "kb_category"),
      eq(s.dropdownOptions.value, "GRC & Compliance"),
      eq(s.dropdownOptions.isActive, true),
    ))).toHaveLength(1);
    storage = (await import("./storage")).storage;
    const auth = await import("./auth");
    const hash = await auth.hashPassword(password);
    await db.insert(s.users).values([
      { id: adminId, username: "reset-admin", email: "reset-admin@example.test", password: hash, firstName: "Reset", lastName: "Administrator" },
      { id: otherId, username: "reset-user", email: "reset-user@example.test", password: hash, firstName: "Ordinary", lastName: "User" },
    ]);
    manualDirectory = await mkdtemp(join(tmpdir(), "system-manual-fixture-"));
    await writeFile(join(manualDirectory, "current-guide.md"), "# Current guide\nInitial repository content.");
    await writeFile(join(manualDirectory, "removed-guide.md"), "# Removed guide\nThis source will be removed.");
    await writeFile(join(manualDirectory, "platform-architecture.md"), [
      "---",
      "title: Platform Architecture & Getting Started",
      "category: Getting Started & Platform Overview",
      "author: Reset Administrator",
      "owner: Reset Administrator",
      "version: 1.0.0",
      "audience: internal",
      "---",
      "",
      "# Platform Architecture & Getting Started",
      "Internal platform overview.",
    ].join("\n"));
    const { syncSystemManualArticles } = await import("./knowledge-manual-sync");
    expect(await syncSystemManualArticles(manualDirectory)).toMatchObject({ inserted: 3, updated: 0, archived: 0, unchanged: 0 });
    expect(await syncSystemManualArticles(manualDirectory)).toMatchObject({ inserted: 0, updated: 0, archived: 0, unchanged: 3 });
    const platformGuide = (await db.select().from(s.kbArticles))
      .find(guide => guide.slug === "system-manual-platform-architecture");
    expect(platformGuide).toMatchObject({
      title: "Platform Architecture & Getting Started",
      category: "Getting Started & Platform Overview",
      authorId: adminId,
      ownerId: adminId,
      authorLabel: "Reset Administrator",
      ownerLabel: "Reset Administrator",
      version: "1.0",
      isSystemGuide: true,
      isPublic: true,
      status: "published",
    });
    const role = await seed(s.roles, { name: "Reset administrator" });
    const permission = await seed(s.permissions, { name: "system_admin" });
    await seed(s.userRoles, { userId: adminId, roleId: role });
    await seed(s.rolePermissions, { roleId: role, permissionId: permission });
    const endUserRole = await seed(s.roles, { name: "End User" });
    await seed(s.userRoles, { userId: otherId, roleId: endUserRole });
    await db.insert(s.sessions).values({ sid: "retained-session", sess: JSON.stringify({ passport: { user: adminId } }), expire: new Date("2099-01-01") });
    await db.insert(s.sessions).values({ sid: "deleted-user-session", sess: JSON.stringify({ passport: { user: otherId } }), expire: new Date("2099-01-01") });
    await seed(s.cabStreamLeases, { userId: adminId, sessionId: "retained-session", expiresAt: new Date("2099-01-01") });
    await seed(s.cabStreamLeases, { userId: otherId, sessionId: "deleted-user-session", expiresAt: new Date("2099-01-01") });
    await seed(s.systemSettings, { key: "reset-sentinel", value: "preserve" });
    await seed(s.settings, { key: "reset-sentinel", value: "preserve" });
    await db.insert(s.moduleSettings).values({ moduleKey: "reset-sentinel", enabled: true });
    await seed(s.dropdownOptions, { category: "reset-sentinel", value: "preserve", label: "Preserve" });
    await seed(s.locations, { name: "Retained location" });
    await seed(s.departments, { name: "Retained department" });
    await seed(s.warehouseLocations, { name: "Retained warehouse", code: "RESET-WH" });
    await seed(s.slaPolicies, { name: "Retained SLA", priority: "high", responseHours: 1, resolutionHours: 4 });
    await seed(s.changeBlackouts, {
      title: "Retained quarter-end freeze",
      startDate: "2026-12-20",
      endDate: "2026-12-31",
      createdById: adminId,
    });
    await setupPool.query(`CREATE TABLE "${schema}"."_onprem_migrations" (name text PRIMARY KEY)`);
    await setupPool.query(`INSERT INTO "${schema}"."_onprem_migrations" VALUES ('retained-migration')`);
    await db.transaction(seedDefaultCatalogsInTransaction);

    // Seed EVERY business table, including real cross-module RESTRICT FKs.
    const employee = await seed(s.employees, { firstName: "Fixture", lastName: "Employee", email: "employee@example.test", position: "Analyst" });
    await db.update(s.users).set({ employeeId: employee }).where(eq(s.users.id, otherId));
    await seed(s.employeeAccessRights, { employeeId: employee, applicationName: "Fixture", privilegeLevel: "Viewer", businessJustification: "Integration fixture" });
    await seed(s.employeeOffboardingClearances, { employeeId: employee, offboardingDate: "2026-10-22", clearanceType: "physical_asset_return", status: "verified", signedBy: adminId });
    const project = await seed(s.projects, { name: "Fixture project" });
    await seed(s.incidentCatalogItems, {
      name: "Fixture incident template", description: "Custom project incident template",
      category: "Network", projectId: project, icon: "network",
      defaultImpact: "high", defaultUrgency: "medium", defaultPriority: "P2",
      defaultAssignmentGroup: "Fixture assignment group", isActive: false, createdBy: adminId,
    });
    await seed(s.serviceContracts, {
      id: 1,
      contractNumber: "CNT-RESET",
      contractName: "Fixture service contract",
      projectId: project,
      slaPolicyId: ids.sla_policies,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await seed(s.projectBaselines, {
      projectId: project,
      versionNumber: "v1.0",
      baselineBudget: "100.00",
      baselineStartDate: "2026-10-01",
      baselineTargetEndDate: "2026-12-31",
      approvedBy: adminId,
      revisionNote: "Initial planning approval",
    });
    await seed(s.projectManagers, { projectId: project, userId: adminId, isPrimary: true });
    await seed(s.projectTeamMembers, { projectId: project, userId: otherId, roleTitle: "Fixture analyst" });
    await seed(s.projectMilestones, { projectId: project, title: "Fixture milestone", dueDate: new Date("2026-11-01T12:00:00.000Z") });
    await seed(s.projectTasks, { projectId: project, title: "Fixture delivery task", assigneeId: otherId });
    await seed(s.projectRisks, { projectId: project, title: "Fixture delivery risk", probability: 2, impact: 3, ownerId: otherId });
    await seed(s.projectChanges, { projectId: project, rfcNumber: "PRFC-RESET", title: "Fixture project RFC", requestedBy: adminId });
    await seed(s.projectDocuments, {
      projectId: project, name: "Fixture charter", version: "1.0", fileUrl: "/fixture/project-document",
      category: "Charter", uploadedBy: adminId, filePath: "/fixture/project-document", originalName: "charter.pdf",
      mimeType: "application/pdf", fileSize: 1,
    });
    const vendor = await seed(s.vendors, { name: "Fixture vendor" });
    await seed(s.vendorCertifications, {
      vendorId: vendor, certificationName: "SOC 2 Type II", certificateNumber: "RESET-CERT",
      issueDate: "2026-01-01", expiryDate: "2027-01-01", documentUrl: "https://example.test/reset-cert.pdf",
    });
    const quotation = await seed(s.vendorQuotations, {
      vendorId: vendor, quoteNumber: "RESET-QUOTE", issueDate: "2026-10-20", validUntil: "2026-11-20",
      currency: "USD", subtotal: "10.00", taxAmount: "0.00", totalAmount: "10.00", status: "converted",
    });
    await seed(s.vendorQuotationItems, { quotationId: quotation, description: "Fixture", itemType: "asset", quantity: 1, unitPrice: "10.00", totalPrice: "10.00" });
    const po = await seed(s.purchaseOrders, { poNumber: "RESET-PO", orderDate: "2026-10-22", totalAmount: "10.00", vendorId: vendor, quotationId: quotation });
    const item = await seed(s.purchaseOrderItems, { purchaseOrderId: po, description: "Fixture", unitPrice: "10.00", totalPrice: "10.00" });
    const receipt = await seed(s.purchaseOrderItemReceipts, { purchaseOrderId: po, purchaseOrderItemId: item });
    const invoice = await seed(s.purchaseInvoices, {
      vendorId: vendor, purchaseOrderId: po, invoiceNumber: "RESET-INV", issueDate: "2026-10-22", dueDate: "2026-11-22",
      currency: "USD", subtotal: "10.00", taxAmount: "0.00", grandTotal: "10.00",
      paymentMethod: "bank_transfer", paymentStatus: "partially_paid", status: "received",
    });
    await seed(s.purchaseInvoiceItems, { invoiceId: invoice, purchaseOrderItemId: item, receiptId: receipt, description: "Fixture", quantity: 1, unitPrice: "10.00", totalPrice: "10.00" });
    await seed(s.purchaseInvoiceMatchLines, { invoiceId: invoice, purchaseOrderItemId: item, description: "Staged fixture", quantity: 1, unitPrice: "10.00", totalPrice: "10.00" });
    await seed(s.purchaseInvoicePayments, { invoiceId: invoice, paymentDate: "2026-10-23", amount: "4.00", paymentMethod: "bank_transfer" });
    await seed(s.budgets, { name: "Fixture budget", fiscalYear: 2026, budgetAmount: "100.00", category: "hardware" });
    const asset = await seed(s.assets, { name: "Fixture", type: "laptop", locationId: ids.locations, departmentId: ids.departments, purchaseOrderNumber: "RESET-PO", purchasePrice: "10.00" });
    const supplierReturn = await seed(s.purchaseReturns, {
      returnNumber: "RET-RESET", debitNoteNumber: "DN-RESET", vendorId: vendor, purchaseOrderId: po, purchaseInvoiceId: invoice,
      returnDate: "2026-10-24", reasonCode: "defective", status: "approved", currency: "USD", totalCredit: "10.00",
    });
    await seed(s.purchaseReturnItems, {
      returnId: supplierReturn, purchaseOrderItemId: item, assetId: asset, quantity: 1, unitPrice: "10.00",
      totalCredit: "10.00", reasonCode: "defective",
    });
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
    const catalog = await seed(s.catalogItems, {
      name: "Fixture service", description: "Custom service description", category: "hardware",
      fulfillmentTeam: "Custom Fulfillment", consumableId: consumable, slaHours: 19,
      approvalRequired: true, isActive: false, displayOrder: 71,
    });
    await seed(s.serviceCatalogItems, {
      id: catalog, title: "Fixture service", category: "Hardware", projectId: project,
      description: "Custom service details", defaultPriority: "P2", defaultImpact: "high",
      defaultUrgency: "high", icon: "laptop", slaHours: 36, requiresApproval: true,
      approverRole: "IT Director",
      customFieldsSchema: [{ key: "justification", label: "Business justification", type: "textarea", required: true }],
      status: "Inactive",
    });
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
    await seed(s.changeAssetLinks, { changeRequestId: change, assetId: asset });
    await seed(s.configurationDocuments, { serverId: infrastructure, documentType: "configuration", originalName: "server.conf", fileName: "server.conf", filePath: "/fixture/server.conf" });
    const contract = await seed(s.contracts, { name: "Fixture SLA", vendorId: vendor });
    await seed(s.vendorContracts, { id: contract, vendorId: vendor, title: "Fixture SLA", contractNumber: "CON-RESET", contractType: "SLA Support", startDate: "2026-01-01", endDate: "2026-12-31" });
    await seed(s.vendorContractAssets, { contractId: contract, assetId: asset });
    await seed(s.vendorContractPurchaseOrders, { contractId: contract, purchaseOrderId: po });
    await seed(s.vendorContractServers, { contractId: contract, serverId: infrastructure });
    const zone = await seed(s.networkZones, { name: "Fixture zone", code: "RESET-ZONE" });
    const firewall = await seed(s.networkDevices, { name: "Fixture firewall", deviceType: "firewall", zoneId: zone, assetId: asset });
    const router = await seed(s.networkDevices, { name: "Fixture router", deviceType: "router", zoneId: zone });
    await seed(s.riskMitigationActions, { riskId: risk, title: "Replace firewall", ownerUserId: otherId });
    await seed(s.riskReviewHistory, { riskId: risk, reviewedById: adminId, inherentScore: 6, residualScore: 4, status: "identified" });
    await seed(s.riskApplicationLinks, { riskId: risk, applicationId: application });
    await seed(s.riskServerLinks, { riskId: risk, serverId: infrastructure });
    await seed(s.riskNetworkDeviceLinks, { riskId: risk, networkDeviceId: firewall });
    await seed(s.riskAssetLinks, { riskId: risk, assetId: asset });
    await seed(s.riskVendorLinks, { riskId: risk, vendorId: vendor });
    await seed(s.riskProblemLinks, { riskId: risk, problemId: problem });
    await seed(s.riskChangeLinks, { riskId: risk, changeId: change });
    await seed(s.networkDeviceLinks, { sourceDeviceId: firewall, targetDeviceId: router });
    const rule = await seed(s.firewallRules, { name: "Fixture rule", firewallDeviceId: firewall, sourceZoneId: zone, action: "allow", businessJustification: "Required for integration fixture" });
    await seed(s.firewallRuleReviews, { firewallRuleId: rule, outcome: "approved", notes: "Fixture review notes" });
    const backup = await seed(s.backupSchedules, { name: "Fixture backup", serverId: infrastructure, frequency: "daily", retentionDays: 30, destination: "Fixture vault" });
    const backupRun = await seed(s.backupJobRuns, { scheduleId: backup, status: "success", startedAt: new Date(), notes: "Fixture backup evidence", evidenceReference: "fixture://backup" });
    await seed(s.backupEvidenceAttachments, {
      jobRunId: backupRun, version: 1, originalName: "backup-evidence.pdf", fileName: "fixture.pdf",
      fileType: "application/pdf", fileSize: 8, filePath: "/fixture/backup-evidence.pdf", uploadedBy: adminId,
    });
    await seed(s.backupRestoreTests, { scheduleId: backup, outcome: "passed", notes: "Fixture restore evidence", evidenceReference: "fixture://restore" });
    const complianceReview = await seed(s.itComponentComplianceReviews, { componentType: "asset", componentId: asset, findings: "Fixture finding", remediationNotes: "Fixture remediation" });
    await seed(s.riskComplianceReviewLinks, { riskId: risk, complianceReviewId: complianceReview });
    const [assignmentGroup] = await db.insert(s.assignmentGroups)
      .values({ name: "Fixture assignment group", description: "Reset coverage fixture." })
      .returning({ id: s.assignmentGroups.id });
    await db.insert(s.assignmentGroupMembers).values({ groupId: assignmentGroup.id, userId: adminId });
    const article = await seed(s.kbArticles, { title: "Fixture policy", content: "Fixture policy body", category: "Policy", authorId: adminId });
    await seed(s.kbArticleVersions, { articleId: article, version: "1.0", snapshot: { title: "Fixture policy" }, changeNote: "Fixture revision" });
    await seed(s.kbArticleAttachments, { articleId: article, articleVersion: "1.0", originalName: "policy.pdf", fileName: "policy.pdf", filePath: "/fixture/policy.pdf" });
    await seed(s.kbArticleControlMappings, { articleId: article, articleVersion: "1.0", framework: "ISO", controlId: "A.5", controlTitle: "Fixture control" });
    await seed(s.kbTicketLinks, { articleId: article, articleVersion: "1.0", incidentId: incident });
    systemGuideId = await seed(s.kbArticles, {
      title: "Repository guide", slug: "system-manual-reset-fixture", content: "Managed from docs.",
      category: "User Guide", status: "published", isPublic: true, isSystemGuide: true,
    });
    await seed(s.kbArticleVersions, { articleId: systemGuideId, version: "1.0", snapshot: { title: "Repository guide" }, changeNote: "System guide seed" });
    await seed(s.kbArticleAttachments, { articleId: systemGuideId, articleVersion: "1.0", originalName: "manual.pdf", fileName: "manual.pdf", filePath: "/fixture/manual.pdf" });
    await seed(s.kbArticleControlMappings, { articleId: systemGuideId, articleVersion: "1.0", framework: "ISO", controlId: "A.6", controlTitle: "System guide control" });
    await seed(s.dataMigrationBatches, { moduleKey: "assets", fileName: "fixture.csv", totalRows: 1, validRows: 1, invalidRows: 0, expiresAt: new Date("2099-01-01"), createdById: adminId, previewData: [{ private: "staged employee data" }] });
    await seed(s.auditLogs, { userId: adminId, action: "DATA_MIGRATION", tableName: "data_migration_batches", recordId: ids.data_migration_batches });
    await seed(s.systemNotifications, {
      userId: adminId, type: "service_contract", severity: "medium", title: "Fixture renewal",
      message: "Fixture support contract is due for renewal.", dedupeKey: "fixture-service-contract-renewal",
    });
    await db.insert(s.appReleaseHistory).values({
      fromVersion: "v2.1.0", toVersion: "v2.2.0", migrationCount: 59,
      notes: "Fixture release history.", status: "applied",
    });
    await db.insert(s.systemUpdateJobs).values({
      requestedByUserId: adminId,
      currentVersion: "v2.2.0",
      targetVersion: "v2.3.0",
      runtimeEnvironment: "self_hosted",
      status: "failed",
      message: "Fixture update status.",
    });
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
    if (manualDirectory) await rm(manualDirectory, { recursive: true, force: true });
    try { await setupPool?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await setupPool?.end(); }
  });

  it("upserts changed Markdown and archives system guides whose source file is removed", async () => {
    await writeFile(join(manualDirectory, "current-guide.md"), "# Current guide\nUpdated repository content.");
    await rm(join(manualDirectory, "removed-guide.md"));
    const { syncSystemManualArticles } = await import("./knowledge-manual-sync");
    expect(await syncSystemManualArticles(manualDirectory)).toMatchObject({
      inserted: 0, updated: 1, archived: 1, unchanged: 1,
    });
    const guides = await db.select().from(s.kbArticles).where(eq(s.kbArticles.isSystemGuide, true));
    expect(guides.find(guide => guide.slug === "system-manual-current-guide")).toMatchObject({
      status: "published", version: "1.1", content: "# Current guide\nUpdated repository content.",
    });
    expect(guides.find(guide => guide.slug === "system-manual-removed-guide")).toMatchObject({
      status: "archived", isPublic: false, version: "1.1",
    });
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

  it("preserves all in-memory users, role mappings, and sessions", async () => {
    const { MemStorage } = await import("./storage");
    const memory = new MemStorage();
    const admin = await memory.createUser({ username: "retained-memory-admin", email: "memory@example.test", password: "fixture-hash", firstName: "Memory", lastName: "Administrator" });
    const endUser = await memory.createUser({ username: "retained-memory-user", email: "user@example.test", password: "fixture-hash", firstName: "Memory", lastName: "User" });
    const adminRole = await memory.createRole({ name: "System Administrator" });
    const endUserRole = await memory.createRole({ name: "End User" });
    const permission = await memory.createPermission({ name: "system_admin" });
    await memory.assignUserRole(admin.id, adminRole.id);
    await memory.assignUserRole(endUser.id, endUserRole.id);
    await memory.assignRolePermission(adminRole.id, permission.id);
    const option = await memory.createDropdownOption({ category: "memory_reset", value: "keep", label: "Keep" });
    const location = await memory.createLocation({ name: "Retained memory location" });
    const department = await memory.createDepartment({ name: "Retained memory department" });
    await memory.createAsset({ name: "Removed memory asset", type: "laptop" });
    const rolesBefore = await memory.getUserRoles(admin.id);
    await new Promise<void>((resolve, reject) => memory.sessionStore.set("memory-admin-session", { passport: { user: admin.id } }, (error?: Error) => error ? reject(error) : resolve()));
    await new Promise<void>((resolve, reject) => memory.sessionStore.set("memory-user-session", { passport: { user: endUser.id } }, (error?: Error) => error ? reject(error) : resolve()));
    expect(await memory.clearAllData({ userId: admin.id, username: admin.username })).toBe(true);
    expect(await memory.getUser(admin.id)).toEqual(admin);
    expect(await memory.getUser(endUser.id)).toEqual(endUser);
    expect(await memory.getUserRoles(admin.id)).toEqual(rolesBefore);
    expect(await memory.getUserRoles(endUser.id)).toEqual([endUserRole]);
    expect(await memory.getUserPermissions(admin.id)).toContain("system_admin");
    const sessions = await new Promise<any>((resolve, reject) => memory.sessionStore.all((error: Error | null, rows: any) => error ? reject(error) : resolve(rows)));
    expect(Object.keys(sessions).sort()).toEqual(["memory-admin-session", "memory-user-session"]);
    expect(await memory.getDropdownOptions()).toContainEqual(option);
    expect(await memory.getLocations()).toContainEqual(location);
    expect(await memory.getDepartments()).toContainEqual(department);
    expect(await memory.getAssets()).toHaveLength(0);
    expect(await memory.getAuditLogs()).toHaveLength(1);
  });

  it("clears every business table, preserves every protected row and ledger, and writes a fresh audit record", async () => {
    const guidesBeforeReset = await snapshotSystemGuides();
    const response = await request({ confirmPassword: password });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result).toMatchObject({
      clearedBy: "reset-admin", auditLogRefreshed: true,
      clearedTables: [...RESET_BUSINESS_TABLES], preservedTables: [...RESET_PROTECTED_TABLES],
      preservedAllUserAccounts: true, preservedAllUserRoleAssignments: true, preservedCatalogRecords: true,
      preservedSystemGuideRecords: true,
    });
    for (const [name, rows] of Object.entries(await snapshot(RESET_BUSINESS_TABLES))) {
      const defaults: Record<string, number> = {
        assignment_groups: 5,
      };
      expect(rows.length, name).toBe(defaults[name] ?? (name === "audit_logs" ? 1 : guidesBeforeReset[name]?.length ?? 0));
    }
    expect(await snapshotSystemGuides()).toEqual(guidesBeforeReset);
    const retainedGuide = await setupPool.query(
      `SELECT id, is_system_guide FROM "${schema}".kb_articles WHERE id = $1`,
      [systemGuideId],
    );
    expect(retainedGuide.rows).toEqual([{ id: systemGuideId, is_system_guide: true }]);
    expect((await setupPool.query(
      `SELECT article_id FROM "${schema}".kb_article_versions WHERE article_id = $1`,
      [systemGuideId],
    )).rows.some((row: { article_id: string }) => row.article_id === systemGuideId)).toBe(true);
    // Both accounts, their roles, and sessions survive; employee-owned user
    // references are detached before employee rows are removed.
    protectedSnapshot.users = protectedSnapshot.users.map((row: any) => ({ ...row, employee_id: null }));
    const seededGroups = new Set(["service desk", "application support", "network operations", "desktop support", "infrastructure"]);
    protectedSnapshot.catalog_items = protectedSnapshot.catalog_items.map((row: any) => ({
      ...row,
      consumable_id: null,
      fulfillment_team: row.fulfillment_team && seededGroups.has(String(row.fulfillment_team).trim().toLowerCase())
        ? row.fulfillment_team : null,
    }));
    protectedSnapshot.service_catalog_items = protectedSnapshot.service_catalog_items.map((row: any) => ({ ...row, project_id: null }));
    protectedSnapshot.incident_catalog_items = protectedSnapshot.incident_catalog_items.map((row: any) => ({
      ...row,
      project_id: null,
      default_assignment_group: row.default_assignment_group && seededGroups.has(String(row.default_assignment_group).trim().toLowerCase())
        ? row.default_assignment_group : null,
    }));
    expect(await snapshot(RESET_PROTECTED_TABLES)).toEqual(protectedSnapshot);
    expect(await db.select().from(s.users).where(eq(s.users.id, otherId))).toMatchObject([
      { username: "reset-user", employeeId: null, isActive: true },
    ]);
    expect(await db.select().from(s.users).where(eq(s.users.id, adminId))).toMatchObject([
      { username: "reset-admin", employeeId: null, isActive: true },
    ]);
    expect(await db.select().from(s.userRoles).where(eq(s.userRoles.userId, otherId))).toHaveLength(1);
    expect(await db.select().from(s.userRoles).where(eq(s.userRoles.userId, adminId))).toHaveLength(1);
    const [customIncident] = await db.select().from(s.incidentCatalogItems)
      .where(eq(s.incidentCatalogItems.name, "Fixture incident template"));
    expect(customIncident).toMatchObject({
      description: "Custom project incident template", projectId: null, defaultPriority: "P2",
      defaultImpact: "high", defaultUrgency: "medium", defaultAssignmentGroup: null,
      isActive: false, createdBy: adminId,
    });
    const [customService] = await db.select().from(s.serviceCatalogItems)
      .where(eq(s.serviceCatalogItems.title, "Fixture service"));
    expect(customService).toMatchObject({
      description: "Custom service details", projectId: null, defaultPriority: "P2",
      defaultImpact: "high", defaultUrgency: "high", slaHours: 36, requiresApproval: true,
      approverRole: "IT Director", status: "Inactive",
      customFieldsSchema: [{ key: "justification", label: "Business justification", type: "textarea", required: true }],
    });
    const [customLegacyService] = await db.select().from(s.catalogItems).where(eq(s.catalogItems.name, "Fixture service"));
    expect(customLegacyService).toMatchObject({
      description: "Custom service description", category: "hardware", fulfillmentTeam: null,
      consumableId: null, slaHours: 19, approvalRequired: true, isActive: false, displayOrder: 71,
    });
    expect(await db.select().from(s.serviceCatalogItems)).toHaveLength(protectedSnapshot.service_catalog_items.length);
    expect(await db.select().from(s.incidentCatalogItems)).toHaveLength(protectedSnapshot.incident_catalog_items.length);
    expect(await db.select().from(s.catalogItems)).toHaveLength(protectedSnapshot.catalog_items.length);
    expect((await setupPool.query(`SELECT * FROM "${schema}"."_onprem_migrations"`)).rows).toEqual([{ name: "retained-migration" }]);
    const [audit] = await db.select().from(s.auditLogs);
    expect(audit).toMatchObject({ action: "CLEAR_SYSTEM_DATA", userId: adminId, recordId: "clear-data" });
    expect(audit.ipAddress).toBeTruthy();
    expect(audit.timestamp).toBeInstanceOf(Date);
    expect(audit.newValues).not.toContain(password);
    expect(JSON.parse(audit.newValues!)).toMatchObject({
      clearedTables: [...RESET_BUSINESS_TABLES],
      preservedAllUserAccounts: true,
      preservedAllUserRoleAssignments: true,
      preservedCatalogRecords: true,
      detachedCatalogReferencesToClearedRecords: true,
      preservedSystemGuideRecords: true,
    });
    // A repeated reset still leaves both users, their role mappings and sessions intact.
    expect((await request({ confirmPassword: password })).status).toBe(200);
    expect(await snapshot(RESET_PROTECTED_TABLES)).toEqual(protectedSnapshot);
    expect(await db.select().from(s.auditLogs)).toHaveLength(1);
    expect(await db.select().from(s.serviceCatalogItems)).toHaveLength(protectedSnapshot.service_catalog_items.length);
    expect(await db.select().from(s.incidentCatalogItems)).toHaveLength(protectedSnapshot.incident_catalog_items.length);
    expect(await db.select().from(s.catalogItems)).toHaveLength(protectedSnapshot.catalog_items.length);
    const groupSnapshot = await snapshot(["assignment_groups"]);
    await db.transaction(seedDefaultAssignmentGroupsInTransaction);
    await db.transaction(seedDefaultAssignmentGroupsInTransaction);
    expect(await snapshot(["assignment_groups"])).toEqual(groupSnapshot);
  });
});
