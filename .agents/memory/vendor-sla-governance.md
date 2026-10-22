---
name: Vendor SLA governance
description: Compatibility and financial-integrity decisions for vendor SLA lifecycle management.
---

Governed SLA contracts extend a single financial contract, rather than creating an independent second financial obligation.

**Why:** Existing procurement, asset expiry views, and executive contract counters already depend on financial contracts. Separate uncoordinated copies would cause duplicate counts or divergent renewal dates and values.

**How to apply:** Save both representations and resource links atomically. Keep generic financial editing from bypassing SLA governance, and retain terminated records instead of deleting contract history.

Lifecycle badges and renewal attention are derived from calendar end dates and the configured notice window; manual termination takes precedence over date-derived expiry.

**Why:** Stored lifecycle labels become stale as time passes, and automatic expiry must not replace the fact that a contract was formally terminated.

**How to apply:** Treat the end date as inclusive, exclude terminated contracts from active counts and renewal queues, and retain the original termination state when reading older financial records.

Display contract valuation separately by currency unless a real, explicitly defined exchange-rate conversion exists.

**Why:** Adding EUR, USD, and other currencies and presenting the result as dollars is financially misleading.

**How to apply:** Preserve currency in both SLA and financial records and group totals by currency. Do not silently introduce an assumed conversion rate.
