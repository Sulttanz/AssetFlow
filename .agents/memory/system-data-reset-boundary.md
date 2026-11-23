---
name: System data reset boundary
description: Identity/configuration protection and isolation rules for destructive reset verification.
---

“Clear All System Data” preserves every user account, role assignment, session, and Incident/Service Catalog record. It clears operational records, nulls user-to-employee and catalog links to deleted projects, consumables, or non-default assignment groups, preserves RBAC/system configuration and repository-managed guides, and restores default assignment groups without reseeding catalogs.

**Why:** The user explicitly requires accounts, role mappings, and all catalog templates/configuration to survive while operational records are deleted.

**How to apply:** Classify new modules deliberately against this boundary. Verify successful wipes only in a dedicated schema inside the disposable test cluster, not even the shared full-suite schema, because other tests run concurrently. Keep the reset and its fresh audit entry atomic.

Seed missing built-in service request and incident catalogs on startup, but never re-seed or overwrite catalog records during a business reset.

**Why:** The user's finalized reset rule preserves all built-in and custom catalog records and their configurations; earlier permission to re-seed during reset was superseded.

**How to apply:** Startup may insert missing defaults without overwriting customer customization. Reset only detaches references to deleted operational records and recreates default assignment groups; it must not call the catalog seeder.
