---
name: CAB historical uniqueness
description: Why a CAB schema migration must not assume historical change/approver pairs are unique.
---

Do not add a unique constraint over historical CAB approver identity without first planning how to retain duplicate existing approval records. The development database contained an older duplicate pair even though schema declarations had implied uniqueness.

**Why:** A new constraint rejected a non-destructive audit-preservation migration; removing one of the duplicate rows would have lost CAB history.

**How to apply:** Treat historical records as immutable audit data. If uniqueness is needed for new assignments, design enforcement that preserves old rows and validate against real data first.