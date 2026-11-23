---
name: System data reset boundary
description: Identity/configuration protection and isolation rules for destructive reset verification.
---

“Clear All System Data” preserves every user account, role assignment, session, and Incident/Service Catalog record. It clears operational records, nulls user-to-employee and catalog links to deleted projects, consumables, or non-default assignment groups, preserves RBAC/system configuration and repository-managed guides, and restores default assignment groups without reseeding catalogs.

**Why:** The user explicitly requires accounts, role mappings, and all catalog templates/configuration to survive while operational records are deleted.

**How to apply:** Classify new modules deliberately against this boundary. Verify successful wipes only in a dedicated schema inside the disposable test cluster, not even the shared full-suite schema, because other tests run concurrently. Keep the reset and its fresh audit entry atomic.

Built-in service request and incident catalogs must always be available after startup and business resets.

**Why:** The user explicitly requires default templates to survive Clear All Data through preservation or immediate re-seeding, rather than leaving empty catalogs.

**How to apply:** Re-seed defaults inside the reset transaction before commit and seed missing defaults at startup without overwriting customer customization.
