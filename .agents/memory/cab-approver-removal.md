---
name: CAB approver removal audit
description: Durable rule for removing mistakenly assigned CAB approvers without losing history or allowing later re-addition.
---

CAB approver removal is a soft deletion. Keep the approval record, mark who removed it and when, and exclude it from active approval calculations and voting displays. Show it separately as read-only history.

**Why:** Hard deletion loses the assignment audit trail and cannot reliably enforce the rule that a removed approver must not be re-added to the same change.

**How to apply:** Approval reads used for voting and CAB gates must include only active records. Assignment checks must examine the complete history and reject both active duplicates and previously removed approvers. Capture the remover's display label at removal time, since deleting that account clears its foreign key; pre-existing rows with a deleted remover may not have a recoverable label.