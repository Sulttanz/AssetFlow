// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as schema from "../shared/schema";
import { bootstrapFreshDatabase, repairLegacyRiskNumbers } from "./onprem-bootstrap";
import { applyStartupMigrations } from "./startup-migrations";
// Test-only import: this helper is intentionally plain Node for installer use.
import { readEnvValue, unmanagedEnv } from "../scripts/onprem-env.mjs";

describe("on-prem deployment safeguards", () => {
  it("includes build tools even under production install defaults without weakening the runtime audit", async () => {
    const { scripts } = JSON.parse(await readFile("package.json", "utf8"));
    const installer = await readFile("scripts/onprem-install.sh", "utf8");
    expect(scripts["audit:security"]).toBe("npm audit --omit=dev --audit-level=high");
    expect(installer).toContain('npm run build:onprem');
    expect(installer).toContain('runuser -u assetflow -- bash -c');
    expect(scripts["build:onprem"]).toContain("npm ci --include=dev");
    // Exercise the actual build-phase command with a fake npm function rather
    // than installing packages or touching the host's system configuration.
    const result = spawnSync("bash", ["-eu", "-c", `
      installed=false
      npm() {
        if [[ "$*" == "ci --include=dev" ]]; then
          [[ "$NODE_ENV" == production && "$npm_config_omit" == dev ]]
          installed=true
        elif [[ "$*" == "run build" ]]; then
          [[ "$installed" == true ]]
          printf 'production-build-tools-ready'
        else
          return 1
        fi
      }
      ${scripts["build:onprem"]}
    `], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, NODE_ENV: "production", npm_config_omit: "dev" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("production-build-tools-ready");
  });

  it("only bootstraps an empty schema and refuses partial installations", async () => {
    const load = vi.fn(async () => "CREATE TABLE baseline_test(id int)");
    const statements: string[] = [];
    const empty = { query: vi.fn(async (sql: string) => {
      statements.push(sql);
      return { rows: [] };
    }) };
    await expect(bootstrapFreshDatabase(empty, load)).resolves.toBe(true);
    expect(statements.slice(1)).toEqual(["BEGIN", "CREATE TABLE baseline_test(id int)", "COMMIT"]);
    load.mockClear();
    const populated = { query: async () => ({
      rows: ["users", "settings", "roles", "permissions", "employees", "assets", "incidents"]
        .map(table_name => ({ table_name })),
    }) };
    await expect(bootstrapFreshDatabase(populated, load)).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
    await expect(bootstrapFreshDatabase({
      query: async () => ({ rows: [{ table_name: "users" }] }),
    }, load)).rejects.toThrow(/automatic bootstrap was refused/);
    expect(load).not.toHaveBeenCalled();
  });

  it("rolls back a failed base schema without pretending initialization succeeded", async () => {
    const statements: string[] = [];
    const client = { query: async (sql: string) => {
      statements.push(sql);
      if (sql === "invalid baseline") throw new Error("invalid baseline");
      return { rows: [] };
    } };
    await expect(bootstrapFreshDatabase(client, async () => "invalid baseline")).rejects.toThrow();
    expect(statements.slice(-1)).toEqual(["ROLLBACK"]);
  });

  it("reads existing quoted/whitespace/commented credentials without evaluating shell code", () => {
    const text = [
      "# comment", " export ASSETFLOW_DB_PASSWORD = '" + "a".repeat(64) + "' # retained",
      ' SESSION_SECRET = "a long existing secret with spaces and # characters" # comment',
      'PORT = 5000 # port', 'OPERATOR_TOKEN="$(do-not-execute)"',
      'export DATABASE_URL = "postgresql://placeholder"',
    ].join("\n");
    expect(readEnvValue(text, "ASSETFLOW_DB_PASSWORD")).toBe("a".repeat(64));
    expect(readEnvValue(text, "SESSION_SECRET")).toBe("a long existing secret with spaces and # characters");
    expect(readEnvValue(text, "PORT")).toBe("5000");
    const preserved = unmanagedEnv(text);
    expect(preserved).toContain('OPERATOR_TOKEN="$(do-not-execute)"');
    expect(preserved).not.toContain("DATABASE_URL");
    expect(preserved).not.toContain("SESSION_SECRET");
    expect(() => readEnvValue('SESSION_SECRET="unterminated', "SESSION_SECRET")).toThrow(/Invalid quoted/);
    // Bind aliases are normalized to managed HOST/PORT by the installer, not
    // retained as stale overrides that could desynchronize Nginx and health.
    expect(unmanagedEnv("BIND_HOST=0.0.0.0\nBIND_PORT=5050\nCUSTOM_FLAG=retained"))
      .toBe("CUSTOM_FLAG=retained\n");
  });

  it("retains hard shell, path, runtime, timeout, backup, and single-start guards", async () => {
    const installer = await readFile("scripts/onprem-install.sh", "utf8");
    const upgrade = await readFile("scripts/onprem-upgrade.sh", "utf8");
    expect(spawnSync("bash", ["-n", "scripts/onprem-install.sh", "scripts/onprem-upgrade.sh"]).status).toBe(0);
    expect(installer).toContain("set -euo pipefail");
    expect(installer).toContain('APP_DIR="$(realpath -m -- "$APP_DIR")"');
    expect(installer).toContain("ALLOW_SYMLINK_APP_DIR");
    expect(installer).toContain('"$NODE_MAJOR" -lt 22');
    expect(installer).toContain('"$INSTALLED_NODE_MAJOR" -ge 22');
    expect(installer).toContain("TimeoutStopSec=30");
    expect(installer).toContain("systemctl start assetflow.service");
    expect(installer).not.toContain("systemctl restart assetflow.service");
    expect(installer).not.toContain("systemctl enable --now assetflow.service");
    for (const script of [installer, upgrade]) {
      expect(script).toContain("--connect-timeout 2 --max-time");
      expect(script).toContain("SECONDS < HEALTH_DEADLINE");
    }
    expect(upgrade).toContain("/var/backups/assetflow");
    expect(upgrade).toContain("mktemp -d");
    expect(upgrade).toContain("set -o noclobber");
    expect(upgrade).toContain('dist/onprem-bootstrap.sql');
  });

  it("keeps host-native TLS optional and constrains the generated proxy and private key", async () => {
    const helper = await readFile("scripts/onprem-https.sh", "utf8");
    const installer = await readFile("scripts/onprem-install.sh", "utf8");
    expect(spawnSync("bash", ["-n", "scripts/onprem-https.sh"]).status).toBe(0);
    expect(installer).toContain('ENABLE_HTTPS="${ENABLE_HTTPS:-false}"');
    expect(installer).toContain('APP_HOST="${BIND_HOST:-${HOST:-127.0.0.1}}"');
    expect(installer).toContain('APP_PORT="${BIND_PORT:-${PORT:-}}"');
    expect(installer).toContain("scripts/onprem-https.sh");
    const certificateHelper = await readFile("scripts/onprem-tls.sh", "utf8");
    expect(certificateHelper).toContain("subjectAltName=${subject_alt_name}");
    expect(helper).toContain('install -o root -g root -m 0600 "$WORK_DIR/server.key" "$KEY"');
    expect(helper).toContain("listen 443 ssl;");
    expect(helper).toContain("ssl_protocols TLSv1.2 TLSv1.3;");
    expect(helper).toContain("proxy_set_header X-Forwarded-Proto \\$scheme;");
    expect(helper).toContain("proxy_set_header X-Forwarded-For \\$remote_addr;");
    expect(helper).not.toContain("$proxy_add_x_forwarded_for");
    expect(helper).toContain("if ! nginx -t;");
    expect(helper.indexOf("if ! nginx -t;")).toBeLessThan(helper.indexOf("systemctl enable nginx"));
    expect(helper.indexOf("if ! nginx -t;")).toBeLessThan(helper.indexOf("systemctl reload nginx"));
    expect(helper).toContain('if [[ "$TLS_PAIR_REUSED" != true ]]; then');
    expect(helper).toContain("prior AssetFlow TLS configuration restored");
  });

  it("documents native PostgreSQL CAB listener keepalive and bind aliases", async () => {
    const listener = await readFile("server/cab-events.ts", "utf8");
    const runtime = await readFile("server/server-bind.ts", "utf8");
    const docs = await readFile("DEPLOY_ONPREM.md", "utf8");
    expect(listener).toContain('application_name: "assetflow-cab-events"');
    expect(listener).toContain('client.query("SELECT 1")');
    expect(listener).toContain("listenerHeartbeatIntervalMs = 20_000");
    expect(runtime).toContain('env.BIND_HOST?.trim() || env.HOST?.trim()');
    expect(runtime).toContain('env.BIND_PORT?.trim() || env.PORT?.trim()');
    expect(docs).toContain("BIND_HOST` / `BIND_PORT");
    expect(docs).toContain("lightweight `SELECT 1` heartbeat every 20 seconds");
  });
});

const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1";
describe.runIf(integrationEnabled)("fresh PostgreSQL deployment and upgrade integration", () => {
  let admin: Pool | undefined;
  let database: Pool | undefined;
  const databaseName = `test_onprem_${randomUUID().replaceAll("-", "")}`;
  afterAll(async () => {
    await database?.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.end();
    }
  });

  it("boots a genuinely empty database, applies every on-prem migration, then reruns without data loss", async () => {
    const url = new URL(process.env.VITEST_TEST_DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) ||
        !url.searchParams.get("options")?.includes("test_") ||
        process.env.VITEST_NATIVE_PG !== "1") {
      throw new Error("On-prem integration test requires the disposable local full-Vitest cluster.");
    }
    url.searchParams.delete("options");
    admin = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 10_000 });
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    url.pathname = `/${databaseName}`;
    database = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 10_000 });
    const baseline = (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))).join("\n");
    const client = await database.connect();
    try {
      const first = await applyStartupMigrations(client, undefined, { bootstrapSql: async () => baseline });
      expect(first.applied.length).toBeGreaterThanOrEqual(61);
      await client.query("INSERT INTO settings(key, value) VALUES ('onprem_bootstrap_canary', 'preserved')");
      const loader = vi.fn(async () => { throw new Error("Existing schema must never load baseline"); });
      const second = await applyStartupMigrations(client, undefined, { bootstrapSql: loader });
      expect(second.applied).toEqual([]);
      expect(second.alreadyApplied).toEqual(first.applied);
      expect(loader).not.toHaveBeenCalled();
      expect((await client.query("SELECT value FROM settings WHERE key='onprem_bootstrap_canary'")).rows[0].value)
        .toBe("preserved");
    } finally { client.release(); }
  }, 120_000);

  it("repairs duplicate/blank historical risk numbers without deleting risks or colliding with existing references", async () => {
    if (!database) throw new Error("Fresh bootstrap did not succeed");
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      await client.query("DROP INDEX risk_register_number_uq");
      await client.query("ALTER TABLE risk_register ALTER COLUMN risk_number DROP NOT NULL");
      await client.query(`INSERT INTO risk_register(title, likelihood, impact, risk_number) VALUES
        ('Original',1,1,'IT-RSK-001'),('Duplicate',1,1,'IT-RSK-001'),
        ('Reserved',1,1,'IT-RSK-002'),('Null',1,1,NULL),('Blank',1,1,'')`);
      await repairLegacyRiskNumbers(client);
      await client.query(await readFile("migrations/onprem/20261213_it_risk_governance.sql", "utf8"));
      const { rows } = await client.query("SELECT title, risk_number FROM risk_register");
      expect(rows).toHaveLength(5);
      expect(new Set(rows.map(row => row.risk_number)).size).toBe(5);
      expect(rows.find(row => row.title === "Reserved").risk_number).toBe("IT-RSK-002");
      expect(rows.filter(row => row.risk_number === "IT-RSK-001")).toHaveLength(1);
      const repairs = await client.query("SELECT * FROM onprem_deploy.risk_number_repairs");
      expect(repairs.rowCount).toBe(3);
      await repairLegacyRiskNumbers(client);
      expect((await client.query("SELECT * FROM onprem_deploy.risk_number_repairs")).rowCount).toBe(3);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }, 30_000);
});
