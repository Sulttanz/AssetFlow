---
title: System Administration, RBAC & Data Reset Guide
category: System Administration & RBAC
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.1.0
audience: all_authenticated
---

# System Administration, RBAC & Data Reset Guide

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

## Clear All System Data: authorization and purpose

Open **System Settings → Clear All System Data** only when intentionally resetting operational business content. This is a destructive operation, not a troubleshooting step or a user-account cleanup tool. Back up required records and attachments and coordinate with affected teams first.

The server requires an authenticated System Administrator with the applicable system permission and verifies the administrator's **current password** before executing the reset. Closing/cancelling the confirmation performs no deletion. A successful reset is one database transaction; foreign-key or final audit-write failures roll back the operation instead of leaving a partial reset.

### Preserved accounts, governance and reference data

| Preserved data | What remains after reset |
|---|---|
| **All User Accounts** (`users`) | Administrators and non-admins retain usernames, optional email, password hashes, active/disabled state and login credentials. No account category is deleted. |
| **All Role Assignments** (`user_roles`) and RBAC | User-role mappings, standard/custom roles, permissions and role-permission mappings remain intact. |
| **Active Sessions** (`sessions`) | Existing session records and CAB stream admission leases are preserved; reset does not deliberately sign everyone out. Normal session expiry and account restrictions still apply. |
| **Incident Catalog and Service Catalog** | Built-in and custom rows in `incident_catalog_items`, `service_catalog_items` and `catalog_items` survive. Their content, priorities, SLA configuration and dynamic form definitions are not reseeded or overwritten during reset. References to deleted operational records are detached as described below. |
| **System Settings** | System/application settings, module-license configuration and dropdown/reference options remain, including the IT Risk Appetite setting. |
| **SLA Policies** | Configured response/resolution policies and targets remain. |
| **Locations / Departments** | Organization location and department reference records remain; warehouse location records are also preserved. |
| **System Manual guides** | All repository-managed system guides (`is_system_guide = true`), their versions, attachments and policy-control mappings remain. The count follows the Markdown files, rather than a hardcoded guide limit. |
| **Other protected configuration** | Change blackout configuration, finance tax settings/rates and finance document sequences remain. Database migration ledgers are not cleared. |

### Permanently cleared operational data

The reset removes operational **Incidents, Service Requests, Problems, Changes, CAB approvals and ticket activity/attachments**, **Projects, project memberships, managers, tasks, milestones, baselines, project changes/risks/documents and asset links**, and **Employees, employee access entitlements and offboarding records**.

It also clears **Assets, license/seat allocations, custody/handovers, assignments, bookings, disposal/audit records, Consumables and inventory movements**, **Vendors and certifications**, **Contracts, quotations, purchase orders, invoices, payments, returns and budgets**, and **Maintenance schedules/records**.

CMDB Applications/Servers and dependencies, Network Topology/Firewall records and reviews, Backup/Restore jobs/evidence records, IT Component Compliance Reviews, the **Internal IT Risk Register** with all mitigation actions/reviews/links, Data Migration Center batches, system notifications and custom Knowledge Base articles are cleared.

Previous **Audit Logs** are cleared. On success the transaction creates one fresh **CLEAR_SYSTEM_DATA** audit entry identifying the administrator and reset scope. Thus the post-reset audit log is not completely empty.

### Safe detachment and restored defaults

- Preserved users are detached from deleted employee records: **`users.employee_id = NULL`**. Credentials, active status and role assignments remain unchanged.
- Project team memberships and other project operational records are deleted. Preserved accounts consequently have no surviving project assignments.
- Catalog references to deleted projects or consumables are set to `NULL`; catalog routing labels referencing removed non-default assignment groups are cleared. Catalog descriptions, priorities, SLAs and form configurations are retained.
- Assignment groups and their memberships are operational data. The default support groups are recreated inside the reset transaction, without re-seeding or overwriting catalog rows. Custom groups/memberships do not survive.
- Non-system Knowledge Base articles and their governed versions/attachments/control mappings are removed. Repository-owned guides and their associated governance records are preserved; operational ticket-to-article links are cleared.
- Startup synchronization reads `docs/system-manual/`, adds missing guides and updates changed guides by stable source-derived slug. It preserves article identity/version history and does not create a duplicate each time the server starts.

Because employee and project associations disappear, a preserved user's self-service persona may change after reset even though their login and role remain valid. Refresh application data and verify operational permissions before resuming work.

### Verification and recovery precautions

Never run a live reset merely to test it. Regression tests use an isolated disposable PostgreSQL schema to verify preservation, detachment, foreign-key safety and rollback. A reset clears database operational records; it is not a secure erasure guarantee for external evidence stores, downloaded reports or backups. Restore deleted business data only through your approved backup/recovery process.
