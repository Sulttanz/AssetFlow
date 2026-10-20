---
name: Software seat accounting
description: Why legacy aggregate usage remains distinct from named employee allocations.
---

Do not interpret the absence of named software-seat allocations as zero usage.
Existing aggregate usage may include unnamed occupants; allocating an employee
identifies that usage before increasing the total, while active allocations
always establish the minimum used-seat count.

**Why:** The populated asset register already tracked manual used-seat totals
before employee allocations existed. Replacing those totals with the number of
new allocation rows would silently discard existing occupancy information.

**How to apply:** Preserve unnamed usage during imports, allocation changes,
and reporting. Releasing an employee frees a seat. Reconciliation that replaces
legacy totals must be an explicit operation, not an incidental side effect.
