// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { changeApprovals, changes, users } from "@shared/schema";

const testDatabaseUrl = process.env.VITEST_TEST_DATABASE_URL;
const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  Boolean(testDatabaseUrl);

const database = vi.hoisted(() => ({
  select: vi.fn(),
  selectDistinct: vi.fn(),
}));
vi.mock("./db", () => ({ db: database }));

import { DatabaseStorage } from "./storage";

describe("CAB alert storage query", () => {
  const dialect = new PgDialect();
  const joinedRows = [
    { id: "change-1", changeNumber: "CHG-000001", title: "Pending change", type: "normal", createdAt: new Date("2026-10-04T10:00:00Z") },
    // Legacy duplicate assignments join to the same projected change.
    { id: "change-1", changeNumber: "CHG-000001", title: "Pending change", type: "normal", createdAt: new Date("2026-10-04T10:00:00Z") },
    { id: "change-2", changeNumber: "CHG-000002", title: "Legacy null decision", type: "emergency", createdAt: new Date("2026-10-03T10:00:00Z") },
  ];
  const disabledApproverRows = [
    { id: "change-3", changeNumber: "CHG-000003", title: "Blocked change", type: "normal", approverLabel: "Inactive Reviewer", approverId: "inactive-user", createdAt: new Date("2026-10-02T10:00:00Z") },
    { id: "change-4", changeNumber: "CHG-000004", title: "Deleted approver change", type: "normal", approverLabel: "Former Reviewer", approverId: null, createdAt: new Date("2026-10-01T10:00:00Z") },
  ];
  let query: {
    selection?: Record<string, unknown>;
    source?: unknown;
    joins?: {
      table: unknown;
      condition: Parameters<typeof dialect.sqlToQuery>[0];
      sql: string;
    }[];
    whereCondition?: Parameters<typeof dialect.sqlToQuery>[0];
    whereSql?: string;
    whereParams?: unknown[];
    orderByConditions?: Parameters<typeof dialect.sqlToQuery>[0][];
    orderBySql?: string[];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    query = {};
    database.selectDistinct.mockImplementation((selection: Record<string, unknown>) => {
      query.selection = selection;
      const builder = {
        from(source: unknown) {
          query.source = source;
          return builder;
        },
        innerJoin(table: unknown, condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          query.joins ??= [];
          query.joins.push({ table, condition, sql: dialect.sqlToQuery(condition).sql });
          return builder;
        },
        leftJoin(table: unknown, condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          query.joins ??= [];
          query.joins.push({ table, condition, sql: dialect.sqlToQuery(condition).sql });
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          query.whereCondition = condition;
          const compiled = dialect.sqlToQuery(condition);
          query.whereSql = compiled.sql;
          query.whereParams = compiled.params;
          return builder;
        },
        orderBy(...ordering: Parameters<typeof dialect.sqlToQuery>[0][]) {
          query.orderByConditions = ordering;
          query.orderBySql = ordering.map(item => dialect.sqlToQuery(item).sql);
          return builder;
        },
        then(resolve: (value: typeof joinedRows) => unknown, reject?: (reason: unknown) => unknown) {
          // Model PostgreSQL SELECT DISTINCT over the projected change fields.
          const sourceRows = query.joins?.length === 2 ? disabledApproverRows : joinedRows;
          const uniqueRows = Array.from(new Map(
            sourceRows.map(row => [
              JSON.stringify(Object.keys(selection).map(key => (row as Record<string, unknown>)[key])),
              row,
            ]),
          ).values());
          return Promise.resolve(uniqueRows).then(resolve, reject);
        },
      };
      return builder;
    });
  });

  it("declares a partial index for active pending votes by approver and change", () => {
    const index = getTableConfig(changeApprovals).indexes.find(
      candidate => candidate.config.name === "change_approvals_pending_approver_change_idx",
    );

    expect(index).toBeDefined();
    expect(index!.config.columns.map(column => column.name)).toEqual(["approver_id", "change_id"]);
    const predicate = dialect.sqlToQuery(index!.config.where!);
    expect(predicate.sql).toContain('"removed_at" IS NULL');
    expect(predicate.sql).toContain('"decision" = \'pending\'');
    expect(predicate.sql).toContain('"decision" IS NULL');
    expect(predicate.params).toEqual([]);
  });

  it("filters to the user's active pending or undecided assignments and returns one lightweight alert per change", async () => {
    const result = await new DatabaseStorage().getPendingCabAlertChanges("alice");

    expect(result).toEqual([
      { id: "change-1", changeNumber: "CHG-000001", title: "Pending change", type: "normal" },
      { id: "change-2", changeNumber: "CHG-000002", title: "Legacy null decision", type: "emergency" },
    ]);

    expect(database.selectDistinct).toHaveBeenCalledTimes(1);
    expect(database.select).not.toHaveBeenCalled();
    expect(query.source).toBe(changes);
    expect(query.joins).toHaveLength(1);
    expect(query.joins?.[0]?.table).toBe(changeApprovals);
    expect(query.joins?.[0]?.sql).toContain('"change_approvals"."change_id"');

    expect(query.whereSql).toMatch(/"change_approvals"\."approver_id" = \$1/);
    expect(query.whereSql).toContain('"change_approvals"."removed_at" is null');
    expect(query.whereSql).toMatch(
      /"change_approvals"\."decision" = \$2 or "change_approvals"\."decision" is null/,
    );
    expect(query.whereParams).toEqual(["alice", "pending"]);

    expect(Object.keys(query.selection!)).toEqual(["id", "changeNumber", "title", "type", "createdAt"]);
    expect(query.selection).not.toHaveProperty("approvals");
    expect(query.selection).not.toHaveProperty("comments");
    expect(query.orderBySql?.join(" ")).toContain('"changes"."created_at"');
    expect(query.orderBySql?.join(" ")).toContain('"changes"."id"');
  });

  it("includes pending assignments for disabled and deleted accounts, but excludes removed or resolved rows", async () => {
    const result = await new DatabaseStorage().getDisabledCabAlertChanges();

    expect(result).toEqual([
      {
        id: "change-3",
        changeNumber: "CHG-000003",
        title: "Blocked change",
        type: "normal",
        approverLabel: "Inactive Reviewer",
        approverAccountStatus: "disabled",
      },
      {
        id: "change-4",
        changeNumber: "CHG-000004",
        title: "Deleted approver change",
        type: "normal",
        approverLabel: "Former Reviewer",
        approverAccountStatus: "deleted",
      },
    ]);
    expect(database.selectDistinct).toHaveBeenCalledTimes(1);
    expect(query.source).toBe(changes);
    expect(query.joins?.map(join => join.table)).toEqual([changeApprovals, users]);
    expect(query.whereSql).toContain('"change_approvals"."approver_id" is null');
    expect(query.whereSql).toContain('"users"."is_active" = $1');
    expect(query.whereSql).toContain('"change_approvals"."removed_at" is null');
    expect(query.whereSql).toMatch(
      /"change_approvals"\."decision" = \$2 or "change_approvals"\."decision" is null/,
    );
    expect(query.whereParams).toEqual([false, "pending"]);
    expect(query.selection).toHaveProperty("approverLabel");
  });

  describe.skipIf(!databaseIntegrationEnabled)("PostgreSQL query plan", () => {
    const schema = `cab_alert_plan_${randomUUID().replace(/-/g, "")}`;
    const databaseUrl = testDatabaseUrl;
    let setupPool: Pool | undefined;
    let plannerPool: Pool | undefined;

    beforeAll(async () => {
      if (!databaseUrl) throw new Error("VITEST_TEST_DATABASE_URL is required for the CAB alert planner test");
      setupPool = new Pool({ connectionString: databaseUrl });
      await setupPool.query(`CREATE SCHEMA "${schema}"`);

      const isolatedUrl = new URL(databaseUrl);
      isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
      plannerPool = new Pool({ connectionString: isolatedUrl.toString() });

      await plannerPool.query(`
        CREATE TABLE changes (
          id varchar PRIMARY KEY,
          change_number text NOT NULL,
          title text NOT NULL,
          type text NOT NULL,
          created_at timestamp NOT NULL
        );
        CREATE TABLE change_approvals (
          id varchar PRIMARY KEY,
          change_id varchar NOT NULL,
          approver_id varchar,
          decision text,
          removed_at timestamp
        )
      `);

      const indexMigration = await readFile(
        new URL("../migrations/20261004_cab_pending_approver_lookup_idx.sql", import.meta.url),
        "utf8",
      );
      await plannerPool.query(indexMigration);

      // Model a large approval history: multiple votes per change, many
      // approvers, completed and removed assignments, plus legacy NULL votes.
      await plannerPool.query(`
        INSERT INTO changes (id, change_number, title, type, created_at)
        SELECT
          'change-' || change_id,
          'CHG-' || lpad(change_id::text, 6, '0'),
          'Historical CAB change ' || change_id,
          CASE WHEN change_id % 7 = 0 THEN 'emergency' ELSE 'normal' END,
          now() - (change_id || ' minutes')::interval
        FROM generate_series(1, 15000) AS change_rows(change_id);

        INSERT INTO change_approvals (id, change_id, approver_id, decision, removed_at)
        SELECT
          'approval-' || approval_no,
          'change-' || (((approval_no - 1) / 4) + 1),
          CASE
            WHEN approval_no <= 3 THEN 'selective-target'
            ELSE 'reviewer-' || (approval_no % 256)
          END,
          CASE
            WHEN approval_no = 2 THEN NULL
            WHEN approval_no <= 3 THEN 'pending'
            WHEN approval_no % 5 = 0 THEN 'pending'
            WHEN approval_no % 5 = 1 THEN NULL
            WHEN approval_no % 2 = 0 THEN 'approved'
            ELSE 'rejected'
          END,
          CASE WHEN approval_no % 19 = 0 THEN now() ELSE NULL END
        FROM generate_series(1, 60000) AS approval_rows(approval_no);

        ANALYZE changes;
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

    it("uses the pending-approver index for a selective lookup over approval history", async () => {
      if (!plannerPool) throw new Error("CAB alert planner database was not initialized");

      // Capture the selection, joins, filters, and sort expressions used by
      // the storage method, then compile that query with a real Drizzle client.
      await new DatabaseStorage().getPendingCabAlertChanges("selective-target");
      expect(query.joins).toHaveLength(1);
      expect(query.whereParams?.[0]).toBe("selective-target");
      expect(query.selection).toBeDefined();
      expect(query.source).toBe(changes);
      expect(query.whereCondition).toBeDefined();
      expect(query.orderByConditions).toHaveLength(2);

      const queryDatabase = drizzle({ client: plannerPool, schema: { changes, changeApprovals } });
      const join = query.joins![0]!;
      const alertQuery = queryDatabase
        .selectDistinct(query.selection as never)
        .from(query.source as typeof changes)
        .innerJoin(join.table as typeof changeApprovals, join.condition as never)
        .where(query.whereCondition as never)
        .orderBy(...(query.orderByConditions as never[]));
      const compiled = alertQuery.toSQL();
      const result = await plannerPool.query(
        `EXPLAIN (FORMAT JSON) ${compiled.sql}`,
        compiled.params,
      );
      const explainJson = result.rows[0]?.["QUERY PLAN"] as unknown;
      const [explain] = typeof explainJson === "string"
        ? JSON.parse(explainJson) as { Plan: PlanNode }[]
        : explainJson as { Plan: PlanNode }[];
      const nodes = flattenPlan(explain.Plan);

      expect(nodes.some(node => node["Index Name"] === "change_approvals_pending_approver_change_idx")).toBe(true);
      expect(nodes.some(
        node => node["Node Type"] === "Seq Scan" && node["Relation Name"] === "change_approvals",
      )).toBe(false);
    });
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