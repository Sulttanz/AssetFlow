---
name: Consumables inventory model
description: Warehouse-specific stock rows, catalog links, and idempotent PO receipt behavior.
---

Consumable quantity records are scoped to one warehouse location. A transfer reduces the source row and creates or updates the matching name/part-number row at the destination. A catalog item's consumable link identifies the product descriptor; fulfillment resolves a matching row at the selected warehouse.

**Why:** Stock has to be locked, counted, and audited independently by location. There is not yet a separate product-master table, so the selected stock row acts as the catalog anchor while matching equivalent location rows by name and part number.

**How to apply:** Preserve one stock row per product and location when adding receipt, transfer, or fulfillment behavior. If introducing a product-master table, migrate the catalog link and existing warehouse rows together rather than treating warehouse quantities as one global total.

PO receiving uses per-line receipt records and a transaction so retries cannot duplicate asset creation or stock additions.

**Why:** A purchase order may contain multiple asset and consumable lines, and repeating the receive action must not silently double the inventory.

**How to apply:** Keep receipt markers and the associated stock/asset updates in the same database transaction; do not reprocess already-received lines.

Disabling a warehouse preserves its inventory and dispatch history but blocks new stock assignment, issue, transfer, receipt, and service-request fulfillment. Enforce the active check in the transaction, not only in form options.

**Why:** Existing audit records must remain readable, while stale browser state or direct API calls must not move stock into or out of a disabled location.

**How to apply:** Keep disabled locations visible for historical records and editing/reactivation; filter them from new-operation choices and re-check status under a row lock when committing a stock movement.
