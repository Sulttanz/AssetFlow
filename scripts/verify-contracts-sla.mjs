import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(projectRoot, "scripts/run-full-vitest.mjs");
const testFile = "server/contracts-sla-verification.test.ts";
const result = spawnSync(process.execPath, [runner, testFile], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
