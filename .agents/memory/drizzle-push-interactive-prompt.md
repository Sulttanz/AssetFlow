---
name: drizzle-kit push interactive constraint prompt
description: Non-interactive `npm run db:push` / `drizzle-kit push` can hang on a TTY prompt about unique constraints even with --force; fix is to align DB constraint names with Drizzle's expected names.
---

`drizzle-kit push` sometimes shows an interactive "Do you want to truncate table?" prompt when it thinks it's adding a *new* unique constraint, even though a functionally-equivalent unique constraint already exists in the DB under Postgres's auto-generated name (e.g. `settings_key_key` vs Drizzle's expected `settings_key_unique`). This happens when a table was created before `.unique()` was added in the Drizzle schema, or was created outside Drizzle's migration flow.

**Why:** The `--force` flag does not bypass this prompt in the sandboxed shell (no real TTY), so `db:push` hangs/repeats indefinitely and blocks the schema push.

**How to apply:** Before pushing, query `information_schema.table_constraints` / `pg_constraint` for the affected table, and `ALTER TABLE ... RENAME CONSTRAINT <existing_name> TO <expected_name>` to match Drizzle's naming convention (`{table}_{column}_unique` for single-column unique constraints). This is a no-op on data — just a rename — and resolves the prompt so `db:push` completes non-interactively.
