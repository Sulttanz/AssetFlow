// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyStartupMigrations,
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

  it("compares configured release versions numerically", () => {
    expect(compareAppVersions("v2.3.0", "v2.2.0")).toBe(1);
    expect(compareAppVersions("2.1.9", "v2.2.0")).toBe(-1);
    expect(compareAppVersions("v2.2.0", "2.2.0")).toBe(0);
  });
});
