// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const library = path.resolve("scripts/onprem-tls.sh");
const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function fixture(name: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "assetflow-tls-test-"));
  temporaryDirectories.push(root);
  const installed = path.join(root, "installed");
  const stage = path.join(root, "stage");
  await mkdir(installed, { mode: 0o700 });
  await mkdir(stage, { mode: 0o700 });
  const env = {
    PATH: process.env.PATH,
    TLS_SERVER_NAME: name,
    CERT: path.join(installed, "server.crt"),
    KEY: path.join(installed, "server.key"),
    WORK_DIR: stage,
    TLS_CERT_FILE: "",
    TLS_KEY_FILE: "",
    TLS_REGENERATE: "false",
  };
  const prepare = (overrides: Record<string, string> = {}) => spawnSync("bash", [
    "-euo", "pipefail", "-c",
    'umask 077; source "$1"; prepare_assetflow_tls; printf "\\nREUSED=%s\\n" "$TLS_PAIR_REUSED"',
    "_", library,
  ], { env: { ...env, ...overrides }, encoding: "utf8", timeout: 30_000 });
  const persist = async () => {
    await copyFile(path.join(stage, "server.crt"), env.CERT);
    await copyFile(path.join(stage, "server.key"), env.KEY);
    await chmod(env.CERT, 0o644);
    await chmod(env.KEY, 0o600);
  };
  return { env, stage, prepare, persist };
}

describe("automatic on-prem self-signed TLS certificates", () => {
  it.each([
    { name: "192.168.6.1", san: "IP Address:192.168.6.1", check: "-checkip" },
    { name: "assetflow.example.internal", san: "DNS:assetflow.example.internal", check: "-checkhost" },
  ])("generates a matching SAN and protected key for $name", async ({ name, san, check }) => {
    const f = await fixture(name);
    const result = f.prepare();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Automatically generated");
    expect(result.stdout).toContain("REUSED=false");
    const certificate = path.join(f.stage, "server.crt");
    const key = path.join(f.stage, "server.key");
    const details = spawnSync("openssl", ["x509", "-in", certificate, "-noout", "-ext", "subjectAltName", check, name], {
      encoding: "utf8",
    });
    expect(details.status, details.stderr).toBe(0);
    expect(details.stdout).toContain(san);
    expect(details.stdout).toContain("does match certificate");
    expect((await stat(key)).mode & 0o777).toBe(0o600);
    await f.persist();
    expect((await stat(f.env.CERT)).mode & 0o777).toBe(0o644);
    expect((await stat(f.env.KEY)).mode & 0o777).toBe(0o600);
  }, 30_000);

  it("reuses existing files unchanged and only generates a replacement on explicit request", async () => {
    const f = await fixture("192.168.6.1");
    expect(f.prepare().status).toBe(0);
    await f.persist();
    const originalCertificate = await readFile(f.env.CERT);
    const originalKey = await readFile(f.env.KEY);
    const originalStats = await stat(f.env.KEY);
    const reused = f.prepare();
    expect(reused.status, reused.stderr).toBe(0);
    expect(reused.stdout).toContain("REUSED=true");
    expect(await readFile(f.env.CERT)).toEqual(originalCertificate);
    expect(await readFile(f.env.KEY)).toEqual(originalKey);
    expect((await stat(f.env.KEY)).mtimeMs).toBe(originalStats.mtimeMs);
    expect((await stat(f.env.KEY)).ino).toBe(originalStats.ino);
    const replacement = f.prepare({ TLS_REGENERATE: "true" });
    expect(replacement.status, replacement.stderr).toBe(0);
    expect(replacement.stdout).toContain("REUSED=false");
    expect(await readFile(path.join(f.stage, "server.key"))).not.toEqual(originalKey);
    // Staging a rotation never alters live files before validation/activation.
    expect(await readFile(f.env.KEY)).toEqual(originalKey);
    expect(await readFile(f.env.CERT)).toEqual(originalCertificate);
  }, 30_000);

  it("refuses incomplete pairs or changed names instead of silently overwriting existing keys", async () => {
    const f = await fixture("192.168.6.1");
    expect(f.prepare().status).toBe(0);
    await f.persist();
    const originalKey = await readFile(f.env.KEY);
    const mismatch = f.prepare({ TLS_SERVER_NAME: "192.168.6.2" });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("does not match");
    expect(await readFile(f.env.KEY)).toEqual(originalKey);
    await rm(f.env.CERT);
    const incomplete = f.prepare();
    expect(incomplete.status).not.toBe(0);
    expect(incomplete.stderr).toContain("Incomplete existing TLS files");
    expect(await readFile(f.env.KEY)).toEqual(originalKey);
  }, 30_000);

  it("rejects ambiguous regeneration and supplied-file options", async () => {
    const f = await fixture("assetflow.example.internal");
    expect(f.prepare({ TLS_REGENERATE: "yes" }).status).not.toBe(0);
    const ambiguous = f.prepare({ TLS_REGENERATE: "true", TLS_CERT_FILE: "/unused/custom.crt" });
    expect(ambiguous.status).not.toBe(0);
    expect(ambiguous.stderr).toContain("Do not combine");
    const partial = f.prepare({ TLS_CERT_FILE: "/unused/custom.crt" });
    expect(partial.status).not.toBe(0);
    expect(partial.stderr).toContain("both readable");
  });
});
