import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_DIRECTORY = path.resolve(
  process.cwd(),
  process.env.ONPREM_MIGRATIONS_DIR ?? "migrations/onprem",
);
const LEDGER_SCHEMA = "onprem_deploy";
const LOCK_ID = 24761006;

function quoteSchemaIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(identifier)) {
    throw new Error(`Invalid migration ledger schema name: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function assertAdditiveMigration(sql: string, name: string): void {
  const executableSql = sql
    .replace(/--[^\n]*/g, "")
    .trim();
  const statements = executableSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (!statements.length) throw new Error(`Migration ${name} is empty.`);

  for (const statement of statements) {
    if (
      /^\s*(?:DROP|DELETE\b|TRUNCATE|RENAME|UPDATE)\b/i.test(statement) ||
      /^ALTER TABLE\b[\s\S]*\b(?:DROP|ALTER COLUMN|RENAME)\b/i.test(statement)
    ) {
      throw new Error(`Migration ${name} contains a destructive SQL operation.`);
    }
    const allowed =
      /^CREATE TABLE IF NOT EXISTS\b/i.test(statement) ||
      /^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS\b/i.test(statement) ||
      /^ALTER TABLE\b[\s\S]*\bADD COLUMN IF NOT EXISTS\b/i.test(statement) ||
      /^INSERT INTO\b[\s\S]*\bON CONFLICT\b[\s\S]*\bDO NOTHING$/i.test(statement);
    if (!allowed) {
      throw new Error(
        `Migration ${name} contains a non-additive or unsupported statement. Only CREATE ... IF NOT EXISTS, ALTER TABLE ... ADD COLUMN IF NOT EXISTS, and INSERT ... ON CONFLICT DO NOTHING are allowed.`,
      );
    }
  }
}

async function migrationFiles(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

export async function applyStartupMigrations(
  client: {
    query: (query: string, values?: unknown[]) => Promise<{ rows?: any[] }>;
  },
  directory = MIGRATION_DIRECTORY,
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  const ledgerSchema = quoteSchemaIdentifier(LEDGER_SCHEMA);
  const ledgerTable = `${ledgerSchema}.sql_migrations`;
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  await client.query(`SELECT pg_advisory_lock(${LOCK_ID})`);
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${ledgerSchema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${ledgerTable} (
        migration_name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const name of await migrationFiles(directory)) {
      const sql = await readFile(path.join(directory, name), "utf8");
      assertAdditiveMigration(sql, name);
      const checksum = createHash("sha256").update(sql).digest("hex");

      await client.query("BEGIN");
      try {
        const { rows = [] } = await client.query(
          `SELECT checksum FROM ${ledgerTable} WHERE migration_name = $1`,
          [name],
        );
        const existing = rows[0];
        if (existing) {
          if (existing.checksum !== checksum) {
            throw new Error(
              `Migration ${name} changed after it was recorded; add a new migration instead of editing an applied file.`,
            );
          }
          await client.query("COMMIT");
          alreadyApplied.push(name);
          continue;
        }

        await client.query(sql);
        await client.query(
          `INSERT INTO ${ledgerTable} (migration_name, checksum) VALUES ($1, $2)`,
          [name, checksum],
        );
        await client.query("COMMIT");
        applied.push(name);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(
          `Failed to apply on-prem migration ${name}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${LOCK_ID})`);
  }

  return { applied, alreadyApplied };
}

export async function runStartupMigrations(): Promise<void> {
  const { pool } = await import("./db");
  const client = await pool.connect();
  try {
    const result = await applyStartupMigrations(client);
    console.log(
      `On-prem SQL migrations: ${result.applied.length} applied, ${result.alreadyApplied.length} already applied.`,
    );
  } finally {
    client.release();
  }
}

export function compareAppVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const match = value.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) throw new Error(`Invalid application version: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}
