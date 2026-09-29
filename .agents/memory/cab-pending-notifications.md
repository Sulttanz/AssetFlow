---
name: CAB pending notification source
description: Why CAB vote reminders are derived from approval state.
---

Pending CAB vote reminders should be derived from active, undecided approval records, not written as separate persistent notifications.

**Why:** A stored reminder can survive a vote or a removed assignment unless every change to approval state also updates a second record. Deriving it keeps the reminder aligned with the authoritative vote state, including previously assigned votes.

**How to apply:** When extending CAB reminders, filter out removed or decided approvals at read time and keep direct links to the relevant change's approval view.