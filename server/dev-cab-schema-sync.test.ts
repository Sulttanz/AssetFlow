import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { applyDevSqlMigrations } from "../scripts/sync-dev-cab-schema.mjs";

const tempDirectories: string[] = [];
const integrationDatabaseUrl =
  process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT
    ? undefined
    : process.env.CAB_SCHEMA_SYNC_TEST_DATABASE_URL ?? process.env.DATABASE_URL;

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
    if (sql.startsWith("INSERT INTO") && sql.includes(".sql_migrations")) {
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

describe("development SQL migration sync against PostgreSQL", () => {
  it.skipIf(!integrationDatabaseUrl)(
    "preserves CAB history and schema across repeated syncs in a temporary legacy schema",
    async () => {
      neonConfig.webSocketConstructor = ws;
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 1 });
      const schemaName = `cab_sync_test_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      let client: Awaited<ReturnType<typeof pool.connect>> | undefined;

      try {
        client = await pool.connect();
        await client.query(`CREATE SCHEMA ${quotedSchema}`);
        await client.query(`SET search_path TO ${quotedSchema}`);

        await client.query(`
          CREATE TABLE users (
            id varchar PRIMARY KEY,
            first_name text,
            last_name text,
            username text NOT NULL
          );
          CREATE TABLE changes (id varchar PRIMARY KEY);
          CREATE TABLE assets (id varchar PRIMARY KEY);
          CREATE TABLE change_environment_stages (
            id varchar PRIMARY KEY,
            change_id varchar NOT NULL,
            environment text NOT NULL,
            "order" integer NOT NULL,
            status text NOT NULL DEFAULT 'pending',
            assigned_to_id varchar,
            due_date timestamptz,
            started_at timestamptz,
            completed_at timestamptz,
            notes text,
            evidence text,
            deployed_by_id varchar,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
          CREATE TABLE change_approvals (
            id varchar PRIMARY KEY,
            change_id varchar NOT NULL,
            approver_id varchar NOT NULL,
            decision text,
            comments text,
            decided_at timestamptz,
            removed_at timestamptz,
            removed_by_id varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT change_approvals_change_id_changes_id_fk
              FOREIGN KEY (change_id) REFERENCES changes(id) ON DELETE CASCADE,
            CONSTRAINT change_approvals_approver_id_users_id_fk
              FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT change_approvals_removed_by_id_users_id_fk
              FOREIGN KEY (removed_by_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT change_approvals_change_id_approver_id_unique
              UNIQUE (change_id, approver_id)
          );
        `);

        await client.query(`
          INSERT INTO users (id, first_name, last_name, username) VALUES
            ('pending-voter', 'Pat', 'Pending', 'pat.pending'),
            ('approved-voter', 'Ari', 'Approved', 'ari.approved'),
            ('rejected-voter', 'Rae', 'Rejected', 'rae.rejected'),
            ('removed-voter', 'Moe', 'Removed', 'moe.removed'),
            ('cab-remover', 'Sam', 'Remover', 'sam.remover');
          INSERT INTO changes (id) VALUES
            ('change-pending'),
            ('change-approved'),
            ('change-rejected'),
            ('change-removed');
          INSERT INTO change_approvals
            (id, change_id, approver_id, decision, comments, decided_at, removed_at, removed_by_id)
          VALUES
            ('approval-pending', 'change-pending', 'pending-voter', 'pending',
              'Awaiting CAB review', NULL, NULL, NULL),
            ('approval-approved', 'change-approved', 'approved-voter', 'approved',
              'Approved with safeguards', '2026-09-30T10:00:00Z', NULL, NULL),
            ('approval-rejected', 'change-rejected', 'rejected-voter', 'rejected',
              'Rollback plan incomplete', '2026-09-30T11:00:00Z', NULL, NULL),
            ('approval-removed', 'change-removed', 'removed-voter', 'pending',
              'Removed before review', NULL, '2026-09-30T12:00:00Z', 'cab-remover');
        `);

        const legacyHistory = await client.query(`
          SELECT id, change_id, approver_id, decision, comments, decided_at, removed_at,
            removed_by_id, created_at
          FROM change_approvals
          ORDER BY id
        `);
        const firstRun = await applyDevSqlMigrations(client, { ledgerSchema: schemaName });
        expect(firstRun.deferred).toBeNull();
        expect(firstRun.applied).toContain("20260929_preserve_cab_approval_history.sql");
        expect(firstRun.applied).toContain("20260929_cab_remover_label.sql");
        expect(firstRun.applied).toContain("20261005_change_stage_attempt_history.sql");

        const upgradedRows = await client.query(`
          SELECT id, change_id, approver_id, original_approver_id, approver_label,
            decision, comments, decided_at, removed_at, removed_by_id, removed_by_label,
            created_at
          FROM change_approvals
          ORDER BY id
        `);
        expect(upgradedRows.rows).toHaveLength(4);
        expect(
          upgradedRows.rows.map((row) => ({
            id: row.id,
            changeId: row.change_id,
            approverId: row.approver_id,
            decision: row.decision,
            comments: row.comments,
            decidedAt: row.decided_at,
            removedAt: row.removed_at,
            removedById: row.removed_by_id,
            createdAt: row.created_at,
          })),
        ).toEqual(legacyHistory.rows.map((row) => ({
          id: row.id,
          changeId: row.change_id,
          approverId: row.approver_id,
          decision: row.decision,
          comments: row.comments,
          decidedAt: row.decided_at,
          removedAt: row.removed_at,
          removedById: row.removed_by_id,
          createdAt: row.created_at,
        })));
        expect(upgradedRows.rows.map((row) => [
          row.original_approver_id,
          row.approver_label,
        ])).toEqual([
          ["approved-voter", "Ari Approved"],
          ["pending-voter", "Pat Pending"],
          ["rejected-voter", "Rae Rejected"],
          ["removed-voter", "Moe Removed"],
        ]);
        expect(upgradedRows.rows.find((row) => row.id === "approval-removed")).toMatchObject({
          removed_by_id: "cab-remover",
          removed_by_label: "Sam Remover",
        });

        const captureSchemaAndHistory = async () => {
          const [columns, constraints, indexes, approvals] = await Promise.all([
            client!.query(
              `SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_schema = $1
               ORDER BY table_name, ordinal_position`,
              [schemaName],
            ),
            client!.query(
              `SELECT relation.relname AS table_name, constraint_row.conname,
                  pg_get_constraintdef(constraint_row.oid) AS definition
               FROM pg_constraint AS constraint_row
               JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
               WHERE constraint_row.connamespace = $1::regnamespace
               ORDER BY relation.relname, constraint_row.conname`,
              [schemaName],
            ),
            client!.query(
              `SELECT tablename, indexname, indexdef
               FROM pg_indexes
               WHERE schemaname = $1
               ORDER BY tablename, indexname`,
              [schemaName],
            ),
            client!.query(`
              SELECT id, change_id, approver_id, original_approver_id, approver_label,
                decision, comments, decided_at, removed_at, removed_by_id, removed_by_label,
                created_at
              FROM change_approvals
              ORDER BY id
            `),
          ]);
          return {
            columns: columns.rows,
            constraints: constraints.rows,
            indexes: indexes.rows,
            approvals: approvals.rows,
          };
        };

        const firstSnapshot = await captureSchemaAndHistory();
        expect(
          firstSnapshot.constraints.some(
            (constraint) =>
              constraint.conname === "change_approvals_change_id_approver_id_unique",
          ),
        ).toBe(false);
        const secondRun = await applyDevSqlMigrations(client, { ledgerSchema: schemaName });
        expect(secondRun).toEqual({
          applied: [],
          alreadyApplied: firstRun.applied,
          deferred: null,
        });
        expect(await captureSchemaAndHistory()).toEqual(firstSnapshot);

        await client.query(`DELETE FROM users WHERE id = 'approved-voter'`);
        await client.query(`DELETE FROM users WHERE id = 'cab-remover'`);
        const retainedAfterAccountDeletion = await client.query(`
          SELECT id, approver_id, original_approver_id, approver_label,
            removed_by_id, removed_by_label
          FROM change_approvals
          WHERE id IN ('approval-approved', 'approval-removed')
          ORDER BY id
        `);
        expect(retainedAfterAccountDeletion.rows).toEqual([
          {
            id: "approval-approved",
            approver_id: null,
            original_approver_id: "approved-voter",
            approver_label: "Ari Approved",
            removed_by_id: null,
            removed_by_label: null,
          },
          {
            id: "approval-removed",
            approver_id: "removed-voter",
            original_approver_id: "removed-voter",
            approver_label: "Moe Removed",
            removed_by_id: null,
            removed_by_label: "Sam Remover",
          },
        ]);

        await client.query(`DELETE FROM changes WHERE id = 'change-pending'`);
        const cascadedApproval = await client.query(
          `SELECT id FROM change_approvals WHERE id = 'approval-pending'`,
        );
        expect(cascadedApproval.rows).toEqual([]);
      } finally {
        if (client) {
          await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
          client.release();
        }
        await pool.end();
      }
    },
    60_000,
  );
});
