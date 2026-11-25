---
name: Route import recovery
description: Why page-module transport failures need local recovery rather than whole-app reloads.
---

Contain failed page imports inside the workspace and use bounded transport retries with user-controlled reloads. Do not automatically reload the entire application on arbitrary render errors.

**Why:** Repeated preview crashes came from failed lazy page downloads while the backend remained healthy. Restarting the server alone did not protect other pages, and automatic full reloads could discard unsaved forms.

**How to apply:** Preserve shared recovery when adding lazy pages. Retry only recognized module transport failures, keep real application exceptions visible, and offer a full reload when browser import caching prevents a retry from recovering.

Check the failed page's transitive module requests as well as its own URL: a page can return 200 while a missing optimized dependency returns 504. Keep the live Vite optimizer cache separate from test/build caches.

**Why:** A KPI page import failure was traced to an unavailable optimized `date-fns` module while the page and backend remained healthy. Re-requesting the page alone could not repair its dependency.
