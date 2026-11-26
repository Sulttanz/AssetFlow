import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapFreshDatabase, repairLegacyRiskNumbers } from "./onprem-bootstrap";

const MIGRATION_DIRECTORY = path.resolve(
  process.cwd(),
  process.env.ONPREM_MIGRATIONS_DIR ?? "migrations/onprem",
);
const LEDGER_SCHEMA = "onprem_deploy";
const LOCK_ID = 24761006;
const ROLE_STANDARDIZATION_MIGRATION = "20261207_standardize_standard_roles.sql";
const ROLE_STANDARDIZATION_MIGRATION_SHA256 = "cb6b6a128495f654ca5cdceb25aa75687e7b584ef845c26b0361cd10447108f3";
const IT_RISK_GOVERNANCE_MIGRATION = "20261213_it_risk_governance.sql";
const IT_RISK_GOVERNANCE_MIGRATION_SHA256 = "39be85a56021d50aa190e50fe22bb8a8af2b40498786ea20b326e2f524cb8d2f";

export type StartupMigrationFailureDiagnostic = {
  code: "STARTUP_SCHEMA_UPGRADE_FAILED";
  stage: "database_connection" | "migration_ledger" | "migration" | "schema_verification";
  migration: string | null;
  sqlState?: string;
  detail: string;
};

export function safeFailureDetail(error: unknown): string {
  const seen = new Set<object>();

  const describe = (value: unknown, depth = 0): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (typeof value !== "object") return "Unknown error";
    if (seen.has(value)) return "[circular error cause]";
    if (depth >= 5) return "[additional nested error details omitted]";
    seen.add(value);

    const fields = value as Record<string, unknown>;
    const name = typeof fields.name === "string" ? fields.name : undefined;
    const message = typeof fields.message === "string" ? fields.message : undefined;
    const code = typeof fields.code === "string" || typeof fields.code === "number"
      ? `code ${String(fields.code)}`
      : undefined;
    const detail = typeof fields.detail === "string" ? fields.detail : undefined;
    const parts = [name, message, code, detail].filter((part): part is string => Boolean(part));

    if (value instanceof AggregateError || Array.isArray(fields.errors)) {
      const errors = Array.isArray(fields.errors) ? fields.errors : [];
      const nested = errors.slice(0, 5).map((item) => describe(item, depth + 1));
      if (nested.length) parts.push(`contained errors: ${nested.join("; ")}`);
      if (errors.length > 5) parts.push(`${errors.length - 5} additional errors omitted`);
    }

    if (fields.cause !== undefined) {
      parts.push(`caused by: ${describe(fields.cause, depth + 1)}`);
    }

    if (!parts.length) {
      try {
        const serialized = JSON.stringify(value);
        if (serialized && serialized !== "{}") parts.push(serialized);
      } catch {
        // Keep the fallback readable and avoid leaking an unhelpful [object Object].
      }
    }
    return parts.join(": ") || "Unknown object error";
  };

  const rawMessage = describe(error);
  const redacted = rawMessage
    .replace(/\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/)[^/\s@]+@/gi, "$1[REDACTED]@")
    .replace(
      /\b(password|passwd|pwd|secret|token|api[_-]?key|database_url|connection_string)\s*([=:])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1$2[REDACTED]",
    )
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return (redacted || "Unknown startup schema upgrade failure").slice(0, 400);
}

export class StartupMigrationError extends Error {
  readonly diagnostic: StartupMigrationFailureDiagnostic;

  constructor(
    stage: StartupMigrationFailureDiagnostic["stage"],
    migration: string | null,
    cause: unknown,
  ) {
    const detail = safeFailureDetail(cause);
    const rawCode = cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : undefined;
    const sqlState = rawCode && /^[A-Z0-9]{5}$/.test(rawCode) ? rawCode : undefined;
    const diagnostic: StartupMigrationFailureDiagnostic = {
      code: "STARTUP_SCHEMA_UPGRADE_FAILED",
      stage,
      migration,
      ...(sqlState ? { sqlState } : {}),
      detail,
    };

    super(`Startup schema upgrade failed: ${JSON.stringify(diagnostic)}`);
    this.name = "StartupMigrationError";
    this.diagnostic = diagnostic;
  }
}

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
  if (name === IT_RISK_GOVERNANCE_MIGRATION) {
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (checksum !== IT_RISK_GOVERNANCE_MIGRATION_SHA256) {
      throw new Error(`Migration ${name} does not match the reviewed risk-governance migration.`);
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
      (name === "20261211_users_optional_email.sql" && (
        /^ALTER TABLE users ALTER COLUMN email DROP NOT NULL$/i.test(statement) ||
        /^UPDATE\s+users\s+SET\s+email\s*=\s*NULL\s+WHERE\s+email\s+IS\s+NOT\s+NULL\s+AND\s+btrim\(email\)\s*=\s*''$/i.test(statement)
      ))
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
      (name === "20261217_location_department_imports.sql" &&
        /^DO \$locations_departments\$\s*BEGIN\s*IF NOT EXISTS\s*\([\s\S]*\)\s*THEN\s*ALTER TABLE departments\s+ADD CONSTRAINT departments_location_id_fkey\s+FOREIGN KEY \(location_id\) REFERENCES locations\(id\)\s+ON DELETE SET NULL NOT VALID;\s*END IF;\s*END;\s*\$locations_departments\$$/i.test(statement)) ||
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
  options: { bootstrapSql?: () => Promise<string> } = {},
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  const ledgerSchema = quoteSchemaIdentifier(LEDGER_SCHEMA);
  const ledgerTable = `${ledgerSchema}.sql_migrations`;
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  let lockAcquired = false;
  let startupFailure: StartupMigrationError | undefined;
  try {
    await client.query(`SELECT pg_advisory_lock(${LOCK_ID})`);
    lockAcquired = true;
    if (options.bootstrapSql) {
      try {
        await bootstrapFreshDatabase(client, options.bootstrapSql);
      } catch (error) {
        throw new StartupMigrationError("schema_verification", null, error);
      }
    }
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${ledgerSchema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${ledgerTable} (
        migration_name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const name of await migrationFiles(directory)) {
      try {
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

          if (name === IT_RISK_GOVERNANCE_MIGRATION) {
            await repairLegacyRiskNumbers(client);
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
          throw error;
        }
      } catch (error) {
        throw new StartupMigrationError("migration", name, error);
      }
    }
  } catch (error) {
    startupFailure = error instanceof StartupMigrationError
      ? error
      : new StartupMigrationError("migration_ledger", null, error);
    throw startupFailure;
  } finally {
    if (lockAcquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock(${LOCK_ID})`);
      } catch (error) {
        // Preserve the blocked migration name if cleanup also fails.
        if (!startupFailure) {
          throw new StartupMigrationError("migration_ledger", null, error);
        }
      }
    }
  }

  return { applied, alreadyApplied };
}

export async function runStartupMigrations(): Promise<void> {
  try {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      const result = await applyStartupMigrations(client, MIGRATION_DIRECTORY, {
        bootstrapSql: () => readFile(path.resolve(process.cwd(), "dist/onprem-bootstrap.sql"), "utf8"),
      });
      try {
        await assertCabStreamLeasesTable(client);
      } catch (error) {
        throw new StartupMigrationError("schema_verification", null, error);
      }
      console.log(
        `On-prem SQL migrations: ${result.applied.length} applied, ${result.alreadyApplied.length} already applied.`,
      );
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof StartupMigrationError) throw error;
    throw new StartupMigrationError("database_connection", null, error);
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
