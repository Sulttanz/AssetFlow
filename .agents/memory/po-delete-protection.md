---
name: PO delete protection pattern
description: Approach for blocking deletion of records with derived/dependent data, with an admin unlink-not-delete override.
---

When a parent record (e.g. Purchase Order) has spawned dependent records (e.g. Assets created from it), don't allow it to be silently deleted — that would either cascade-delete real data or orphan foreign keys.

**Pattern:**
- Track derivation with a boolean flag on the parent (e.g. `assetsCreated`) rather than inferring it from a join every time.
- On delete: if the flag is set, block for regular users (403 with a clear explanation).
- For privileged users (permission-gated, e.g. `system_admin`), require an explicit second confirmation step: first attempt returns 400 + `requiresConfirmation: true`, client shows a native confirm dialog, then retries the request with `confirmAdminDelete: true` in the body.
- On confirmed admin delete: unlink the dependent records (clear the foreign key/reference field) rather than deleting them, so no data is destroyed. Then delete the parent. Log both the unlink and the delete as separate audit entries.

**Why:** User explicitly chose "block + admin override that unlinks instead of destroys" over silent cascade-delete or hard block with no escape hatch — preserves data integrity while giving admins a real out.

**How to apply:** Reuse this two-step confirmation + unlink-not-delete shape for any other parent/derived-record relationship in this app (e.g. contracts→assets, budgets→purchase orders) where deletion of the parent could strand or destroy dependent data.
