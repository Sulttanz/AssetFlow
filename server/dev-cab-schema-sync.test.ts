import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDevSqlMigrations } from "../scripts/sync-dev-cab-schema.mjs";

const tempDirectories: string[] = [];

async function createMigrationDirectory(files: Record<string, string>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dev-sql-migrations-"));
  tempDirectories.push(directory);
  await Promise.all(
    Object.entries(files).map(([name, sql]) => writeFile(path.join(directory, name), sql)),
  );
  return directory;
}

function fakeClient({ missingSql }: { missingSql?: string } = {}) {
  const ledger = new Map<string, string>();
  const executedMigrations: string[] = [];
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.startsWith("SELECT checksum FROM")) {
      const [name] = values as [string];
      const checksum = ledger.get(name);
      return { rows: checksum ? [{ checksum }] : [] };
    }
    if (sql.startsWith("INSERT INTO replit_workspace_setup.sql_migrations")) {
      const [name, checksum] = values as [string, string];
      ledger.set(name, checksum);
      return { rows: [] };
    }
    if (missingSql && sql.includes(missingSql)) {
      const error = new Error("missing database object") as Error & { code: string };
      error.code = "42P01";
      throw error;
    }
    if (sql.trim().startsWith("SELECT 'migration:")) {
      executedMigrations.push(sql.trim());
    }
    return { rows: [] };
  });
  return { query, ledger, executedMigrations };
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("development SQL migration sync", () => {
  it("discovers SQL files in sorted order, records them, and skips them on later runs", async () => {
    const directory = await createMigrationDirectory({
      "002_second.sql": "SELECT 'migration:second';",
      "001_first.sql": "SELECT 'migration:first';",
      "notes.txt": "not a migration",
    });
    const client = fakeClient();

    const firstRun = await applyDevSqlMigrations(client, { directory });
    expect(firstRun).toEqual({
      applied: ["001_first.sql", "002_second.sql"],
      alreadyApplied: [],
      deferred: null,
    });
    expect(client.executedMigrations).toEqual([
      "SELECT 'migration:first';",
      "SELECT 'migration:second';",
    ]);

    const secondRun = await applyDevSqlMigrations(client, { directory });
    expect(secondRun).toEqual({
      applied: [],
      alreadyApplied: ["001_first.sql", "002_second.sql"],
      deferred: null,
    });
    expect(client.executedMigrations).toHaveLength(2);
  });

  it("discovers every SQL migration currently in the repository", async () => {
    const directory = path.resolve("migrations");
    const migrationFiles = (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const client = fakeClient();

    const result = await applyDevSqlMigrations(client, { directory });

    expect(result.applied).toEqual(migrationFiles);
  });

  it("defers the first migration whose required schema is missing, without recording it", async () => {
    const directory = await createMigrationDirectory({
      "001_needs_table.sql": "SELECT missing_table;",
      "002_later.sql": "SELECT 'migration:later';",
    });
    const client = fakeClient({ missingSql: "missing_table" });

    await expect(
      applyDevSqlMigrations(client, { directory, deferMissingSchema: true }),
    ).resolves.toEqual({
      applied: [],
      alreadyApplied: [],
      deferred: "001_needs_table.sql",
    });
    expect(client.ledger.size).toBe(0);
    expect(client.executedMigrations).toHaveLength(0);
    expect(client.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(true);
  });

  it("fails instead of silently deferring missing schema in the final setup pass", async () => {
    const directory = await createMigrationDirectory({
      "001_needs_table.sql": "SELECT missing_table;",
    });
    const client = fakeClient({ missingSql: "missing_table" });

    await expect(applyDevSqlMigrations(client, { directory })).rejects.toThrow(
      "Failed to apply SQL migration 001_needs_table.sql",
    );
    expect(client.ledger.size).toBe(0);
  });

  it("rejects edits to an already-recorded migration", async () => {
    const directory = await createMigrationDirectory({
      "001_first.sql": "SELECT 'migration:first';",
    });
    const client = fakeClient();
    await applyDevSqlMigrations(client, { directory });
    await writeFile(path.join(directory, "001_first.sql"), "SELECT 'migration:changed';");

    await expect(applyDevSqlMigrations(client, { directory })).rejects.toThrow(
      "changed after it was recorded",
    );
  });
});
