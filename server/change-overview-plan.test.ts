// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { changeApprovals, changes } from "@shared/schema";

const database = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("./db", () => ({ db: database }));

import { DatabaseStorage } from "./storage";

const dialect = new PgDialect();
const aggregateSelection = {
  total: "23",
  draft: "2",
  submitted: "3",
  approved: "4",
  rejected: "1",
  requested: "1",
  inProgress: "5",
  completed: "3",
  failed: "2",
  cancelled: "2",
  emergency: "6",
  thisMonth: "7",
};
const queries: {
  selection: Record<string, unknown>;
  table?: unknown;
  whereCondition?: Parameters<typeof dialect.sqlToQuery>[0];
}[] = [];

const testDatabaseUrl = process.env.VITEST_TEST_DATABASE_URL;
const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  Boolean(testDatabaseUrl);
const scaledHistorySize = 450_000;
const countIndexStorageBudgetBytes = 8 * 1024 * 1024;

describe("CAB overview pending count plan", () => {
  const schema = `cab_overview_plan_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = testDatabaseUrl;
  let setupPool: Pool | undefined;
  let plannerPool: Pool | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    queries.length = 0;
    database.select.mockImplementation((selection: Record<string, unknown>) => {
      const query = { selection } as (typeof queries)[number];
      queries.push(query);
      const builder = {
        from(table: unknown) {
          query.table = table;
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          query.whereCondition = condition;
          return builder;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          const rows = query.table === changes
            ? [aggregateSelection]
            : [{ count: "11369" }];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    });
  });

  beforeAll(async () => {
    if (!databaseIntegrationEnabled) return;
    if (!databaseUrl) throw new Error("VITEST_TEST_DATABASE_URL is required for the CAB overview planner test");
    setupPool = new Pool({ connectionString: databaseUrl });
    await setupPool.query(`CREATE SCHEMA "${schema}"`);

    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
    plannerPool = new Pool({ connectionString: isolatedUrl.toString() });

    await plannerPool.query(`
      CREATE TABLE change_approvals (
        id varchar PRIMARY KEY,
        change_id varchar NOT NULL,
        approver_id varchar,
        original_approver_id varchar NOT NULL,
        approver_label text NOT NULL,
        decision text,
        comments text,
        decided_at timestamp,
        removed_at timestamp,
        removed_by_id varchar,
        removed_by_label text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    const approverIndexMigration = await readFile(
      new URL("../migrations/20261004_cab_pending_approver_lookup_idx.sql", import.meta.url),
      "utf8",
    );
    await plannerPool.query(approverIndexMigration);

    // Representative history: active pending votes, legacy undecided votes,
    // completed decisions, removed assignments, and many approvers.
    await plannerPool.query(`
      INSERT INTO change_approvals (
        id, change_id, approver_id, original_approver_id, approver_label,
        decision, comments, decided_at, removed_at, removed_by_id, removed_by_label
      )
      SELECT
        'approval-' || approval_no,
        'change-' || (((approval_no - 1) / 4) + 1),
        'reviewer-' || (approval_no % 256),
        'reviewer-' || (approval_no % 256),
        'Reviewer ' || (approval_no % 256),
        CASE
          WHEN approval_no % 5 = 0 THEN 'pending'
          WHEN approval_no % 5 = 1 THEN NULL
          WHEN approval_no % 2 = 0 THEN 'approved'
          ELSE 'rejected'
        END,
        CASE WHEN approval_no % 5 IN (2, 3) THEN 'Historical decision comment' ELSE NULL END,
        CASE WHEN approval_no % 5 IN (2, 3) THEN now() ELSE NULL END,
        CASE WHEN approval_no % 19 = 0 THEN now() ELSE NULL END,
        CASE WHEN approval_no % 19 = 0 THEN 'former-reviewer' ELSE NULL END,
        CASE WHEN approval_no % 19 = 0 THEN 'Former reviewer' ELSE NULL END
      FROM generate_series(1, 60000) AS approval_rows(approval_no);

      ANALYZE change_approvals
    `);
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

  it.skipIf(!databaseIntegrationEnabled)("uses the strict pending-count index without changing the overview count", async () => {
    if (!plannerPool) throw new Error("CAB overview planner database was not initialized");

    const summary = await new DatabaseStorage().getChangeReportSummary(new Date("2026-10-01T00:00:00Z"));
    expect(summary.pendingApprovals).toBe(11369);
    expect(queries).toHaveLength(2);

    const approvalQuery = queries.find(query => query.table === changeApprovals);
    expect(approvalQuery?.whereCondition).toBeDefined();
    const compiled = drizzle({ client: plannerPool, schema: { changeApprovals } })
      .select(approvalQuery!.selection as never)
      .from(approvalQuery!.table as typeof changeApprovals)
      .where(approvalQuery!.whereCondition as never)
      .toSQL();
    expect(compiled.sql).toContain('"change_approvals"."decision" = $1');
    expect(compiled.sql).not.toContain('"change_approvals"."decision" is null');
    expect(compiled.params).toEqual(["pending"]);

    const readCount = async () => {
      const result = await plannerPool!.query(compiled.sql, compiled.params);
      return Number(result.rows[0]?.count ?? 0);
    };
    const explain = async () => {
      const result = await plannerPool!.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${compiled.sql}`,
        compiled.params,
      );
      const json = result.rows[0]?.["QUERY PLAN"] as unknown;
      const [plan] = typeof json === "string"
        ? JSON.parse(json) as { Plan: PlanNode }[]
        : json as { Plan: PlanNode }[];
      return flattenPlan(plan.Plan);
    };

    const countBefore = await readCount();
    const planBefore = await explain();

    const countIndexMigration = await readFile(
      new URL("../migrations/20261007_cab_pending_overview_count_idx.sql", import.meta.url),
      "utf8",
    );
    await plannerPool.query(countIndexMigration);
    await plannerPool.query("VACUUM (ANALYZE) change_approvals");

    const countAfter = await readCount();
    const planAfter = await explain();

    expect(countBefore).toBe(11369);
    expect(countAfter).toBe(countBefore);
    expect(planBefore.some(node =>
      node["Relation Name"] === "change_approvals" &&
      ["Seq Scan", "Bitmap Heap Scan", "Index Scan"].includes(node["Node Type"]),
    )).toBe(true);
    expect(planBefore.some(node => node["Node Type"] === "Index Only Scan")).toBe(false);
    expect(planBefore.some(node => node["Index Name"] === "change_approvals_active_pending_count_idx"))
      .toBe(false);
    expect(planAfter.some(node =>
      node["Index Name"] === "change_approvals_active_pending_count_idx" &&
      node["Node Type"] === "Index Only Scan",
    )).toBe(true);

    const withIndex = "change_approvals_with_count_index";
    const withoutIndex = "change_approvals_without_count_index";
    await plannerPool.query(`
      CREATE TABLE ${withIndex} AS SELECT * FROM change_approvals;
      CREATE TABLE ${withoutIndex} AS SELECT * FROM change_approvals;

      ALTER TABLE ${withIndex} ADD PRIMARY KEY (id);
      ALTER TABLE ${withoutIndex} ADD PRIMARY KEY (id);

      CREATE INDEX ${withIndex}_history_idx
        ON ${withIndex} (change_id, original_approver_id);
      CREATE INDEX ${withoutIndex}_history_idx
        ON ${withoutIndex} (change_id, original_approver_id);

      CREATE INDEX ${withIndex}_approver_idx ON ${withIndex} (approver_id, change_id)
        WHERE removed_at IS NULL AND (decision = 'pending' OR decision IS NULL);
      CREATE INDEX ${withoutIndex}_approver_idx ON ${withoutIndex} (approver_id, change_id)
        WHERE removed_at IS NULL AND (decision = 'pending' OR decision IS NULL);

      CREATE INDEX ${withIndex}_count_idx ON ${withIndex} (decision)
        WHERE removed_at IS NULL AND decision = 'pending';
      ANALYZE ${withIndex};
      ANALYZE ${withoutIndex};
    `);

    const measureWrite = async (table: string, statement: string) => {
      const client = await plannerPool!.connect();
      try {
        const result = await client.query(
          `EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) ${statement}`,
        );
        const json = result.rows[0]?.["QUERY PLAN"] as unknown;
        const [explanation] = typeof json === "string"
          ? JSON.parse(json) as { Plan: PlanNode; "Execution Time": number }[]
          : json as { Plan: PlanNode; "Execution Time": number }[];
        const wal = explanation.Plan as PlanNode & { "WAL Bytes"?: number };
        return {
          executionMs: Number(explanation["Execution Time"]),
          walBytes: Number(wal["WAL Bytes"] ?? 0),
        };
      } finally {
        client.release();
      }
    };
    const inserts = (table: string, round: number) => `
      INSERT INTO ${table} (
        id, change_id, approver_id, original_approver_id, approver_label, decision, removed_at
      )
      SELECT
        'benchmark-insert-${round}-' || vote_no,
        'benchmark-change-' || vote_no,
        'benchmark-reviewer-' || vote_no,
        'benchmark-reviewer-' || vote_no,
        'Benchmark reviewer ' || vote_no,
        'pending',
        NULL
      FROM generate_series(1, 1000) AS votes(vote_no)
    `;
    const decisions = (table: string, _round: number) => `
      UPDATE ${table} AS approval
      SET decision = 'approved',
          comments = 'Benchmark decision comment',
          decided_at = now()
      FROM (
        SELECT id FROM ${table}
        WHERE id LIKE 'approval-%' AND decision = 'pending' AND removed_at IS NULL
        ORDER BY id LIMIT 1000
      ) AS candidates
      WHERE approval.id = candidates.id
    `;
    const removals = (table: string, _round: number) => `
      UPDATE ${table} AS approval
      SET removed_at = now(),
          removed_by_id = 'benchmark-operator',
          removed_by_label = 'Benchmark operator'
      FROM (
        SELECT id FROM ${table}
        WHERE id LIKE 'approval-%' AND decision = 'pending' AND removed_at IS NULL
        ORDER BY id LIMIT 1000
      ) AS candidates
      WHERE approval.id = candidates.id
    `;
    const writeCases = [
      { name: "insert", statement: inserts },
      { name: "decision", statement: decisions },
      { name: "removal", statement: removals },
    ];
    type WriteMeasurement = Awaited<ReturnType<typeof measureWrite>>;
    type WriteSamples = { withIndex: WriteMeasurement[]; withoutIndex: WriteMeasurement[] };
    const samples = new Map<string, WriteSamples>();
    for (const writeCase of writeCases) {
      const result: WriteSamples = { withIndex: [], withoutIndex: [] };
      for (let round = 0; round < 3; round += 1) {
        const runWithFirst = round % 2 === 0;
        const first = runWithFirst ? withIndex : withoutIndex;
        const second = runWithFirst ? withoutIndex : withIndex;
        const firstResult = await measureWrite(first, writeCase.statement(first, round));
        const secondResult = await measureWrite(second, writeCase.statement(second, round));
        result[first === withIndex ? "withIndex" : "withoutIndex"].push(firstResult);
        result[second === withIndex ? "withIndex" : "withoutIndex"].push(secondResult);
      }
      samples.set(writeCase.name, result);
    }

    const concurrentWriterCount = 8;
    const concurrentWritesPerWriter = 128;
    const concurrentWriteCount = concurrentWriterCount * concurrentWritesPerWriter;
    const concurrentWithIndex = "change_approvals_concurrent_with_count_index";
    const concurrentWithoutIndex = "change_approvals_concurrent_without_count_index";
    await plannerPool.query(`
      CREATE TABLE ${concurrentWithIndex} (LIKE ${withIndex} INCLUDING ALL);
      CREATE TABLE ${concurrentWithoutIndex} (LIKE ${withoutIndex} INCLUDING ALL);
    `);
    type ConcurrentMeasurement = {
      elapsedMs: number;
      writesPerSecond: number;
      databaseWriteMetrics: {
        walBytes: number;
        walRecords: number;
        walFullPageImages: number;
        sharedHitBlocks: number;
        sharedReadBlocks: number;
        sharedDirtiedBlocks: number;
        sharedWrittenBlocks: number;
        totalStatementExecutionMs: number;
        slowestStatementExecutionMs: number;
      };
      finalPendingCount: number;
      completedWrites: number;
    };
    type ConcurrentSamples = { withIndex: ConcurrentMeasurement[]; withoutIndex: ConcurrentMeasurement[] };
    const concurrentSamples = new Map<string, ConcurrentSamples>();
    const measureConcurrentWrite = async (
      table: string,
      operation: "insert" | "decision" | "removal",
      round: number,
    ): Promise<ConcurrentMeasurement> => {
      await plannerPool!.query(`TRUNCATE ${table}`);
      if (operation !== "insert") {
        await plannerPool!.query(`
          INSERT INTO ${table} (
            id, change_id, approver_id, original_approver_id, approver_label, decision
          )
          SELECT
            'concurrent-${round}-' || lpad(worker_no::text, 2, '0') || '-' ||
              lpad(vote_no::text, 4, '0'),
            'concurrent-change-' || worker_no || '-' || vote_no,
            'concurrent-reviewer-' || worker_no || '-' || vote_no,
            'concurrent-reviewer-' || worker_no || '-' || vote_no,
            'Concurrent benchmark reviewer',
            'pending'
          FROM generate_series(0, ${concurrentWriterCount - 1}) AS workers(worker_no)
          CROSS JOIN generate_series(1, ${concurrentWritesPerWriter}) AS votes(vote_no)
        `);
      }

      const makeStatement = (worker: number) => {
        const prefix = `concurrent-${round}-${String(worker).padStart(2, "0")}-`;
        if (operation === "insert") {
          return `
            INSERT INTO ${table} (
              id, change_id, approver_id, original_approver_id, approver_label, decision
            )
            SELECT
              '${prefix}' || lpad(vote_no::text, 4, '0'),
              'concurrent-change-${round}-${worker}-' || vote_no,
              'concurrent-reviewer-${round}-${worker}-' || vote_no,
              'concurrent-reviewer-${round}-${worker}-' || vote_no,
              'Concurrent benchmark reviewer',
              'pending'
            FROM generate_series(1, ${concurrentWritesPerWriter}) AS votes(vote_no)
          `;
        }
        if (operation === "decision") {
          return `
            UPDATE ${table}
            SET decision = 'approved',
                comments = 'Concurrent benchmark decision',
                decided_at = now()
            WHERE id >= '${prefix}0001' AND id <= '${prefix}${String(concurrentWritesPerWriter).padStart(4, "0")}'
              AND decision = 'pending' AND removed_at IS NULL
          `;
        }
        return `
          UPDATE ${table}
          SET removed_at = now(),
              removed_by_id = 'concurrent-benchmark-operator',
              removed_by_label = 'Concurrent benchmark operator'
          WHERE id >= '${prefix}0001' AND id <= '${prefix}${String(concurrentWritesPerWriter).padStart(4, "0")}'
            AND decision = 'pending' AND removed_at IS NULL
        `;
      };

      const clients = await Promise.all(
        Array.from({ length: concurrentWriterCount }, () => plannerPool!.connect()),
      );
      const startedAt = process.hrtime.bigint();
      let explainedResults: Awaited<ReturnType<typeof clients[number]["query"]>>[];
      try {
        const settled = await Promise.allSettled(clients.map((client, worker) =>
          client.query(`EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) ${makeStatement(worker)}`),
        ));
        const failure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
        if (failure) throw failure.reason;
        explainedResults = settled.map(result => (result as PromiseFulfilledResult<typeof settled[number]>).value);
      } finally {
        clients.forEach(client => client.release());
      }
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statementMetrics = explainedResults.map(result => {
        const json = result.rows[0]?.["QUERY PLAN"] as unknown;
        const [explanation] = typeof json === "string"
          ? JSON.parse(json) as { Plan: PlanNode & Record<string, unknown>; "Execution Time": number }[]
          : json as { Plan: PlanNode & Record<string, unknown>; "Execution Time": number }[];
        const plan = explanation.Plan;
        return {
          walBytes: Number(plan["WAL Bytes"] ?? 0),
          walRecords: Number(plan["WAL Records"] ?? 0),
          walFullPageImages: Number(plan["WAL FPI"] ?? 0),
          sharedHitBlocks: Number(plan["Shared Hit Blocks"] ?? 0),
          sharedReadBlocks: Number(plan["Shared Read Blocks"] ?? 0),
          sharedDirtiedBlocks: Number(plan["Shared Dirtied Blocks"] ?? 0),
          sharedWrittenBlocks: Number(plan["Shared Written Blocks"] ?? 0),
          executionMs: Number(explanation["Execution Time"]),
        };
      });
      const targetRows = await plannerPool!.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE decision = 'pending' AND removed_at IS NULL)::int AS pending,
          count(*) FILTER (WHERE decision = 'approved' AND removed_at IS NULL)::int AS approved,
          count(*) FILTER (WHERE removed_at IS NOT NULL)::int AS removed
        FROM ${table}
      `);
      const counts = targetRows.rows[0] as {
        total: number;
        pending: number;
        approved: number;
        removed: number;
      };
      const completedWrites = operation === "insert"
        ? Number(counts.pending)
        : operation === "decision" ? Number(counts.approved) : Number(counts.removed);
      const finalPendingCount = Number(counts.pending);
      const expectedPendingCount = operation === "insert" ? concurrentWriteCount : 0;
      expect(Number(counts.total)).toBe(concurrentWriteCount);
      expect(completedWrites).toBe(concurrentWriteCount);
      expect(finalPendingCount).toBe(expectedPendingCount);

      return {
        elapsedMs,
        writesPerSecond: concurrentWriteCount / (elapsedMs / 1000),
        databaseWriteMetrics: {
          walBytes: statementMetrics.reduce((total, metrics) => total + metrics.walBytes, 0),
          walRecords: statementMetrics.reduce((total, metrics) => total + metrics.walRecords, 0),
          walFullPageImages: statementMetrics.reduce((total, metrics) => total + metrics.walFullPageImages, 0),
          sharedHitBlocks: statementMetrics.reduce((total, metrics) => total + metrics.sharedHitBlocks, 0),
          sharedReadBlocks: statementMetrics.reduce((total, metrics) => total + metrics.sharedReadBlocks, 0),
          sharedDirtiedBlocks: statementMetrics.reduce((total, metrics) => total + metrics.sharedDirtiedBlocks, 0),
          sharedWrittenBlocks: statementMetrics.reduce((total, metrics) => total + metrics.sharedWrittenBlocks, 0),
          totalStatementExecutionMs: statementMetrics.reduce((total, metrics) => total + metrics.executionMs, 0),
          slowestStatementExecutionMs: Math.max(...statementMetrics.map(metrics => metrics.executionMs)),
        },
        finalPendingCount,
        completedWrites,
      };
    };

    for (const writeCase of writeCases) {
      const result: ConcurrentSamples = { withIndex: [], withoutIndex: [] };
      for (let round = 0; round < 3; round += 1) {
        const runWithFirst = round % 2 === 0;
        const first = runWithFirst ? concurrentWithIndex : concurrentWithoutIndex;
        const second = runWithFirst ? concurrentWithoutIndex : concurrentWithIndex;
        const firstResult = await measureConcurrentWrite(
          first, writeCase.name as "insert" | "decision" | "removal", round,
        );
        const secondResult = await measureConcurrentWrite(
          second, writeCase.name as "insert" | "decision" | "removal", round,
        );
        expect(firstResult.finalPendingCount).toBe(secondResult.finalPendingCount);
        result[first === concurrentWithIndex ? "withIndex" : "withoutIndex"].push(firstResult);
        result[second === concurrentWithIndex ? "withIndex" : "withoutIndex"].push(secondResult);
      }
      concurrentSamples.set(writeCase.name, result);
    }

    const concurrentMedian = (values: number[]) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const concurrentWriteCosts = [...concurrentSamples].map(([operation, result]) => ({
      operation,
      withIndex: {
        elapsedMs: concurrentMedian(result.withIndex.map(sample => sample.elapsedMs)),
        writesPerSecond: concurrentMedian(result.withIndex.map(sample => sample.writesPerSecond)),
        databaseWriteMetrics: Object.fromEntries(
          Object.keys(result.withIndex[0].databaseWriteMetrics).map(metric => [
            metric,
            concurrentMedian(result.withIndex.map(sample =>
              sample.databaseWriteMetrics[metric as keyof ConcurrentMeasurement["databaseWriteMetrics"]],
            )),
          ]),
        ),
        finalPendingCounts: result.withIndex.map(sample => sample.finalPendingCount),
      },
      withoutIndex: {
        elapsedMs: concurrentMedian(result.withoutIndex.map(sample => sample.elapsedMs)),
        writesPerSecond: concurrentMedian(result.withoutIndex.map(sample => sample.writesPerSecond)),
        databaseWriteMetrics: Object.fromEntries(
          Object.keys(result.withoutIndex[0].databaseWriteMetrics).map(metric => [
            metric,
            concurrentMedian(result.withoutIndex.map(sample =>
              sample.databaseWriteMetrics[metric as keyof ConcurrentMeasurement["databaseWriteMetrics"]],
            )),
          ]),
        ),
        finalPendingCounts: result.withoutIndex.map(sample => sample.finalPendingCount),
      },
    }));
    console.info("CAB count index concurrent write costs", JSON.stringify({
      writers: concurrentWriterCount,
      writesPerWriter: concurrentWritesPerWriter,
      writesPerOperation: concurrentWriteCount,
      operations: concurrentWriteCosts,
    }));

    const sizeResult = await plannerPool.query(`
      SELECT
        pg_relation_size($1::regclass)::bigint AS index_bytes,
        pg_relation_size($2::regclass)::bigint AS table_bytes
    `, [`${withIndex}_count_idx`, withIndex]);
    const indexBytes = Number(sizeResult.rows[0]?.index_bytes);
    const tableBytes = Number(sizeResult.rows[0]?.table_bytes);
    const finalCounts = await Promise.all([withIndex, withoutIndex].map(async table => {
      const result = await plannerPool!.query(
        `SELECT count(*)::int AS count FROM ${table}
         WHERE removed_at IS NULL AND decision = 'pending'`,
      );
      return Number(result.rows[0]?.count);
    }));

    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const writeCosts = [...samples].map(([name, result]) => {
      const withMetrics = {
        executionMs: median(result.withIndex.map(sample => sample.executionMs)),
        walBytes: median(result.withIndex.map(sample => sample.walBytes)),
      };
      const withoutMetrics = {
        executionMs: median(result.withoutIndex.map(sample => sample.executionMs)),
        walBytes: median(result.withoutIndex.map(sample => sample.walBytes)),
      };
      return { operation: name, withIndex: withMetrics, withoutIndex: withoutMetrics };
    });
    console.info("CAB count index write costs", JSON.stringify({
      indexBytes,
      tableBytes,
      finalPendingCounts: finalCounts,
      operations: writeCosts,
    }));

    expect(finalCounts).toEqual([8369, 8369]);
    expect(indexBytes).toBeGreaterThan(0);
    expect(indexBytes).toBeLessThan(1024 * 1024);
    expect(indexBytes).toBeLessThan(tableBytes * 0.1);
    for (const cost of writeCosts) {
      expect(cost.withIndex.executionMs).toBeLessThanOrEqual(cost.withoutIndex.executionMs * 2 + 10);
      expect(cost.withIndex.walBytes).toBeLessThanOrEqual(cost.withoutIndex.walBytes * 2);
      expect(cost.withIndex.walBytes).toBeGreaterThan(0);
    }
    expect(writeCosts.find(cost => cost.operation === "insert")!.withIndex.walBytes)
      .toBeGreaterThan(writeCosts.find(cost => cost.operation === "insert")!.withoutIndex.walBytes);

    const scaledIndexWorkloads = [];
    for (const pendingPercent of [1, 10, 50, 90]) {
      await plannerPool.query("TRUNCATE change_approvals");
      await plannerPool.query(`
        INSERT INTO change_approvals (
          id, change_id, approver_id, original_approver_id, approver_label, decision
        )
        SELECT
          'scale-' || lpad(approval_no::text, 7, '0'),
          'scale-change-' || (((approval_no - 1) / 4) + 1),
          'scale-reviewer-' || (approval_no % 256),
          'scale-reviewer-' || (approval_no % 256),
          'Scale reviewer ' || (approval_no % 256),
          'approved'
        FROM generate_series(1, $1::int) AS approval_rows(approval_no)
      `, [scaledHistorySize]);
      await plannerPool.query(`
        UPDATE change_approvals
        SET decision = CASE
          WHEN substring(id FROM 7)::int % 100 < $1 THEN 'pending'
          ELSE 'approved'
        END
      `, [pendingPercent]);
      await plannerPool.query("VACUUM (ANALYZE) change_approvals");

      const pendingCount = await readCount();
      const scaledPlan = await explain();
      const scaledSizeResult = await plannerPool.query(
        "SELECT pg_relation_size($1::regclass)::bigint AS index_bytes",
        ["change_approvals_active_pending_count_idx"],
      );
      const scaledIndexBytes = Number(scaledSizeResult.rows[0]?.index_bytes);
      const expectedPendingCount = scaledHistorySize * pendingPercent / 100;
      scaledIndexWorkloads.push({ pendingPercent, pendingCount, scaledIndexBytes });

      expect(pendingCount).toBe(expectedPendingCount);
      if (pendingPercent < 90) {
        expect(scaledPlan.some(node =>
          node["Index Name"] === "change_approvals_active_pending_count_idx" &&
          node["Node Type"] === "Index Only Scan",
        ), `expected index-only scan at ${pendingPercent}% pending`).toBe(true);
      }
      expect(scaledIndexBytes).toBeGreaterThan(0);
      expect(scaledIndexBytes).toBeLessThanOrEqual(countIndexStorageBudgetBytes);
    }
    console.info("CAB count index large-history workloads", JSON.stringify({
      historySize: scaledHistorySize,
      storageBudgetBytes: countIndexStorageBudgetBytes,
      workloads: scaledIndexWorkloads,
    }));
  }, 120_000);

  it("declares the same strict predicate in the Drizzle schema", () => {
    const index = getTableConfig(changeApprovals).indexes.find(
      candidate => candidate.config.name === "change_approvals_active_pending_count_idx",
    );

    expect(index).toBeDefined();
    expect(index!.config.columns.map(column => column.name)).toEqual(["decision"]);
    const predicate = dialect.sqlToQuery(index!.config.where!);
    expect(predicate.sql).toContain('"removed_at" IS NULL');
    expect(predicate.sql).toContain('"decision" = \'pending\'');
    expect(predicate.sql).not.toContain('"decision" IS NULL');
    expect(predicate.params).toEqual([]);
  });
});

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
};

function flattenPlan(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flattenPlan)];
}
