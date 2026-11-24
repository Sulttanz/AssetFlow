// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolvePostgresDriver } from "./db-driver-selection";

describe("PostgreSQL driver selection", () => {
  it("selects node-postgres for local, standard, and on-prem PostgreSQL URLs", () => {
    expect(resolvePostgresDriver("postgresql://assetflow:secret@localhost:5432/assetflow")).toBe("pg");
    expect(resolvePostgresDriver("postgres://assetflow:secret@127.0.0.1/assetflow")).toBe("pg");
    expect(resolvePostgresDriver("postgresql://assetflow:secret@db.example.internal/assetflow")).toBe("pg");
  });

  it("selects Neon for Neon endpoint URLs", () => {
    expect(resolvePostgresDriver("postgresql://app:secret@ep-example.us-east-2.aws.neon.tech/app")).toBe("neon");
    expect(resolvePostgresDriver("neon://app:secret@ep-example.neon.tech/app")).toBe("neon");
  });

  it("honors explicit driver selection over URL-based detection", () => {
    expect(resolvePostgresDriver("postgresql://app@ep-example.neon.tech/app", "pg")).toBe("pg");
    expect(resolvePostgresDriver("postgresql://app@db.example.test/app", "neon")).toBe("neon");
    expect(resolvePostgresDriver("postgresql://app@db.example.test/app", "node-postgres")).toBe("pg");
  });

  it("rejects unsupported driver names and malformed database URLs clearly", () => {
    expect(() => resolvePostgresDriver("postgresql://localhost/app", "something-else"))
      .toThrow(/Unsupported DB_DRIVER/);
    expect(() => resolvePostgresDriver("not a url"))
      .toThrow(/DATABASE_URL must be a valid PostgreSQL connection URL/);
    expect(() => resolvePostgresDriver("https://localhost/database"))
      .toThrow(/must use the postgres, postgresql, or neon protocol/);
  });
});
