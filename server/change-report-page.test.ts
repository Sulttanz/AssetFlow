// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { changes, changeApprovals } from "@shared/schema";

const select = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ db: { select } }));
import { DatabaseStorage } from "./storage";

describe("change report page projection", () => {
  it("joins row labels and returns active approval counts without hydrating approval or stage history", async () => {
    const dialect = new PgDialect();
    const pageRows = [{
      id: "change-1",
      changeNumber: "CHG-000001",
      title: "Emergency network change",
      type: "emergency",
      status: "approved",
      priority: "high",
      risk: "critical",
      scheduledStart: new Date("2026-10-05T10:00:00.000Z"),
      scheduledEnd: new Date("2026-10-05T11:00:00.000Z"),
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      requestedByLabel: "Requesting User",
      assignedToLabel: "Assigned User",
    }];
    const queries: {
      keys: string[];
      projection: Record<string, unknown>;
      table?: unknown;
      joins: { table: unknown; sql: string }[];
      where?: string;
      params?: unknown[];
      selectedSql?: string;
      selectedParams?: unknown[];
      limit?: number;
      offset?: number;
      orderByCount?: number;
      groupByCount?: number;
    }[] = [];

    select.mockImplementation((selection: Record<string, unknown>) => {
      const query: typeof queries[number] = {
        keys: Object.keys(selection ?? {}),
        projection: selection,
        joins: [],
      };
      if (query.keys.includes("changeId")) {
        const aggregateExpressions = ["activeApprovalCount", "approvedCount", "pendingCount"]
          .map(key => dialect.sqlToQuery(selection[key] as Parameters<typeof dialect.sqlToQuery>[0]));
        query.selectedSql = aggregateExpressions.map(expression => expression.sql).join(" ");
        query.selectedParams = aggregateExpressions.flatMap(expression => expression.params);
      }
      queries.push(query);
      const builder = {
        from(table: unknown) {
          query.table = table;
          return builder;
        },
        leftJoin(table: unknown, condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          query.joins.push({ table, sql: dialect.sqlToQuery(condition).sql });
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          if (condition) {
            const compiled = dialect.sqlToQuery(condition);
            query.where = compiled.sql;
            query.params = compiled.params;
          }
          return builder;
        },
        orderBy(...args: unknown[]) {
          query.orderByCount = args.length;
          return builder;
        },
        limit(value: number) {
          query.limit = value;
          return builder;
        },
        offset(value: number) {
          query.offset = value;
          return builder;
        },
        groupBy(...args: unknown[]) {
          query.groupByCount = args.length;
          return builder;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          const rows = query.keys.includes("count")
            ? [{ count: "9" }]
            : query.keys.includes("changeId")
              ? [{ changeId: "change-1", activeApprovalCount: "3", approvedCount: "1", pendingCount: "2" }]
              : pageRows;
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    });

    const result = await new DatabaseStorage().getChangeReportPage({
      page: 2,
      pageSize: 25,
      search: "emergency",
      searchType: true,
      type: "emergency",
      status: "approved",
      risk: "critical",
    });

    expect(result).toEqual({
      changes: [{
        ...pageRows[0],
        activeApprovalCount: 3,
        approvedCount: 1,
        pendingCount: 2,
      }],
      total: 9,
    });

    const countQuery = queries.find(query => query.keys.includes("count"));
    const pageQuery = queries.find(query => query.keys.includes("requestedByLabel"));
    const approvalQuery = queries.find(query => query.keys.includes("changeId"));
    expect(countQuery?.table).toBe(changes);
    expect(pageQuery?.table).toBe(changes);
    expect(pageQuery).toMatchObject({ limit: 25, offset: 25, orderByCount: 2 });
    expect(pageQuery?.joins).toHaveLength(2);
    expect(pageQuery?.keys).toEqual([
      "id", "changeNumber", "title", "type", "status", "priority", "risk",
      "scheduledStart", "scheduledEnd", "createdAt", "requestedByLabel", "assignedToLabel",
    ]);
    expect(pageQuery?.keys).not.toContain("description");
    expect(dialect.sqlToQuery(
      pageQuery?.projection.requestedByLabel as Parameters<typeof dialect.sqlToQuery>[0],
    ).sql).toContain("concat_ws");
    expect(dialect.sqlToQuery(
      pageQuery?.projection.assignedToLabel as Parameters<typeof dialect.sqlToQuery>[0],
    ).sql).toContain("concat_ws");
    expect(pageQuery?.where).toContain("title");
    expect(pageQuery?.where).toContain("change_number");
    expect(pageQuery?.where).toContain("risk");
    expect(pageQuery?.params).toEqual(expect.arrayContaining([
      "%emergency%", "emergency", "approved", "critical",
    ]));

    expect(approvalQuery?.table).toBe(changeApprovals);
    expect(approvalQuery?.where).toContain("removed_at");
    expect(approvalQuery?.where).toContain("change_id");
    expect(approvalQuery?.selectedSql).toContain("decision");
    expect(approvalQuery?.selectedSql).toContain("approved");
    expect(approvalQuery?.selectedSql).toContain("pending");
    expect(approvalQuery?.selectedSql).toContain("is null");
    expect(approvalQuery?.params).toEqual(expect.arrayContaining(["change-1"]));
    expect(approvalQuery?.groupByCount).toBe(1);
    expect(queries.some(query => query.table !== changes && query.table !== changeApprovals)).toBe(false);
  });
});
