---
name: System data reset boundary
description: Identity/configuration protection and isolation rules for destructive reset verification.
---

“Clear All System Data” preserves every user account, role assignment, and authentication session. It clears operational records, nulls users’ employee links before employee deletion, preserves RBAC/system configuration and repository-managed guides, and restores built-in catalogs.

**Why:** The user explicitly requires every account and role assignment to survive operational resets while employees, projects, and other business records are deleted.

**How to apply:** Classify new modules deliberately against this boundary. Verify successful wipes only in a dedicated schema inside the disposable test cluster, not even the shared full-suite schema, because other tests run concurrently. Keep the reset and its fresh audit entry atomic.

Built-in service request and incident catalogs must always be available after startup and business resets.

**Why:** The user explicitly requires default templates to survive Clear All Data through preservation or immediate re-seeding, rather than leaving empty catalogs.

**How to apply:** Re-seed defaults inside the reset transaction before commit and seed missing defaults at startup without overwriting customer customization.
