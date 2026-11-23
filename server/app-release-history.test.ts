// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLogs, appReleaseHistory } from "@shared/schema";
import { initializeTestSchema, testDatabaseUrlForSchema } from "./test-database";

describe("application release history", () => {
  it("tracks the package version and declares a safe additive startup migration", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const appVersion = await readFile("shared/version.ts", "utf8");
    const migration = await readFile(path.resolve("migrations/onprem/20261214_app_release_history.sql"), "utf8");
    expect(appVersion).toContain(`"v${pkg.version}"`);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS app_release_history/);
    expect(migration).toContain("to_version text NOT NULL");
    expect(migration).toContain("migration_count integer NOT NULL DEFAULT 0");
    const { assertAdditiveMigration } = await import("./startup-migrations");
    expect(() => assertAdditiveMigration(migration, "20261214_app_release_history.sql")).not.toThrow();
  });
});

describe.runIf(process.env.RUN_DATABASE_INTEGRATION_TESTS === "1")("release startup recording in an isolated PostgreSQL schema", () => {
  const originalUrl = process.env.DATABASE_URL!;
  const schema = `test_release_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  let setupPool: Pool;
  let appPool: Pool;
  let db: typeof import("./db").db;
  beforeAll(async () => {
    const original = new URL(originalUrl);
    if (!["localhost", "127.0.0.1"].includes(original.hostname) || !original.searchParams.get("options")?.includes("test_full_")) {
      throw new Error("Release history tests require the disposable Vitest database.");
    }
    setupPool = new Pool({ connectionString: originalUrl });
    const client = await setupPool.connect();
    try { await initializeTestSchema(client, schema); } finally { client.release(); }
    process.env.DATABASE_URL = testDatabaseUrlForSchema(originalUrl, schema);
    const database = await import("./db");
    db = database.db;
    appPool = database.pool;
    await appPool.query('CREATE SCHEMA IF NOT EXISTS onprem_deploy');
    await appPool.query(`CREATE TABLE IF NOT EXISTS onprem_deploy.sql_migrations (
      migration_name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await appPool.query("INSERT INTO onprem_deploy.sql_migrations(migration_name, checksum) VALUES ('migration-a.sql','a'), ('migration-b.sql','b') ON CONFLICT DO NOTHING");
  }, 60000);
  afterAll(async () => {
    if (appPool) {
      await appPool.query("DROP TABLE IF EXISTS onprem_deploy.sql_migrations");
      await appPool.end();
    }
    process.env.DATABASE_URL = originalUrl;
    if (setupPool) {
      await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await setupPool.end();
    }
  });

  it("records only increasing releases, writes an audit row, and preserves the last successful version", async () => {
    const { recordAppReleaseIfUpgraded, getRecentAppReleaseHistory, getSystemMigrationStatus } = await import("./app-release-history");
    expect(await recordAppReleaseIfUpgraded("v2.2.0", 60)).toMatchObject({
      fromVersion: null, toVersion: "v2.2.0", migrationCount: 60, status: "installed",
    });
    expect(await recordAppReleaseIfUpgraded("v2.2.0", 60)).toBeNull();
    expect(await recordAppReleaseIfUpgraded("v2.1.9", 61)).toBeNull();
    expect(await recordAppReleaseIfUpgraded("v2.3.0", 63, "Release upgrade")).toMatchObject({
      fromVersion: "v2.2.0", toVersion: "v2.3.0", migrationCount: 63, status: "applied",
    });
    expect(await recordAppReleaseIfUpgraded("v2.3.0", 63)).toBeNull();

    const history = await getRecentAppReleaseHistory();
    expect(history.map(row => [row.fromVersion, row.toVersion])).toEqual([
      ["v2.2.0", "v2.3.0"],
      [null, "v2.2.0"],
    ]);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.tableName, "app_release_history"));
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({ action: "CREATE", recordName: "v2.2.0 → v2.3.0" });
    expect(JSON.parse(audits[0].newValues ?? "{}")).toMatchObject({ version: "v2.3.0", migrationCount: 63 });

    expect(await getSystemMigrationStatus()).toMatchObject({
      schemaMigrationCount: 2,
      latestMigration: "migration-b.sql",
      environment: "test",
    });
    expect(await db.select().from(appReleaseHistory)).toHaveLength(2);
  }, 30000);
});
