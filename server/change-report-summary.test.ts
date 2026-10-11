// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { changes, changeApprovals } from "@shared/schema";

const select = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ db: { select } }));

import { DatabaseStorage } from "./storage";

describe("change report aggregates", () => {
  it("returns exact status, type, date, and active pending approval totals without loading changes", async () => {
    const dialect = new PgDialect();
    const startOfMonth = new Date("2026-10-01T00:00:00.000Z");
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
    const queries: { table?: unknown; where?: string; params?: unknown[] }[] = [];
    let monthAggregate: unknown;

    select.mockImplementation((selection: Record<string, unknown>) => {
      const query: { table?: unknown; where?: string; params?: unknown[] } = {};
      queries.push(query);
      if (selection?.thisMonth) monthAggregate = selection.thisMonth;
      const builder = {
        from(table: unknown) {
          query.table = table;
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          const result = dialect.sqlToQuery(condition);
          query.where = result.sql;
          query.params = result.params;
          return builder;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          const rows = query.table === changes
            ? [aggregateSelection]
            : [{ count: "8" }];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    });

    const result = await new DatabaseStorage().getChangeReportSummary(startOfMonth);

    expect(result).toEqual({
      total: 23,
      draft: 2,
      submitted: 3,
      approved: 4,
      rejected: 1,
      requested: 1,
      inProgress: 5,
      completed: 3,
      failed: 2,
      cancelled: 2,
      emergency: 6,
      thisMonth: 7,
      pendingApprovals: 8,
    });
    expect(queries.map(query => query.table)).toEqual([changes, changeApprovals]);
    expect(queries[1]?.where).toContain('"change_approvals"."removed_at" is null');
    expect(queries[1]?.where).toContain('"change_approvals"."decision" = $1');
    expect(queries[1]?.where).not.toContain('"change_approvals"."decision" is null');
    expect(queries[1]?.params).toContain("pending");
    const monthSql = dialect.sqlToQuery(monthAggregate as Parameters<typeof dialect.sqlToQuery>[0]);
    expect(monthSql.sql).toContain("created_at");
    expect(monthSql.params).toContain(startOfMonth);
  });
});