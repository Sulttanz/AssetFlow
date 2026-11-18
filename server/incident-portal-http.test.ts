// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && Boolean(url &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /search_path=test_full_[a-z0-9_]+/.test(url.searchParams.get("options") ?? ""));

describe.runIf(enabled)("Project-scoped incident portal over HTTP", () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const outsiderId = randomUUID();
  const projectIds = [randomUUID(), randomUUID()];
  const catalogIds = [randomUUID(), randomUUID(), randomUUID()];
  const incidentIds: string[] = [];
  let server: Server | undefined;
  let base = "";
  let cookie = "";
  let outsiderCookie = "";

  async function request(path: string, method = "GET", body?: unknown, sessionCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
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
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const password = randomUUID();
    const hash = await hashPassword(password);
    await db.insert(s.users).values([actorId, outsiderId].map(id => ({
      id, username: `portal-${id}`, email: `portal-${id}@example.test`,
      password: hash, firstName: "Portal", lastName: suffix, employeeId: null,
    })));
    // Exercise real end-user persona middleware, not a custom role bypass.
    const [role] = await db.select().from(s.roles).where(eq(s.roles.name, "end_user")).limit(1);
    if (!role) throw new Error("Standard end_user role was not initialized");
    await db.insert(s.userRoles).values([actorId, outsiderId].map(userId => ({ userId, roleId: role.id })));
    await db.insert(s.projects).values(projectIds.map(id => ({ id, name: `Portal project ${id}`, title: `Portal project ${id}` })));
    await db.insert(s.projectTeamMembers).values({ projectId: projectIds[0], userId: actorId });
    await db.insert(s.incidentCatalogItems).values(catalogIds.map((id, index) => ({
      id, name: `Portal type ${id}`, category: "Network",
      projectId: index === 0 ? null : projectIds[index - 1],
      defaultPriority: "P2", defaultImpact: "high", defaultUrgency: "medium",
      defaultAssignmentGroup: "Service Desk",
    })));
    for (const id of [actorId, outsiderId]) {
      const response = await fetch(`${base}/api/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: `portal-${id}`, password }),
      });
      expect(response.status).toBe(200);
      const sessionCookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
      if (id === actorId) cookie = sessionCookie;
      else outsiderCookie = sessionCookie;
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (incidentIds.length) {
        const files = await db.select().from(s.ticketAttachments).where(inArray(s.ticketAttachments.incidentId, incidentIds));
        for (const file of files) await unlink(file.filePath).catch(() => {});
        await db.delete(s.ticketAttachments).where(inArray(s.ticketAttachments.incidentId, incidentIds));
        await db.delete(s.incidents).where(inArray(s.incidents.id, incidentIds));
      }
      await db.delete(s.incidentCatalogItems).where(inArray(s.incidentCatalogItems.id, catalogIds));
      await db.delete(s.projects).where(inArray(s.projects.id, projectIds));
      await db.delete(s.auditLogs).where(inArray(s.auditLogs.userId, [actorId, outsiderId]));
      await db.delete(s.userRoles).where(inArray(s.userRoles.userId, [actorId, outsiderId]));
      await db.delete(s.users).where(inArray(s.users.id, [actorId, outsiderId]));
    } finally {
      if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
      await pool.end();
    }
  });

  it("returns only assigned projects and global plus matching-project templates", async () => {
    const result = await request("/api/portal/incidents/options");
    expect(result.status).toBe(200);
    expect(result.body.projects.map((project: { id: string }) => project.id)).toEqual([projectIds[0]]);
    expect(result.body.selectedProjectId).toBe(projectIds[0]);
    expect(result.body.catalog.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([catalogIds[0], catalogIds[1]]));
    expect(result.body.catalog.some((item: { id: string }) => item.id === catalogIds[2])).toBe(false);
    expect(result.body.assignedAssets).toEqual([]);
    expect(result.body.linkedEmployee).toBe(false);
    expect((await request(`/api/portal/incidents/options?projectId=${projectIds[1]}`)).status).toBe(403);
  });

  it("rejects unauthorized scope and technical overrides, and persists comments and attachments safely", async () => {
    const input = { title: `Portal incident ${suffix}`, description: "Cannot connect to VPN", projectId: projectIds[0], incidentCatalogItemId: catalogIds[1] };
    expect((await request("/api/incidents", "POST", { ...input, projectId: projectIds[1] })).status).toBe(403);
    expect((await request("/api/incidents", "POST", { ...input, incidentCatalogItemId: catalogIds[2] })).status).toBe(403);
    expect((await request("/api/incidents", "POST", input, outsiderCookie)).status).toBe(403);
    expect((await request("/api/incident-catalog", "POST", { name: "Forbidden" })).status).toBe(403);
    const created = await request("/api/incidents", "POST", {
      ...input, priority: "P1", impact: "low", urgency: "low",
      assignmentGroup: "Unauthorized team", assignedToId: outsiderId,
      responseDueAt: "2099-01-01", resolveDueAt: "2099-01-01", requesterId: outsiderId,
    });
    expect(created.status).toBe(201);
    incidentIds.push(created.body.id);
    expect(created.body).toMatchObject({
      requesterId: actorId, creatorId: actorId, priority: "P2", impact: "high", urgency: "medium",
      assignmentGroup: "Service Desk", assignedToId: null, assigneeId: null, status: "New",
    });
    expect(created.body.resolveDueAt).not.toContain("2099");
    expect((await request(`/api/incidents/${created.body.id}/comments`, "POST", { message: "Additional troubleshooting details" })).status).toBe(201);
    const activity = await request(`/api/incidents/${created.body.id}/activity`);
    expect(activity.body).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Comment", details: "Additional troubleshooting details" })]));
    const form = new FormData();
    form.append("file", new Blob(["VPN connection failed"], { type: "text/plain" }), "vpn.log");
    const upload = await fetch(`${base}/api/incidents/${created.body.id}/attachments`, { method: "POST", headers: { cookie }, body: form });
    expect(upload.status).toBe(201);
    const attachment = await upload.json();
    expect(attachment.filePath).toBeUndefined();
    const download = await fetch(`${base}/api/incidents/${created.body.id}/attachments/${attachment.id}`, { headers: { cookie } });
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("VPN connection failed");
    expect((await request(`/api/incidents/${created.body.id}/attachments`, "GET", undefined, outsiderCookie)).status).toBe(403);
  });
});
