// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as s from "@shared/schema";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" && process.env.VITEST_NATIVE_PG === "1";
describe.runIf(enabled)("Project delivery governance in isolated PostgreSQL", () => {
  const schema = `test_projects_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const originalUrl = process.env.DATABASE_URL;
  const originalUploadRoot = process.env.PROJECT_DOCUMENT_UPLOAD_DIR;
  const manager = randomUUID();
  const member = randomUUID();
  const other = randomUUID();
  const demo = randomUUID();
  const admin = randomUUID();
  const project = randomUUID();
  let setupPool: Pool;
  let appPool: Pool;
  let db: typeof import("./db").db;
  let storage: typeof import("./storage").storage;
  let server: Server;
  let base = "";
  let uploadRoot = "";
  let taskId = "";
  let riskId = "";

  const request = (url: string, method = "GET", body?: unknown, actor = manager) => fetch(`${base}${url}`, {
    method,
    headers: { "x-test-user": actor, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const prefix = `/api/projects/${project}`;

  beforeAll(async () => {
    if (!originalUrl) throw new Error("A disposable test database is required.");
    const url = new URL(originalUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.searchParams.get("options")?.includes("test_full_")) {
      throw new Error("Refusing project integration tests outside the disposable full-suite database.");
    }
    setupPool = new Pool({ connectionString: originalUrl });
    const client = await setupPool.connect();
    try { await initializeTestSchema(client, schema); } finally { client.release(); }
    process.env.DATABASE_URL = testDatabaseUrlForSchema(originalUrl, schema);
    uploadRoot = await mkdtemp(path.join(tmpdir(), "project-documents-test-"));
    process.env.PROJECT_DOCUMENT_UPLOAD_DIR = uploadRoot;
    const database = await import("./db");
    db = database.db;
    appPool = database.pool;
    storage = (await import("./storage")).storage;
    await db.insert(s.users).values([manager, member, other, demo, admin].map((id, index) => ({
      id, username: `project-test-${index}`, email: `project-${index}@example.test`, password: "not-a-login",
      firstName: `Project user ${index}`, lastName: "Test",
    })));
    await db.insert(s.projects).values({ id: project, name: "Workspace fixture", title: "Workspace fixture", budget: "10000.00" });
    await db.insert(s.projectManagers).values([
      { projectId: project, userId: manager, isPrimary: true },
      { projectId: project, userId: demo, isPrimary: false },
    ]);
    await db.insert(s.projectTeamMembers).values({ projectId: project, userId: member, roleTitle: "Engineer" });
    const app = express();
    app.use(express.json());
    const { registerProjectWorkspaceRoutes } = await import("./project-workspace");
    registerProjectWorkspaceRoutes(app, (req, res, next) => {
      const id = req.get("x-test-user");
      if (!id) return void res.status(401).json({ message: "Authentication required." });
      req.user = { id } as Express.User;
      next();
    }, (_req, _res, next) => next());
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.on("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 60_000);

  beforeEach(() => {
    vi.spyOn(storage, "getUserRoles").mockImplementation(async id =>
      [{ id: `${id}-role`, name: id === demo ? "Demo Viewer" : id === admin ? "admin" : "project_member", description: null }] as any);
    vi.spyOn(storage, "getUserPermissions").mockImplementation(async id =>
      id === admin ? ["system_admin"] : id === demo ? ["project_view"] : []);
  });

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (appPool) await appPool.end();
    if (setupPool) {
      await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await setupPool.end();
    }
    if (uploadRoot) await rm(uploadRoot, { recursive: true, force: true });
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalUploadRoot === undefined) delete process.env.PROJECT_DOCUMENT_UPLOAD_DIR;
    else process.env.PROJECT_DOCUMENT_UPLOAD_DIR = originalUploadRoot;
    vi.restoreAllMocks();
  });

  it("allows assigned managers to create work and limits assignees to status and hours", async () => {
    const created = await request(`${prefix}/tasks`, "POST", {
      title: "Validate deployment", assigneeId: member, estimatedHours: 8, dueDate: "2027-01-01",
    });
    expect(created.status).toBe(201);
    taskId = (await created.json()).id;
    expect((await request(`${prefix}/tasks/${taskId}`, "PATCH", { status: "In Progress", loggedHours: 2.5 }, member)).status).toBe(200);
    expect((await request(`${prefix}/tasks/${taskId}`, "PATCH", { assigneeId: other }, member)).status).toBe(400);
    expect((await request(`${prefix}/tasks/${taskId}`, "PATCH", { loggedHours: 100 }, other)).status).toBe(403);
    expect((await request(`${prefix}/tasks/reorder`, "PATCH", { taskIds: [taskId] })).status).toBe(200);
    const rows = await (await request(`${prefix}/tasks?assigneeId=${member}`)).json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ assigneeId: member, loggedHours: "2.50", status: "In Progress" });
    expect((await request(`${prefix}/tasks/${taskId}`, "PATCH", { status: "In Review" })).status).toBe(200);
    const [unchangedHours] = await db.select().from(s.projectTasks).where(eq(s.projectTasks.id, taskId));
    expect(unchangedHours).toMatchObject({ loggedHours: "2.50", estimatedHours: "8.00" });
  });

  it("keeps demo accounts read-only even when assigned as a project manager", async () => {
    expect((await request(`${prefix}/tasks/${taskId}`, "DELETE", undefined, demo)).status).toBe(403);
    expect((await request(`${prefix}/tasks/${taskId}`, "PATCH", { status: "Done" }, demo)).status).toBe(403);
    expect((await request(`${prefix}/tasks`, "GET", undefined, other)).status).toBe(403);
  });

  it("generates risk scores in PostgreSQL and enforces owner field boundaries", async () => {
    const created = await request(`${prefix}/risks`, "POST", {
      title: "Cutover failure", probability: 4, impact: 5, ownerId: member,
    });
    expect(created.status).toBe(201);
    const risk = await created.json();
    riskId = risk.id;
    expect(risk.riskScore).toBe(20);
    expect((await request(`${prefix}/risks/${riskId}`, "PATCH", { impact: 1 }, member)).status).toBe(403);
    const nextReviewDate = new Date();
    nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + 1);
    const nextReview = nextReviewDate.toISOString().slice(0, 10);
    expect((await request(`${prefix}/risks/${riskId}`, "PATCH", {
      status: "Mitigated", mitigationStrategy: "Verified rollback plan", reviewDate: nextReview,
    }, member)).status).toBe(200);
    const [ownerUpdatedRisk] = await db.select().from(s.projectRisks).where(eq(s.projectRisks.id, riskId));
    expect(ownerUpdatedRisk.reviewDate).toBe(nextReview);
    const changed = await request(`${prefix}/risks/${riskId}`, "PATCH", { impact: 2 });
    expect((await changed.json()).riskScore).toBe(8);
    const dueRiskDate = new Date();
    dueRiskDate.setUTCDate(dueRiskDate.getUTCDate() + 3);
    const dueDate = dueRiskDate.toISOString().slice(0, 10);
    expect((await request(`${prefix}/risks/${riskId}`, "PATCH", { status: "Identified", reviewDate: dueDate })).status).toBe(200);
    const queue = await (await request("/api/projects/risk-reviews/queue?filter=due-soon", "GET", undefined, member)).json();
    expect(queue).toMatchObject({
      dueSoonCount: 1,
      overdueCount: 0,
      reviews: [expect.objectContaining({ id: riskId, projectId: project, reviewDate: dueDate })],
    });
    expect(await (await request("/api/projects/risk-reviews/queue", "GET", undefined, other)).json())
      .toMatchObject({ dueSoonCount: 0, overdueCount: 0, reviews: [] });
    expect((await request(`${prefix}/risks/${riskId}`, "DELETE", undefined, demo)).status).toBe(403);
    expect((await request(`/api/projects/${randomUUID()}/risks/${riskId}`, "PATCH", { impact: 1 })).status).toBe(404);
  });

  it("enforces the RFC lifecycle and prevents edits after submission", async () => {
    const created = await request(`${prefix}/changes`, "POST", { rfcNumber: "PRFC-TEST-001", title: "Upgrade production" });
    expect(created.status).toBe(201);
    const id = (await created.json()).id;
    const url = `${prefix}/changes/${id}`;
    expect((await request(`${url}/status`, "POST", { status: "Implemented" })).status).toBe(409);
    expect((await request(url, "PATCH", { reason: "Required security update" })).status).toBe(200);
    for (const status of ["Submitted", "Approved", "Implemented"]) {
      expect((await request(`${url}/status`, "POST", { status })).status).toBe(200);
    }
    expect((await request(url, "PATCH", { title: "Rewritten after approval" })).status).toBe(409);
    expect((await request(url, "DELETE")).status).toBe(409);
  });

  it("creates one linked project task after the project change receives its final approval", async () => {
    const change = await storage.createChange({
      changeNumber: `CHG-${randomUUID().slice(0, 8)}`,
      title: "Apply approved project configuration",
      description: "Test project change",
      type: "normal",
      status: "submitted",
      priority: "medium",
      risk: "low",
      cabRequired: true,
      projectId: project,
      requestedById: member,
    });
    const approval = await storage.createChangeApproval({
      changeId: change.id,
      approverId: manager,
      decision: "pending",
    });
    const result = await storage.updateChangeApproval(change.id, approval.id, "approved", "Approved for delivery");
    expect(result?.decision).toBe("approved");

    const linkedTasks = await db.select().from(s.projectTasks).where(eq(s.projectTasks.changeRequestId, change.id));
    expect(linkedTasks).toHaveLength(1);
    expect(linkedTasks[0]).toMatchObject({
      projectId: project,
      status: "To Do",
      title: expect.stringContaining(change.changeNumber),
    });

    // Repeating the approval completion path cannot duplicate the task.
    await storage.updateChangeWithCabStatusGuard(change.id, { status: "approved" });
    expect(await db.select().from(s.projectTasks).where(eq(s.projectTasks.changeRequestId, change.id))).toHaveLength(1);
  });

  it("stores versioned documents, protects downloads, and records audit entries", async () => {
    const body = new FormData();
    body.set("file", new Blob(["Approved project charter"], { type: "text/plain" }), "charter.txt");
    body.set("name", "Project charter");
    body.set("category", "Charter");
    body.set("version", "1.0");
    const created = await fetch(`${base}${prefix}/documents`, { method: "POST", headers: { "x-test-user": manager }, body });
    expect(created.status).toBe(201);
    const doc = await created.json();
    expect(doc.version).toBe("1.0");
    expect(doc.filePath).toBeUndefined();
    expect((await request(`${prefix}/documents/${doc.id}`, "PATCH", { category: "SOW", version: "1.1" }, demo)).status).toBe(403);
    const edited = await request(`${prefix}/documents/${doc.id}`, "PATCH", { category: "SOW", version: "1.1" });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ version: "1.1", category: "SOW" });
    const download = await request(doc.fileUrl, "GET", undefined, member);
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("Approved project charter");
    expect((await request(doc.fileUrl, "GET", undefined, other)).status).toBe(403);
    expect((await request(`${prefix}/documents/${doc.id}`, "DELETE", undefined, demo)).status).toBe(403);
    expect((await request(`${prefix}/documents/${doc.id}`, "DELETE")).status).toBe(200);
    const audit = await db.select().from(s.auditLogs).where(eq(s.auditLogs.tableName, "project_documents"));
    expect(audit.map(entry => entry.action)).toEqual(expect.arrayContaining(["CREATE", "UPDATE", "DELETE"]));
    expect(audit.every(entry => entry.userId === manager && entry.ipAddress)).toBe(true);
  });

  it("reports project membership and task workloads without granting universal reporting access", async () => {
    expect((await request("/api/reports/project-allocations", "GET", undefined, member)).status).toBe(403);
    const report = await (await request("/api/reports/project-allocations", "GET", undefined, admin)).json();
    expect(report.rows.find((row: { userId: string }) => row.userId === member)).toMatchObject({
      taskCount: 1, estimatedHours: 8, loggedHours: 2.5, projectCount: 1,
    });
  });
});
