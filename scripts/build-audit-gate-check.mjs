import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const npmExecutable = execFileSync("which", ["npm"], { encoding: "utf8" }).trim();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "build-audit-gate-"));
const fixtureDir = path.join(tempRoot, "fixture");
const shimDir = path.join(tempRoot, "bin");
const npmShim = path.join(shimDir, "npm");
const auditLog = path.join(tempRoot, "audit-calls.jsonl");
const buildMarker = path.join(fixtureDir, "build-ran");

try {
  assert.ok(packageJson.scripts.prebuild, "package.json must define the prebuild audit gate");
  assert.ok(packageJson.scripts["audit:security"], "package.json must define the security audit");
  await Promise.all([
    mkdir(fixtureDir, { recursive: true }),
    mkdir(shimDir, { recursive: true }),
  ]);

  await writeFile(path.join(fixtureDir, "package.json"), JSON.stringify({
    name: "build-audit-gate-fixture",
    private: true,
    type: "module",
    scripts: {
      prebuild: packageJson.scripts.prebuild,
      "audit:security": packageJson.scripts["audit:security"],
      build: "node build-marker.mjs",
    },
  }, null, 2));
  await writeFile(path.join(fixtureDir, "build-marker.mjs"), `
import { writeFileSync } from "node:fs";
writeFileSync("build-ran", "build script ran");
`);
  await writeFile(npmShim, `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);

if (args[0] === "audit") {
  appendFileSync(process.env.BUILD_AUDIT_GATE_LOG, JSON.stringify(args) + "\\n");
  process.exit(Number(process.env.BUILD_AUDIT_GATE_STATUS));
}

const result = spawnSync(process.env.BUILD_AUDIT_GATE_REAL_NPM, args, {
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
`);
  await chmod(npmShim, 0o755);

  async function runScenario(auditStatus) {
    await rm(buildMarker, { force: true });
    await writeFile(auditLog, "");

    const env = {
      ...process.env,
      PATH: `${shimDir}${path.delimiter}${process.env.PATH ?? ""}`,
      BUILD_AUDIT_GATE_LOG: auditLog,
      BUILD_AUDIT_GATE_REAL_NPM: npmExecutable,
      BUILD_AUDIT_GATE_STATUS: String(auditStatus),
    };
    delete env.npm_config_ignore_scripts;
    delete env.NPM_CONFIG_IGNORE_SCRIPTS;

    const result = spawnSync(npmExecutable, ["run", "build"], {
      cwd: fixtureDir,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });
    if (result.error) throw result.error;

    const auditCalls = (await readFile(auditLog, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line));
    assert.deepEqual(auditCalls, [["audit", "--audit-level=high"]], "build must run the configured high-severity audit");
    return result;
  }

  const failedAudit = await runScenario(1);
  assert.notEqual(failedAudit.status, 0, "npm run build must fail when the security audit fails");
  assert.equal(await readFile(buildMarker, "utf8").catch(() => null), null,
    "the build script must not run after a failed audit");

  const successfulAudit = await runScenario(0);
  assert.equal(successfulAudit.status, 0, "npm run build must succeed when the security audit passes");
  assert.equal(await readFile(buildMarker, "utf8"), "build script ran",
    "the build script must run after a successful audit");

  console.log("Build audit gate check passed for failed and successful audits.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}