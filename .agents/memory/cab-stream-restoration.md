---
name: CAB stream restoration
description: Client behavior for disabling and later restoring ITSM access while a user stays on the page.
---

When ITSM is disabled, close the CAB event stream and listen on a separate authenticated access-restoration stream. Signal after any successful ITSM enable update rather than relying on a pre-update read, so concurrent setting writes cannot miss a wake-up. Keep low-frequency module polling as a fallback, and reopen CAB alerts only after confirming ITSM is enabled and the same signed-in account is still active. Stop native retry loops if the access signal stream fails.

**Why:** A closed CAB stream cannot hear that access was restored, and a separate pre-update read can race with concurrent setting writes. A data-free wake-up is safe because each client rechecks the authoritative module state and active account before reconnecting; polling covers missed notifications.

**How to apply:** Preserve the paused state, cross-instance restoration signal, polling fallback, and fresh account/module checks when changing CAB stream lifecycle or module-access recovery.