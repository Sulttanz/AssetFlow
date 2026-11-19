---
name: Persona-specific landing pages
description: End Users start in self-service; staff, managers, and auditors use role-filtered Dashboard workspaces.
---

Post-login End Users land at `/portal`. System Administrators, IT Agents, Asset Managers, CAB Members, IT Managers, auditors, and read-only users land at `/dashboard`, where workspace cards and APIs are scoped to their persona. Show My Assets only to users linked to an employee record.

**Why:** The user explicitly requested this persona split to keep employee self-service separate from staff operations while restricting custody data for unlinked external users.

**How to apply:** When changing role navigation, keep `/portal` as the End User landing page and `/dashboard` for other standard roles. Never infer executive-data access from the shared Dashboard URL; gate links and API reads independently, and require an employee link for personal asset custody.
