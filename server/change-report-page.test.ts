// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { changes, changeApprovals } from "@shared/schema";

const select = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ db: { select } }));
import { DatabaseStorage } from "./storage";

describe("change report page projection", () => {
  it("continues after the last loaded cursor row is deleted", async () => {
    const dialect = new PgDialect();
    let liveChanges = Array.from({ length: 4 }, (_, index) => ({
      id: `change-${index + 1}`,
      changeNumber: `CHG-00000${4 - index}`,
      title: `Change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      scheduledStart: null,
      scheduledEnd: null,
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      requestedByLabel: null,
      assignedToLabel: null,
    }));
    let cursorWhereSql: string | undefined;

    select.mockImplementation((selection: Record<string, unknown>) => {
      let where: Parameters<typeof dialect.sqlToQuery>[0] | undefined;
      let limit = Number.POSITIVE_INFINITY;
      let offset = 0;
      const builder = {
        from() {
          return builder;
        },
        leftJoin() {
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0] | undefined) {
          where = condition;
          return builder;
        },
        orderBy() {
          return builder;
        },
        limit(value: number) {
          limit = value;
          return builder;
        },
        offset(value: number) {
          offset = value;
          return builder;
        },
        groupBy() {
          return builder;
        },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          if (Object.hasOwn(selection, "count")) {
            return Promise.resolve([{ count: String(liveChanges.length) }]).then(resolve, reject);
          }
          if (Object.hasOwn(selection, "changeId")) {
            return Promise.resolve([]).then(resolve, reject);
          }

          const compiled = where ? dialect.sqlToQuery(where) : { sql: "", params: [] };
          const cursor = compiled.params.find(
            (parameter): parameter is string => typeof parameter === "string" && parameter.startsWith("CHG-"),
          );
          if (cursor) cursorWhereSql = compiled.sql;
          const rows = liveChanges
            .filter(change => !cursor || change.changeNumber.localeCompare(cursor) < 0)
            .sort((left, right) => right.changeNumber.localeCompare(left.changeNumber))
            .slice(offset, offset + limit);
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    });

    const storage = new DatabaseStorage();
    const firstBatch = await storage.getChangeReportPage({
      page: 1,
      pageSize: 2,
      cursorPaging: true,
    });
    const deletedCursorNumber = firstBatch.changes.at(-1)?.changeNumber;
    expect(deletedCursorNumber).toBe("CHG-000003");
    liveChanges = liveChanges.filter(change => change.changeNumber !== deletedCursorNumber);

    const nextBatch = await storage.getChangeReportPage({
      page: 2,
      pageSize: 2,
      cursorPaging: true,
      cursorChangeNumber: deletedCursorNumber,
    });
    expect(cursorWhereSql).toContain("change_number");
    expect(cursorWhereSql).toContain("<");
    const exportedChanges = [...firstBatch.changes, ...nextBatch.changes];
    const remainingNumbers = liveChanges.map(change => change.changeNumber);
    const exportedNumbers = exportedChanges.map(change => change.changeNumber);

    expect(exportedNumbers).toEqual(expect.arrayContaining(remainingNumbers));
    expect(new Set(exportedNumbers).size).toBe(exportedNumbers.length);
    for (const changeNumber of remainingNumbers) {
      expect(exportedNumbers.filter(number => number === changeNumber)).toHaveLength(1);
    }
  });

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
      orderBySql?: string;
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
          query.orderBySql = args.map(expression =>
            dialect.sqlToQuery(expression as Parameters<typeof dialect.sqlToQuery>[0]).sql,
          ).join(", ");
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
      scheduledStartFrom: new Date("2026-10-05T00:00:00.000Z"),
      scheduledStartToExclusive: new Date("2026-10-06T00:00:00.000Z"),
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
    expect(countQuery?.where).toContain("scheduled_start");
    expect(pageQuery?.params).toEqual(expect.arrayContaining([
      "%emergency%", "emergency", "approved", "critical",
      "2026-10-05T00:00:00.000Z", "2026-10-06T00:00:00.000Z",
    ]));
    expect(countQuery?.params).toEqual(expect.arrayContaining([
      "2026-10-05T00:00:00.000Z", "2026-10-06T00:00:00.000Z",
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

    const cursorQueryStart = queries.length;
    await new DatabaseStorage().getChangeReportPage({
      page: 2,
      pageSize: 25,
      cursorPaging: true,
      cursorChangeNumber: "CHG-000050",
    });
    const cursorQueries = queries.slice(cursorQueryStart);
    const cursorCountQuery = cursorQueries.find(query => query.keys.includes("count"));
    const cursorPageQuery = cursorQueries.find(query => query.keys.includes("requestedByLabel"));
    expect(cursorCountQuery?.params ?? []).not.toContain("CHG-000050");
    expect(cursorPageQuery).toMatchObject({ limit: 25, offset: 0 });
    expect(cursorPageQuery?.where).toContain("change_number");
    expect(cursorPageQuery?.params).toContain("CHG-000050");
    expect(cursorPageQuery?.orderBySql).toContain("change_number");

    const snapshotQueryStart = queries.length;
    const matchingIds = await new DatabaseStorage().getChangeReportMatchingIds({
      search: "emergency",
      searchType: true,
      type: "emergency",
      status: "approved",
      risk: "critical",
      scheduledStartFrom: new Date("2026-10-05T00:00:00.000Z"),
      scheduledStartToExclusive: new Date("2026-10-06T00:00:00.000Z"),
    });
    expect(matchingIds).toEqual(["change-1"]);
    const snapshotQuery = queries.slice(snapshotQueryStart).find(query => query.keys.includes("id"));
    expect(snapshotQuery?.keys).toEqual(["id"]);
    expect(snapshotQuery?.where).toContain("status");
    expect(snapshotQuery?.where).toContain("risk");
    expect(snapshotQuery?.where).toContain("scheduled_start");
    expect(snapshotQuery?.orderBySql).toContain("change_number");
    expect(snapshotQuery?.orderBySql).toContain("id");

    const idBatchQueryStart = queries.length;
    await new DatabaseStorage().getChangeReportPage({
      page: 1,
      pageSize: 1,
      cursorPaging: true,
      changeIds: ["change-1"],
    });
    const idBatchPageQuery = queries.slice(idBatchQueryStart).find(query => query.keys.includes("requestedByLabel"));
    expect(idBatchPageQuery?.where).toContain("id");
    expect(idBatchPageQuery?.where).not.toContain("status");
    expect(idBatchPageQuery?.orderBySql).toContain("change_number");
  });
});
