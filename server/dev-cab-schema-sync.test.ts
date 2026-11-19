import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { applyDevSqlMigrations } from "../scripts/sync-dev-cab-schema.mjs";

const tempDirectories: string[] = [];
const integrationDatabaseUrl =
  process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT
    ? undefined
    : process.env.CAB_SCHEMA_SYNC_TEST_DATABASE_URL;
const concurrentIndexBuildProbeEnabled =
  process.env.CAB_SCHEMA_SYNC_TEST_WITH_LOCK_PROBE === "1";

if (process.env.CAB_SCHEMA_SYNC_TEST_REQUIRED === "1" && !integrationDatabaseUrl) {
  throw new Error(
    "CAB schema sync integration tests require an isolated CAB_SCHEMA_SYNC_TEST_DATABASE_URL.",
  );
}

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

  it("runs explicitly selected index migrations concurrently without changing their checksum", async () => {
    const migrationSql = [
      "-- replit: concurrent-index",
      "CREATE INDEX IF NOT EXISTS sample_history_idx",
      "  ON sample_history (account_id, event_id, created_at);",
    ].join("\n");
    const migrationName = "003_sample_history_idx.sql";
    const directory = await createMigrationDirectory({ [migrationName]: migrationSql });
    const client = fakeClient();

    const result = await applyDevSqlMigrations(client, { directory });

    expect(result).toEqual({
      applied: [migrationName],
      alreadyApplied: [],
      deferred: null,
    });
    const indexBuild = client.query.mock.calls.find(([sql]) =>
      sql.includes("CREATE INDEX CONCURRENTLY"),
    );
    expect(indexBuild?.[0]).toBe(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS sample_history_idx\n  ON sample_history (account_id, event_id, created_at);",
    );
    expect(client.ledger.get(migrationName)).toBe(
      createHash("sha256").update(migrationSql).digest("hex"),
    );
    expect(client.query.mock.calls.findIndex(([sql]) =>
      sql.includes("CREATE INDEX CONCURRENTLY"),
    )).toBeLessThan(client.query.mock.calls.findIndex(([sql]) => sql === "BEGIN"));
  });

  it("keeps unmarked index migrations transactional", async () => {
    const directory = await createMigrationDirectory({
      "001_regular_index.sql":
        "CREATE INDEX IF NOT EXISTS regular_idx ON regular_table (account_id);",
    });
    const client = fakeClient();

    await applyDevSqlMigrations(client, { directory });

    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes("CREATE INDEX CONCURRENTLY"),
    )).toBe(false);
    expect(client.query.mock.calls.some(([sql]) =>
      sql === "CREATE INDEX IF NOT EXISTS regular_idx ON regular_table (account_id);",
    )).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => sql === "BEGIN")).toBe(true);
  });
});

describe("development SQL migration sync against PostgreSQL", () => {
  it.skipIf(!integrationDatabaseUrl)(
    "refuses to replace a same-name index on another table or with a different definition",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 1 });
      const migrationName = "001_conflicting_index.sql";
      const migrationSql = [
        "-- replit: concurrent-index",
        "CREATE INDEX IF NOT EXISTS expected_assignment_idx",
        "  ON change_approvals (change_id, original_approver_id);",
      ].join("\n");
      const directory = await createMigrationDirectory({ [migrationName]: migrationSql });

      try {
        for (const conflict of ["another table", "different definition"] as const) {
          const schemaName = `cab_conflicting_idx_${randomUUID().replaceAll("-", "")}`;
          const ledgerSchema = `cab_conflicting_ledger_${randomUUID().replaceAll("-", "")}`;
          const quotedSchema = `"${schemaName}"`;
          const quotedLedgerSchema = `"${ledgerSchema}"`;
          let client: Awaited<ReturnType<typeof pool.connect>> | undefined;

          try {
            client = await pool.connect();
            await client.query(`CREATE SCHEMA ${quotedSchema}`);
            await client.query(`CREATE SCHEMA ${quotedLedgerSchema}`);
            await client.query(`SET search_path TO ${quotedSchema}`);
            await client.query(`
              CREATE TABLE change_approvals (
                change_id varchar NOT NULL,
                original_approver_id varchar NOT NULL
              )
            `);
            await client.query(`
              CREATE TABLE other_approvals (
                change_id varchar NOT NULL,
                original_approver_id varchar NOT NULL
              )
            `);

            if (conflict === "another table") {
              await client.query(
                "CREATE INDEX expected_assignment_idx ON other_approvals (change_id, original_approver_id)",
              );
            } else {
              await client.query(
                "CREATE INDEX expected_assignment_idx ON change_approvals (change_id)",
              );
            }
            await client.query(`
              CREATE TABLE ${quotedLedgerSchema}.sql_migrations (
                migration_name text PRIMARY KEY,
                checksum text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
              )
            `);
            await client.query(
              `INSERT INTO ${quotedLedgerSchema}.sql_migrations
                (migration_name, checksum, applied_at)
               VALUES ('prior_migration.sql', 'prior-checksum', '2026-01-02T03:04:05Z')`,
            );

            const captureIndex = async () => {
              const { rows } = await client!.query(
                `SELECT table_class.relname AS table_name, pg_get_indexdef(index_class.oid) AS definition
                 FROM pg_class AS index_class
                 JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
                 JOIN pg_index AS index_info ON index_info.indexrelid = index_class.oid
                 JOIN pg_class AS table_class ON table_class.oid = index_info.indrelid
                 WHERE index_namespace.nspname = $1
                   AND index_class.relname = 'expected_assignment_idx'`,
                [schemaName],
              );
              return rows;
            };
            const captureLedger = async () => {
              const { rows } = await client!.query(
                `SELECT migration_name, checksum, applied_at::text AS applied_at
                 FROM ${quotedLedgerSchema}.sql_migrations
                 ORDER BY migration_name`,
              );
              return rows;
            };
            const indexBefore = await captureIndex();
            const ledgerBefore = await captureLedger();
            expect(ledgerBefore).toHaveLength(1);

            await expect(
              applyDevSqlMigrations(client, { directory, ledgerSchema }),
            ).rejects.toThrow(
              `Index ${schemaName}.expected_assignment_idx exists with a different table or definition; refusing to replace it.`,
            );

            expect(await captureIndex()).toEqual(indexBefore);
            expect(await captureLedger()).toEqual(ledgerBefore);
          } finally {
            if (client) {
              await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
              await client.query(`DROP SCHEMA IF EXISTS ${quotedLedgerSchema} CASCADE`).catch(() => {});
              client.release();
            }
          }
        }
      } finally {
        await pool.end();
      }
    },
    60_000,
  );

  it.skipIf(!integrationDatabaseUrl)(
    "preserves a CAB decision when only the deleted approver's original identity remains",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 1 });
      const schemaName = `cab_sync_retained_identity_${randomUUID().replaceAll("-", "")}`;
      const ledgerSchema = `cab_ledger_retained_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const migrationName = "20260929_preserve_cab_approval_history.sql";
      const migrationSql = await readFile(path.resolve("migrations", migrationName), "utf8");
      const directory = await createMigrationDirectory({ [migrationName]: migrationSql });
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
          CREATE TABLE change_approvals (
            id varchar PRIMARY KEY,
            change_id varchar NOT NULL,
            approver_id varchar,
            original_approver_id varchar NOT NULL,
            approver_label text,
            decision text,
            comments text,
            decided_at timestamptz,
            removed_at timestamptz,
            removed_by_id varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT change_approvals_approver_id_users_id_fk
              FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
          );
          INSERT INTO change_approvals (
            id, change_id, approver_id, original_approver_id, approver_label,
            decision, comments, decided_at
          ) VALUES (
            'approval-deleted-voter', 'change-retained', NULL, 'deleted-voter', NULL,
            'approved', 'Decision must remain recoverable', '2026-09-30T10:00:00Z'
          );
        `);

        const result = await applyDevSqlMigrations(client, { directory, ledgerSchema });
        expect(result.applied).toContain(migrationName);

        const upgraded = await client.query(`
          SELECT id, change_id, approver_id, original_approver_id, approver_label,
            decision, comments, decided_at
          FROM change_approvals
          WHERE id = 'approval-deleted-voter'
        `);
        expect(upgraded.rows).toEqual([
          {
            id: "approval-deleted-voter",
            change_id: "change-retained",
            approver_id: null,
            original_approver_id: "deleted-voter",
            approver_label: "deleted-voter",
            decision: "approved",
            comments: "Decision must remain recoverable",
            decided_at: new Date("2026-09-30T10:00:00Z"),
          },
        ]);
      } finally {
        if (client) {
          await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
          await client.query(`DROP SCHEMA IF EXISTS "${ledgerSchema}" CASCADE`);
          client.release();
        }
        await pool.end();
      }
    },
    60_000,
  );

  it.skipIf(!integrationDatabaseUrl)(
    "retries the unchanged CAB migration after restoring missing approver identity",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 1 });
      const schemaName = `cab_sync_missing_identity_${randomUUID().replaceAll("-", "")}`;
      const ledgerSchema = `cab_ledger_missing_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const quotedLedgerSchema = `"${ledgerSchema}"`;
      const migrationName = "20260929_preserve_cab_approval_history.sql";
      const migrationSql = await readFile(path.resolve("migrations", migrationName), "utf8");
      const migrationChecksum = createHash("sha256").update(migrationSql).digest("hex");
      const directory = await createMigrationDirectory({ [migrationName]: migrationSql });
      const authoritativeIdentityFixture = {
        approvalId: "approval-orphaned-identity",
        approverId: "restored-voter",
        firstName: "Recovered",
        lastName: "Operator",
        username: "recovered.operator",
      };
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
          CREATE TABLE change_approvals (
            id varchar PRIMARY KEY,
            change_id varchar NOT NULL,
            approver_id varchar,
            decision text,
            comments text,
            decided_at timestamptz,
            removed_at timestamptz,
            removed_by_id varchar,
            created_at timestamptz NOT NULL DEFAULT now()
          );
          INSERT INTO change_approvals
            (id, change_id, approver_id, decision, comments, decided_at)
          VALUES
            ('approval-orphaned-identity', 'change-retained', NULL, 'approved',
             'Decision must remain recoverable', '2026-09-30T10:00:00Z');
        `);

        const captureSchemaAndHistory = async () => {
          const columns = await client!.query(
            `SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = $1
             ORDER BY table_name, ordinal_position`,
            [schemaName],
          );
          const constraints = await client!.query(
            `SELECT relation.relname AS table_name, constraint_row.conname,
                pg_get_constraintdef(constraint_row.oid) AS definition
             FROM pg_constraint AS constraint_row
             JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
             WHERE constraint_row.connamespace = $1::regnamespace
             ORDER BY relation.relname, constraint_row.conname`,
            [schemaName],
          );
          const indexes = await client!.query(
            `SELECT tablename, indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = $1
             ORDER BY tablename, indexname`,
            [schemaName],
          );
          const approvals = await client!.query(`
            SELECT id, change_id, approver_id, decision, comments, decided_at,
              removed_at, removed_by_id, created_at
            FROM change_approvals
            ORDER BY id
          `);
          return {
            columns: columns.rows,
            constraints: constraints.rows,
            indexes: indexes.rows,
            approvals: approvals.rows,
          };
        };

        const beforeFailure = await captureSchemaAndHistory();
        await expect(
          applyDevSqlMigrations(client, { directory, ledgerSchema }),
        ).rejects.toThrow(
          "Cannot safely upgrade CAB approval history: approval row(s) approval-orphaned-identity have no recoverable approver identity. Restore each original approver ID from an authoritative audit record or backup, then rerun the migration; do not delete or recreate the approval decision.",
        );

        expect(await captureSchemaAndHistory()).toEqual(beforeFailure);
        const ledger = await client.query(
          `SELECT migration_name, checksum
           FROM ${quotedLedgerSchema}.sql_migrations
           ORDER BY migration_name`,
        );
        expect(ledger.rows).toEqual([]);

        await client.query(
          `INSERT INTO users (id, first_name, last_name, username)
           VALUES ($1, $2, $3, $4)`,
          [
            authoritativeIdentityFixture.approverId,
            authoritativeIdentityFixture.firstName,
            authoritativeIdentityFixture.lastName,
            authoritativeIdentityFixture.username,
          ],
        );
        const restoredApproval = await client.query(
          `UPDATE change_approvals
           SET approver_id = $2
           WHERE id = $1`,
          [authoritativeIdentityFixture.approvalId, authoritativeIdentityFixture.approverId],
        );
        expect(restoredApproval.rowCount).toBe(1);

        expect(await readFile(path.resolve("migrations", migrationName), "utf8"))
          .toBe(migrationSql);
        const retry = await applyDevSqlMigrations(client, { directory, ledgerSchema });
        expect(retry).toEqual({
          applied: [migrationName],
          alreadyApplied: [],
          deferred: null,
        });

        const upgradedApproval = await client.query(`
          SELECT id, change_id, approver_id, original_approver_id, approver_label,
            decision, comments, decided_at
          FROM change_approvals
          WHERE id = $1
        `, [authoritativeIdentityFixture.approvalId]);
        expect(upgradedApproval.rows).toEqual([
          {
            id: authoritativeIdentityFixture.approvalId,
            change_id: "change-retained",
            approver_id: authoritativeIdentityFixture.approverId,
            original_approver_id: authoritativeIdentityFixture.approverId,
            approver_label: "Recovered Operator",
            decision: "approved",
            comments: "Decision must remain recoverable",
            decided_at: new Date("2026-09-30T10:00:00Z"),
          },
        ]);

        const appliedLedger = await client.query(
          `SELECT migration_name, checksum
           FROM ${quotedLedgerSchema}.sql_migrations
           ORDER BY migration_name`,
        );
        expect(appliedLedger.rows).toEqual([
          { migration_name: migrationName, checksum: migrationChecksum },
        ]);
      } finally {
        if (client) {
          await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
          await client.query(`DROP SCHEMA IF EXISTS ${quotedLedgerSchema} CASCADE`);
          client.release();
        }
        await pool.end();
      }
    },
    60_000,
  );

  it.skipIf(!integrationDatabaseUrl)(
    "rolls back partial schema changes and the ledger row, then applies the repaired migration once",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 1 });
      const schemaName = `cab_sync_rollback_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const directory = await createMigrationDirectory({
        "001_partial_upgrade.sql":
          `CREATE TABLE ${quotedSchema}.partial_upgrade (id integer); SELECT 1 / 0;`,
      });
      let client: Awaited<ReturnType<typeof pool.connect>> | undefined;

      try {
        client = await pool.connect();
        await client.query(`CREATE SCHEMA ${quotedSchema}`);

        await expect(
          applyDevSqlMigrations(client, { directory, ledgerSchema: schemaName }),
        ).rejects.toThrow("Failed to apply SQL migration 001_partial_upgrade.sql");

        const afterFailure = await client.query(
          `SELECT to_regclass($1) AS relation,
             (SELECT count(*)::int FROM ${quotedSchema}.sql_migrations) AS ledger_count`,
          [`${schemaName}.partial_upgrade`],
        );
        expect(afterFailure.rows[0]).toEqual({ relation: null, ledger_count: 0 });

        await writeFile(
          path.join(directory, "001_partial_upgrade.sql"),
          `CREATE TABLE ${quotedSchema}.partial_upgrade (id integer);`,
        );
        const retry = await applyDevSqlMigrations(client, {
          directory,
          ledgerSchema: schemaName,
        });
        expect(retry).toEqual({
          applied: ["001_partial_upgrade.sql"],
          alreadyApplied: [],
          deferred: null,
        });

        const repeatedRun = await applyDevSqlMigrations(client, {
          directory,
          ledgerSchema: schemaName,
        });
        expect(repeatedRun).toEqual({
          applied: [],
          alreadyApplied: ["001_partial_upgrade.sql"],
          deferred: null,
        });
        const afterRetry = await client.query(`
          SELECT to_regclass($1) AS relation,
            (SELECT count(*)::int FROM ${quotedSchema}.sql_migrations) AS ledger_count
        `, [`${schemaName}.partial_upgrade`]);
        expect(afterRetry.rows[0]).toEqual({
          relation: `${schemaName}.partial_upgrade`,
          ledger_count: 1,
        });
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

  it.skipIf(!integrationDatabaseUrl)(
    "serializes concurrent runners and records each migration once",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 2 });
      const schemaName = `cab_sync_concurrent_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const directory = await createMigrationDirectory({
        "001_shared_upgrade.sql":
          `SELECT pg_sleep(0.25); CREATE TABLE ${quotedSchema}.shared_upgrade (id integer);`,
      });
      const clients: Array<Awaited<ReturnType<typeof pool.connect>>> = [];

      try {
        clients.push(await pool.connect(), await pool.connect());
        await clients[0].query(`CREATE SCHEMA ${quotedSchema}`);
        const backendIds = await Promise.all(
          clients.map(async (client) => {
            const { rows: [row] } = await client.query("SELECT pg_backend_pid() AS id");
            return row.id;
          }),
        );
        expect(backendIds[0]).not.toBe(backendIds[1]);

        const results = await Promise.all(
          clients.map((client) =>
            applyDevSqlMigrations(client, { directory, ledgerSchema: schemaName }),
          ),
        );
        expect(results.filter((result) => result.applied.length === 1)).toHaveLength(1);
        expect(results.filter((result) => result.alreadyApplied.length === 1)).toHaveLength(1);
        expect(results.every((result) => result.deferred === null)).toBe(true);

        const { rows: [ledger] } = await clients[0].query(`
          SELECT count(*)::int AS count, min(migration_name) AS migration_name
          FROM ${quotedSchema}.sql_migrations
        `);
        expect(ledger).toEqual({ count: 1, migration_name: "001_shared_upgrade.sql" });
        const { rows: [createdTable] } = await clients[0].query(
          "SELECT to_regclass($1) AS relation",
          [`${schemaName}.shared_upgrade`],
        );
        expect(createdTable.relation).toBe(`${schemaName}.shared_upgrade`);
      } finally {
        if (clients.length) {
          await clients[0].query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
          clients.forEach((client) => client.release());
        }
        await pool.end();
      }
    },
    60_000,
  );

  it.skipIf(!integrationDatabaseUrl)(
    "preserves CAB history and schema across repeated syncs in a temporary legacy schema",
    async () => {
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
          const columns = await client!.query(
            `SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = $1
             ORDER BY table_name, ordinal_position`,
            [schemaName],
          );
          const constraints = await client!.query(
            `SELECT relation.relname AS table_name, constraint_row.conname,
                pg_get_constraintdef(constraint_row.oid) AS definition
             FROM pg_constraint AS constraint_row
             JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
             WHERE constraint_row.connamespace = $1::regnamespace
             ORDER BY relation.relname, constraint_row.conname`,
            [schemaName],
          );
          const indexes = await client!.query(
            `SELECT tablename, indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = $1
             ORDER BY tablename, indexname`,
            [schemaName],
          );
          const approvals = await client!.query(`
            SELECT id, change_id, approver_id, original_approver_id, approver_label,
              decision, comments, decided_at, removed_at, removed_by_id, removed_by_label,
              created_at
            FROM change_approvals
            ORDER BY id
          `);
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

  // Keep this long-running scan out of the broad parallel suite: its active
  // PostgreSQL snapshot can postpone VACUUM visibility-map updates elsewhere.
  it.skipIf(!integrationDatabaseUrl || !concurrentIndexBuildProbeEnabled)(
    "keeps CAB writes available and retries an interrupted concurrent history index build",
    async () => {
      const pool = new Pool({ connectionString: integrationDatabaseUrl, max: 4 });
      const schemaName = `cab_concurrent_idx_${randomUUID().replaceAll("-", "")}`;
      const quotedSchema = `"${schemaName}"`;
      const migrationName = "001_test_cab_assignment_history_lookup_idx.sql";
      const migrationSql = [
        "-- replit: concurrent-index",
        await readFile(
          path.resolve("migrations/20261018_cab_assignment_history_lookup_idx.sql"),
          "utf8",
        ),
      ].join("\n");
      const migrationChecksum = createHash("sha256").update(migrationSql).digest("hex");
      const directory = await createMigrationDirectory({ [migrationName]: migrationSql });
      let migrationClient: Awaited<ReturnType<typeof pool.connect>> | undefined;
      let lockClient: Awaited<ReturnType<typeof pool.connect>> | undefined;
      let writerClient: Awaited<ReturnType<typeof pool.connect>> | undefined;
      let observerClient: Awaited<ReturnType<typeof pool.connect>> | undefined;
      let migrationPromise: Promise<unknown> | undefined;
      let backendPid: number | undefined;
      let writerLockOpen = false;

      try {
        migrationClient = await pool.connect();
        lockClient = await pool.connect();
        writerClient = await pool.connect();
        observerClient = await pool.connect();

        await migrationClient.query(`CREATE SCHEMA ${quotedSchema}`);
        await migrationClient.query(`
          CREATE TABLE ${quotedSchema}.change_approvals (
            change_id varchar NOT NULL,
            original_approver_id varchar NOT NULL
          )
        `);
        await migrationClient.query(
          `SET search_path TO ${quotedSchema}`,
        );
        await lockClient.query(`SET search_path TO ${quotedSchema}`);
        await writerClient.query(`SET search_path TO ${quotedSchema}`);

        await lockClient.query("BEGIN");
        writerLockOpen = true;
        await lockClient.query("LOCK TABLE change_approvals IN ROW EXCLUSIVE MODE");
        const { rows: [backend] } = await migrationClient.query(
          "SELECT pg_backend_pid() AS id",
        );
        backendPid = backend.id;

        migrationPromise = applyDevSqlMigrations(migrationClient, {
          directory,
          ledgerSchema: schemaName,
        });

        let reachedWriterWait = false;
        for (let attempt = 0; attempt < 2000; attempt += 1) {
          const { rows: [progress] } = await observerClient.query(
            `SELECT phase
             FROM pg_stat_progress_create_index
             WHERE pid = $1`,
            [backendPid],
          );
          if (progress?.phase === "waiting for writers before build") {
            reachedWriterWait = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(reachedWriterWait).toBe(true);

        await writerClient.query("SET statement_timeout TO '3s'");
        await expect(
          writerClient.query(
            `INSERT INTO change_approvals (change_id, original_approver_id)
             VALUES ('write-during-index', 'cab-approver')`,
          ),
        ).resolves.toMatchObject({ rowCount: 1 });

        const { rows: [cancelled] } = await observerClient.query(
          "SELECT pg_cancel_backend($1) AS cancelled",
          [backendPid],
        );
        expect(cancelled.cancelled).toBe(true);
        await expect(migrationPromise).rejects.toThrow();
        migrationPromise = undefined;
        migrationClient.release();
        migrationClient = undefined;

        const { rows: [interruptedIndex] } = await observerClient.query(
          `SELECT index_info.indisvalid
           FROM pg_index AS index_info
           JOIN pg_class AS index_class ON index_class.oid = index_info.indexrelid
           JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
           WHERE index_namespace.nspname = $1
             AND index_class.relname = 'change_approvals_change_original_approver_idx'`,
          [schemaName],
        );
        expect(interruptedIndex?.indisvalid).toBe(false);
        const { rows: [unrecordedMigration] } = await observerClient.query(
          `SELECT migration_name
           FROM "${schemaName}".sql_migrations
           WHERE migration_name = $1`,
          [migrationName],
        );
        expect(unrecordedMigration).toBeUndefined();

        await lockClient.query("COMMIT");
        writerLockOpen = false;

        const retryClient = await pool.connect();
        try {
          await retryClient.query(`SET search_path TO ${quotedSchema}`);
          const retryResult = await applyDevSqlMigrations(retryClient, {
            directory,
            ledgerSchema: schemaName,
          });
          expect(retryResult).toEqual({
            applied: [migrationName],
            alreadyApplied: [],
            deferred: null,
          });
          const { rows: [finishedIndex] } = await retryClient.query(
            `SELECT index_info.indisvalid
             FROM pg_index AS index_info
             JOIN pg_class AS index_class ON index_class.oid = index_info.indexrelid
             JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
             WHERE index_namespace.nspname = $1
               AND index_class.relname = 'change_approvals_change_original_approver_idx'`,
            [schemaName],
          );
          expect(finishedIndex?.indisvalid).toBe(true);
          const { rows: [ledgerEntry] } = await retryClient.query(
            `SELECT checksum FROM "${schemaName}".sql_migrations WHERE migration_name = $1`,
            [migrationName],
          );
          expect(ledgerEntry?.checksum).toBe(migrationChecksum);
        } finally {
          retryClient.release();
        }
      } finally {
        if (migrationPromise && backendPid && observerClient) {
          await observerClient.query("SELECT pg_cancel_backend($1)", [backendPid])
            .catch(() => {});
          await migrationPromise.catch(() => {});
        }
        if (writerLockOpen && lockClient) {
          await lockClient.query("ROLLBACK").catch(() => {});
        }
        if (observerClient) {
          await observerClient.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)
            .catch(() => {});
        }
        migrationClient?.release();
        lockClient?.release();
        writerClient?.release();
        observerClient?.release();
        await pool.end();
      }
    },
    60_000,
  );
});
