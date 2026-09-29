// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { changes } from "@shared/schema";

const select = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ db: { select } }));
import { DatabaseStorage } from "./storage";

describe("paged changes", () => {
  it("applies filters before limiting rows, orders ties deterministically, and returns the full filtered count", async () => {
    const dialect = new PgDialect();
    const queries: { sql?: string; params?: unknown[]; limit?: number; offset?: number; order?: number }[] = [];
    select.mockImplementation(() => {
      const query: { sql?: string; params?: unknown[]; limit?: number; offset?: number; order?: number } = {};
      queries.push(query);
      const builder = {
        from(table: unknown) {
          expect(table).toBe(changes);
          return builder;
        },
        where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
          if (condition) {
            const result = dialect.sqlToQuery(condition);
            query.sql = result.sql;
            query.params = result.params;
          }
          return builder;
        },
        orderBy(...args: unknown[]) { query.order = args.length; return builder; },
        limit(value: number) { query.limit = value; return builder; },
        offset(value: number) { query.offset = value; return builder; },
        then(resolve: (value: unknown[]) => void) {
          return Promise.resolve(query.limit ? [] : [{ count: 51 }]).then(resolve);
        },
      };
      return builder;
    });

    const result = await new DatabaseStorage().getChangesPage({
      page: 3, pageSize: 25, search: "a_%", type: "emergency", status: "submitted",
    });
    expect(result).toEqual({ changes: [], total: 51 });
    expect(queries).toHaveLength(2);
    expect(queries[1]).toMatchObject({ limit: 25, offset: 50, order: 2 });
    for (const query of queries) {
      expect(query.sql).toContain("title");
      expect(query.sql).toContain("change_number");
      expect(query.sql).toContain("type");
      expect(query.sql).toContain("status");
      expect(query.params).toEqual(expect.arrayContaining(["%a\\_\\%%", "emergency", "submitted"]));
    }
  });
});