import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "full-vitest-postgres-"));
const dataDirectory = path.join(tempRoot, "postgres-data");
const postgresLog = path.join(tempRoot, "postgres.log");
const schemaName = `test_full_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
let postgresStarted = false;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || `exit code ${result.status}`}`);
  }
  return result;
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve a local PostgreSQL port.");
  }
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return address.port;
}

function testEnvironment(extra = {}) {
  const env = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "CI"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, NODE_ENV: "test", ...extra };
}

try {
  const port = await findAvailablePort();
  run("initdb", [
    "-D", dataDirectory,
    "--no-locale",
    "--encoding=UTF8",
    "--auth-local=trust",
    "--auth-host=trust",
    "--username=postgres",
    "--no-instructions",
  ], { stdio: "inherit", env: testEnvironment() });

  run("pg_ctl", [
    "-D", dataDirectory,
    "-l", postgresLog,
    "-o", `-h 127.0.0.1 -k ${tempRoot} -p ${port} -c listen_addresses=127.0.0.1`,
    "-w",
    "start",
  ], { stdio: "inherit", env: testEnvironment() });
  postgresStarted = true;

  const adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  run("psql", [
    "--host", "127.0.0.1",
    "--port", String(port),
    "--username", "postgres",
    "--dbname", "postgres",
    "--set", "ON_ERROR_STOP=1",
    "--file", path.join(projectRoot, "scripts/fixtures/cab-schema-sync-legacy.sql"),
  ], { stdio: "inherit", env: testEnvironment() });

  const schemaSetup = run(process.execPath, [
    "--import", "tsx",
    path.join(projectRoot, "scripts/initialize-vitest-schema.ts"),
  ], {
    stdio: "inherit",
    env: testEnvironment({
      DATABASE_URL: adminUrl,
      VITEST_SCHEMA_NAME: schemaName,
    }),
  });
  if (schemaSetup.status !== 0) throw new Error("Failed to initialize the isolated Vitest schema.");

  const applicationUrl = new URL(adminUrl);
  applicationUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  const isolatedDatabaseUrl = applicationUrl.toString();

  console.log("Running Vitest against a disposable local PostgreSQL cluster; app database secrets are not passed to tests.");
  const vitestCli = path.join(projectRoot, "node_modules/vitest/vitest.mjs");
  const vitestEnvironment = testEnvironment({
    DATABASE_URL: isolatedDatabaseUrl,
    VITEST_TEST_DATABASE_URL: isolatedDatabaseUrl,
    CAB_SCHEMA_SYNC_TEST_DATABASE_URL: adminUrl,
    CAB_SCHEMA_SYNC_TEST_REQUIRED: "1",
    RUN_DATABASE_INTEGRATION_TESTS: "1",
    VITEST_NATIVE_PG: "1",
    SESSION_SECRET: "isolated-full-vitest-session-secret",
    ...(process.env.RUN_COMPREHENSIVE_SEED_TESTS === "1"
      ? { RUN_COMPREHENSIVE_SEED_TESTS: "1" }
      : {}),
  });
  const runVitest = (args) => spawnSync(
    process.execPath,
    [vitestCli, "run", "--config", "vitest.config.ts", ...args],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: vitestEnvironment,
    },
  );
  const selectedTests = process.argv.slice(2);
  const fullSuite = runVitest(selectedTests.length
    ? selectedTests
    : ["--exclude", "server/change-overview-plan.test.ts"]);
  if (fullSuite.error) throw fullSuite.error;
  if (fullSuite.status !== 0) {
    process.exitCode = fullSuite.status ?? 1;
  } else if (selectedTests.length === 0) {
    console.log("Running the CAB overview planner benchmark separately to avoid overlapping PostgreSQL snapshots.");
    const isolatedPlannerSuite = runVitest(["server/change-overview-plan.test.ts"]);
    if (isolatedPlannerSuite.error) throw isolatedPlannerSuite.error;
    if (isolatedPlannerSuite.status !== 0) process.exitCode = isolatedPlannerSuite.status ?? 1;
  }
} finally {
  try {
    if (postgresStarted) {
      run("pg_ctl", ["-D", dataDirectory, "-m", "fast", "-w", "stop"], {
        env: testEnvironment(),
      });
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
