---
name: Dashboard reporting windows
description: Distinguishing period-based SLA activity from current operational snapshots.
---

The executive dashboard's timeframe applies to incidents resolved within that period. Inventory, employee and project totals, open queues, access expiry and attention items remain current snapshots.

**Why:** Filtering open queues by ticket creation date would hide older unresolved incidents and misrepresent current workload. Likewise, a period selector must not imply historical inventory snapshots that the system does not store.

**How to apply:** Keep the timeframe scope explicit in the UI. New period-based metrics need an appropriate event date; do not silently reinterpret current totals when adding filters.
