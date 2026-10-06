import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const replitConfig = await readFile(path.join(projectRoot, ".replit"), "utf8");
const npmExecutable = execFileSync("which", ["npm"], { encoding: "utf8" }).trim();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "build-audit-gate-"));
const fixtureDir = path.join(tempRoot, "fixture");
const shimDir = path.join(tempRoot, "bin");
const npmShim = path.join(shimDir, "npm");
const auditLog = path.join(tempRoot, "audit-calls.jsonl");
const buildMarker = path.join(fixtureDir, "build-ran");

function getDeploymentBuildCommand(configText) {
  const lines = configText.split(/\r?\n/);
  const deploymentStart = lines.findIndex(line => line.trim() === "[deployment]");
  assert.notEqual(deploymentStart, -1, ".replit must define a [deployment] section");

  const nextSection = lines.findIndex((line, index) =>
    index > deploymentStart && /^\s*\[[^\]]+\]\s*$/.test(line));
  const deploymentLines = lines.slice(deploymentStart + 1, nextSection === -1 ? undefined : nextSection);
  const buildSetting = deploymentLines.find(line => /^\s*build\s*=/.test(line));
  assert.ok(buildSetting, ".replit [deployment] section must define a build command");

  const buildMatch = buildSetting.match(/^\s*build\s*=\s*(\[[^\r\n]*\])\s*(?:#.*)?$/);
  assert.ok(buildMatch, ".replit deployment build command must be a string array");

  let buildCommand;
  assert.doesNotThrow(() => {
    buildCommand = JSON.parse(buildMatch[1]);
  }, ".replit deployment build command must contain valid JSON-compatible strings");
  assert.ok(Array.isArray(buildCommand), ".replit deployment build command must be an array");
  return buildCommand;
}

assert.deepEqual(
  getDeploymentBuildCommand(replitConfig).slice(0, 3),
  ["npm", "run", "build"],
  ".replit deployment build command must invoke the audited npm run build script",
);

try {
  assert.ok(packageJson.scripts["audit:security"], "package.json must define the security audit");
  assert.match(
    packageJson.scripts.build,
    /^npm run audit:security && /,
    "package.json build script must invoke the security audit directly instead of relying on lifecycle hooks",
  );
  await Promise.all([
    mkdir(fixtureDir, { recursive: true }),
    mkdir(shimDir, { recursive: true }),
  ]);

  await writeFile(path.join(fixtureDir, "package.json"), JSON.stringify({
    name: "build-audit-gate-fixture",
    private: true,
    type: "module",
    scripts: {
      "audit:security": packageJson.scripts["audit:security"],
      build: packageJson.scripts.build,
    },
  }, null, 2));
  const buildMarkerShim = `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.BUILD_AUDIT_GATE_BUILD_MARKER, "build script ran");
`;
  for (const buildTool of ["vite", "esbuild"]) {
    const shimPath = path.join(shimDir, buildTool);
    await writeFile(shimPath, buildMarkerShim);
    await chmod(shimPath, 0o755);
  }
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
      BUILD_AUDIT_GATE_BUILD_MARKER: buildMarker,
      npm_config_ignore_scripts: "true",
      NPM_CONFIG_IGNORE_SCRIPTS: "true",
    };

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