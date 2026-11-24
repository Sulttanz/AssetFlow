import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const managed = new Set([
  "DATABASE_URL", "ASSETFLOW_DB_NAME", "ASSETFLOW_DB_USER", "ASSETFLOW_DB_PASSWORD",
  "SESSION_SECRET", "NODE_ENV", "PORT", "HOST", "TRUST_PROXY", "COOKIE_SECURE",
]);

export function parseEnvLine(line) {
  if (!line.trim() || line.trimStart().startsWith("#")) return null;
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) throw new Error("Unsupported environment file syntax. Use one KEY=value assignment per line.");
  const [, key, raw] = match;
  let value = raw.trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    // Installer-managed secrets are deliberately single-line, without expansion
    // or escape interpretation. Never execute/source customer environment files.
    let end = 1;
    while (end < value.length) {
      if (value[end] === quote) break;
      if (quote === '"' && value[end] === "\\") end++;
      end++;
    }
    if (end >= value.length || !/^\s*(?:#.*)?$/.test(value.slice(end + 1))) {
      throw new Error(`Invalid quoted environment value for ${key}.`);
    }
    value = value.slice(1, end);
    if (quote === '"') value = value.replace(/\\(["\\$`])/g, "$1");
  } else {
    value = value.replace(/\s+#.*$/, "").trimEnd();
  }
  if (/[\r\n\0]/.test(value)) throw new Error(`Environment value for ${key} must be single-line.`);
  return { key, value };
}

export function readEnvValue(text, key) {
  let value = "";
  for (const line of text.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (entry?.key === key) value = entry.value;
  }
  return value;
}

export function unmanagedEnv(text) {
  return text.split(/\r?\n/).filter(line => {
    const entry = parseEnvLine(line);
    return !entry || !managed.has(entry.key);
  }).join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, file, key] = process.argv.slice(2);
    const text = readFileSync(file, "utf8");
    if (mode === "read" && key) process.stdout.write(readEnvValue(text, key));
    else if (mode === "unmanaged") process.stdout.write(unmanagedEnv(text));
    else throw new Error("Invalid on-prem environment helper invocation.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cannot read environment file.");
    process.exitCode = 1;
  }
}
