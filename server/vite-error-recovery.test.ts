import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("development frontend error recovery", () => {
  it("protects every lazy application page with the shared recovery wrapper", () => {
    const source = readFileSync("client/src/App.tsx", "utf8");
    expect(source).toContain("createRecoverableLazyRoute as lazy");
    expect(source).not.toMatch(/import\s*\{[^}]*\blazy\b[^}]*\}\s*from\s*["']react["']/);
  });

  it("uses Vite's nonfatal logger instead of exiting the backend on transform errors", () => {
    const source = readFileSync("server/vite.ts", "utf8");
    expect(source).toMatch(/customLogger:\s*viteLogger/);
    expect(source).not.toMatch(/process\.exit\s*\(/);
  });
});
