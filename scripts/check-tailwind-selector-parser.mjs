import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
const minimumVersion = "7.1.6";
const typographyPath = "node_modules/@tailwindcss/typography";
const typographyLock = packageLock.packages?.[typographyPath];

function compareVersions(left, right) {
  const parse = version => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.*)?$/.exec(version);
    assert.ok(match, `Expected a valid numeric package version, received "${version}".`);
    return {
      core: match.slice(1, 4).map(Number),
      prerelease: match[4],
    };
  };
  const a = parse(left);
  const b = parse(right);

  for (let index = 0; index < a.core.length; index++) {
    if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

assert.ok(typographyLock, `Lockfile is missing ${typographyPath}.`);

const overrideVersion =
  packageJson.overrides?.["@tailwindcss/typography"]?.["postcss-selector-parser"];
assert.ok(
  typeof overrideVersion === "string",
  "package.json must keep a scoped postcss-selector-parser override for @tailwindcss/typography.",
);
assert.ok(
  compareVersions(overrideVersion, minimumVersion) >= 0,
  `The scoped parser override must be at least ${minimumVersion}; found ${overrideVersion}.`,
);

const declaredVersion = typographyLock.dependencies?.["postcss-selector-parser"];
assert.ok(
  declaredVersion,
  "The lockfile must retain @tailwindcss/typography's postcss-selector-parser dependency.",
);

// npm installs the scoped override at the nearest applicable node_modules path.
const nestedParserPath = `${typographyPath}/node_modules/postcss-selector-parser`;
const parserPath = packageLock.packages[nestedParserPath]
  ? nestedParserPath
  : "node_modules/postcss-selector-parser";
const parserLock = packageLock.packages?.[parserPath];
assert.ok(
  parserLock,
  `Lockfile does not resolve postcss-selector-parser for @tailwindcss/typography (declares ${declaredVersion}).`,
);
assert.ok(
  compareVersions(parserLock.version, minimumVersion) >= 0,
  `A clean install would resolve postcss-selector-parser@${parserLock.version} for @tailwindcss/typography; expected at least ${minimumVersion}.`,
);
assert.equal(
  parserLock.version,
  overrideVersion,
  `The lockfile resolves postcss-selector-parser@${parserLock.version}, but the scoped override requests ${overrideVersion}.`,
);

console.log(
  `Tailwind Typography parser lock check passed: declared ${declaredVersion}, scoped override and clean-install resolution are both ${parserLock.version}.`,
);
