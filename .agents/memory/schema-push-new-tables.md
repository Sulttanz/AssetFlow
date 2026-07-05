---
name: Schema push after adding tables
description: New Drizzle tables defined in shared/schema.ts don't exist in the actual Postgres DB until db:push is run
---

When adding new tables to `shared/schema.ts` and wiring them into `server/storage.ts` (DatabaseStorage) and `server/routes.ts`, the tables do not automatically get created in the real database. Type-checking and route registration all succeed silently even though the table is missing.

**Why:** Drizzle only defines the schema in code; it does not run migrations automatically. Without `npm run db:push`, INSERT/SELECT queries against the new table fail at runtime with a generic error (e.g. route catch blocks swallow the real Postgres error and return a generic 500 like "Failed to create X"), which can look like an application logic bug rather than a missing-table issue.

**How to apply:** After adding any new table(s) to the schema and before end-to-end testing that exercises them, run `npm run db:push` and verify the table exists (e.g. query `information_schema.tables`) before assuming a 500 error is a code bug.
