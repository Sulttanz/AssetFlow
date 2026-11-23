// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canReadKnowledge } from "@shared/kb-governance";
import { kbArticles, kbArticleVersions } from "@shared/schema";
import { RESET_PROTECTED_TABLES } from "@shared/system-data-reset";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";

const manualDirectory = path.resolve("docs/system-manual");
const riskSlug = "system-manual-internal-it-department-risk-management";
const adminSlug = "system-manual-system-administration-rbac";

describe("repository system manual contracts", () => {
  it("documents the internal IT risk workflow without claiming project or executive approval coupling", async () => {
    const guide = await readFile(path.join(manualDirectory, "internal-it-department-risk-management.md"), "utf8");
    for (const text of [
      "IT-RSK-001", "Inherent Risk", "Residual Risk", "Target Risk", "Clear matrix filter",
      "Infrastructure & High Availability", "Cybersecurity & Vulnerability", "Backup, DR & Continuity",
      "Identity, Access & Patching", "Third-Party & Vendor", "Service Delivery & ITSM", "Regulatory & Compliance",
      "Confidentiality", "Integrity", "Availability", "Partially Effective", "Mitigate", "Accept", "Transfer", "Avoid",
      "acceptedByUserId", "acceptedAt", "Acceptance expires", "12", "Spawn Change Request", "Spawn Problem",
      "Mark Reviewed Today", "Executive IT Risk Report (PDF)", "project_risks",
    ]) expect(guide).toContain(text);
    expect(guide).toContain("not** a separate executive approval-routing workflow");
    expect(guide).toContain("is_system_guide: true");
    expect(guide).toContain("audience: all_authenticated");
  });
  it("documents the actual protected reset tables and the fresh reset audit entry", async () => {
    const guide = await readFile(path.join(manualDirectory, "system-administration-rbac.md"), "utf8");
    const required = ["users", "user_roles", "roles", "permissions", "role_permissions", "sessions",
      "incident_catalog_items", "service_catalog_items", "catalog_items", "sla_policies", "locations", "departments"];
    for (const table of required) expect(RESET_PROTECTED_TABLES as readonly string[]).toContain(table);
    for (const text of ["All User Accounts", "All Role Assignments", "Active Sessions", "Incident Catalog",
      "Service Catalog", "System Settings", "SLA Policies", "Locations / Departments", "System Manual guides",
      "users.employee_id = NULL", "CLEAR_SYSTEM_DATA", "custom Knowledge Base", "current password",
      "No account category is deleted", "not reseeded or overwritten"]) expect(guide).toContain(text);
  });
});

describe.runIf(process.env.RUN_DATABASE_INTEGRATION_TESTS === "1")("repository manual sync in isolated PostgreSQL", () => {
  const schema = `test_manual_docs_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
  const originalUrl = process.env.DATABASE_URL!;
  let pool: Pool;
  let appPool: Pool;
  let db: typeof import("./db").db;
  let sync: typeof import("./knowledge-manual-sync").syncSystemManualArticles;
  let guideCount: number;
  let riskId: string;
  beforeAll(async () => {
    const url = new URL(originalUrl);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.searchParams.get("options")?.includes("test_full_")) {
      throw new Error("System Manual sync tests require the disposable test database");
    }
    pool = new Pool({ connectionString: originalUrl });
    const client = await pool.connect();
    try { await initializeTestSchema(client, schema); } finally { client.release(); }
    process.env.DATABASE_URL = testDatabaseUrlForSchema(originalUrl, schema);
    const database = await import("./db"); db = database.db; appPool = database.pool;
    sync = (await import("./knowledge-manual-sync")).syncSystemManualArticles;
    guideCount = (await readdir(manualDirectory)).filter(name => name.endsWith(".md")).length;
  }, 60000);
  afterAll(async () => {
    if (appPool) await appPool.end();
    process.env.DATABASE_URL = originalUrl;
    if (pool) { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
  });
  it("imports the actual manuals once and makes the new risk guide readable by every authenticated role", async () => {
    expect(await sync()).toEqual({ inserted: guideCount, updated: 0, archived: 0, unchanged: 0 });
    const [risk] = await db.select().from(kbArticles).where(eq(kbArticles.slug, riskSlug));
    riskId = risk.id;
    expect(risk).toMatchObject({ title: "Internal IT Department Risk Management Guide", isSystemGuide: true,
      status: "published", isPublic: true, authorLabel: "Sulttanz", ownerLabel: "Sulttanz", category: "GRC & Compliance" });
    for (const role of ["system_admin", "it_manager", "it_agent", "cab_member", "asset_manager",
      "auditor", "read_only_user", "demo_viewer", "end_user"]) {
      expect(canReadKnowledge({ id: "authenticated-reader", roles: [{ name: role }] }, risk)).toBe(true);
    }
    expect(canReadKnowledge(null, risk)).toBe(false);
    const [admin] = await db.select().from(kbArticles).where(eq(kbArticles.slug, adminSlug));
    expect(admin.content).toContain("users.employee_id = NULL");
    expect(admin.content).toContain("CLEAR_SYSTEM_DATA");
  });
  it("is idempotent on restart without duplicate article or revision rows", async () => {
    expect(await sync()).toEqual({ inserted: 0, updated: 0, archived: 0, unchanged: guideCount });
    expect(await db.select().from(kbArticles).where(eq(kbArticles.isSystemGuide, true))).toHaveLength(guideCount);
    expect(await db.select().from(kbArticleVersions).where(eq(kbArticleVersions.articleId, riskId))).toHaveLength(1);
  });
  it("updates an outdated deployed manual in place, preserves its prior version, and stabilizes on the next restart", async () => {
    await db.update(kbArticles).set({ content: "# Previous IT risk manual\nLegacy scoring instructions." })
      .where(eq(kbArticles.id, riskId));
    expect(await sync()).toEqual({ inserted: 0, updated: 1, archived: 0, unchanged: guideCount - 1 });
    const [risk] = await db.select().from(kbArticles).where(and(eq(kbArticles.id, riskId), eq(kbArticles.slug, riskSlug)));
    expect(risk.content).toContain("Three-stage scoring");
    expect(risk.version).toBe("1.1");
    const revisions = await db.select().from(kbArticleVersions).where(eq(kbArticleVersions.articleId, riskId));
    expect(revisions.map(row => row.version).sort()).toEqual(["1.0", "1.1"]);
    expect(await sync()).toEqual({ inserted: 0, updated: 0, archived: 0, unchanged: guideCount });
    expect(await db.select().from(kbArticles).where(eq(kbArticles.slug, riskSlug))).toHaveLength(1);
  });
});
