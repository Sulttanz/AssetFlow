---
name: Bulk import governance
description: Preserve approval and publication boundaries when migrating enterprise records.
---

Bulk imports are data onboarding, not an alternative authorization or approval workflow. Do not let spreadsheet values publish policies, approve purchase orders, or create employee login/access grants.

**Why:** An administrator may be importing inventory from an unreviewed source. Accepting its workflow status as authorization would bypass the system's governance controls.

**How to apply:** Keep policy imports in Draft and purchase orders pending normal approval. Employee imports populate the directory only. When expanding import fields or modules, reuse the domain's validation and retain explicit preview confirmation and an audit summary.
