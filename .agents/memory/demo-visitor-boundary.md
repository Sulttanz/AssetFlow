---
name: Demo visitor authorization boundary
description: Demo visitors may explore operational data and analytics without gaining mutation or administration rights.
---

The demonstration visitor role is meant to see operational pages, full ticket queues, reports, knowledge content, and executive analytics, but must remain read-only. User-account management, roles/permissions, system settings, and data clearing are out of scope for that role.

**Why:** The user wants visitors to explore the platform without the ability to change or delete business data or configure the system.

**How to apply:** Check the demo role before other role or administrator grants and before route handlers, including endpoints that ordinarily require only authentication. A read-only executive dashboard is intentional; it does not imply administration rights. Keep navigation and API decisions aligned.
