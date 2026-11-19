import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cab-schema-sync-test-"));
const dataDirectory = path.join(tempRoot, "postgres-data");
const postgresLog = path.join(tempRoot, "postgres.log");
const reportPath = path.join(tempRoot, "vitest-report.json");
let postgresStarted = false;
const testEnvironment = {};
for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "CI"]) {
  if (process.env[key]) testEnvironment[key] = process.env[key];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Could not reserve a local PostgreSQL port.");
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function assertNoSkippedTests(report) {
  const expectedIntegrationTests = [
    "preserves a CAB decision when only the deleted approver's original identity remains",
    "retries the unchanged CAB migration after restoring missing approver identity",
    "rolls back partial schema changes and the ledger row, then applies the repaired migration once",
    "serializes concurrent runners and records each migration once",
    "preserves CAB history and schema across repeated syncs in a temporary legacy schema",
    "keeps CAB writes available and retries an interrupted concurrent history index build",
    "uses the index and preserves duplicate historical assignment rows",
  ];
  const assertions = report.testResults.flatMap((file) => file.assertionResults ?? []);
  const skipped = assertions.filter((test) => test.status !== "passed");
  assert.deepEqual(
    skipped.map((test) => `${test.status}: ${test.fullName}`),
    [],
    "CAB schema sync validation cannot pass when any test is skipped.",
  );
  for (const name of expectedIntegrationTests) {
    assert.ok(
      assertions.some((test) => test.fullName.endsWith(name) && test.status === "passed"),
      `Required PostgreSQL regression did not pass: ${name}`,
    );
  }
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
  ]);
  run("pg_ctl", [
    "-D", dataDirectory,
    "-l", postgresLog,
    "-o", `-h 127.0.0.1 -k ${tempRoot} -p ${port} -c listen_addresses=127.0.0.1`,
    "-w",
    "start",
  ]);
  postgresStarted = true;

  run("psql", [
    "--host", "127.0.0.1",
    "--port", String(port),
    "--username", "postgres",
    "--dbname", "postgres",
    "--set", "ON_ERROR_STOP=1",
    "--file", path.join(projectRoot, "scripts/fixtures/cab-schema-sync-legacy.sql"),
  ]);

  const result = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "vitest.config.ts",
      "server/dev-cab-schema-sync.test.ts",
      "server/startup-migrations.test.ts",
      "server/cab-assignment-plan.test.ts",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...testEnvironment,
        NODE_ENV: "test",
        CAB_SCHEMA_SYNC_TEST_REQUIRED: "1",
        CAB_SCHEMA_SYNC_TEST_WITH_LOCK_PROBE: "1",
        RUN_DATABASE_INTEGRATION_TESTS: "1",
        VITEST_NATIVE_PG: "1",
        DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
        VITEST_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
        CAB_SCHEMA_SYNC_TEST_DATABASE_URL:
          `postgresql://postgres@127.0.0.1:${port}/postgres`,
      },
    },
  );
  if (result.error) throw result.error;
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (result.status !== 0) {
    for (const test of report.testResults.flatMap((file) => file.assertionResults ?? [])) {
      if (test.status === "failed") {
        console.error(`${test.fullName}\n${test.failureMessages?.join("\n") ?? ""}`);
      }
    }
    throw new Error(`CAB schema sync integration tests failed with exit code ${result.status}`);
  }

  assertNoSkippedTests(report);
  console.log("CAB schema sync PostgreSQL regression passed with no skipped tests.");
} finally {
  try {
    if (postgresStarted) {
      run("pg_ctl", ["-D", dataDirectory, "-m", "fast", "-w", "stop"]);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
