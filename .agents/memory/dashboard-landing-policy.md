---
name: Common Dashboard landing
description: A common post-login destination must not broaden executive analytics permissions.
---

All post-login navigation should land at `/dashboard`, not at a portal, tracker, Changes or Access Governance page. Keep the dashboard content appropriate to the user's persona.

**Why:** The user explicitly requested Dashboard as the default landing before production. That navigation preference is not permission to expose executive analytics to agents, employees or auditors.

**How to apply:** New personas should get suitable dashboard content and permitted links at the common URL. Do not restore lower-level persona redirects or enable executive API requests for non-executive users.
