// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { findDuplicateDropdowns, dropdownIdentity } from "../shared/dropdown-utils";
import { insertDropdownOptionSchema } from "../shared/schema";

const state = vi.hoisted(() => ({ rows: [] as any[], trace: [] as { sql: string; params: unknown[] }[] }));
vi.mock("./db", () => ({
  db: { transaction: async (callback: any) => callback({
    execute: async (query: any) => {
      const { sql, params } = new PgDialect().sqlToQuery(query);
      state.trace.push({ sql, params });
    },
    select: () => ({ from: async () => state.rows }),
    delete: () => ({ where: async () => { state.trace.push({ sql: "DELETE", params: [] }); } }),
  }) },
}));
import { ensureDropdownIntegrity } from "./dropdown-integrity";

const row = (id: string, category = "assetType", value = "Laptop", isActive = true) => ({
  id, category, value, label: id, isActive, displayOrder: 0, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
});

describe("dropdown integrity", () => {
  beforeEach(() => { state.rows = []; state.trace = []; });

  it("deduplicates category and value together, including whitespace/case and inactive rows", () => {
    expect(dropdownIdentity(" AssetType ", " LAPTOP ")).toBe(dropdownIdentity("assetType", "laptop"));
    const duplicates = findDuplicateDropdowns([row("a"), row("b", " ASSETTYPE ", " laptop "), row("c", "status", "Laptop")]);
    expect(duplicates.map(item => [item.duplicate.id, item.keptId])).toEqual([["b", "a"]]);
  });

  it("keeps an active entry over an older inactive copy and uses stable oldest/id ordering", () => {
    const inactive = { ...row("a", "status", "Open", false), createdAt: new Date("2020-01-01") };
    expect(findDuplicateDropdowns([inactive, row("b", "STATUS", "open")])[0].keptId).toBe("b");
    expect(findDuplicateDropdowns([row("b"), row("a")])[0].keptId).toBe("a");
  });

  it("archives original metadata before deleting, and installs the unique index under a lock", async () => {
    state.rows = [row("a"), row("b", " ASSETTYPE ", " laptop ")];
    expect(await ensureDropdownIntegrity()).toEqual({ deleted: 1, ids: ["b"] });
    expect(state.trace[0].sql).toMatch(/LOCK TABLE/);
    const archive = state.trace.findIndex(item => item.sql.startsWith("INSERT INTO"));
    const deletion = state.trace.findIndex(item => item.sql === "DELETE");
    expect(archive).toBeLessThan(deletion);
    expect(JSON.parse(state.trace[archive].params[2] as string)).toMatchObject({ id: "b", label: "b" });
    expect(state.trace.at(-1)?.sql).toMatch(/CREATE UNIQUE INDEX.*dropdown_options_category_value_ci_unique/s);
  });

  it("supports case-insensitive category-scoped cleanup without deleting other categories", async () => {
    state.rows = [row("a"), row("b"), row("c", "status", "open"), row("d", "status", "OPEN")];
    expect(await ensureDropdownIntegrity(" ASSETTYPE ")).toEqual({ deleted: 1, ids: ["b"] });
  });

  it("validates trimmed nonblank lookup keys, values and labels", () => {
    expect(insertDropdownOptionSchema.parse({ category: " status ", value: " open ", label: " Open " })).toMatchObject({ category: "status", value: "open", label: "Open" });
    expect(insertDropdownOptionSchema.safeParse({ category: " ", value: "open", label: "Open" }).success).toBe(false);
    expect(insertDropdownOptionSchema.safeParse({ category: "status", value: " ", label: "Open" }).success).toBe(false);
  });
});
