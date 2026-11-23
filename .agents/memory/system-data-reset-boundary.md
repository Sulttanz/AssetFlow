---
name: System data reset boundary
description: Identity/configuration protection and isolation rules for destructive reset verification.
---

“Clear All System Data” removes all non-administrator accounts and their role assignments and sessions, while preserving System Administrator accounts and sessions, RBAC definitions, system configuration, and reference directories. Business data, including project memberships and tasks, is cleared without cascading into protected records.

**Why:** The user explicitly chose deletion of every non-admin account while requiring administrators to retain access and standard roles, permissions, and system configuration to remain intact.

**How to apply:** Classify new modules deliberately against this boundary. Verify successful wipes only in a dedicated schema inside the disposable test cluster, not even the shared full-suite schema, because other tests run concurrently. Keep the reset and its fresh audit entry atomic.

Built-in service request and incident catalogs must always be available after startup and business resets.

**Why:** The user explicitly requires default templates to survive Clear All Data through preservation or immediate re-seeding, rather than leaving empty catalogs.

**How to apply:** Re-seed defaults inside the reset transaction before commit and seed missing defaults at startup without overwriting customer customization.
