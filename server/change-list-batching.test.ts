// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  changes, changeApprovals, changeEnvironmentStages, users, departments,
  type Change, type ChangeApproval, type ChangeEnvironmentStage, type User, type Department,
} from "@shared/schema";

const select = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ db: { select } }));

import { DatabaseStorage } from "./storage";

describe("batched change list details", () => {
  const dialect = new PgDialect();
  let changeRows: Change[];
  let approvalRows: ChangeApproval[];
  let stageRows: ChangeEnvironmentStage[];
  let userRows: User[];
  let departmentRows: Department[];
  let reads: { table: string; ids?: string[] }[];

  beforeEach(() => {
    changeRows = [];
    approvalRows = [];
    stageRows = [];
    userRows = [];
    departmentRows = [];
    reads = [];

    // Model the IN filtering of the database instead of returning every row:
    // that way a wrong batch boundary or wrong foreign key fails the mapping test.
    select.mockImplementation(() => ({
      from(table: unknown) {
        const source =
          table === changes ? { name: "changes", rows: changeRows, key: "id" } :
          table === changeApprovals ? { name: "approvals", rows: approvalRows, key: "changeId" } :
          table === changeEnvironmentStages ? { name: "stages", rows: stageRows, key: "changeId" } :
          table === users ? { name: "users", rows: userRows, key: "id" } :
          table === departments ? { name: "departments", rows: departmentRows, key: "id" } :
          undefined;
        if (!source) throw new Error("Unexpected table in change list query");
        const read: { table: string; ids?: string[] } = { table: source.name };
        reads.push(read);
        let result = source.rows;
        const query = {
          where(condition: Parameters<typeof dialect.sqlToQuery>[0]) {
            read.ids = dialect.sqlToQuery(condition).params as string[];
            result = source.rows.filter(row => read.ids!.includes(String(row[source.key as keyof typeof row])));
            return query;
          },
          orderBy() { return query; },
          then(resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return query;
      },
    }));
  });

  const change = (id: string, extra: Partial<Change> = {}) =>
    ({ id, requestedById: null, assignedToId: null, departmentId: null, ...extra }) as Change;
  const approval = (id: string, changeId: string, approverId: string | null, extra: Partial<ChangeApproval> = {}) =>
    ({ id, changeId, approverId, originalApproverId: approverId ?? "deleted", decision: "pending", removedAt: null, removedById: null, ...extra }) as ChangeApproval;
  const user = (id: string) =>
    ({ id, username: id, firstName: id, lastName: "Member" }) as User;

  it("keeps shared and distinct votes on the correct changes while retaining removed and deleted-account history", async () => {
    changeRows = [change("first", { requestedById: "requester", departmentId: "dept" }), change("second", { assignedToId: "shared" })];
    approvalRows = [
      approval("vote-shared-first", "first", "shared", { decision: "approved" }),
      approval("vote-only-first", "first", "only-first", { decision: "rejected" }),
      approval("vote-deleted", "second", null, { originalApproverId: "deleted-account", approverLabel: "Former member" }),
      approval("vote-shared-second", "second", "shared"),
      approval("vote-only-second", "second", "only-second"),
      approval("removed", "first", "former-first", {
        originalApproverId: "former-first", removedAt: new Date("2026-01-01"),
        removedById: "remover", removedByLabel: "Remover",
      }),
    ];
    stageRows = [{ id: "stage", changeId: "second", assignedToId: "only-first", deployedById: "shared", order: 1 }] as ChangeEnvironmentStage[];
    userRows = ["requester", "shared", "only-first", "only-second", "remover"].map(user);
    departmentRows = [{ id: "dept", name: "Operations" }] as Department[];

    const result = await new DatabaseStorage().getChanges();
    expect(result.map(row => row.id)).toEqual(["first", "second"]);
    expect(result[0].requestedBy?.id).toBe("requester");
    expect(result[0].department?.id).toBe("dept");
    expect(result[0].approvals.map(v => [v.id, v.decision, v.approver?.id])).toEqual([
      ["vote-shared-first", "approved", "shared"], ["vote-only-first", "rejected", "only-first"],
    ]);
    expect(result[1].approvals.map(v => [v.id, v.approver?.id])).toEqual([
      ["vote-deleted", undefined], ["vote-shared-second", "shared"], ["vote-only-second", "only-second"],
    ]);
    expect(result[1].approvals[0]).toMatchObject({ approverId: null, originalApproverId: "deleted-account", approverLabel: "Former member" });
    expect(result[1].assignedTo?.id).toBe("shared");
    expect(result[1].stages[0]).toMatchObject({ assignedTo: { id: "only-first" }, deployedBy: { id: "shared" } });
    expect(result[0].removedApprovals).toMatchObject([{ id: "removed", removedBy: { id: "remover" } }]);
    expect(result[0].removedApproverIds).toEqual(["former-first"]);
    expect(result[1].removedApprovals).toEqual([]);
    expect(result[1].removedApproverIds).toEqual([]);
    expect(reads.map(read => read.table).sort()).toEqual(["approvals", "changes", "departments", "stages", "users"]);
    expect(reads.find(read => read.table === "users")?.ids).toEqual(
      expect.arrayContaining(["requester", "shared", "only-first", "only-second", "remover"]),
    );
    expect(reads.find(read => read.table === "users")?.ids).not.toContain("former-first");
    expect(reads.find(read => read.table === "users")?.ids).not.toContain("deleted-account");
  });

  it("uses bounded batch reads rather than one read per change or CAB member", async () => {
    changeRows = Array.from({ length: 501 }, (_, i) => change(`change-${i}`));
    approvalRows = changeRows.map((row, i) => approval(`vote-${i}`, row.id, `member-${i}`));
    approvalRows.push(approval("removed-last", "change-500", null, {
      originalApproverId: "former-last", removedAt: new Date("2026-01-02"),
    }));
    userRows = changeRows.map((_, i) => user(`member-${i}`));

    const result = await new DatabaseStorage().getChanges();
    expect(result).toHaveLength(501);
    expect(result[0].approvals).toMatchObject([{ id: "vote-0", approver: { id: "member-0" } }]);
    expect(result[500].approvals).toMatchObject([{ id: "vote-500", approver: { id: "member-500" } }]);
    expect(result[500].removedApproverIds).toEqual(["former-last"]);
    expect(result[500].removedApprovals).toMatchObject([{ id: "removed-last" }]);
    for (const table of ["approvals", "stages", "users"]) {
      const batches = reads.filter(read => read.table === table);
      expect(batches).toHaveLength(2);
      expect(batches.map(batch => batch.ids?.length).sort((a, b) => a! - b!)).toEqual([1, 500]);
      expect(new Set(batches.flatMap(batch => batch.ids))).toHaveProperty("size", 501);
    }
    expect(reads).toHaveLength(7); // One change read, two each for approvals, stages, and users.
  });
});