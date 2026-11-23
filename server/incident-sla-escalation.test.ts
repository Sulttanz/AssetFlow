// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";

const databaseUrl = process.env.DATABASE_URL;
const safeDisposableDatabase = Boolean(databaseUrl &&
  ["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(new URL(databaseUrl).searchParams.get("options") ?? ""));
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && safeDisposableDatabase;

describe.runIf(enabled)("incident SLA breach escalation", () => {
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [adminId, assignedAgentId, groupAgentId, directAgentId] = ids;
  const suffix = randomUUID();
  const adminRoleId = randomUUID();
  const groupName = `SLA Escalation ${suffix}`;
  const incidentIds: string[] = [];
  const policyIds: string[] = [];
  let groupId: number | undefined;
  let server: Server | undefined;
  let baseUrl = "";
  let cookie = "";
  let assignedAgentCookie = "";
  let priorItsmSetting: typeof s.moduleSettings.$inferSelect | undefined;

  async function request(path: string, method = "GET", body?: unknown, sessionCookie = cookie) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { cookie: sessionCookie, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    [priorItsmSetting] = await db.select().from(s.moduleSettings).where(eq(s.moduleSettings.moduleKey, "itsm")).limit(1);
    await db.insert(s.moduleSettings).values({ moduleKey: "itsm", enabled: true }).onConflictDoUpdate({
      target: s.moduleSettings.moduleKey,
      set: { enabled: true },
    });

    const password = randomUUID();
    const passwordHash = await hashPassword(password);
    await db.insert(s.users).values(ids.map((id, index) => ({
      id,
      username: `sla-escalation-${suffix.slice(0, 8)}-${index}`,
      email: `sla-escalation-${suffix.slice(0, 8)}-${index}@example.test`,
      password: passwordHash,
      firstName: ["Admin", "Assigned", "Group", "Direct"][index],
      lastName: "Escalation Test",
      isActive: true,
    })));

    let [adminPermission] = await db.select().from(s.permissions).where(eq(s.permissions.name, "system_admin")).limit(1);
    if (!adminPermission) {
      [adminPermission] = await db.insert(s.permissions).values({
        name: "system_admin",
        description: "Administrator permission for the isolated incident SLA escalation test.",
      }).returning();
    }
    const [adminRole] = await db.insert(s.roles).values({
      id: adminRoleId,
      name: `SLA escalation admin ${suffix}`,
      description: "Disposable role for incident SLA escalation verification.",
    }).returning();
    await db.insert(s.rolePermissions).values({ roleId: adminRole.id, permissionId: adminPermission.id });
    await db.insert(s.userRoles).values({ userId: adminId, roleId: adminRole.id });

    const [agentRole] = await db.select().from(s.roles).where(eq(s.roles.name, "it_agent")).limit(1);
    if (!agentRole) throw new Error("The standard IT agent role was not initialized.");
    await db.insert(s.userRoles).values([assignedAgentId, groupAgentId, directAgentId].map(userId => ({
      userId, roleId: agentRole.id,
    })));
    const [group] = await db.insert(s.assignmentGroups).values({ name: groupName, active: true }).returning();
    groupId = group.id;
    await db.insert(s.assignmentGroupMembers).values({ groupId: group.id, userId: groupAgentId });

    const login = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: `sla-escalation-${suffix.slice(0, 8)}-0`, password }),
    });
    if (login.status !== 200) throw new Error(`Test administrator login returned ${login.status}.`);
    cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (!cookie) throw new Error("Test administrator login did not create a session.");
    const staffLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: `sla-escalation-${suffix.slice(0, 8)}-1`, password }),
    });
    if (staffLogin.status !== 200) throw new Error(`Test IT staff login returned ${staffLogin.status}.`);
    assignedAgentCookie = staffLogin.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (!assignedAgentCookie) throw new Error("Test IT staff login did not create a session.");
  }, 60_000);

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    }
    try {
      await db.delete(s.systemNotifications).where(inArray(s.systemNotifications.userId, ids));
      if (incidentIds.length) await db.delete(s.incidents).where(inArray(s.incidents.id, incidentIds));
      if (policyIds.length) await db.delete(s.slaPolicies).where(inArray(s.slaPolicies.id, policyIds));
      if (groupId) await db.delete(s.assignmentGroups).where(eq(s.assignmentGroups.id, groupId));
      await db.delete(s.auditLogs).where(eq(s.auditLogs.userId, adminId));
      await db.delete(s.userRoles).where(inArray(s.userRoles.userId, ids));
      await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, adminRoleId));
      await db.delete(s.roles).where(eq(s.roles.id, adminRoleId));
      await db.delete(s.users).where(inArray(s.users.id, ids));
      if (priorItsmSetting) {
        await db.update(s.moduleSettings).set({ enabled: priorItsmSetting.enabled, updatedBy: priorItsmSetting.updatedBy })
          .where(eq(s.moduleSettings.moduleKey, "itsm"));
      } else {
        await db.delete(s.moduleSettings).where(eq(s.moduleSettings.moduleKey, "itsm"));
      }
    } finally {
      await pool.end();
    }
  });

  it("configures separate targets, notifies their staff, records activity, and respects the ITSM gate", async () => {
    const options = await request("/api/sla-policies/options");
    expect(options.status).toBe(200);
    expect(options.body.assignmentGroups).toContainEqual(expect.objectContaining({ name: groupName }));
    expect(options.body.staff).toContainEqual(expect.objectContaining({ id: directAgentId }));

    const createdPolicy = await request("/api/sla-policies", "POST", {
      name: `Incident escalation ${suffix}`,
      ticketType: "incident",
      category: null,
      priority: "high",
      responseHours: 2,
      resolutionHours: 4,
      responseEscalationGroup: groupName,
      responseEscalationUserId: directAgentId,
      resolutionEscalationGroup: groupName,
      resolutionEscalationUserId: directAgentId,
      isActive: true,
    });
    expect(createdPolicy.status).toBe(201);
    expect(createdPolicy.body.responseEscalationGroup).toBe(groupName);
    policyIds.push(createdPolicy.body.id);

    const incidentBase = {
      title: `Escalation verification ${suffix}`,
      description: "Disposable incident for escalation verification.",
      urgency: "high",
      impact: "high",
      priority: "P2",
      category: "Network",
      creatorId: adminId,
      requesterId: adminId,
      slaPolicyId: createdPolicy.body.id,
      assignmentGroup: "Unmanaged Legacy Team",
      assigneeId: assignedAgentId,
      assignedToId: assignedAgentId,
    };
    const [responseIncident, resolutionIncident] = await db.insert(s.incidents).values([
      {
        ...incidentBase,
        incidentNumber: `INC-SLA-R-${suffix.slice(0, 8)}`,
        status: "New",
        responseDueAt: new Date(Date.now() - 60_000),
        resolveDueAt: new Date(Date.now() + 86_400_000),
      },
      {
        ...incidentBase,
        incidentNumber: `INC-SLA-L-${suffix.slice(0, 8)}`,
        status: "In Progress",
        firstRespondedAt: new Date(Date.now() - 86_400_000),
        responseDueAt: new Date(Date.now() - 86_400_000),
        resolveDueAt: new Date(Date.now() - 60_000),
      },
    ]).returning();
    incidentIds.push(responseIncident.id, resolutionIncident.id);

    const responseResult = await request(`/api/incidents/${responseIncident.id}/status`, "PATCH", { status: "In Progress" });
    expect(responseResult.status).toBe(200);
    const resolutionResult = await request(`/api/incidents/${resolutionIncident.id}/status`, "PATCH", {
      status: "Resolved",
      category: "Network",
      resolutionCode: "Solved (Permanent Fix)",
      resolutionNotes: "The test incident was restored.",
    });
    expect(resolutionResult.status).toBe(200);

    const notifications = await db.select().from(s.systemNotifications)
      .where(and(eq(s.systemNotifications.type, "incident_sla"), inArray(s.systemNotifications.userId, ids)));
    expect(notifications.filter(row => row.relatedId === responseIncident.id).map(row => row.userId).sort())
      .toEqual([assignedAgentId, directAgentId, groupAgentId].sort());
    expect(notifications.filter(row => row.relatedId === resolutionIncident.id).map(row => row.userId).sort())
      .toEqual([assignedAgentId, directAgentId, groupAgentId].sort());
    const activityRows = await db.select().from(s.incidentActivities)
      .where(inArray(s.incidentActivities.incidentId, incidentIds));
    expect(activityRows.filter(row => row.action === "SLA escalation sent")).toHaveLength(2);
    expect(activityRows.some(row => row.details?.includes(groupName) && row.details.includes("notified"))).toBe(true);
    const staffAlerts = await request("/api/alerts", "GET", undefined, assignedAgentCookie);
    expect(staffAlerts.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "incident_sla", incidentId: responseIncident.id }),
      expect.objectContaining({ type: "incident_sla", incidentId: resolutionIncident.id }),
    ]));

    await db.update(s.moduleSettings).set({ enabled: false }).where(eq(s.moduleSettings.moduleKey, "itsm"));
    const gatedPolicyList = await request("/api/sla-policies");
    expect(gatedPolicyList.status).toBe(403);
    const gatedStaffAlerts = await request("/api/alerts", "GET", undefined, assignedAgentCookie);
    expect(gatedStaffAlerts.body.some((alert: { type: string }) => alert.type === "incident_sla")).toBe(false);
  }, 60_000);
});
