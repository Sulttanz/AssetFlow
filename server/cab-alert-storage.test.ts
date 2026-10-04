// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { changeApprovals, changes } from "@shared/schema";

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
  let query: {
    selection?: Record<string, unknown>;
    source?: unknown;
    joins?: { table: unknown; sql: string }[];
    whereSql?: string;
    whereParams?: unknown[];
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
          query.joins.push({ table, sql: dialect.sqlToQuery(condition).sql });
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          const compiled = dialect.sqlToQuery(condition);
          query.whereSql = compiled.sql;
          query.whereParams = compiled.params;
          return builder;
        },
        orderBy(...ordering: Parameters<typeof dialect.sqlToQuery>[0][]) {
          query.orderBySql = ordering.map(item => dialect.sqlToQuery(item).sql);
          return builder;
        },
        then(resolve: (value: typeof joinedRows) => unknown, reject?: (reason: unknown) => unknown) {
          // Model PostgreSQL SELECT DISTINCT over the projected change fields.
          const uniqueRows = Array.from(new Map(
            joinedRows.map(row => [
              JSON.stringify([row.id, row.changeNumber, row.title, row.type, row.createdAt]),
              row,
            ]),
          ).values());
          return Promise.resolve(uniqueRows).then(resolve, reject);
        },
      };
      return builder;
    });
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
});