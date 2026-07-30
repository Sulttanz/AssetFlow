---
name: Tier 1 Security & Stability Fixes
description: What was changed to address the five critical issues identified in the system audit
---

## Fixes Applied

### Fix 1 — Session Persistence (connect-pg-simple)
- Replaced `memorystore` with `connect-pg-simple` backed by the existing Neon WebSocket pool (`pool` from `server/db.ts`)
- Pass `pool: pool as any` — do NOT use `conString` (standard pg TCP fails against Neon serverless)
- `createTableIfMissing: true` auto-creates the `sessions` table
- Sessions now survive server restarts

### Fix 2 — Sensitive Logging Stripped
- Removed all ~25 verbose `console.log` lines from `server/auth.ts` (username/password flow, session IDs, user object structure)
- Removed request-body dumps from `server/routes.ts` asset create/update (lines 1339, 1341, 1380, 1382)
- Kept only `console.error` for actual runtime errors

### Fix 3 — Login Rate Limiting
- Added `express-rate-limit` to `server/auth.ts` (already in package.json)
- 10 attempts per IP per 15 minutes; uses default IP key generator (custom keyGenerator causes ERR_ERL_KEY_GEN_IPV6 warning — avoid it)
- Applied as middleware directly on the `/api/login` POST route

### Fix 4 — File Upload Path Traversal
- `server/routes.ts` `/api/uploads/:filename` now:
  - Calls `path.basename()` to strip directory components
  - Rejects if `basename !== req.params.filename` (catches encoded `%2F` traversal)
  - Rejects filenames starting with `.` (hidden files)
  - Verifies resolved path starts within `uploadsDir`
  - Returns 400 for invalid, 404 for missing, not 500

### Fix 5 — Cascade Delete Audit History Protection
- `shared/schema.ts`: changed `onDelete: "cascade"` → `"restrict"` on:
  - `assetDisposalRecords.assetId`
  - `assetAuditItems.assetId`
- `server/routes.ts` asset DELETE handler: catches pg error code `23503` (FK violation) and returns **409 Conflict** with a human-readable message instead of 500

**Why:** Audit/disposal records are compliance history — losing them on an accidental delete is irreversible.
