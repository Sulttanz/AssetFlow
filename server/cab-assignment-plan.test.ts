// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { changeApprovals } from "@shared/schema";

const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" && process.env.VITEST_NATIVE_PG === "1";

describe("CAB assignment history lookup index", () => {
  const schema = `cab_assignment_plan_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = process.env.DATABASE_URL;
  let setupPool: Pool | undefined;
  let plannerPool: Pool | undefined;

  beforeAll(async () => {
    if (!databaseIntegrationEnabled) return;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for the CAB assignment planner test");
    setupPool = new Pool({ connectionString: databaseUrl });
    await setupPool.query(`CREATE SCHEMA "${schema}"`);

    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
    plannerPool = new Pool({ connectionString: isolatedUrl.toString() });
    await plannerPool.query(`
      CREATE TABLE change_approvals (
        id varchar PRIMARY KEY,
        change_id varchar NOT NULL,
        original_approver_id varchar NOT NULL,
        removed_at timestamp
      );
      INSERT INTO change_approvals (id, change_id, original_approver_id, removed_at)
      SELECT
        'approval-' || approval_no,
        'change-1',
        'approver-' || approval_no,
        CASE WHEN approval_no % 19 = 0 THEN now() ELSE NULL END
      FROM generate_series(1, 60000) AS approval_rows(approval_no);
      -- Historical duplicate assignments must remain legal and searchable.
      INSERT INTO change_approvals (id, change_id, original_approver_id, removed_at)
      VALUES ('historical-duplicate', 'change-1', 'approver-59999', now());
    `);

    const migration = await readFile(
      new URL("../migrations/onprem/20261110_cab_assignment_history_lookup_idx.sql", import.meta.url),
      "utf8",
    );
    await plannerPool.query(migration);
    await plannerPool.query("ANALYZE change_approvals");
  });

  afterAll(async () => {
    try {
      await plannerPool?.end();
    } finally {
      if (setupPool) {
        try {
          await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        } finally {
          await setupPool.end();
        }
      }
    }
  });

  it("declares a non-unique index matching serialized assignment history lookups", () => {
    const index = getTableConfig(changeApprovals).indexes.find(
      candidate => candidate.config.name === "change_approvals_change_original_approver_idx",
    );
    expect(index).toBeDefined();
    expect(index!.config.columns.map(column => column.name)).toEqual([
      "change_id",
      "original_approver_id",
    ]);
    expect(index!.config.unique).toBe(false);
  });

  it.skipIf(!databaseIntegrationEnabled)("uses the index and preserves duplicate historical assignment rows", async () => {
    if (!plannerPool) throw new Error("CAB assignment planner database was not initialized");

    const history = await plannerPool.query(
      `SELECT removed_at
       FROM change_approvals
       WHERE change_id = $1 AND original_approver_id = $2`,
      ["change-1", "approver-59999"],
    );
    expect(history.rows).toHaveLength(2);

    const result = await plannerPool.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT removed_at
       FROM change_approvals
       WHERE change_id = $1 AND original_approver_id = $2`,
      ["change-1", "approver-59999"],
    );
    const json = result.rows[0]?.["QUERY PLAN"] as unknown;
    const [plan] = typeof json === "string"
      ? JSON.parse(json) as { Plan: PlanNode }[]
      : json as { Plan: PlanNode }[];
    const nodes = flattenPlan(plan.Plan);
    expect(nodes.some(node =>
      node["Index Name"] === "change_approvals_change_original_approver_idx" &&
      node["Node Type"] === "Index Scan" &&
      String(node["Index Cond"]).includes("change_id") &&
      String(node["Index Cond"]).includes("original_approver_id"),
    )).toBe(true);

    const indexDetails = await plannerPool.query(`
      SELECT
        index_info.indisunique AS is_unique,
        index_info.indisvalid AS is_valid,
        pg_get_indexdef(index_info.indexrelid) AS definition
      FROM pg_index AS index_info
      JOIN pg_class AS index_class ON index_class.oid = index_info.indexrelid
      JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
      WHERE index_class.relname = $1 AND index_namespace.nspname = $2
    `, ["change_approvals_change_original_approver_idx", schema]);
    expect(indexDetails.rows).toHaveLength(1);
    expect(indexDetails.rows[0].is_unique).toBe(false);
    expect(indexDetails.rows[0].is_valid).toBe(true);
    expect(indexDetails.rows[0].definition).toContain("(change_id, original_approver_id)");
  });
});

type PlanNode = {
  "Node Type": string;
  "Index Name"?: string;
  "Index Cond"?: string;
  Plans?: PlanNode[];
};

function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flattenPlan)];
}
