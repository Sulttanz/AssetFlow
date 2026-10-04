---
name: CAB stream restoration
description: Client behavior for disabling and later restoring ITSM access while a user stays on the page.
---

When an ITSM-disabled response closes a CAB event stream, do not let EventSource retry continuously. Recheck module access at a low frequency while paused, and reopen the stream only after ITSM is enabled and the same signed-in account is still active.

**Why:** A stream closed for revoked module access will not restart by itself, but retrying it continuously while access remains disabled wastes requests and connections.

**How to apply:** Preserve the paused state and account check when changing client-side CAB stream lifecycle or module-access recovery.