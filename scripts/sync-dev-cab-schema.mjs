import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "migrations");
const migrationLockId = 24761005;
const missingSchemaErrorCodes = new Set(["42P01", "42703"]);

function quoteSchemaIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(identifier)) {
    throw new Error(`Invalid migration ledger schema name: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function discoverMigrations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

function migrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

function assertMigrationHasNoTransactionWrapper(sql, name) {
  const executableLines = sql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"));
  const firstLine = executableLines[0] ?? "";
  const lastLine = executableLines.at(-1) ?? "";

  if (/^(BEGIN|START TRANSACTION)\s*;?$/i.test(firstLine) ||
      /^(COMMIT|END|ROLLBACK)\s*;?$/i.test(lastLine)) {
    throw new Error(
      `Migration ${name} must not include BEGIN/COMMIT; each migration is run in its own transaction.`,
    );
  }
}

async function assertCabApprovalIdentityRecoverable(client) {
  const { rows: [columnInfo] } = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'original_approver_id'
    ) AS has_original_approver_id
  `);
  const hasOriginalId = columnInfo?.has_original_approver_id === true;
  const identityMissingPredicate = hasOriginalId
    ? "COALESCE(a.original_approver_id, a.approver_id) IS NULL"
    : "(a.approver_id IS NULL OR u.id IS NULL)";
  const { rows: [result] } = await client.query(`
    SELECT string_agg(a.id, ', ' ORDER BY a.id) AS affected_approval_ids
    FROM change_approvals AS a
    LEFT JOIN users AS u ON u.id = a.approver_id
    WHERE ${identityMissingPredicate}
  `);
  if (result?.affected_approval_ids) {
    throw new Error(
      `Cannot safely upgrade CAB approval history: approval row(s) ${result.affected_approval_ids} have no recoverable approver identity. Restore each original approver ID from an authoritative audit record or backup, then rerun the migration; do not delete or recreate the approval decision.`,
    );
  }
}

/**
 * Apply every discovered SQL migration in filename order. The caller owns the
 * connection so this runner can be tested without a live database.
 */
export async function applyDevSqlMigrations(
  client,
  {
    directory = migrationDirectory,
    deferMissingSchema = false,
    ledgerSchema = "replit_workspace_setup",
  } = {},
) {
  const quotedLedgerSchema = quoteSchemaIdentifier(ledgerSchema);
  const migrationLedger = `${quotedLedgerSchema}.sql_migrations`;
  const migrations = await discoverMigrations(directory);
  const result = { applied: [], alreadyApplied: [], deferred: null };

  await client.query(`SELECT pg_advisory_lock(${migrationLockId})`);
  try {
    // Keep setup bookkeeping outside the app schema so Drizzle's schema push
    // does not interpret it as an application table to remove.
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedLedgerSchema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationLedger} (
        migration_name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const name of migrations) {
      const sql = await readFile(path.join(directory, name), "utf8");
      assertMigrationHasNoTransactionWrapper(sql, name);
      const checksum = migrationChecksum(sql);

      await client.query("BEGIN");
      try {
        const { rows: [existing] } = await client.query(
          `SELECT checksum FROM ${migrationLedger} WHERE migration_name = $1`,
          [name],
        );

        if (existing) {
          if (existing.checksum !== checksum) {
            throw new Error(
              `Migration ${name} changed after it was recorded; add a new migration instead of editing an applied file.`,
            );
          }
          await client.query("COMMIT");
          result.alreadyApplied.push(name);
          continue;
        }

        if (name === "20260929_preserve_cab_approval_history.sql") {
          await assertCabApprovalIdentityRecoverable(client);
        }
        await client.query(sql);
        await client.query(
          `INSERT INTO ${migrationLedger} (migration_name, checksum) VALUES ($1, $2)`,
          [name, checksum],
        );
        await client.query("COMMIT");
        result.applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (deferMissingSchema && missingSchemaErrorCodes.has(error?.code)) {
          result.deferred = name;
          break;
        }
        throw new Error(`Failed to apply SQL migration ${name}: ${error.message}`, {
          cause: error,
        });
      }
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${migrationLockId})`);
  }

  return result;
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Development SQL migrations are limited to NODE_ENV=development.");
  }
  if (!process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Development SQL migrations are limited to a Replit development workspace.");
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--defer-missing-schema")) {
    throw new Error("Usage: node scripts/sync-dev-cab-schema.mjs [--defer-missing-schema]");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for development SQL migrations.");
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    const result = await applyDevSqlMigrations(client, {
      deferMissingSchema: args.includes("--defer-missing-schema"),
    });
    console.log(`Development SQL migrations applied: ${result.applied.length}`);
    console.log(`Development SQL migrations already applied: ${result.alreadyApplied.length}`);
    if (result.deferred) {
      console.log(`Deferred ${result.deferred} and later migrations until the schema is available.`);
    }
  } finally {
    client?.release();
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Development SQL migration sync failed:", error.message);
    process.exitCode = 1;
  });
}