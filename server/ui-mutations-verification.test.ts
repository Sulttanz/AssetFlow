// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";

const databaseUrl = process.env.DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const safeDatabase = parsedUrl &&
  ["localhost", "127.0.0.1"].includes(parsedUrl.hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(parsedUrl.searchParams.get("options") ?? "");
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && Boolean(safeDatabase);

describe.runIf(enabled)("UI mutation HTTP and persistence verification", () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const roleId = randomUUID();
  let server: Server | undefined;
  let base = "";
  let cookie = "";
  let incidentId: string | undefined;
  let projectId: string | undefined;
  let contractId: number | undefined;
  let assignmentGroupId: number | undefined;
  const employeeIds: string[] = [];
  const results: { method: string; path: string; status: number; expectedStatus: number }[] = [];

  async function request(method: string, path: string, input?: unknown, expectedStatus = 200) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const body = await response.json().catch(() => null);
    results.push({ method, path, status: response.status, expectedStatus });
    expect(response.status, `${method} ${path}: ${JSON.stringify(body)}`).toBe(expectedStatus);
    console.log(`[PASS] ${method} ${path} → ${response.status}`);
    return body;
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const password = `temporary-${randomUUID()}`;
    const username = `verify-mutations-${suffix.slice(0, 8)}`;
    await db.insert(s.users).values({
      id: actorId, username, password: await hashPassword(password),
      email: `${username}@example.test`, firstName: "Mutation", lastName: "Verifier", isActive: true,
    });
    await db.insert(s.roles).values({ id: roleId, name: `Mutation Verification ${suffix}` });
    for (const name of ["system_admin", "employee_create", "employee_update"]) {
      await db.insert(s.permissions).values({ name, description: name }).onConflictDoNothing();
      const [permission] = await db.select().from(s.permissions).where(eq(s.permissions.name, name));
      await db.insert(s.rolePermissions).values({ roleId, permissionId: permission.id });
    }
    await db.insert(s.userRoles).values({ userId: actorId, roleId });
    const login = await fetch(`${base}/api/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).not.toBe("");
  }, 60_000);

  afterAll(async () => {
    try {
      if (incidentId) await db.delete(s.incidents).where(eq(s.incidents.id, incidentId));
      if (contractId) await db.delete(s.serviceContracts).where(eq(s.serviceContracts.id, contractId));
      if (projectId) await db.delete(s.projects).where(eq(s.projects.id, projectId));
      if (assignmentGroupId) await db.delete(s.assignmentGroups).where(eq(s.assignmentGroups.id, assignmentGroupId));
      for (const id of employeeIds) await db.delete(s.employees).where(eq(s.employees.id, id));
      await db.delete(s.userRoles).where(eq(s.userRoles.userId, actorId));
      await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
      await db.delete(s.roles).where(eq(s.roles.id, roleId));
      await db.delete(s.auditLogs).where(eq(s.auditLogs.userId, actorId));
      await db.delete(s.users).where(eq(s.users.id, actorId));
    } finally {
      if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
      await pool.end();
    }
  });

  it("creates the third employee, and returns descriptive conflicts and field validation", async () => {
    const employeeInput = {
      firstName: "Employee", lastName: "Verification",
      email: `employee-3-${suffix}@example.test`, position: "QA", employeeId: "3",
    };
    for (const number of ["1", "2", "3"]) {
      const employee = await request("POST", "/api/employees", {
        ...employeeInput, employeeId: number, email: `employee-${number}-${suffix}@example.test`,
      }, 201);
      employeeIds.push(employee.id);
      expect(employee.employeeId).toBe(number);
      expect(employee.id).not.toBe(number);
    }
    const duplicateId = await request("POST", "/api/employees", {
      ...employeeInput, email: `different-${suffix}@example.test`,
    }, 409);
    expect(duplicateId).toMatchObject({ code: "DUPLICATE_EMPLOYEE_ID", requestId: expect.any(String) });
    const duplicateEmail = await request("POST", "/api/employees", {
      ...employeeInput, employeeId: `different-${suffix}`,
    }, 409);
    expect(duplicateEmail.code).toBe("DUPLICATE_EMPLOYEE_EMAIL");
    const invalid = await request("POST", "/api/employees", { employeeId: "3" }, 400);
    expect(invalid.code).toBe("VALIDATION_ERROR");
    expect(invalid.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "firstName" })]));
    const duplicateUpdate = await request("PUT", `/api/employees/${employeeIds[0]}`, { employeeId: "3" }, 409);
    expect(duplicateUpdate.code).toBe("DUPLICATE_EMPLOYEE_ID");
  });

  it("stores multiple blank emails as null and preserves omitted emails on update", async () => {
    const input = { firstName: "Optional", lastName: "Email", position: "Engineer" };
    for (const email of ["", " \t ", null, undefined]) {
      const employee = await request("POST", "/api/employees", { ...input, email }, 201);
      employeeIds.push(employee.id);
      expect(employee.email).toBeNull();
      const [stored] = await db.select().from(s.employees).where(eq(s.employees.id, employee.id));
      expect(stored.email).toBeNull();
    }
    const address = `optional-${suffix}@example.test`;
    const employee = await request("POST", "/api/employees", { ...input, email: ` ${address} ` }, 201);
    employeeIds.push(employee.id);
    expect(employee.email).toBe(address);
    expect((await request("PUT", `/api/employees/${employee.id}`, { firstName: "Renamed" })).email).toBe(address);
    for (const email of ["", "   ", null]) {
      expect((await request("PUT", `/api/employees/${employee.id}`, { email: address })).email).toBe(address);
      expect((await request("PUT", `/api/employees/${employee.id}`, { email })).email).toBeNull();
    }
    const invalid = await request("POST", "/api/employees", { ...input, email: "invalid" }, 400);
    expect(invalid.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "email" })]));
  });

  it("normalizes legacy blank emails idempotently without changing real addresses", async () => {
    const input = { firstName: "Legacy", lastName: "Email", position: "Engineer" };
    const address = `legacy-${suffix}@example.test`;
    const rows = await db.insert(s.employees).values([
      { ...input, email: "" }, { ...input, email: " \t " }, { ...input, email: address },
    ]).returning();
    employeeIds.push(...rows.map(row => row.id));
    const migration = await readFile("migrations/onprem/20261206_optional_employee_email.sql", "utf8");
    await db.execute(sql.raw(migration));
    await db.execute(sql.raw(migration));
    for (const [index, employee] of rows.entries()) {
      const [stored] = await db.select().from(s.employees).where(eq(s.employees.id, employee.id));
      expect(stored.email).toBe(index === 2 ? address : null);
    }
  });

  it("verifies incident creation, partial edits, assignment, resolution/closure, project updates and contract updates", async () => {
    const projectInput = {
      title: `Mutation verification ${suffix}`, description: "Disposable API verification.",
      status: "Planning", healthStatus: "On Track",
      startDate: "2026-01-01T12:00:00.000Z", targetEndDate: "2030-12-31T12:00:00.000Z",
      budget: 1000, actualSpend: 0, managerIds: [actorId], primaryManagerId: actorId,
      teamMembers: [], milestones: [], assets: [],
    };
    const project = await request("POST", "/api/projects", projectInput, 201);
    projectId = project.id;
    const contract = await request("POST", "/api/contracts", {
      contractNumber: `UI-${suffix}`, contractName: "Mutation test support", projectId,
      startDate: "2026-01-01", endDate: "2030-12-31", renewalNoticeDays: 60,
    }, 201);
    contractId = contract.id;

    const incident = await request("POST", "/api/incidents", {
      title: `Mutation test incident ${suffix}`, description: "Disposable incident workflow verification.",
      priority: "P2", urgency: "high", impact: "medium", category: "Network", projectId,
    }, 201);
    incidentId = incident.id;
    expect(incident.status).toBe("New");

    const group = await request("POST", "/api/assignment-groups", {
      name: `Network ${suffix}`, description: "Disposable assignment group.",
    }, 201);
    assignmentGroupId = group.id;
    await request("POST", `/api/assignment-groups/${group.id}/members`, { userId: actorId }, 201);
    await request("POST", `/api/assignment-groups/${group.id}/members`, { userId: actorId }, 409);
    const groupMembers = await request("GET", `/api/assignment-groups/${group.id}/members`);
    expect(groupMembers).toEqual(expect.arrayContaining([expect.objectContaining({ id: actorId })]));
    const eligibleMembers = await request("GET", "/api/assignment-groups/eligible-users");
    expect(eligibleMembers).toEqual(expect.arrayContaining([expect.objectContaining({ id: actorId })]));
    await request("PUT", `/api/assignment-groups/${group.id}`, { description: "Updated assignment group." });
    const groups = await request("GET", "/api/assignment-groups");
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: group.id, members: expect.arrayContaining([expect.objectContaining({ id: actorId })]) }),
    ]));
    const assigned = await request("PATCH", `/api/incidents/${incidentId}/assignment`, {
      assignmentGroup: group.name, assigneeId: actorId,
    });
    expect(assigned).toMatchObject({ assignmentGroup: group.name, assigneeId: actorId, assignedToId: actorId });
    const queueReport = await request("GET", `/api/enterprise-reporting/operations?assignmentGroupId=${group.id}`);
    expect(queueReport.itsm.assignmentGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: group.name, openCount: 1 }),
    ]));
    await request("DELETE", `/api/assignment-groups/${group.id}/members/${actorId}`, undefined, 204);
    expect(await request("GET", `/api/assignment-groups/${group.id}/members`)).toEqual([]);
    const categoryOnly = await request("PATCH", `/api/incidents/${incidentId}`, { category: "Connectivity" });
    expect(categoryOnly).toMatchObject({ category: "Connectivity", status: "New", priority: incident.priority });
    const codeOnly = await request("PUT", `/api/incidents/${incidentId}`, { resolutionCode: "Workaround Applied" });
    expect(codeOnly).toMatchObject({ category: "Connectivity", resolutionCode: "Workaround Applied", status: "New" });
    await request("PATCH", `/api/incidents/${incidentId}`, { category: 123 }, 400);
    await request("PATCH", `/api/incidents/${incidentId}`, {}, 400);
    await request("PATCH", `/api/incidents/${incidentId}`, { assignedEngineerId: actorId }, 400);
    await request("PATCH", `/api/incidents/${incidentId}/status`, { status: "Closed" }, 409);

    const started = await request("PATCH", `/api/incidents/${incidentId}/status`, { status: "In Progress" });
    expect(started.firstRespondedAt).toBeTruthy();
    const resolution = { category: "Connectivity", resolutionCode: "Solved (Permanent Fix)", resolutionNotes: "Restored service and verified connectivity." };
    const resolved = await request("PATCH", `/api/incidents/${incidentId}/status`, { status: "Resolved", ...resolution });
    expect(resolved.status).toBe("Resolved");
    expect(resolved.resolvedAt).toBeTruthy();
    const closed = await request("PUT", `/api/incidents/${incidentId}`, {
      status: "Closed", ...resolution, resolutionNotes: "Requester confirmed restoration.",
    });
    expect(closed.status).toBe("Closed");
    expect(closed.closedAt).toBeTruthy();
    expect(closed.resolvedAt).toBe(resolved.resolvedAt);
    const operationsReport = await request("GET", `/api/enterprise-reporting/operations?assignmentGroupId=${group.id}`);
    expect(operationsReport.capabilities).toMatchObject({ itsm: true, itam: true });
    expect(operationsReport.itsm.mttrByPriority).toEqual(expect.arrayContaining([
      expect.objectContaining({ priority: "P2", resolvedCount: expect.any(Number) }),
    ]));
    expect(operationsReport.itam).toHaveProperty("supportContracts.contracts");
    const auditReport = await request("GET", `/api/enterprise-reporting/audit-events?category=itsm&assignmentGroupId=${group.id}`);
    expect(auditReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ tableName: "incidents", action: "UPDATE", summary: expect.stringContaining("status:") }),
      expect.objectContaining({ tableName: "incidents", action: "UPDATE", summary: expect.stringContaining("assignmentGroup:") }),
    ]));
    await request("PATCH", `/api/incidents/${incidentId}`, { resolutionNotes: null }, 400);
    const incidentList = await request("GET", "/api/incidents");
    expect(incidentList.find((row: { id: string }) => row.id === incidentId)).toMatchObject({
      status: "Closed", assigneeId: actorId, category: "Connectivity",
    });

    const updatedProject = await request("PUT", `/api/projects/${projectId}`, {
      ...projectInput, title: `Updated mutation verification ${suffix}`, budget: 1500,
    });
    expect(updatedProject.title).toBe(`Updated mutation verification ${suffix}`);
    const [persistedProject] = await db.select().from(s.projects).where(eq(s.projects.id, projectId!));
    expect(Number(persistedProject.budget)).toBe(1500);

    const updatedContract = await request("PUT", `/api/contracts/${contractId}`, {
      contractName: "Updated mutation test support", renewalNoticeDays: 90,
    });
    expect(updatedContract).toMatchObject({ contractName: "Updated mutation test support", renewalNoticeDays: 90 });
    const contractDetail = await request("GET", `/api/contracts/${contractId}`);
    expect(contractDetail.contractName).toBe("Updated mutation test support");
    console.log(`UI_MUTATIONS_VERIFICATION ${JSON.stringify({
      success: true, passedSteps: results.length, totalSteps: results.length, results,
    })}`);
  }, 60_000);
});
