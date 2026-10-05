import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "migrations");

const cabSchemaStatusQuery = `
  SELECT
    to_regclass('change_approvals') IS NOT NULL AS has_table,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'original_approver_id'
        AND is_nullable = 'NO'
    ) AS original_approver_id_required,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'approver_label'
        AND is_nullable = 'NO'
    ) AS approver_label_required,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'approver_id'
        AND is_nullable = 'YES'
    ) AS approver_id_nullable,
    EXISTS (
      SELECT 1
      FROM pg_constraint AS c
      JOIN pg_class AS t ON t.oid = c.conrelid
      JOIN pg_namespace AS n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'change_approvals'
        AND c.conname = 'change_approvals_approver_id_users_id_fk'
        AND c.contype = 'f'
        AND c.confdeltype = 'n'
    ) AS approver_fk_sets_null,
    NOT EXISTS (
      SELECT 1
      FROM pg_constraint AS c
      JOIN pg_class AS t ON t.oid = c.conrelid
      JOIN pg_namespace AS n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'change_approvals'
        AND c.conname = 'change_approvals_change_id_approver_id_unique'
        AND c.contype = 'u'
    ) AS legacy_assignment_unique_removed,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'removed_by_id'
    ) AS has_removed_by_id,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'removed_at'
    ) AS has_removed_at,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'change_approvals'
        AND column_name = 'removed_by_label'
    ) AS has_removed_by_label,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'change_approvals'
        AND indexname = 'change_approvals_pending_approver_change_idx'
    ) AS has_pending_approver_lookup_index
`;

async function readMigration(name) {
  return readFile(path.join(migrationDirectory, name), "utf8");
}

/**
 * Apply the CAB data migrations only when the connected development database
 * needs them. The caller owns the connection, which also makes this logic
 * testable without a live database.
 */
export async function syncCabMigrations(client) {
  const { rows: [status] } = await client.query(cabSchemaStatusQuery);

  if (!status?.has_table) {
    return {
      history: "deferred-no-table",
      removerLabel: "deferred-no-table",
      pendingApproverIndex: "deferred-no-table",
    };
  }

  const historyReady =
    status.original_approver_id_required &&
    status.approver_label_required &&
    status.approver_id_nullable &&
    status.approver_fk_sets_null &&
    status.legacy_assignment_unique_removed;

  let history = "already-applied";
  if (!historyReady) {
    await client.query(await readMigration("20260929_preserve_cab_approval_history.sql"));
    history = "applied";
  }

  if (!status.has_removed_by_id || !status.has_removed_at) {
    return {
      history,
      removerLabel: "deferred-missing-columns",
      pendingApproverIndex: "deferred-missing-columns",
    };
  }

  let needsRemoverLabelMigration = !status.has_removed_by_label;
  if (!needsRemoverLabelMigration) {
    const { rows: [backfill] } = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM change_approvals AS a
        JOIN users AS u ON u.id = a.removed_by_id
        WHERE a.removed_at IS NOT NULL
          AND a.removed_by_label IS NULL
      ) AS needed
    `);
    needsRemoverLabelMigration = Boolean(backfill?.needed);
  }

  if (!needsRemoverLabelMigration) {
    const pendingApproverIndex = await syncPendingApproverIndex(client, status);
    return { history, removerLabel: "already-applied", pendingApproverIndex };
  }

  await client.query(await readMigration("20260929_cab_remover_label.sql"));
  const pendingApproverIndex = await syncPendingApproverIndex(client, status);
  return { history, removerLabel: "applied", pendingApproverIndex };
}

async function syncPendingApproverIndex(client, status) {
  if (status.has_pending_approver_lookup_index) return "already-applied";
  await client.query(await readMigration("20261004_cab_pending_approver_lookup_idx.sql"));
  return "applied";
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("CAB schema sync is limited to NODE_ENV=development.");
  }
  if (!process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("CAB schema sync is limited to a Replit development workspace.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for development CAB schema sync.");
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    const result = await syncCabMigrations(client);
    console.log(`CAB approval history migration: ${result.history}`);
    console.log(`CAB remover label migration: ${result.removerLabel}`);
    console.log(`CAB pending approver index: ${result.pendingApproverIndex}`);
  } finally {
    client?.release();
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Development CAB schema sync failed:", error.message);
    process.exitCode = 1;
  });
}