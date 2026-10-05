---
name: Workspace SQL migration ledger
description: Keep persistent workspace migration bookkeeping separate from application tables managed by Drizzle.
---

Store the workspace SQL migration ledger in its own PostgreSQL schema, not alongside the application's Drizzle-managed tables.

**Why:** Drizzle schema pushes reconcile the application schema. Setup bookkeeping in that schema can be mistaken for an unmodeled application table.

**How to apply:** Workspace-only migration runners should use a separate bookkeeping schema and remain guarded from production and application startup paths.
