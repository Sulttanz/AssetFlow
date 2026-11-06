// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { toDateInputValue } from "@shared/date-format";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";
import { runContractRenewalCheck } from "./services/contract-renewal-checker";

const databaseUrl = process.env.DATABASE_URL;
const options = databaseUrl ? new URL(databaseUrl).searchParams.get("options") ?? "" : "";
const safeDisposableDatabase = Boolean(
  databaseUrl &&
  ["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(options),
);
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  safeDisposableDatabase;

describe.runIf(enabled)("Service Contract & SLA end-to-end verification", () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const managerId = randomUUID();
  const adminId = randomUUID();
  const projectId = randomUUID();
  const testRoleId = randomUUID();
  const incidentIds: string[] = [];
  let contractId: number | undefined;
  let policyIds: string[] = [];
  let permissionId: string | undefined;
  let server: Server | undefined;
  let baseUrl = "";
  let cookie = "";

  const results: Array<{ step: string; status: "PASS" | "FAIL" | "SKIP"; details: string }> = [];
  const recordStep = async (step: string, action: () => Promise<string>) => {
    try {
      const details = await action();
      results.push({ step, status: "PASS", details });
      console.log(`[PASS] ${step}: ${details}`);
      return true;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      results.push({ step, status: "FAIL", details });
      console.error(`[FAIL] ${step}: ${details}`);
      return false;
    }
  };

  const skipStep = (step: string, reason: string) => {
    results.push({ step, status: "SKIP", details: reason });
    console.warn(`[SKIP] ${step}: ${reason}`);
  };

  const createIncident = async (title: string) => {
    const response = await fetch(`${baseUrl}/api/incidents`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title,
        description: "Disposable contract/SLA verification incident.",
        urgency: "medium",
        impact: "medium",
        priority: "P3",
        category: "Hardware",
        projectId,
      }),
    });
    const body = await response.json();
    if (response.status !== 201) {
      throw new Error(`POST /api/incidents returned ${response.status}: ${JSON.stringify(body)}`);
    }
    incidentIds.push(body.id);
    return body;
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 60_000);

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close(error => error ? reject(error) : resolve()),
      );
    }
    await pool.end();
  });

  it("runs all verification phases and emits a machine-readable result", async () => {
    let startDate = "";
    let futureDate = "";
    let baselinePolicyId = "";
    let contractPolicyId = "";
    let actorUsername = "";
    let actorPassword = "";

    const schemaAndCrudPassed = await recordStep("1. DB Schema & CRUD", async () => {
      const now = new Date();
      startDate = toDateInputValue(now);
      const oneYear = new Date(now);
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      futureDate = toDateInputValue(oneYear);
      actorUsername = `verify-contracts-${suffix.slice(0, 8)}`;
      actorPassword = `temporary-${randomUUID()}`;
      const passwordHash = await hashPassword(actorPassword);

      const [contractPolicy, baselinePolicy] = await db.insert(s.slaPolicies).values([
        {
          name: `Contract SLA verification ${suffix}`,
          ticketType: "incident",
          priority: "critical",
          responseHours: 1,
          resolutionHours: 4,
          isActive: true,
        },
        {
          name: `Baseline SLA verification ${suffix}`,
          ticketType: "incident",
          priority: "medium",
          responseHours: 8,
          resolutionHours: 40,
          isActive: true,
        },
      ]).returning();
      contractPolicyId = contractPolicy.id;
      baselinePolicyId = baselinePolicy.id;
      policyIds = [contractPolicyId, baselinePolicyId];

      await db.insert(s.users).values([
        {
          id: actorId,
          username: actorUsername,
          email: `${actorUsername}@example.test`,
          password: passwordHash,
          firstName: "Contract",
          lastName: "Verifier",
          isActive: true,
        },
        {
          id: managerId,
          username: `verify-manager-${suffix.slice(0, 8)}`,
          email: `verify-manager-${suffix.slice(0, 8)}@example.test`,
          password: passwordHash,
          firstName: "Project",
          lastName: "Manager",
          isActive: true,
        },
        {
          id: adminId,
          username: `verify-admin-${suffix.slice(0, 8)}`,
          email: `verify-admin-${suffix.slice(0, 8)}@example.test`,
          password: passwordHash,
          firstName: "System",
          lastName: "Administrator",
          isActive: true,
        },
      ]);
      await db.insert(s.projects).values({
        id: projectId,
        name: `Contract SLA verification ${suffix}`,
        title: `Contract SLA verification ${suffix}`,
      });
      await db.insert(s.projectManagers).values({ projectId, userId: managerId, isPrimary: true });

      const [systemPermission] = await db.select().from(s.permissions)
        .where(eq(s.permissions.name, "system_admin")).limit(1);
      if (systemPermission) permissionId = systemPermission.id;
      else {
        const [created] = await db.insert(s.permissions).values({
          name: "system_admin",
          description: "System administrator permission for isolated contract verification.",
        }).returning();
        permissionId = created.id;
      }
      await db.insert(s.roles).values({
        id: testRoleId,
        name: `Contract Verification Admin ${suffix}`,
        description: "Disposable role for the contract SLA verification runner.",
      });
      await db.insert(s.rolePermissions).values({ roleId: testRoleId, permissionId });
      await db.insert(s.userRoles).values({ userId: adminId, roleId: testRoleId });

      const contractStart = startDate;
      const [contract] = await db.insert(s.serviceContracts).values({
        contractNumber: `VERIFY-${suffix.slice(0, 12)}`,
        contractName: `Disposable SLA verification ${suffix}`,
        projectId,
        slaPolicyId: contractPolicyId,
        startDate: contractStart,
        endDate: futureDate,
        renewalNoticeDays: 60,
        status: "active",
      }).returning();
      contractId = contract.id;
      if (contract.status !== "active") throw new Error(`Expected active, received ${contract.status}`);

      const login = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: actorUsername, password: actorPassword }),
      });
      if (login.status !== 200) throw new Error(`Test account login returned ${login.status}`);
      cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
      if (!cookie) throw new Error("Login did not return a session cookie.");

      return `Created project, two SLA policies, active contract #${contract.id}, and isolated test recipients.`;
    });

    if (schemaAndCrudPassed) {
      await recordStep("2. Active Contract ITSM Binding", async () => {
        const incident = await createIncident(`Active contract binding ${suffix}`);
        if (incident.contractId !== contractId) throw new Error(`Expected contractId ${contractId}, got ${incident.contractId}`);
        if (incident.slaPolicyId !== contractPolicyId) {
          throw new Error(`Expected inherited SLA ${contractPolicyId}, got ${incident.slaPolicyId}`);
        }
        return `Incident ${incident.incidentNumber} inherited contract #${contractId} and its SLA policy.`;
      });
    } else {
      skipStep("2. Active Contract ITSM Binding", "Fixture setup did not complete.");
    }

    if (schemaAndCrudPassed && contractId !== undefined) {
      await recordStep("3. Expired Contract & Warranty", async () => {
        const now = new Date();
        const oldStart = new Date(now);
        oldStart.setFullYear(oldStart.getFullYear() - 1);
        const pastEnd = new Date(now);
        pastEnd.setDate(pastEnd.getDate() - 10);
        await db.update(s.serviceContracts).set({
          startDate: toDateInputValue(oldStart),
          endDate: toDateInputValue(pastEnd),
          status: "active",
        }).where(eq(s.serviceContracts.id, contractId!));
        const incident = await createIncident(`Expired contract warning ${suffix}`);
        if (incident.isWarrantyExpired !== true) throw new Error("Incident did not set isWarrantyExpired=true.");
        if (incident.contractId !== null) throw new Error("Expired contract should not be bound as an active contract.");
        if (incident.slaPolicyId !== baselinePolicyId) {
          throw new Error(`Expected baseline SLA ${baselinePolicyId}, got ${incident.slaPolicyId}`);
        }
        return `Incident ${incident.incidentNumber} was flagged out of warranty and used the baseline SLA.`;
      });
    } else {
      skipStep("3. Expired Contract & Warranty", "Fixture setup did not complete.");
    }

    if (schemaAndCrudPassed && contractId !== undefined) {
      await recordStep("4. Renewal Engine & Admin/Manager Notifications", async () => {
        const now = new Date();
        const oldStart = new Date(now);
        oldStart.setDate(oldStart.getDate() - 30);
        const noticeEnd = new Date(now);
        noticeEnd.setDate(noticeEnd.getDate() + 15);
        await db.update(s.serviceContracts).set({
          startDate: toDateInputValue(oldStart),
          endDate: toDateInputValue(noticeEnd),
          renewalNoticeDays: 60,
          status: "active",
        }).where(eq(s.serviceContracts.id, contractId!));

        const transitions = await runContractRenewalCheck(now, db);
        if (!transitions.some(item => item.id === contractId && item.status === "near_expiration")) {
          throw new Error("Renewal checker did not transition the contract to near_expiration.");
        }
        const [updated] = await db.select().from(s.serviceContracts)
          .where(eq(s.serviceContracts.id, contractId!)).limit(1);
        if (updated?.status !== "near_expiration") throw new Error(`Database status is ${updated?.status ?? "missing"}.`);

        const notifications = await db.select().from(s.systemNotifications).where(and(
          eq(s.systemNotifications.type, "service_contract"),
          eq(s.systemNotifications.relatedId, String(contractId)),
          inArray(s.systemNotifications.userId, [adminId, managerId]),
        ));
        const recipients = new Set(notifications.map(notification => notification.userId));
        if (!recipients.has(adminId)) throw new Error("No admin renewal notification was persisted.");
        if (!recipients.has(managerId)) throw new Error("No project-manager renewal notification was persisted.");
        for (const recipient of [adminId, managerId]) {
          const username = recipient === adminId
            ? `verify-admin-${suffix.slice(0, 8)}`
            : `verify-manager-${suffix.slice(0, 8)}`;
          const login = await fetch(`${baseUrl}/api/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: actorPassword }),
          });
          if (login.status !== 200) throw new Error(`Recipient login returned ${login.status}.`);
          const recipientCookie = login.headers.get("set-cookie")?.split(";")[0];
          if (!recipientCookie) throw new Error("Recipient login did not return a session cookie.");
          const alertsResponse = await fetch(`${baseUrl}/api/alerts`, { headers: { cookie: recipientCookie } });
          const alerts = await alertsResponse.json();
          if (alertsResponse.status !== 200 || !alerts.some((alert: any) =>
            alert.type === "service_contract" && alert.contractId === contractId)) {
            throw new Error(`The ${recipient === adminId ? "admin" : "project manager"} alert was not returned by /api/alerts.`);
          }
        }
        return `Status changed to near_expiration; persisted notifications reached ${recipients.size} admin/manager recipient(s).`;
      });
    } else {
      skipStep("4. Renewal Engine & Admin/Manager Notifications", "Fixture setup did not complete.");
    }

    const cleanupPassed = await recordStep("5. Cleanup", async () => {
      const testUserIds = [actorId, managerId, adminId];
      await db.delete(s.systemNotifications).where(inArray(s.systemNotifications.userId, testUserIds));
      if (incidentIds.length) {
        await db.delete(s.auditLogs).where(and(
          eq(s.auditLogs.tableName, "incidents"),
          inArray(s.auditLogs.recordId, incidentIds),
        ));
        await db.delete(s.incidents).where(inArray(s.incidents.id, incidentIds));
      }
      if (contractId !== undefined) {
        await db.delete(s.auditLogs).where(and(
          eq(s.auditLogs.tableName, "service_contracts"),
          eq(s.auditLogs.recordId, String(contractId)),
        ));
        await db.delete(s.serviceContracts).where(eq(s.serviceContracts.id, contractId));
      }
      await db.delete(s.projectManagers).where(eq(s.projectManagers.projectId, projectId));
      await db.delete(s.projects).where(eq(s.projects.id, projectId));
      if (policyIds.length) await db.delete(s.slaPolicies).where(inArray(s.slaPolicies.id, policyIds));
      await db.delete(s.userRoles).where(eq(s.userRoles.roleId, testRoleId));
      await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, testRoleId));
      await db.delete(s.roles).where(eq(s.roles.id, testRoleId));
      // system_admin is shared reference data, not a fixture-owned row.
      // Other parallel suites may already reference it; the disposable cluster
      // removes this catalog entry after every suite has finished.
      await db.delete(s.users).where(inArray(s.users.id, testUserIds));
      return "Deleted test incidents, notifications, contract, project, SLA policies, role, and users.";
    });

    const summary = {
      success: results.length === 5 && results.every(result => result.status === "PASS"),
      passedSteps: results.filter(result => result.status === "PASS").length,
      totalSteps: 5,
      results,
    };
    console.log(`CONTRACTS_SLA_VERIFICATION ${JSON.stringify(summary)}`);
    expect(cleanupPassed).toBe(true);
    expect(summary).toMatchObject({ success: true, passedSteps: 5, totalSteps: 5 });
  }, 60_000);
});
