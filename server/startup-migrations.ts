import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_DIRECTORY = path.resolve(
  process.cwd(),
  process.env.ONPREM_MIGRATIONS_DIR ?? "migrations/onprem",
);
const LEDGER_SCHEMA = "onprem_deploy";
const LOCK_ID = 24761006;
const ROLE_STANDARDIZATION_MIGRATION = "20261207_standardize_standard_roles.sql";
const ROLE_STANDARDIZATION_MIGRATION_SHA256 = "cb6b6a128495f654ca5cdceb25aa75687e7b584ef845c26b0361cd10447108f3";

function quoteSchemaIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(identifier)) {
    throw new Error(`Invalid migration ledger schema name: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function assertAdditiveMigration(sql: string, name: string): void {
  if (name === ROLE_STANDARDIZATION_MIGRATION) {
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (checksum !== ROLE_STANDARDIZATION_MIGRATION_SHA256) {
      throw new Error(`Migration ${name} does not match the reviewed role-merging migration.`);
    }
    return;
  }
  const executableSql = sql.replace(/--[^\n]*/g, "").trim();
  const statements: string[] = [];
  let statement = "";
  let dollarTag: string | undefined;
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < executableSql.length; index += 1) {
    const char = executableSql[index];
    if (dollarTag) {
      if (executableSql.startsWith(dollarTag, index)) {
        statement += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = undefined;
      } else {
        statement += char;
      }
      continue;
    }
    if (quote) {
      statement += char;
      if (char === quote && executableSql[index + 1] === quote) {
        statement += executableSql[index + 1];
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      statement += char;
      continue;
    }
    if (char === "$") {
      const tag = /^\$[a-z_][a-z0-9_]*\$|^\$\$/i.exec(executableSql.slice(index))?.[0];
      if (tag) {
        dollarTag = tag;
        statement += tag;
        index += tag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      if (statement.trim()) statements.push(statement.trim());
      statement = "";
    } else {
      statement += char;
    }
  }
  if (statement.trim()) statements.push(statement.trim());

  if (!statements.length) throw new Error(`Migration ${name} is empty.`);

  for (const statement of statements) {
    // This data-preserving relaxation is intentionally narrower than permitting
    // arbitrary ALTER COLUMN, DROP, or UPDATE statements in startup migrations.
    if (
      /^ALTER TABLE employees ALTER COLUMN email DROP NOT NULL$/i.test(statement) ||
      /^UPDATE employees SET email = NULL WHERE email IS NOT NULL AND email ~ '\^\[\[:space:\]\]\*\$'$/i.test(statement)
    ) continue;
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
      /^INSERT INTO\b[\s\S]*\bON CONFLICT\b[\s\S]*\bDO NOTHING$/i.test(statement) ||
      /^INSERT INTO module_settings\s*\(module_key,\s*enabled\)\s*VALUES\s*\('project_management',\s*true\)\s*ON CONFLICT\s*\(module_key\)\s*DO UPDATE SET enabled = true\s+WHERE module_settings\.updated_by IS NULL$/i.test(statement) ||
      /^CREATE OR REPLACE FUNCTION project_management_touch_updated_at\(\)\s+RETURNS trigger\s+LANGUAGE plpgsql\s+AS \$\$\s*BEGIN\s*NEW\.updated_at\s*:=\s*CURRENT_TIMESTAMP;\s*RETURN NEW;\s*END;\s*\$\$$/i.test(statement) ||
      /^DO \$project_management\$\s*BEGIN\s*IF NOT EXISTS\s*\(\s*SELECT 1 FROM pg_trigger\s+WHERE tgname = 'project_management_updated_at'\s+AND tgrelid = 'projects'::regclass\s*\)\s*THEN\s*CREATE TRIGGER project_management_updated_at\s+BEFORE UPDATE ON projects\s+FOR EACH ROW\s+EXECUTE FUNCTION project_management_touch_updated_at\(\);\s*END IF;\s*END;\s*\$project_management\$$/i.test(statement) ||
      /^DO \$project_workspace\$\s*BEGIN\s*IF NOT EXISTS\s*\(\s*SELECT 1 FROM pg_trigger\s+WHERE tgname = 'project_workspace_updated_at'\s+AND tgrelid = '(project_risks|project_changes)'::regclass\s*\)\s*THEN\s*CREATE TRIGGER project_workspace_updated_at\s+BEFORE UPDATE ON \1\s+FOR EACH ROW\s+EXECUTE FUNCTION project_management_touch_updated_at\(\);\s*END IF;\s*END;\s*\$project_workspace\$$/i.test(statement);
    if (!allowed) {
      throw new Error(
        `Migration ${name} contains a non-additive or unsupported statement: ${statement.slice(0, 180)}. Only approved additive schema statements and explicitly allowlisted updates are allowed.`,
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
    await assertCabStreamLeasesTable(client);
    console.log(
      `On-prem SQL migrations: ${result.applied.length} applied, ${result.alreadyApplied.length} already applied.`,
    );
  } finally {
    client.release();
  }
}

export async function assertCabStreamLeasesTable(client: {
  query: (query: string, values?: unknown[]) => Promise<{ rows?: any[] }>;
}): Promise<void> {
  const { rows = [] } = await client.query(
    "SELECT to_regclass('cab_stream_leases') AS table_name",
  );
  if (!rows[0]?.table_name) {
    throw new Error(
      "Required CAB event lease table cab_stream_leases is missing after startup migrations.",
    );
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
