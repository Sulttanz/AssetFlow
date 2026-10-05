import { describe, expect, it, vi } from "vitest";
import { syncCabMigrations } from "../scripts/sync-dev-cab-schema.mjs";

const migratedSchema = {
  has_table: true,
  original_approver_id_required: true,
  approver_label_required: true,
  approver_id_nullable: true,
  approver_fk_sets_null: true,
  legacy_assignment_unique_removed: true,
  has_removed_by_id: true,
  has_removed_at: true,
  has_removed_by_label: true,
  has_pending_approver_lookup_index: true,
};

function fakeClient(status: Record<string, boolean>, missingRemoverLabels = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("to_regclass('change_approvals')")) {
      return { rows: [status] };
    }
    if (sql.includes("AS needed")) {
      return { rows: [{ needed: missingRemoverLabels }] };
    }
    return { rows: [] };
  });
  return { query };
}

describe("development CAB schema sync", () => {
  it("defers clean databases with no CAB table to Drizzle's current schema", async () => {
    const client = fakeClient({ has_table: false });

    await expect(syncCabMigrations(client)).resolves.toEqual({
      history: "deferred-no-table",
      removerLabel: "deferred-no-table",
      pendingApproverIndex: "deferred-no-table",
    });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("applies both migrations to a legacy database with existing CAB assignments", async () => {
    const legacySchema = {
      ...migratedSchema,
      original_approver_id_required: false,
      approver_label_required: false,
      approver_id_nullable: false,
      approver_fk_sets_null: false,
      legacy_assignment_unique_removed: false,
      has_removed_by_label: false,
      has_pending_approver_lookup_index: false,
    };
    const client = fakeClient(legacySchema);

    await expect(syncCabMigrations(client)).resolves.toEqual({
      history: "applied",
      removerLabel: "applied",
      pendingApproverIndex: "applied",
    });

    const appliedSql = client.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.includes("ALTER TABLE change_approvals"));
    expect(appliedSql).toHaveLength(2);
    expect(appliedSql[0]).toContain("ADD COLUMN IF NOT EXISTS original_approver_id");
    expect(appliedSql[0]).toContain("COALESCE(a.original_approver_id, a.approver_id)");
    expect(appliedSql[0]).toContain("DROP CONSTRAINT IF EXISTS");
    expect(appliedSql[1]).toContain("ADD COLUMN IF NOT EXISTS removed_by_label");
    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes("CREATE INDEX IF NOT EXISTS change_approvals_pending_approver_change_idx"),
    )).toBe(true);
  });

  it("does not rerun migrations when the schema is already current", async () => {
    const client = fakeClient(migratedSchema);

    await expect(syncCabMigrations(client)).resolves.toEqual({
      history: "already-applied",
      removerLabel: "already-applied",
      pendingApproverIndex: "already-applied",
    });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("ALTER TABLE change_approvals"))).toBe(false);
  });

  it("backfills missing remover labels even when the column already exists", async () => {
    const client = fakeClient(migratedSchema, true);

    await expect(syncCabMigrations(client)).resolves.toEqual({
      history: "already-applied",
      removerLabel: "applied",
      pendingApproverIndex: "already-applied",
    });
    expect(client.query.mock.calls.some(([sql]) => sql.includes("UPDATE change_approvals AS a"))).toBe(true);
  });

  it("adds the pending approver index to an otherwise current CAB schema", async () => {
    const client = fakeClient({
      ...migratedSchema,
      has_pending_approver_lookup_index: false,
    });

    await expect(syncCabMigrations(client)).resolves.toEqual({
      history: "already-applied",
      removerLabel: "already-applied",
      pendingApproverIndex: "applied",
    });
    expect(client.query.mock.calls.some(([sql]) =>
      sql.includes("CREATE INDEX IF NOT EXISTS change_approvals_pending_approver_change_idx"),
    )).toBe(true);
  });
});