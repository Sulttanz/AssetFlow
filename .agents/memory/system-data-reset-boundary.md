---
name: System data reset boundary
description: Identity/configuration protection and isolation rules for destructive reset verification.
---

“Clear All System Data” is a business-record reset, not an account or installation reset. Preserve accounts, authorization, sessions, system configuration and reference directories. Include new business modules without widening deletion through cascading.

**Why:** The user explicitly requires accounts and core configuration to remain intact when clearing module data. A destructive test on the active database would defeat that requirement.

**How to apply:** Classify new modules deliberately against this boundary. Verify successful wipes only in a dedicated schema inside the disposable test cluster, not even the shared full-suite schema, because other tests run concurrently. Keep the reset and its fresh audit entry atomic.
