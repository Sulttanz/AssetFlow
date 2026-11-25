// @vitest-environment node
import express, { type RequestHandler } from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  assets, backupSchedules, budgets, catalogItems, cmdbApplications, consumables, consumableStockMovements,
  dataMigrationBatches, departments, dropdownOptions, employees, incidents, incidentActivities, kbArticleControlMappings,
  kbArticles, locations, networkDevices, networkZones, projectMilestones, projectTasks, projects,
  purchaseOrderItems, purchaseOrders, roles, risks, serviceCatalogItems, serviceRequestActivities,
  serviceRequests, serviceRequestsApprovals, servers, userRoles, users, vendorContracts, vendors, warehouseLocations,
} from "@shared/schema";
import { dataMigrationModules } from "@shared/data-migration-modules";
import { db } from "./db";
import { registerDataMigrationRoutes } from "./data-migration-center";
import { assertAdditiveMigration } from "./startup-migrations";

const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" && process.env.VITEST_NATIVE_PG === "1";
const prefix = `migration-${randomUUID().slice(0, 8)}`;
const actorId = randomUUID();
const otherActorId = randomUUID();
const noRoleId = randomUUID();
const actorEmail = `${prefix}@example.test`;
const departmentName = `${prefix}-IT`;
const locationName = `${prefix}-DC`;
const warehouseCode = `${prefix}-WH`;
let server: Server;
let base = "";

const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const auth: RequestHandler = (req, res, done) => {
  const actor = req.get("x-test-user");
  if (!actor) return void res.status(401).json({ message: "Authentication required" });
  req.user = { id: actor } as Express.User;
  done();
};
const headers = (actor = actorId) => ({ "x-test-user": actor, "x-test-admin": "1" });
const post = (path: string, body: unknown, actor = actorId) => fetch(`${base}${path}`, {
  method: "POST", headers: { ...headers(actor), "Content-Type": "application/json" }, body: JSON.stringify(body),
});

async function previewCsv(moduleKey: string, rows: Array<Record<string, unknown>>, actor = actorId) {
  const module = dataMigrationModules.find(item => item.key === moduleKey)!;
  const csv = [
    module.fields.map(field => quote(field.header)).join(","),
    ...rows.map(row => module.fields.map(field => quote(row[field.key])).join(",")),
  ].join("\r\n");
  const body = new FormData();
  body.append("file", new Blob([csv], { type: "text/csv" }), `${prefix}-${moduleKey}.csv`);
  const response = await fetch(`${base}/api/data-migrations/${moduleKey}/preview`, { method: "POST", headers: headers(actor), body });
  expect(response.status, await response.clone().text()).toBe(201);
  return response.json();
}

async function previewEmployeeWorkbook(workbook: ExcelJS.Workbook, fileName = `${prefix}-employees.xlsx`) {
  const body = new FormData();
  body.append("file", new Blob([await workbook.xlsx.writeBuffer()]), fileName);
  const response = await fetch(`${base}/api/import/employees/preview`, {
    method: "POST",
    headers: headers(),
    body,
  });
  return { response, result: await response.json() };
}

function setByHeader(sheet: ExcelJS.Worksheet, rowNumber: number, header: string, value: unknown) {
  const headerRow = sheet.getRow(1);
  const column = Array.from({ length: sheet.columnCount }, (_, index) => index + 1)
    .find(index => String(headerRow.getCell(index).value ?? "").trim().replace(/\*+$/, "").trim().toLowerCase() === header.toLowerCase());
  if (!column) throw new Error(`Missing test column "${header}".`);
  sheet.getRow(rowNumber).getCell(column).value = value as ExcelJS.CellValue;
}

async function importRows(moduleKey: string, rows: Array<Record<string, unknown>>) {
  const preview = await previewCsv(moduleKey, rows);
  expect(preview.rows.flatMap((row: any) => row.errors)).toEqual([]);
  expect(preview.validRows).toBe(rows.length);
  const response = await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(200);
  expect(result, JSON.stringify(result)).toMatchObject({ importedRows: rows.length, failedRows: 0 });
  return preview;
}

describe.runIf(integrationEnabled)("Data Migration Center on disposable PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.searchParams.get("options")?.includes("search_path=test_full_")) {
      throw new Error("Migration integration tests require the disposable full-suite database.");
    }
    await db.insert(users).values([
      { id: actorId, username: prefix, email: actorEmail, password: "not-a-login-credential", firstName: "Migration", lastName: "Tester" },
      { id: otherActorId, username: `${prefix}-other`, email: `${prefix}-other@example.test`, password: "not-a-login-credential", firstName: "Other", lastName: "Tester" },
      { id: noRoleId, username: `${prefix}-visitor`, email: `${prefix}-visitor@example.test`, password: "not-a-login-credential", firstName: "Read", lastName: "Only" },
    ]);
    const [managerRole] = await db.select().from(roles).where(eq(roles.name, "it_manager"));
    await db.insert(userRoles).values([
      { userId: actorId, roleId: managerRole.id },
      { userId: otherActorId, roleId: managerRole.id },
    ]);
    await db.insert(departments).values({ name: departmentName });
    await db.insert(locations).values({ name: locationName });
    await db.insert(warehouseLocations).values({ name: `${prefix} Warehouse`, code: warehouseCode });
    await db.insert(dropdownOptions).values([
      { category: "application_category", value: prefix, label: prefix },
      { category: "contract_type", value: prefix, label: prefix },
      { category: "kb_category", value: "Policy", label: "Policy" },
    ]).onConflictDoNothing();
    const app = express();
    app.use(express.json());
    registerDataMigrationRoutes(app, auth);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.on("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("requires authentication and a Manager or Administrator role", async () => {
    expect((await fetch(`${base}/api/data-migrations/modules`)).status).toBe(401);
    expect((await fetch(`${base}/api/data-migrations/modules`, { headers: headers(noRoleId) })).status).toBe(403);
    expect((await fetch(`${base}/api/import/modules`, { headers: headers(noRoleId) })).status).toBe(403);
  });

  it("provides all fifteen guided templates and an additive staging migration", async () => {
    const source = await readFile("migrations/onprem/20261109_data_migration_center.sql", "utf8");
    expect(() => assertAdditiveMigration(source, "data-migration-center")).not.toThrow();
    expect(dataMigrationModules).toHaveLength(15);
    const enabledModules = await (await fetch(`${base}/api/import/modules`, { headers: headers() })).json();
    expect(enabledModules).toHaveLength(15);
    for (const module of dataMigrationModules) {
      const response = await fetch(`${base}/api/import/${module.key}/template`, { headers: headers() });
      expect(response.status).toBe(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
      expect((workbook.worksheets[0].getRow(1).values as string[]).slice(1)).toEqual(module.fields.map(field => field.header));
      if (module.key === "employees") {
        const importSheet = workbook.getWorksheet("Import Data");
        expect(importSheet).toBeTruthy();
        expect((importSheet!.getRow(1).values as string[]).slice(1)).toEqual([
          "Employee ID", "First Name*", "Last Name*", "Email", "Department", "Job Title*", "Mobile", "Phone", "Start Date", "Location",
        ]);
        expect((importSheet!.getRow(1).values as string[]).some(value => String(value ?? "").toLowerCase().includes("salary"))).toBe(false);
        expect(workbook.getWorksheet("Field Guide")?.getColumn(1).values.some(value => String(value ?? "").toLowerCase().includes("salary"))).toBe(false);
      }
      expect(workbook.worksheets[0].getCell("A2").text).toContain("__SAMPLE__");
      expect(workbook.getWorksheet("Field Guide")?.rowCount).toBe(module.fields.length + 1);
      const body = new FormData();
      const sample = await workbook.xlsx.writeBuffer();
      body.append("file", new Blob([sample as BlobPart]), "sample.xlsx");
      const sampleResponse = await fetch(`${base}/api/data-migrations/${module.key}/preview`, { method: "POST", headers: headers(), body });
      expect(sampleResponse.status).toBe(400);
    }
  });

  it("imports a completed employee XLSX template and safely ignores a legacy Salary column", async () => {
    const templateResponse = await fetch(`${base}/api/import/employees/template`, { headers: headers() });
    expect(templateResponse.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await templateResponse.arrayBuffer()));
    const sheet = workbook.getWorksheet("Import Data")!;
    const email = `${prefix}-xlsx-employee@example.test`;
    setByHeader(sheet, 2, "Employee ID", `${prefix}-xlsx-employee`);
    setByHeader(sheet, 2, "First Name", "  Amina  ");
    setByHeader(sheet, 2, "Last Name", "  Tester ");
    setByHeader(sheet, 2, "Email", email);
    setByHeader(sheet, 2, "Department", departmentName);
    setByHeader(sheet, 2, "Job Title", "Systems Analyst");
    setByHeader(sheet, 2, "Mobile", "+10000000444");
    setByHeader(sheet, 2, "Phone", "+10000000123");
    setByHeader(sheet, 2, "Start Date", "15-03-2026");
    setByHeader(sheet, 2, "Location", locationName);
    const legacySalaryColumn = sheet.columnCount + 1;
    sheet.getCell(1, legacySalaryColumn).value = "Salary";
    sheet.getCell(2, legacySalaryColumn).value = 999999;

    const { response, result: preview } = await previewEmployeeWorkbook(workbook, "employees-import-template.xlsx");
    expect(response.status, JSON.stringify(preview)).toBe(201);
    expect(preview).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, validCount: 1, invalidCount: 0, errors: [] });

    const commit = await post(`/api/import/employees/${preview.batchId}/commit`, { confirm: true });
    const result = await commit.json();
    expect(commit.status, JSON.stringify(result)).toBe(200);
    expect(result).toMatchObject({ importedRows: 1, failedRows: 0, invalidRows: 0 });
    const [employee] = await db.select().from(employees).where(eq(employees.email, email));
    expect(employee).toMatchObject({
      employeeId: `${prefix}-xlsx-employee`,
      firstName: "Amina",
      lastName: "Tester",
      position: "Systems Analyst",
      mobile: "+10000000444",
      phone: "+10000000123",
      startDate: "2026-03-15",
      salary: null,
    });
    expect(employee.departmentId).toBeTruthy();
    expect(employee.locationId).toBeTruthy();
  });

  it("allows an employee row without email and returns a clear error for a header-only workbook", async () => {
    const preview = await previewCsv("employees", [{
      employeeId: `${prefix}-no-email`,
      firstName: "No",
      lastName: "Email",
      position: "Analyst",
      email: "",
    }]);
    expect(preview).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import Data");
    sheet.addRow(dataMigrationModules.find(module => module.key === "employees")!.fields.map(field => field.header));
    const body = new FormData();
    body.append("file", new Blob([await workbook.xlsx.writeBuffer()]), "empty-employees.xlsx");
    const response = await fetch(`${base}/api/import/employees/preview`, { method: "POST", headers: headers(), body });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("No data rows were detected in Employees (Directory Only)"),
    });
  });

  it("reports translated-ready employee row errors with exact XLSX row, identifier, field and reason", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Field Guide").addRow(["Column", "Guidance"]);
    const sheet = workbook.addWorksheet("Employee Upload");
    sheet.addRow([" Employee ID ", "First Name *", "Last Name*", "Email *", "Department", "Job Title*", "Phone", "Start Date", "Location"]);
    const duplicateEmail = `${prefix}-duplicate@example.test`;
    sheet.addRow([`${prefix}-good`, "Valid", "Employee", duplicateEmail, "", "Analyst", "", "", ""]);
    sheet.addRow([`${prefix}-duplicate`, "Second", "Employee", duplicateEmail, "", "Analyst", "", "", ""]);
    sheet.addRow([`${prefix}-missing-last`, "Mahmoud", "", `${prefix}-missing-last@example.test`, "", "Analyst", "", "", ""]);
    sheet.addRow([`${prefix}-bad-email`, "Invalid", "Email", "not-an-email", "", "Analyst", "", "", ""]);

    const { response, result } = await previewEmployeeWorkbook(workbook, "legacy-employees.xlsx");
    expect(response.status, JSON.stringify(result)).toBe(201);
    expect(result).toMatchObject({ totalRows: 4, validRows: 1, invalidRows: 3, validCount: 1, invalidCount: 3 });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rowNumber: 3,
        identifier: `${prefix}-duplicate - Second Employee`,
        field: "Email",
        message: "Email address already exists.",
      }),
      expect.objectContaining({
        rowNumber: 4,
        identifier: `${prefix}-missing-last - Mahmoud`,
        field: "Last Name",
        message: "Missing required field",
      }),
      expect.objectContaining({
        rowNumber: 5,
        identifier: `${prefix}-bad-email - Invalid Email`,
        field: "Email",
        message: "Enter a valid email address.",
      }),
    ]));
  });

  it("previews errors without inserting records, imports only valid rows, and prevents replay", async () => {
    const tag = `${prefix}-asset`;
    const preview = await previewCsv("assets", [
      { name: `${prefix} laptop`, assetTag: tag, type: "laptop", lastAuditDate: "15-03-2026" },
      { name: "Duplicate", assetTag: tag.toUpperCase(), type: "laptop" },
      { name: "", type: "laptop" },
      { name: "Invalid date", type: "laptop", lastAuditDate: "31-02-2026" },
    ]);
    expect(preview).toMatchObject({ totalRows: 4, validRows: 1, invalidRows: 3 });
    expect(await db.select().from(assets).where(eq(assets.assetTag, tag))).toHaveLength(0);
    expect((await post(`/api/data-migrations/${preview.batchId}/import`, {})).status).toBe(400);
    const response = await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true, rows: [] });
    expect(await response.json()).toMatchObject({ importedRows: 1, invalidRows: 3, failedRows: 0 });
    const [asset] = await db.select().from(assets).where(eq(assets.assetTag, tag));
    expect(asset.lastAuditDate).toBe("2026-03-15");
    const [batch] = await db.select().from(dataMigrationBatches).where(eq(dataMigrationBatches.id, preview.batchId));
    expect(batch.previewData).toBeNull();
    expect(batch.status).toBe("imported");
    expect((await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true })).status).toBe(409);
    const history = await (await fetch(`${base}/api/data-migrations/history`, { headers: headers() })).json();
    expect(history.find((row: any) => row.moduleKey === "assets")).toMatchObject({
      importedRows: 1, invalidRows: 3, performedBy: "Migration Tester",
    });
  });

  it("rejects another actor's preview and clears expired staging data", async () => {
    const preview = await previewCsv("assets", [{ name: `${prefix} Private`, type: "laptop" }]);
    expect((await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true }, otherActorId)).status).toBe(409);
    await db.update(dataMigrationBatches).set({ expiresAt: new Date(Date.now() - 10000) }).where(eq(dataMigrationBatches.id, preview.batchId));
    expect((await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true })).status).toBe(409);
    const [batch] = await db.select().from(dataMigrationBatches).where(eq(dataMigrationBatches.id, preview.batchId));
    expect(batch.status).toBe("expired");
    expect(batch.previewData).toBeNull();
  });

  it("isolates database races by row and blocks opening stock when a warehouse is disabled after preview", async () => {
    const tag = `${prefix}-race`;
    const preview = await previewCsv("assets", [
      { name: `${prefix} Race`, assetTag: tag, type: "laptop" },
      { name: `${prefix} Surviving row`, assetTag: `${tag}-valid`, type: "laptop" },
    ]);
    await db.insert(assets).values({ name: "Concurrent insert", type: "laptop", assetTag: tag });
    const response = await post(`/api/data-migrations/${preview.batchId}/import`, { confirm: true });
    const result = await response.json();
    expect(result).toMatchObject({ importedRows: 1, failedRows: 1 });
    expect(result.rowErrors[0].error).toContain("duplicate identifier");
    expect(result.rowErrors[0].error).not.toContain("insert into");
    expect(await db.select().from(assets).where(eq(assets.assetTag, `${tag}-valid`))).toHaveLength(1);

    const stockPreview = await previewCsv("consumables", [{ name: `${prefix}-blocked-stock`, quantityInStock: 5, warehouseCode }]);
    await db.update(warehouseLocations).set({ isActive: false }).where(eq(warehouseLocations.code, warehouseCode));
    try {
      const blocked = await post(`/api/data-migrations/${stockPreview.batchId}/import`, { confirm: true });
      expect(await blocked.json()).toMatchObject({ importedRows: 0, failedRows: 1 });
      expect(await db.select().from(consumables).where(eq(consumables.name, `${prefix}-blocked-stock`))).toHaveLength(0);
    } finally {
      await db.update(warehouseLocations).set({ isActive: true }).where(eq(warehouseLocations.code, warehouseCode));
    }
  });

  it("imports each supported module with real relationships, PO line totals and policy control mapping", async () => {
    const employeeEmail = `${prefix}-employee@example.test`;
    await importRows("employees", [{
      employeeId: `${prefix}-EMP`, firstName: "Test", lastName: "Employee", email: employeeEmail,
      position: "Analyst", departmentName, locationName, startDate: "15-03-2026",
    }]);
    expect((await db.select().from(employees).where(eq(employees.email, employeeEmail)))[0].startDate).toBe("2026-03-15");
    await importRows("applications", [{
      name: `${prefix}-app`, category: prefix, hostingType: "saas", criticalityRating: "P2",
      businessOwnerEmail: employeeEmail,
    }]);
    expect((await db.select().from(cmdbApplications).where(eq(cmdbApplications.name, `${prefix}-app`)))[0].businessOwner).toBeTruthy();
    await importRows("servers", [{ hostname: `${prefix}-server`, osPlatform: "linux", environment: "production", cpuRamSpecs: "8 CPU / 16 GB / 1 TB" }]);
    expect(await db.select().from(servers).where(eq(servers.hostname, `${prefix}-server`))).toHaveLength(1);
    await importRows("network", [{ recordType: "zone", name: `${prefix}-zone`, zoneCode: `${prefix}-INT`, securityLevel: "internal" }]);
    expect(await db.select().from(networkZones).where(eq(networkZones.name, `${prefix}-zone`))).toHaveLength(1);
    await importRows("network", [{ recordType: "device", name: `${prefix}-switch`, deviceType: "switch", zoneName: `${prefix}-zone`, firmwareVersion: "7.2.1" }]);
    expect((await db.select().from(networkDevices).where(eq(networkDevices.name, `${prefix}-switch`)))[0].firmwareVersion).toBe("7.2.1");
    await importRows("backups", [{ name: `${prefix}-backup`, targetType: "server", targetName: `${prefix}-server`, frequency: "daily", retentionDays: 30, destination: "Audit vault", ownerEmail: actorEmail, nextDueAt: "15-03-2026" }]);
    expect((await db.select().from(backupSchedules).where(eq(backupSchedules.name, `${prefix}-backup`)))[0].nextDueAt?.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    await importRows("vendors", [{ name: `${prefix}-vendor`, code: `${prefix}-V`, contractTitle: "Support SLA", contractNumber: `${prefix}-contract`, contractType: prefix, startDate: "01-01-2026", endDate: "31-12-2026", cost: 1200 }]);
    expect(await db.select().from(vendors).where(eq(vendors.code, `${prefix}-V`))).toHaveLength(1);
    expect(await db.select().from(vendorContracts).where(eq(vendorContracts.contractNumber, `${prefix}-contract`))).toHaveLength(1);
    await importRows("consumables", [{ name: `${prefix}-toner`, quantityInStock: 7, minReorderLevel: 2, warehouseCode, vendorCode: `${prefix}-V` }]);
    const [consumable] = await db.select().from(consumables).where(eq(consumables.name, `${prefix}-toner`));
    expect(consumable.quantityInStock).toBe(7);
    expect((await db.select().from(consumableStockMovements).where(eq(consumableStockMovements.consumableId, consumable.id)))[0].quantity).toBe(7);
    await importRows("finance", [
      { recordType: "purchase_order_item", poNumber: `${prefix}-PO`, vendorName: `${prefix}-vendor`, orderDate: "15-03-2026", itemDescription: "Switch", quantity: 2, unitPrice: 10 },
      { recordType: "purchase_order_item", poNumber: `${prefix}-PO`, vendorName: `${prefix}-vendor`, orderDate: "15-03-2026", itemDescription: "Cable", quantity: 3, unitPrice: 5 },
      { recordType: "budget", budgetName: `${prefix}-budget`, fiscalYear: 2026, budgetAmount: 5000, budgetCategory: "hardware", departmentName, locationName },
    ]);
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, `${prefix}-PO`));
    expect(po).toMatchObject({ totalAmount: "35.00", status: "pending" });
    expect(await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id))).toHaveLength(2);
    expect(await db.select().from(budgets).where(eq(budgets.name, `${prefix}-budget`))).toHaveLength(1);
    await importRows("knowledge", [{ title: `${prefix} Policy`, slug: `${prefix}-policy`, category: "Policy", content: "A policy, with commas\nand a new line.", reviewDate: "15-03-2027", framework: "ISO 27001", controlId: "A.5.15", controlTitle: "Access control" }]);
    const [article] = await db.select().from(kbArticles).where(eq(kbArticles.slug, `${prefix}-policy`));
    expect(article).toMatchObject({ status: "draft", isPublic: false, reviewDate: "2027-03-15", content: "A policy, with commas\nand a new line." });
    expect(await db.select().from(kbArticleControlMappings).where(eq(kbArticleControlMappings.articleId, article.id))).toHaveLength(1);
  });

  it("imports project work, ITSM intake, and standalone risks without bypassing approvals or lifecycle", async () => {
    const projectName = `${prefix}-project`;
    const projectTitle = `${prefix} Project`;
    await db.insert(projects).values({
      name: projectName,
      title: projectTitle,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      targetEndDate: new Date("2027-12-31T00:00:00.000Z"),
    });

    await importRows("project_tasks", [{
      projectName,
      title: `${prefix} Task`,
      status: "In Progress",
      priority: "High",
      assigneeEmail: actorEmail,
      estimatedHours: 4,
      loggedHours: 1.5,
      dueDate: "15-04-2027",
    }]);
    const [task] = await db.select().from(projectTasks).where(eq(projectTasks.title, `${prefix} Task`));
    expect(task).toMatchObject({ assigneeId: actorId, status: "In Progress", priority: "High", estimatedHours: "4.00", loggedHours: "1.50" });

    await importRows("project_milestones", [{
      projectName: projectTitle,
      title: `${prefix} Milestone`,
      dueDate: "30-04-2027",
      status: "Pending",
    }]);
    expect(await db.select().from(projectMilestones).where(eq(projectMilestones.title, `${prefix} Milestone`))).toHaveLength(1);

    await importRows("incidents", [{
      title: `${prefix} Incident`,
      description: "A validated imported incident.",
      requesterEmail: actorEmail,
      projectName: projectTitle,
      priority: "P2",
    }]);
    const [incident] = await db.select().from(incidents).where(eq(incidents.title, `${prefix} Incident`));
    expect(incident).toMatchObject({ requesterId: actorId, creatorId: actorId, projectId: task.projectId, status: "New", priority: "P2", resolvedAt: null, closedAt: null });
    expect(await db.select().from(incidentActivities).where(eq(incidentActivities.incidentId, incident.id))).toHaveLength(1);

    const catalogId = randomUUID();
    const catalogTitle = `${prefix} Approval Service`;
    await db.insert(catalogItems).values({ id: catalogId, name: catalogTitle, category: "software" });
    await db.insert(serviceCatalogItems).values({
      id: catalogId, title: catalogTitle, category: "Software", requiresApproval: true, approverRole: "Manager",
    });
    await importRows("service_requests", [{
      title: `${prefix} Service Request`,
      description: "Approval must remain pending after import.",
      requesterEmail: actorEmail,
      catalogItemTitle: catalogTitle,
      projectName: projectTitle,
      requestedQuantity: 2,
      targetFulfillmentDate: "30-05-2027",
    }]);
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.title, `${prefix} Service Request`));
    expect(request).toMatchObject({
      requesterId: actorId, creatorId: actorId, projectId: task.projectId,
      approvalStatus: "pending", fulfillmentStage: "Pending Approval", fulfillmentStatus: "Submitted",
    });
    const [approval] = await db.select().from(serviceRequestsApprovals).where(eq(serviceRequestsApprovals.ticketId, request.id));
    expect(approval).toMatchObject({ status: "Pending", approverRole: "Manager", approverId: null });
    expect(await db.select().from(serviceRequestActivities).where(eq(serviceRequestActivities.serviceRequestId, request.id))).toHaveLength(1);

    await importRows("risks", [{
      title: `${prefix} Risk`,
      category: "vendor",
      likelihood: 3,
      impact: 4,
      ownerEmail: actorEmail,
      status: "identified",
    }]);
    const [importedRisk] = await db.select().from(risks).where(eq(risks.title, `${prefix} Risk`));
    expect(importedRisk.category).toBe("Third-Party & Vendor");
    expect(importedRisk.riskNumber).toMatch(/^IT-RSK-\d{3,}$/);
    const [risk] = await db.select().from(risks).where(eq(risks.title, `${prefix} Risk`));
    expect(risk).toMatchObject({ ownerId: actorId, likelihood: 3, impact: 4, riskScore: 12, status: "identified", createdById: actorId });
  });

  it("supports the /api/import preview and commit aliases and validates safe enum values and references", async () => {
    const invalidRows = [
      { title: `${prefix} Bad Priority`, description: "Description", requesterEmail: actorEmail, priority: "urgent", status: "Resolved" },
      { title: `${prefix} Missing Project`, status: "Backlog" },
    ];
    const invalidCsv = [
      dataMigrationModules.find(module => module.key === "incidents")!.fields.map(field => quote(field.header)).join(","),
      dataMigrationModules.find(module => module.key === "incidents")!.fields.map(field => quote(invalidRows[0][field.key as keyof typeof invalidRows[0]])).join(","),
    ].join("\r\n");
    const invalidBody = new FormData();
    invalidBody.append("file", new Blob([invalidCsv]), `${prefix}-invalid.csv`);
    const invalidResponse = await fetch(`${base}/api/import/incidents/preview`, { method: "POST", headers: headers(), body: invalidBody });
    expect(invalidResponse.status).toBe(201);
    const invalidPreview = await invalidResponse.json();
    expect(invalidPreview.validRows).toBe(0);
    expect(invalidPreview.rows[0].errors.join(" ")).toMatch(/Priority|Status/);

    const invalidDatePreview = await previewCsv("assets", [{
      name: `${prefix} Invalid Date`, type: "laptop", lastAuditDate: "31-02-2026",
    }]);
    expect(invalidDatePreview.validRows).toBe(0);
    expect(invalidDatePreview.rows[0].errors.join(" ")).toContain("Last Audit Date");

    const body = new FormData();
    const csv = [
      dataMigrationModules.find(module => module.key === "assets")!.fields.map(field => quote(field.header)).join(","),
      dataMigrationModules.find(module => module.key === "assets")!.fields.map(field => quote(({
        name: `${prefix} Alias Asset`, type: "laptop", assetTag: `${prefix}-alias`,
      } as Record<string, unknown>)[field.key])).join(","),
    ].join("\r\n");
    body.append("file", new Blob([csv]), `${prefix}-alias.csv`);
    const previewResponse = await fetch(`${base}/api/import/assets/preview`, { method: "POST", headers: headers(), body });
    expect(previewResponse.status).toBe(201);
    const preview = await previewResponse.json();
    const committed = await post(`/api/import/assets/${preview.batchId}/commit`, { confirm: true });
    expect(committed.status).toBe(200);
    expect(await committed.json()).toMatchObject({ importedRows: 1, failedRows: 0 });
    expect(await db.select().from(assets).where(eq(assets.assetTag, `${prefix}-alias`))).toHaveLength(1);
  });

  it("validates conditional fields and handles unsupported uploads with JSON errors", async () => {
    const preview = await previewCsv("finance", [{ recordType: "budget" }, { recordType: "purchase_order_item" }]);
    expect(preview.validRows).toBe(0);
    expect(preview.rows.every((row: any) => row.errors.length >= 4)).toBe(true);
    const body = new FormData();
    body.append("file", new Blob(["unsupported"]), "unsafe.exe");
    const response = await fetch(`${base}/api/data-migrations/assets/preview`, { method: "POST", headers: headers(), body });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(".xlsx");
  });
});
