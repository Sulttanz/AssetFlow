// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import ws from "ws";
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

describe("CAB overview pending count plan", () => {
  const schema = `cab_overview_plan_${randomUUID().replaceAll("-", "")}`;
  const databaseUrl = process.env.DATABASE_URL;
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
    if (!databaseUrl) throw new Error("DATABASE_URL is required for the CAB overview planner test");
    neonConfig.webSocketConstructor = ws;
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
        decision text,
        removed_at timestamp
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
      INSERT INTO change_approvals (id, change_id, approver_id, decision, removed_at)
      SELECT
        'approval-' || approval_no,
        'change-' || (((approval_no - 1) / 4) + 1),
        'reviewer-' || (approval_no % 256),
        CASE
          WHEN approval_no % 5 = 0 THEN 'pending'
          WHEN approval_no % 5 = 1 THEN NULL
          WHEN approval_no % 2 = 0 THEN 'approved'
          ELSE 'rejected'
        END,
        CASE WHEN approval_no % 19 = 0 THEN now() ELSE NULL END
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

  it("uses the strict pending-count index without changing the overview count", async () => {
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
    await plannerPool.query("ANALYZE change_approvals");

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
  });

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
