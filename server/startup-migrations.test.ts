// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyStartupMigrations,
  assertCabStreamLeasesTable,
  assertAdditiveMigration,
  compareAppVersions,
} from "./startup-migrations";

class MigrationClient {
  ledger = new Map<string, string>();
  executedSql: string[] = [];

  async query(query: string, values?: unknown[]) {
    if (query.startsWith("SELECT checksum")) {
      const checksum = this.ledger.get(String(values?.[0]));
      return { rows: checksum ? [{ checksum }] : [] };
    }
    if (query.includes(".sql_migrations (migration_name, checksum)")) {
      this.ledger.set(String(values?.[0]), String(values?.[1]));
      return { rows: [] };
    }
    if (/^INSERT INTO settings\b/i.test(query.trim())) {
      this.executedSql.push(query);
    }
    if (/^CREATE TABLE IF NOT EXISTS cab_stream_leases\b/i.test(query.trim())) {
      this.executedSql.push(query);
    }
    if (/CREATE INDEX IF NOT EXISTS\b/i.test(query)) {
      this.executedSql.push(query);
    }
    return { rows: [] };
  }
}

let tempDirectory: string | undefined;
afterEach(async () => {
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

describe("on-prem startup migrations", () => {
  it("applies an additive migration once and verifies its checksum on later boots", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "onprem-migration-test-"));
    const filename = "20261019_system_version.sql";
    const migrationSql = `
      INSERT INTO settings (key, value, description)
      VALUES ('system_version', 'v2.2.0', 'Current version')
      ON CONFLICT (key) DO NOTHING;
    `;
    await writeFile(path.join(tempDirectory, filename), migrationSql);
    const client = new MigrationClient();

    await expect(applyStartupMigrations(client, tempDirectory)).resolves.toMatchObject({
      applied: [filename],
      alreadyApplied: [],
    });
    await expect(applyStartupMigrations(client, tempDirectory)).resolves.toMatchObject({
      applied: [],
      alreadyApplied: [filename],
    });
    expect(client.executedSql).toHaveLength(1);

    await writeFile(path.join(tempDirectory, filename), migrationSql.replace("v2.2.0", "v2.2.1"));
    await expect(applyStartupMigrations(client, tempDirectory)).rejects.toThrow(
      /changed after it was recorded/,
    );
  });

  it("uses an additive startup migration for optional user email", async () => {
    const migration = await readFile("migrations/onprem/20261211_users_optional_email.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "20261211_users_optional_email.sql")).not.toThrow();
    expect(migration).toMatch(/btrim\(email\)\s*=\s*''/i);
    expect(migration).toMatch(/ALTER COLUMN email DROP NOT NULL/i);
  });

  it("reports a blocked migration with a credential-safe startup failure signal", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "onprem-migration-failure-test-"));
    const filename = "20261208_blocked_upgrade.sql";
    const migrationSql = "CREATE TABLE IF NOT EXISTS blocked_table (id integer);";
    await writeFile(path.join(tempDirectory, filename), migrationSql);

    class FailingMigrationClient extends MigrationClient {
      async query(query: string, values?: unknown[]) {
        if (query === migrationSql) {
          throw Object.assign(
            new Error("permission denied while connecting to postgres://operator:db-secret@db.example/app"),
            { code: "42501" },
          );
        }
        return super.query(query, values);
      }
    }

    let failure: unknown;
    try {
      await applyStartupMigrations(new FailingMigrationClient(), tempDirectory);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "StartupMigrationError",
      diagnostic: {
        code: "STARTUP_SCHEMA_UPGRADE_FAILED",
        stage: "migration",
        migration: filename,
        sqlState: "42501",
      },
    });
    const diagnostic = (failure as Error & { diagnostic: { detail: string } }).diagnostic;
    expect(diagnostic.detail).toContain("postgres://[REDACTED]@db.example/app");
    expect(diagnostic.detail).not.toContain("db-secret");
  });

  it("rejects destructive or unsupported migration SQL", () => {
    expect(() => assertAdditiveMigration(
      "ALTER TABLE assets DROP COLUMN serial_number;",
      "unsafe.sql",
    )).toThrow(/destructive|non-additive or unsupported/);
    expect(() => assertAdditiveMigration(
      "DELETE FROM assets;",
      "unsafe.sql",
    )).toThrow(/destructive|non-additive or unsupported/);
  });

  it("allows only the narrowly approved employee email relaxation and blank cleanup", async () => {
    const migration = await readFile("migrations/onprem/20261206_optional_employee_email.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "optional_employee_email.sql")).not.toThrow();
    for (const sql of [
      "ALTER TABLE users ALTER COLUMN email DROP NOT NULL;",
      "ALTER TABLE employees DROP COLUMN email;",
      "ALTER TABLE employees ALTER COLUMN first_name DROP NOT NULL;",
      "UPDATE employees SET email = NULL;",
      "UPDATE employees SET email = NULL WHERE email IS NOT NULL;",
    ]) {
      expect(() => assertAdditiveMigration(sql, "unsafe.sql")).toThrow(/destructive|unsupported/);
    }
  });

  it("accepts only the exact reviewed built-in role merge migration", async () => {
    const migration = await readFile("migrations/onprem/20261207_standardize_standard_roles.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "20261207_standardize_standard_roles.sql")).not.toThrow();
    expect(() => assertAdditiveMigration(
      `${migration}\nDROP TABLE users;`,
      "20261207_standardize_standard_roles.sql",
    )).toThrow(/reviewed role-merging migration/);
  });

  it("accepts the ITSM migrations' additive foreign keys and activity tables", async () => {
    for (const name of [
      "20261020_incident_management.sql",
      "20261021_service_request_management.sql",
      "20261025_maintenance_log_analytics.sql",
      "20261026_consumables_inventory.sql",
      "20261027_warehouse_site.sql",
      "20261028_seed_consumable_categories.sql",
      "20261029_employee_offboarding_access_entitlements.sql",
      "20261030_access_governance_catalog.sql",
      "20261031_cmdb_applications_servers_documents.sql",
      "20261101_access_expiry_offboarding_clearances.sql",
      "20261102_cmdb_dependency_change_impact.sql",
      "20261128_change_asset_impact_links.sql",
      "20261107_network_backup_policy_compliance.sql",
      "20261108_it_component_compliance_reviews.sql",
      "20261111_enterprise_project_management.sql",
      "20261112_project_delivery_governance.sql",
      "20261113_project_document_versions.sql",
      "20261114_project_workspace_timestamps.sql",
      "20261115_project_baselines_risk_residuals.sql",
      "20261127_assignment_groups.sql",
      "20261124_change_calendar_blackouts.sql",
      "20261204_procurement_catalog_stock_adjustments.sql",
      "20261214_app_release_history.sql",
    ]) {
      const migration = await readFile(path.resolve(process.cwd(), "migrations/onprem", name), "utf8");
      expect(() => assertAdditiveMigration(migration, name)).not.toThrow();
    }
  });

  it("includes the CAB assignment history index in the additive deployment migrations", async () => {
    const deployedMigration = await readFile(
      path.resolve(process.cwd(), "migrations/onprem/20261110_cab_assignment_history_lookup_idx.sql"),
      "utf8",
    );
    const developmentMigration = await readFile(
      path.resolve(process.cwd(), "migrations/20261018_cab_assignment_history_lookup_idx.sql"),
      "utf8",
    );

    expect(() => assertAdditiveMigration(
      deployedMigration,
      "20261110_cab_assignment_history_lookup_idx.sql",
    )).not.toThrow();
    expect(deployedMigration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim())
      .toBe(developmentMigration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim());

    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "onprem-cab-index-test-"));
    const filename = "20261110_cab_assignment_history_lookup_idx.sql";
    await writeFile(path.join(tempDirectory, filename), deployedMigration);
    const client = new MigrationClient();
    await expect(applyStartupMigrations(client, tempDirectory)).resolves.toMatchObject({
      applied: [filename],
      alreadyApplied: [],
    });
    expect(client.executedSql).toContain(deployedMigration);
  });

  it("applies the CAB stream lease table migration and verifies it before startup", async () => {
    const deployedMigration = await readFile(
      path.resolve(process.cwd(), "migrations/onprem/20261205_cab_stream_leases.sql"),
      "utf8",
    );
    const developmentMigration = await readFile(
      path.resolve(process.cwd(), "migrations/20261004_cab_stream_leases.sql"),
      "utf8",
    );

    expect(() => assertAdditiveMigration(deployedMigration, "CAB stream leases")).not.toThrow();
    expect(deployedMigration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim())
      .toBe(developmentMigration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim());

    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "onprem-cab-leases-test-"));
    const filename = "20261205_cab_stream_leases.sql";
    await writeFile(path.join(tempDirectory, filename), deployedMigration);
    const client = new MigrationClient();
    await expect(applyStartupMigrations(client, tempDirectory)).resolves.toMatchObject({
      applied: [filename],
      alreadyApplied: [],
    });
    await expect(applyStartupMigrations(client, tempDirectory)).resolves.toMatchObject({
      applied: [],
      alreadyApplied: [filename],
    });
    expect(client.executedSql).toHaveLength(1);
    expect(client.executedSql[0]).toContain("CREATE TABLE IF NOT EXISTS cab_stream_leases");
    expect(client.executedSql[0]).toContain("CREATE INDEX IF NOT EXISTS cab_stream_leases_user_expiry_idx");
    expect(client.executedSql[0]).toContain("CREATE INDEX IF NOT EXISTS cab_stream_leases_expiry_idx");

    await expect(assertCabStreamLeasesTable({
      query: async () => ({ rows: [{ table_name: "cab_stream_leases" }] }),
    })).resolves.toBeUndefined();
    await expect(assertCabStreamLeasesTable({
      query: async () => ({ rows: [{ table_name: null }] }),
    })).rejects.toThrow(/required CAB event lease table cab_stream_leases is missing/i);
  });

  it("compares configured release versions numerically", () => {
    expect(compareAppVersions("v2.3.0", "v2.2.0")).toBe(1);
    expect(compareAppVersions("2.1.9", "v2.2.0")).toBe(-1);
    expect(compareAppVersions("v2.2.0", "2.2.0")).toBe(0);
  });
});
