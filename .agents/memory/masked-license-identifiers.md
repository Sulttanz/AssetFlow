---
name: Masked license identifiers
description: Security rule for presenting license keys in reports and exports.
---

Auditor-facing reports may identify license records, but must mask license keys rather than exposing the full credential.

**Why:** License keys are sensitive activation credentials; reporting needs traceability without making exports a credential disclosure.

**How to apply:** Show only a masked suffix in tables and exports, and do not include the unmasked key in search text, API response payloads, or generated files.
