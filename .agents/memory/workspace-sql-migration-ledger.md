---
name: Workspace SQL migration ledger
description: Keep persistent workspace migration bookkeeping separate from application tables managed by Drizzle.
---

## Migration ledger separation

Keep migration bookkeeping outside Drizzle-managed schemas. Workspace setup migrations use their own ledger and remain limited to development setup. On-prem application startup migrations use a separate ledger and only read additive, idempotent SQL from `migrations/onprem/`; do not replay the historical root-level SQL migrations at application startup.

**Why:** Root-level migration files were created for workspace setup and include historical data backfills and constraint changes. A new on-prem database ledger cannot infer which of those were already applied, so replaying them could fail or affect customer data.

**How to apply:** Put new on-prem startup migrations in `migrations/onprem/`, use only operations accepted by the additive migration guard, and never edit a checksummed migration after it has been applied. Keep workspace setup bookkeeping in its separate schema.

Store the workspace SQL migration ledger in its own PostgreSQL schema, not alongside the application's Drizzle-managed tables.

**Why:** Drizzle schema pushes reconcile the application schema. Setup bookkeeping in that schema can be mistaken for an unmodeled application table.

**How to apply:** Workspace-only migration runners should use a separate bookkeeping schema and remain guarded from production and application startup paths.

Applied SQL migration files are checksum-protected. Restore accidental edits to the recorded migration and place safety checks in the migration runner before that migration executes, or in a new migration whose ordering is safe.

**Why:** Editing a migration already recorded in the workspace ledger stops post-merge setup before schema reconciliation can finish.

**How to apply:** When a historical upgrade needs extra validation, keep its original contents unchanged and put the preflight in the runner; verify both the checksum and the post-merge setup retry.
