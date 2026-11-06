import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(projectRoot, "scripts/run-full-vitest.mjs");
const focusedSuites = [
  "server/ui-mutations-verification.test.ts",
  "client/src/pages/incident-service-requests.mutations.test.tsx",
  "client/src/pages/projects.test.tsx",
  "client/src/components/service-contracts/service-contracts-register.test.tsx",
  "server/incident-lifecycle.test.ts",
  "server/incident-contract-resolution.test.ts",
  "server/project-management.routes.test.ts",
  "server/project-management-validation.test.ts",
];

console.log("Running incident, project, and service-contract mutation checks in a disposable PostgreSQL test environment.");
const result = spawnSync(
  process.execPath,
  [runner, ...focusedSuites],
  { cwd: projectRoot, stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
