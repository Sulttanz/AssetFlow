---
name: Route import recovery
description: Why page-module transport failures need local recovery rather than whole-app reloads.
---

Contain failed page imports inside the workspace and use bounded transport retries with user-controlled reloads. Do not automatically reload the entire application on arbitrary render errors.

**Why:** Repeated preview crashes came from failed lazy page downloads while the backend remained healthy. Restarting the server alone did not protect other pages, and automatic full reloads could discard unsaved forms.

**How to apply:** Preserve shared recovery when adding lazy pages. Retry only recognized module transport failures, keep real application exceptions visible, and offer a full reload when browser import caching prevents a retry from recovering.
