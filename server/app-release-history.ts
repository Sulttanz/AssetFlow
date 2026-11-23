import { readFileSync } from "node:fs";
import path from "node:path";
import { desc, sql } from "drizzle-orm";
import { compareAppVersions } from "./startup-migrations";
import { appReleaseHistory, auditLogs } from "@shared/schema";
import { db, pool } from "./db";

const RELEASE_LOCK_ID = 24871014;
const PACKAGE_JSON_PATH = path.resolve(process.cwd(), "package.json");

export function readPackageAppVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error("package.json must contain a valid semantic application version.");
  }
  return `v${pkg.version}`;
}

export async function getSystemMigrationStatus() {
  const result = await pool.query(`
    SELECT count(*)::int AS "schemaMigrationCount",
           (SELECT migration_name FROM onprem_deploy.sql_migrations ORDER BY applied_at DESC, migration_name DESC LIMIT 1) AS "latestMigration"
    FROM onprem_deploy.sql_migrations
  `);
  return {
    schemaMigrationCount: Number(result.rows[0]?.schemaMigrationCount ?? 0),
    latestMigration: result.rows[0]?.latestMigration ?? null,
    environment: process.env.NODE_ENV ?? "unknown",
  };
}

export async function recordAppReleaseIfUpgraded(
  version = readPackageAppVersion(),
  migrationCount = 0,
  notes: string | null = "Recorded automatically during application startup.",
) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${RELEASE_LOCK_ID})`);
    const [previous] = await tx.select().from(appReleaseHistory)
      .orderBy(desc(appReleaseHistory.appliedAt), desc(appReleaseHistory.id)).limit(1);
    if (previous && compareAppVersions(version, previous.toVersion) <= 0) return null;

    const [release] = await tx.insert(appReleaseHistory).values({
      fromVersion: previous?.toVersion ?? null,
      toVersion: version,
      migrationCount,
      notes,
      status: previous ? "applied" : "installed",
    }).returning();

    await tx.insert(auditLogs).values({
      action: "CREATE",
      tableName: "app_release_history",
      recordId: String(release.id),
      recordName: `${previous?.toVersion ?? "Initial installation"} → ${version}`,
      oldValues: previous ? JSON.stringify({ version: previous.toVersion }) : null,
      newValues: JSON.stringify({
        version: release.toVersion,
        fromVersion: release.fromVersion,
        appliedAt: release.appliedAt,
        migrationCount: release.migrationCount,
        status: release.status,
      }),
    });
    return release;
  });
}

export async function getRecentAppReleaseHistory(limit = 10) {
  return db.select({
    id: appReleaseHistory.id,
    fromVersion: appReleaseHistory.fromVersion,
    toVersion: appReleaseHistory.toVersion,
    appliedAt: appReleaseHistory.appliedAt,
    migrationCount: appReleaseHistory.migrationCount,
    notes: appReleaseHistory.notes,
    status: appReleaseHistory.status,
  }).from(appReleaseHistory)
    .orderBy(desc(appReleaseHistory.appliedAt), desc(appReleaseHistory.id))
    .limit(Math.max(1, Math.min(50, limit)));
}
