---
name: Bulk import governance
description: Preserve approval and publication boundaries when migrating enterprise records.
---

Bulk imports are data onboarding, not an alternative authorization or approval workflow. Do not let spreadsheet values publish policies, approve purchase orders, or create employee login/access grants.

**Why:** An administrator may be importing inventory from an unreviewed source. Accepting its workflow status as authorization would bypass the system's governance controls.

**How to apply:** Keep policy imports in Draft and purchase orders pending normal approval. Employee imports populate the directory only. Ticket imports must use the domain's normal catalog and approval rules, and should not accept spreadsheet-supplied terminal states. Retire legacy direct-write import endpoints when a staged, validated import flow replaces them; do not leave parallel paths that bypass preview, row validation, or audit summaries.
