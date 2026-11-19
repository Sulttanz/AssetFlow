// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { changeApprovals } from "@shared/schema";

const testDatabaseUrl = process.env.VITEST_TEST_DATABASE_URL;
const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  Boolean(testDatabaseUrl);
const cabAssignmentBenchmarkEnabled = process.env.RUN_CAB_ASSIGNMENT_BENCHMARK === "1";

describe("CAB assignment history lookup index", () => {
  const schema = `cab_assignment_plan_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = testDatabaseUrl;
  let setupPool: Pool | undefined;
  let plannerPool: Pool | undefined;

  beforeAll(async () => {
    if (!databaseIntegrationEnabled) return;
    if (!databaseUrl) throw new Error("VITEST_TEST_DATABASE_URL is required for the CAB assignment planner test");
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

  if (cabAssignmentBenchmarkEnabled) {
    it.skipIf(!databaseIntegrationEnabled)(
      "benchmarks assignment lookups with and without the composite index",
      async () => {
        if (!plannerPool) throw new Error("CAB assignment benchmark database was not initialized");

        const client = await plannerPool.connect();
        try {
          await client.query("SET max_parallel_workers_per_gather = 0");

          const historySizes = [8_000, 64_000, 450_000];
          const lookupRounds = 25;
          const report: {
            historySize: number;
            matchingRows: number;
            indexBytes: number;
            withIndex: { medianMsPerLookup: number; totalElapsedMs: number };
            withoutIndex: { medianMsPerLookup: number; totalElapsedMs: number };
          }[] = [];

          for (const historySize of historySizes) {
            const withIndexTable = "cab_assignment_benchmark_with_index";
            const withoutIndexTable = "cab_assignment_benchmark_without_index";
            await client.query(`
              DROP TABLE IF EXISTS ${withIndexTable}, ${withoutIndexTable};
              CREATE TABLE ${withIndexTable} (
                id varchar NOT NULL,
                change_id varchar NOT NULL,
                original_approver_id varchar NOT NULL,
                removed_at timestamp
              );
              CREATE TABLE ${withoutIndexTable} (
                id varchar NOT NULL,
                change_id varchar NOT NULL,
                original_approver_id varchar NOT NULL,
                removed_at timestamp
              );
            `);

            for (const table of [withIndexTable, withoutIndexTable]) {
              await client.query(`
                INSERT INTO ${table} (id, change_id, original_approver_id, removed_at)
                SELECT
                  'approval-' || approval_no,
                  'change-' || (((approval_no - 1) / 4) + 1),
                  'approver-' || (approval_no % 256),
                  CASE WHEN approval_no % 19 = 0 THEN TIMESTAMP '2026-01-01 00:00:00' ELSE NULL END
                FROM generate_series(1, $1::int) AS approval_rows(approval_no);
              `, [historySize]);
              // Duplicate historical assignments remain valid audit rows.
              await client.query(`
                INSERT INTO ${table} (id, change_id, original_approver_id, removed_at)
                VALUES (
                  'historical-duplicate',
                  'change-' || ((($1 - 1) / 4) + 1),
                  'approver-' || ($1 % 256),
                  TIMESTAMP '2026-01-01 00:00:00'
                );
              `, [historySize]);
            }

            await client.query(`
              CREATE INDEX cab_assignment_benchmark_lookup_idx
                ON ${withIndexTable} (change_id, original_approver_id);
              ANALYZE ${withIndexTable};
              ANALYZE ${withoutIndexTable};
            `);

            const changeId = `change-${Math.ceil(historySize / 4)}`;
            const approverId = `approver-${historySize % 256}`;
            const lookupSql = (table: string) => `
              SELECT id, removed_at
              FROM ${table}
              WHERE change_id = $1 AND original_approver_id = $2
            `;

            const compareRows = async (table: string) => {
              const result = await client.query(lookupSql(table), [changeId, approverId]);
              return result.rows
                .map(row => ({
                  id: String(row.id),
                  removedAt: row.removed_at === null
                    ? null
                    : new Date(row.removed_at).toISOString(),
                }))
                .sort((left, right) => left.id.localeCompare(right.id));
            };

            const indexedRows = await compareRows(withIndexTable);
            const unindexedRows = await compareRows(withoutIndexTable);
            expect(indexedRows).toEqual(unindexedRows);
            expect(indexedRows.map(row => row.id)).toEqual([
              `approval-${historySize}`,
              "historical-duplicate",
            ].sort((left, right) => left.localeCompare(right)));

            const explain = async (table: string) => {
              const result = await client.query(
                `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${lookupSql(table)}`,
                [changeId, approverId],
              );
              const json = result.rows[0]?.["QUERY PLAN"] as unknown;
              const [plan] = typeof json === "string"
                ? JSON.parse(json) as { Plan: PlanNode }[]
                : json as { Plan: PlanNode }[];
              return flattenPlan(plan.Plan);
            };
            const indexedPlan = await explain(withIndexTable);
            const unindexedPlan = await explain(withoutIndexTable);
            expect(indexedPlan.some(node =>
              node["Index Name"] === "cab_assignment_benchmark_lookup_idx" &&
              ["Index Scan", "Bitmap Index Scan"].includes(node["Node Type"]),
            )).toBe(true);
            expect(unindexedPlan.some(node =>
              node["Node Type"] === "Seq Scan" &&
              node["Relation Name"] === withoutIndexTable,
            )).toBe(true);

            const sizeResult = await client.query(
              "SELECT pg_relation_size($1::regclass)::bigint AS index_bytes",
              ["cab_assignment_benchmark_lookup_idx"],
            );
            const indexBytes = Number(sizeResult.rows[0]?.index_bytes);
            expect(indexBytes).toBeGreaterThan(0);

            const elapsedSamples: Record<"withIndex" | "withoutIndex", number[]> = {
              withIndex: [],
              withoutIndex: [],
            };
            const tables = {
              withIndex: withIndexTable,
              withoutIndex: withoutIndexTable,
            } as const;
            for (let round = 0; round < lookupRounds + 3; round += 1) {
              const order = round % 2 === 0
                ? ["withIndex", "withoutIndex"] as const
                : ["withoutIndex", "withIndex"] as const;
              for (const scenario of order) {
                const startedAt = performance.now();
                const result = await client.query(lookupSql(tables[scenario]), [changeId, approverId]);
                const elapsedMs = performance.now() - startedAt;
                expect(result.rowCount).toBe(indexedRows.length);
                if (round >= 3) elapsedSamples[scenario].push(elapsedMs);
              }
            }

            const median = (values: number[]) => {
              const ordered = [...values].sort((left, right) => left - right);
              return ordered[Math.floor(ordered.length / 2)];
            };
            const withIndexTotal = elapsedSamples.withIndex.reduce((sum, value) => sum + value, 0);
            const withoutIndexTotal = elapsedSamples.withoutIndex.reduce((sum, value) => sum + value, 0);
            report.push({
              historySize,
              matchingRows: indexedRows.length,
              indexBytes,
              withIndex: {
                medianMsPerLookup: median(elapsedSamples.withIndex),
                totalElapsedMs: withIndexTotal,
              },
              withoutIndex: {
                medianMsPerLookup: median(elapsedSamples.withoutIndex),
                totalElapsedMs: withoutIndexTotal,
              },
            });
          }

          console.info("CAB assignment history lookup benchmark", JSON.stringify({
            lookupRounds,
            workloads: report,
          }));
        } finally {
          client.release();
        }
      },
      120_000,
    );
  }
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
