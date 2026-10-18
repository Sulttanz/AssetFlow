---
name: CAB alert link freshness
description: Why CAB alert deep links must verify the target before showing cached approval details.
---

CAB alert deep links should confirm that the referenced change is still available before showing any approval history or voting controls. Treat missing, inaccessible, and failed lookups as unavailable; do not use a cached detail record as a fallback.

**Why:** Cached change details can outlive deletion or access changes, so reusing them may expose stale approvals or permit a misleading vote flow.

**How to apply:** For user-driven CAB alert links, make a fresh detail request and show a clear unavailable state on failure; keep ordinary detail refresh behavior separate.
