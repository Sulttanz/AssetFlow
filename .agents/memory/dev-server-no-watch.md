---
name: Dev server (tsx) does not auto-reload on server file edits
description: Backend/server-side code edits require a manual workflow restart to take effect; only frontend Vite HMR is automatic.
---

The `npm run dev` script runs `tsx server/index.ts` with no `--watch` flag. Editing frontend files under `client/src` triggers Vite HMR automatically, but editing backend files (e.g. `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`) does NOT restart the server process.

**Why:** Hit this directly — added new seed data to a `/api/dropdowns/seed` route, called the endpoint via the running server, and the new entries silently didn't get created because the server was still running the old pre-edit code. No error was thrown; it just looked like the insert failed.

**How to apply:** After editing any server-side file, restart the "Start application" workflow before testing/calling the affected endpoint (via API test or e2e test). Don't assume changes are live just because the edit succeeded.
