// @vitest-environment node
import express, { type RequestHandler } from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { db, pool } from "./db";
import { registerBackupGovernanceRoutes } from "./backup-governance";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && Boolean(url &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /search_path=test_full_[a-z0-9_]+/.test(url.searchParams.get("options") ?? ""));

describe.runIf(enabled)("Backup evidence attachments over HTTP", () => {
  const managerId = randomUUID();
  const auditorId = randomUUID();
  const applicationId = randomUUID();
  const scheduleId = randomUUID();
  const runId = randomUUID();
  const restoreTestId = randomUUID();
  const createdRoleIds: string[] = [];
  let server: Server | undefined;
  let base = "";

  const request = (path: string, userId = managerId) =>
    fetch(`${base}${path}`, { headers: { "x-test-user": userId } });
  const upload = (path: string, userId: string, name: string, content: string, mimeType: string) => {
    const body = new FormData();
    body.append("file", new Blob([content], { type: mimeType }), name);
    return fetch(`${base}${path}`, { method: "POST", headers: { "x-test-user": userId }, body });
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const auth: RequestHandler = (req, res, next) => {
      const id = req.get("x-test-user");
      if (!id) return void res.status(401).json({ message: "Authentication required" });
      (req as any).user = { id };
      next();
    };
    const enabledModule: RequestHandler = (_req, _res, next) => next();
    registerBackupGovernanceRoutes(app, auth, enabledModule);
    server = await new Promise<Server>(resolve => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    await db.insert(s.users).values([
      { id: managerId, username: `backup-manager-${managerId}`, email: `${managerId}@example.test`, password: "test", firstName: "Backup", lastName: "Manager" },
      { id: auditorId, username: `backup-auditor-${auditorId}`, email: `${auditorId}@example.test`, password: "test", firstName: "Backup", lastName: "Auditor" },
    ]);
    for (const name of ["it_manager", "auditor"]) {
      const [existing] = await db.select({ id: s.roles.id }).from(s.roles).where(eq(s.roles.name, name)).limit(1);
      if (!existing) {
        const [created] = await db.insert(s.roles).values({ name }).returning({ id: s.roles.id });
        createdRoleIds.push(created.id);
      }
    }
    const roleRows = await db.select({ id: s.roles.id, name: s.roles.name }).from(s.roles)
      .where(inArray(s.roles.name, ["it_manager", "auditor"]));
    await db.insert(s.userRoles).values([
      { userId: managerId, roleId: roleRows.find(role => role.name === "it_manager")!.id },
      { userId: auditorId, roleId: roleRows.find(role => role.name === "auditor")!.id },
    ]);
    await db.insert(s.cmdbApplications).values({
      id: applicationId, name: `Backup evidence app ${applicationId}`, category: "Business", hostingType: "saas",
    });
    await db.insert(s.backupSchedules).values({
      id: scheduleId, name: `Backup evidence schedule ${scheduleId}`, applicationId,
      backupType: "full", frequency: "daily", retentionDays: 30, destination: "Test vault",
    });
    await db.insert(s.backupJobRuns).values({
      id: runId, scheduleId, status: "success", startedAt: new Date(), notes: "Integration backup evidence",
    });
    await db.insert(s.backupRestoreTests).values({
      id: restoreTestId, scheduleId, outcome: "passed", notes: "Integration restore evidence",
    });
  }, 60000);

  afterAll(async () => {
    try {
      const files = await db.select().from(s.backupEvidenceAttachments).where(inArray(
        s.backupEvidenceAttachments.jobRunId, [runId],
      ));
      const restoreFiles = await db.select().from(s.backupEvidenceAttachments).where(eq(
        s.backupEvidenceAttachments.restoreTestId, restoreTestId,
      ));
      for (const file of [...files, ...restoreFiles]) await unlink(file.filePath).catch(() => {});
      await db.delete(s.auditLogs).where(inArray(s.auditLogs.userId, [managerId, auditorId]));
      await db.delete(s.backupEvidenceAttachments).where(inArray(
        s.backupEvidenceAttachments.jobRunId, [runId],
      ));
      await db.delete(s.backupEvidenceAttachments).where(eq(s.backupEvidenceAttachments.restoreTestId, restoreTestId));
      await db.delete(s.backupJobRuns).where(eq(s.backupJobRuns.id, runId));
      await db.delete(s.backupRestoreTests).where(eq(s.backupRestoreTests.id, restoreTestId));
      await db.delete(s.backupSchedules).where(eq(s.backupSchedules.id, scheduleId));
      await db.delete(s.cmdbApplications).where(eq(s.cmdbApplications.id, applicationId));
      await db.delete(s.userRoles).where(inArray(s.userRoles.userId, [managerId, auditorId]));
      await db.delete(s.users).where(inArray(s.users.id, [managerId, auditorId]));
      if (createdRoleIds.length) await db.delete(s.roles).where(inArray(s.roles.id, createdRoleIds));
    } finally {
      if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
      await pool.end();
    }
  });

  it("keeps prior file versions and permits auditors to read but not upload", async () => {
    const path = `/api/backup-schedules/runs/${runId}/evidence`;
    const first = await upload(path, managerId, "backup.pdf", "%PDF-1.7 first", "application/pdf");
    const firstBody = await first.text();
    expect(first.status, firstBody).toBe(201);
    const firstFile = JSON.parse(firstBody);
    const second = await upload(path, managerId, "backup.pdf", "%PDF-1.7 second", "application/pdf");
    expect(second.status).toBe(201);
    expect((await second.json()).version).toBe(2);

    const listResponse = await request(path, auditorId);
    expect(listResponse.status).toBe(200);
    const listed = await listResponse.json();
    expect(listed).toHaveLength(2);
    expect(listed.map((file: { version: number }) => file.version).sort()).toEqual([1, 2]);
    expect(listed[0].uploadedByName).toBe("Backup Manager");
    expect(listed[0].filePath).toBeUndefined();

    const download = await request(`${path}/${firstFile.id}`, auditorId);
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("%PDF-1.7 first");
    expect((await upload(path, auditorId, "blocked.pdf", "%PDF-1.7", "application/pdf")).status).toBe(403);
    expect((await upload(path, managerId, "blocked.exe", "invalid", "application/octet-stream")).status).toBe(400);
  });

  it("attaches restore-test evidence to that exact test record", async () => {
    const path = `/api/backup-schedules/restore-tests/${restoreTestId}/evidence`;
    const result = await upload(path, managerId, "restore.log", "restore succeeded", "text/plain");
    const body = await result.text();
    expect(result.status, body).toBe(201);
    const metadata = JSON.parse(body);
    expect(metadata.restoreTestId).toBe(restoreTestId);
    expect(metadata.jobRunId).toBeNull();
    expect((await (await request(path, auditorId)).json()).map((file: { id: string }) => file.id)).toContain(metadata.id);
  });
});
