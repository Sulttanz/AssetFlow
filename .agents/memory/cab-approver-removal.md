---
name: CAB approver removal audit
description: Durable rule for removing mistakenly assigned CAB approvers without losing history or allowing later re-addition.
---

CAB approver removal is a soft deletion. Keep the approval record, mark who removed it and when, and exclude it from active approval calculations and voting displays. Show it separately as read-only history.

**Why:** Hard deletion loses the assignment audit trail. Historical uniqueness cannot safely rely on a database constraint, and a pre-transaction check lets concurrent assignments create duplicates.

**How to apply:** Approval reads used for voting and CAB gates must include only active records. Check complete assignment history and insert under the same transaction after locking the parent change row; reject both active duplicates and previously removed approvers. Keep removal as a soft delete and capture the remover's display label at removal time, since deleting that account clears its foreign key.