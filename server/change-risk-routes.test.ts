// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { eq, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@shared/schema";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";
import { addReviewFrequency, riskAssessmentInputSchema, IT_RISK_CATEGORIES } from "@shared/risk-management";

const features = vi.hoisted(() => ({ enabled: new Set(["risk_management", "itsm", "cmdb", "asset_management"]) }));
vi.mock("./module-access", async importOriginal => ({
  ...await importOriginal<typeof import("./module-access")>(),
  isFeatureEnabled: async (key: string) => features.enabled.has(key),
}));

describe("Internal IT risk domain boundaries", () => {
  it("has no Project Management dependencies on any risk table", () => {
    const tables = [s.risks, s.riskMitigationActions, s.riskReviewHistory, s.riskApplicationLinks, s.riskServerLinks,
      s.riskNetworkDeviceLinks, s.riskAssetLinks, s.riskVendorLinks, s.riskComplianceReviewLinks, s.riskProblemLinks, s.riskChangeLinks];
    for (const table of tables) for (const fk of getTableConfig(table).foreignKeys) {
      expect(getTableName(fk.reference().foreignTable)).not.toMatch(/^project/);
    }
  });
  it("validates calendar dates and clamps monthly/yearly review dates", () => {
    expect(riskAssessmentInputSchema.safeParse({ title: "Invalid date", category: IT_RISK_CATEGORIES[0], likelihood: 2, impact: 2, nextReviewDate: "2026-02-30" }).success).toBe(false);
    expect(addReviewFrequency(new Date("2028-01-31"), "Monthly").toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(addReviewFrequency(new Date("2028-02-29"), "Annual").toISOString().slice(0, 10)).toBe("2029-02-28");
  });
});

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1";
describe.runIf(enabled)("IT risk API in isolated PostgreSQL", () => {
  const originalUrl = process.env.DATABASE_URL!;
  const schema = `test_it_risk_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let pool: Pool;
  let appPool: Pool;
  let db: typeof import("./db").db;
  let server: Server;
  let base: string;
  const manager = randomUUID(), viewer = randomUUID(), endUser = randomUUID(), engineer = randomUUID();
  let riskId: string;
  const payload = { title: "Core routing resilience", category: IT_RISK_CATEGORIES[0], likelihood: 4, impact: 4, ownerId: engineer };
  const request = async (path: string, method = "GET", body?: unknown, actor: string | null = manager) => {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(actor ? { "x-actor": actor } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    const url = new URL(originalUrl);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.searchParams.get("options")?.includes("test_full_")) throw new Error("An isolated disposable database is required");
    pool = new Pool({ connectionString: originalUrl });
    const client = await pool.connect();
    try { await initializeTestSchema(client, schema); } finally { client.release(); }
    process.env.DATABASE_URL = testDatabaseUrlForSchema(originalUrl, schema);
    const database = await import("./db");
    db = database.db; appPool = database.pool;
    for (const [id, username] of [[manager, "risk-manager"], [viewer, "risk-auditor"], [endUser, "end-user"], [engineer, "engineer"]]) {
      await db.insert(s.users).values({ id, username, email: `${username}@example.test`, password: "not-a-login-fixture", firstName: username, lastName: "Fixture", isActive: true });
    }
    for (const [id, name, permissionName] of [[manager, "Risk Manager", "risk_manage"], [viewer, "Risk Auditor", "compliance_view"]]) {
      const [role] = await db.insert(s.roles).values({ name }).returning();
      const [permission] = await db.insert(s.permissions).values({ name: permissionName, resource: "risks", action: "manage" }).returning();
      await db.insert(s.rolePermissions).values({ roleId: role.id, permissionId: permission.id });
      await db.insert(s.userRoles).values({ userId: id, roleId: role.id });
    }
    const { requireAuth, requireAnyPermission } = await import("./auth");
    const { registerRiskManagementRoutes } = await import("./risk-management");
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => {
      const id = req.get("x-actor"); if (id) req.user = { id } as Express.User;
      req.isAuthenticated = (() => !!id) as any; next();
    });
    registerRiskManagementRoutes(app, requireAuth, requireAnyPermission, (key: string) =>
      (_req, res, next) => features.enabled.has(key) ? next() : res.status(403).json({ code: "FEATURE_NOT_ENABLED" }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  }, 60000);
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (appPool) await appPool.end();
    process.env.DATABASE_URL = originalUrl;
    if (pool) { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
  });
  it("creates concurrently numbered IT risks with atomic score history and audit", async () => {
    const results = await Promise.all([1, 2, 3].map(n => request("/api/risks", "POST", { ...payload, title: `${payload.title} ${n}` })));
    expect(results.map(result => result.status)).toEqual([201, 201, 201]);
    expect(results.map(result => result.body.riskNumber).sort()).toEqual(["IT-RSK-001", "IT-RSK-002", "IT-RSK-003"]);
    riskId = results[0].body.id;
    expect(results[0].body.riskScore).toBe(16);
    const result = await request(`/api/risks/${riskId}`);
    expect(result.body.owner.id).toBe(engineer);
    expect(result.body.reviewHistory).toHaveLength(1);
  });
  it("enforces acceptance at the configured threshold and records actor/timestamp", async () => {
    const invalid = await request(`/api/risks/${riskId}`, "PUT", { treatmentStrategy: "Accept", residualImpact: 4, residualLikelihood: 3 });
    expect(invalid.status).toBe(400);
    const expiry = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const accepted = await request(`/api/risks/${riskId}`, "PUT", { treatmentStrategy: "Accept", status: "accepted", residualImpact: 4, residualLikelihood: 3, acceptanceJustification: "Approved compensating controls and planned remediation", acceptanceExpiresAt: expiry });
    expect(accepted.status).toBe(200); expect(accepted.body.acceptedByUserId).toBe(manager); expect(accepted.body.acceptedAt).toBeTruthy();
    expect((await request(`/api/risks/${riskId}`, "PUT", { acceptanceJustification: "" })).status).toBe(400);
    expect((await request(`/api/risks/${riskId}`, "PUT", { acceptanceExpiresAt: "2020-01-01" })).status).toBe(400);
    expect((await request("/api/risks", "POST", { ...payload, projectId: randomUUID() })).status).toBe(400);
    expect((await request("/api/risks", "POST", { ...payload, impact: 6 })).status).toBe(400);
  });
  it("makes appetite configurable and prevents forged acceptance identity", async () => {
    expect((await request("/api/risk-management/settings", "PUT", { appetiteThreshold: 8 })).status).toBe(200);
    expect((await request("/api/risk-management/settings")).body.appetiteThreshold).toBe(8);
    expect((await request("/api/risks", "POST", { ...payload, acceptedByUserId: engineer })).status).toBe(400);
    expect((await request("/api/risk-management/settings", "PUT", { appetiteThreshold: 12 })).status).toBe(200);
  });
  it("tracks overdue actions, completion, reopening and audit", async () => {
    const created = await request(`/api/risks/${riskId}/actions`, "POST", { title: "Deploy HA router", ownerUserId: engineer, dueDate: "2020-01-01" });
    expect(created.status).toBe(201);
    const path = `/api/risks/${riskId}/actions/${created.body.id}`;
    expect((await request(`/api/risks/${riskId}`)).body.mitigationActions[0].status).toBe("Overdue");
    const completed = await request(path, "PUT", { status: "Completed", evidenceNotes: "Failover test evidence verified" });
    expect(completed.body.completedAt).toBeTruthy();
    expect((await request(path, "PUT", { status: "In Progress" })).body.completedAt).toBeNull();
    expect((await request(`/api/risks/${riskId}/actions/${randomUUID()}`, "PUT", { title: "Missing" })).status).toBe(404);
    const audits = await db.select().from(s.auditLogs).where(eq(s.auditLogs.recordId, riskId));
    expect(audits.some(row => row.action === "UPDATE_MITIGATION_ACTION")).toBe(true);
  });
  it("records review signoffs and advances cadence without editing the score", async () => {
    const review = await request(`/api/risks/${riskId}/reviews`, "POST", { notes: "Quarterly engineering review signed off" });
    expect(review.status).toBe(201);
    expect(review.body.risk.riskScore).toBe(16);
    expect(review.body.risk.nextReviewDate).toBe(addReviewFrequency(new Date(), "Quarterly").toISOString().slice(0, 10));
    expect(review.body.history.reviewedById).toBe(manager);
  });
  it("allows auditors to read but blocks them and end users from mutation", async () => {
    expect((await request("/api/risks", "GET", undefined, viewer)).status).toBe(200);
    expect((await request("/api/risks", "POST", payload, viewer)).status).toBe(403);
    expect((await request("/api/risks", "GET", undefined, endUser)).status).toBe(403);
    expect((await request("/api/risks", "GET", undefined, null)).status).toBe(401);
  });
  it("links IT infrastructure and spawns idempotent internal changes/problems without projects", async () => {
    const [serverRow] = await db.insert(s.servers).values({ hostname: "risk-server", osPlatform: "Linux", environment: "production" }).returning();
    expect((await request(`/api/risks/${riskId}/links`, "POST", { type: "servers", targetId: serverRow.id })).status).toBe(201);
    expect((await request(`/api/risks/${riskId}`)).body.links.servers).toEqual([serverRow.id]);
    const change = await request(`/api/risks/${riskId}/spawn-change`, "POST", {});
    expect(change.status).toBe(201); expect(change.body.projectId).toBeNull();
    expect((await request(`/api/risks/${riskId}/spawn-change`, "POST", {})).body.id).toBe(change.body.id);
    const problem = await request(`/api/risks/${riskId}/spawn-problem`, "POST", {});
    expect(problem.status).toBe(201);
    expect((await request(`/api/risks/${riskId}/spawn-problem`, "POST", {})).body.id).toBe(problem.body.id);
    const loaded = await db.query.risks.findFirst({
      where: eq(s.risks.id, riskId),
      with: { owner: true, acceptedBy: true, mitigationActions: true, reviewHistory: true,
        applicationLinks: true, serverLinks: { with: { server: true } }, networkDeviceLinks: true,
        assetLinks: true, vendorLinks: true, complianceReviewLinks: true, problemLinks: true, changeLinks: true },
    });
    expect(loaded?.serverLinks[0].server.hostname).toBe("risk-server");
    expect(loaded?.mitigationActions).toHaveLength(1);
  });
  it("works with Project Management and optional IT modules unavailable", async () => {
    features.enabled = new Set(["risk_management"]);
    const tables = ["projects", "project_risks", "changes", "problems", "assets", "vendors", "servers", "cmdb_applications", "network_devices", "it_component_compliance_reviews"];
    try {
      for (const name of tables) await pool.query(`ALTER TABLE "${schema}"."${name}" RENAME TO "unavailable_${name}"`);
      expect((await request("/api/risks")).status).toBe(200);
      const options = await request("/api/risks/options");
      expect(options.status).toBe(200); expect(options.body.servers).toEqual([]);
      expect((await request("/api/risks", "POST", payload)).status).toBe(201);
      expect((await request(`/api/risks/${riskId}/spawn-change`, "POST", {})).status).toBe(403);
    } finally {
      for (const name of tables.reverse()) await pool.query(`ALTER TABLE "${schema}"."unavailable_${name}" RENAME TO "${name}"`);
      features.enabled = new Set(["risk_management", "itsm", "cmdb", "asset_management"]);
    }
  });
  it("rolls back assessment writes when the audit insert fails", async () => {
    const trigger = `CREATE FUNCTION "${schema}".fail_risk_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'risk audit failure'; END $$`;
    await pool.query(trigger);
    await pool.query(`CREATE TRIGGER fail_risk_audit BEFORE INSERT ON "${schema}".audit_logs FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_risk_audit()`);
    try {
      const response = await request(`/api/risks/${riskId}`, "PUT", { title: "Must not persist" });
      expect(response.status).toBe(500);
      expect((await request(`/api/risks/${riskId}`)).body.title).not.toBe("Must not persist");
    } finally { await pool.query(`DROP TRIGGER fail_risk_audit ON "${schema}".audit_logs`); }
  });
  it("keeps risk numbers unique and untruncated after 999", async () => {
    await pool.query(`SELECT setval('"${schema}".risk_register_number_seq'::regclass, 999)`);
    const result = await request("/api/risks", "POST", payload);
    expect(result.status).toBe(201);
    expect(result.body.riskNumber).toBe("IT-RSK-1000");
  });
});
