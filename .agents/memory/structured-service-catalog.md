---
name: Structured service catalog compatibility and approval boundary
description: Why catalog identity stays compatible with stock fulfillment, and submitted forms and approval policies are captured rather than read retroactively.
---

Keep the structured catalog additive and preserve existing catalog identities and historical fulfillment links.

**Why:** The older catalog already powers consumable fulfillment and historical requests. An independent replacement identity would disconnect those records even if the storefront appeared to work.

**How to apply:** Keep compatibility metadata synchronized when editing structured services; do not drop or recreate legacy catalog rows to change configuration.

Treat submitted form definitions and required approver roles as historical evidence, not live references to current catalog configuration.

**Why:** Changing a service's questions or approver policy must not reinterpret an already-submitted request or erase its justification.

**How to apply:** Capture configuration at submission. Serialize approval decisions and competing ticket edits using the parent request lock, and prevent generic ticket updates from changing approval decisions.
