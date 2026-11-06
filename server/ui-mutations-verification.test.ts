// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
    await db.insert(s.permissions).values({
      name: "system_admin", description: "System administrator",
    }).onConflictDoNothing();
    const [permission] = await db.select().from(s.permissions).where(eq(s.permissions.name, "system_admin"));
    await db.insert(s.roles).values({ id: roleId, name: `Mutation Verification ${suffix}` });
    await db.insert(s.rolePermissions).values({ roleId, permissionId: permission.id });
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

    const assigned = await request("PATCH", `/api/incidents/${incidentId}/assignment`, {
      assignmentGroup: "Network", assigneeId: actorId,
    });
    expect(assigned).toMatchObject({ assignmentGroup: "Network", assigneeId: actorId, assignedToId: actorId });
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
