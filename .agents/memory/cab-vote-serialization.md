---
name: CAB vote serialization
description: Transaction ordering rule for deriving a change's status from concurrent CAB votes.
---

When multiple CAB members vote on different assignments for one change, serialize the vote and status calculation on the parent change row inside one database transaction.

**Why:** Locking an individual approval only coordinates requests for the same approver. Separate votes can otherwise derive and write the parent status from different snapshots.

**How to apply:** Keep parent-row locking ahead of the approval write, then calculate status from active decisions inside the same transaction. Manual status overrides must use the same lock and vote snapshot; when a request clears CAB, preserve the requirement if active approvals appeared since its preflight read.