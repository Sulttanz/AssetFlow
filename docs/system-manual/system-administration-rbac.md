---
title: System Administration & RBAC Matrix
category: System Administration & RBAC
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: all_authenticated
---

# System Administration & RBAC Matrix

Access is enforced by server-side roles and permissions, page/API persona rules, and enabled module feature gates. A hidden menu entry is not the security boundary; APIs also verify authorization.

## Standard and special roles

| Role | Typical scope |
|---|---|
| **System Administrator** | Full system administration, role/permission and module configuration, user administration, and repository-owned system guide governance. |
| **IT Manager** | IT operations oversight, project and service governance, change review, and applicable financial/offboarding workflows. |
| **IT Agent** | Incident, service request, problem, and assigned IT operations workbenches; authorized custom Knowledge Base governance. |
| **Asset Manager** | Asset, assignment, maintenance, consumables, vendor, and related inventory operations as permitted by feature gates. |
| **CAB Member** | Assigned change approvals and the associated review information; not general system administration. |
| **Auditor** | Read-oriented access to audit, asset, access-governance, and compliance views permitted by the configured policy. |
| **Read Only User** | Read-only role template. Its actual visibility is determined by permissions assigned by an administrator. |
| **Demo Viewer** | Special read-only demonstration persona enforced by the demo guard. It is handled separately from the canonical role catalog and cannot perform mutating actions. |
| **End User** | Self-service access determined by linked employee state and Assigned Projects; see the four account patterns in the Project Collaboration guide. |

Role labels are normalized against the canonical role keys. Legacy aliases may be recognized during migration, but user assignments should use the standard role names above.

## User Management rules

- Usernames are required and unique. The email address is optional; when supplied it must be valid and unique. A blank email is stored as `NULL`, allowing username-only accounts.
- Sign-in accepts the username or the account's email address. If no email is recorded, the user signs in with the username.
- **Linked Employee** connects a login account to an active employee directory record. It controls access to employee-specific features such as My Assigned Assets; it does not itself grant Project Management membership.
- **Assigned Projects** is a multi-select maintained by authorized user administrators. It synchronizes with project team membership. Assign only active projects the user is intended to access; removing a membership removes project-scoped access.
- The four End User patterns—linked/no project, linked/project member, external project user, and unlinked general user—are described in the Project Collaboration guide. Server APIs enforce the same scope when records are read or submitted.

## Knowledge Base governance

All authenticated roles can read published repository-synced system guides regardless of module license. System guide content is sourced from `docs/system-manual/` and synchronized idempotently at startup. System Administrators alone may edit or archive a system guide. System Administrators, IT Managers, and IT Agents may create, edit, review, and publish custom Knowledge Base articles. Other roles are read-only for article authoring.

## Safe administration

Use the normal user, role, module, and project management screens. Never share passwords or tokens in Knowledge Base content. Clear-data and other destructive settings require administrator authorization and retain protected system data according to their documented safeguards.
