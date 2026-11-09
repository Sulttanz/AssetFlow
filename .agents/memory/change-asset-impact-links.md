---
name: Change asset impact links
description: Data-model and module-boundary decisions for linking registered assets to IT changes.
---

Keep registered asset targets in a separate change-to-asset link table rather than widening the application/server CI-link constraint. Include one-hop asset relationships and application/server dependencies when presenting change exposure.

**Why:** The asset registry is an independently licensed module, while CMDB applications and servers already have a constrained link model. A separate additive relation preserves existing CI behavior and allows asset reads to be gated independently.

**How to apply:** Skip asset option, detail, and summary reads while asset management is disabled, preserve existing links for re-enablement, and expose the combined impact in reviewer, risk, and report views.
