---
name: Incident portal and external project users
description: Employee linkage, project-scoped incident intake, and staff-only triage boundaries.
---

Treat an account without an employee link as an external/project user. Hide employee-only asset navigation and hardware requests, while retaining its permitted project tickets and service requests. Linked employees can open their own assigned asset register from the portal and main navigation even if they lack the separate `my_assets_view` permission.

**Why:** The user explicitly requested that external project users see project ITSM work rather than internal employee hardware options, and that employee-linked users retain access to their own assets.

**How to apply:** Portal incident intake offers only assigned projects and global or matching-project incident types. Auto-select a sole assigned project without a picker; show a picker only for two or more. Linked internal employees without projects submit internal incidents with no project. Unlinked external accounts without projects remain blocked. End users supply subject, description, optional assigned equipment, and attachments; staff retain technical triage. Derive technical defaults on the server, not from end-user input. Personal asset access must resolve to the logged-in user's linked employee record; never expose the organization-wide asset register through this path. Preserve an explicitly chosen employee link when editing unrelated account details.
