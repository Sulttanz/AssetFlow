import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDatabaseUrl = process.env.VITEST_TEST_DATABASE_URL;
const testEnvironment = { ...process.env };

// Never let the workspace's application or Neon credentials become a test
// target. Database integration tests only run with an explicitly supplied,
// isolated VITEST_TEST_DATABASE_URL.
for (const key of [
  "DATABASE_URL",
  "NEON_DATABASE_URL",
  "VITEST_TEST_DATABASE_URL",
  "CAB_SCHEMA_SYNC_TEST_DATABASE_URL",
  "CAB_SCHEMA_SYNC_TEST_REQUIRED",
  "REPLIT_DEPLOYMENT",
]) {
  delete testEnvironment[key];
}
testEnvironment.DATABASE_URL = testDatabaseUrl
  ?? "postgresql://vitest-disabled:vitest-disabled@127.0.0.1:1/vitest";
testEnvironment.RUN_DATABASE_INTEGRATION_TESTS = testDatabaseUrl ? "1" : "0";
testEnvironment.NODE_ENV = "test";
testEnvironment.SESSION_SECRET = "isolated-full-vitest-session-secret";

if (!testDatabaseUrl) {
  console.log(
    "Running without an external database. PostgreSQL integration tests are skipped; " +
    "set VITEST_TEST_DATABASE_URL to an isolated test database to enable them.",
  );
}

const result = spawnSync(
  process.execPath,
  [path.join(projectRoot, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.config.ts"],
  { cwd: projectRoot, stdio: "inherit", env: testEnvironment },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
