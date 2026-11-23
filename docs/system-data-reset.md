# Clear All System Data

`POST /api/system/clear-data` is a password-confirmed **business database reset**.
It requires an authenticated, active account with `system_admin` permission and
the current account's valid local password (`confirmPassword`).

## Removed

- Assets, software allocations, custody handovers, assignments, maintenance,
  bookings, disposals, asset requests/audits and attachment records.
- Employees, access entitlements and offboarding clearances.
- Consumable stock, movements, dispatches and receiving records.
- Vendors, contracts and their links, purchase orders, lines and budgets.
- Projects, legacy tickets, incidents, requests, problems, changes, CAB decisions,
  stage/PIR history, and risks. Project links on retained catalog items are detached.
- CMDB applications, servers, hosting/dependency links and document records.
- Network zones/devices/links, firewall rules and review history.
- Backup schedules, run evidence references and restore-verification records.
- Knowledge articles, revisions, document metadata, compliance mappings and
  ticket links; IT component baseline reviews, findings and remediation notes.
- Staged migration payloads and migration history, including previous audit logs.

## Preserved

- Users, password hashes, account status and security configuration.
- Roles, permissions, user-role assignments and role-permission mappings.
- Sessions and CAB stream admission infrastructure.
- All legacy, built-in, and custom Incident Catalog and Service Catalog records,
  including priorities, SLAs, descriptions, approval settings and dynamic form schemas.
  Links to deleted projects, consumables, or non-default assignment groups are set to
  `NULL`; catalog records themselves are neither deleted nor reseeded during reset.
- Default assignment groups are recreated after their business records are cleared.
- System settings, general settings and module configuration.
- Dropdown options, locations, departments, warehouse definitions and SLA policies.
- Migration/schema ledgers and the database schema itself.

Attachment and evidence **records** are removed, not the binary files in upload
directories, external storage or external backup systems.

## Atomicity and audit

Business tables are explicitly classified. Most are cleared by one transactional
PostgreSQL `TRUNCATE ... CONTINUE IDENTITY RESTRICT`; employees, projects, and
consumables are deleted with `DELETE` so protected references can be detached safely.
Catalog links to consumables/projects and user links to employees are nulled first.
No `CASCADE` is used. Concurrent resets are serialized and lock waits are bounded.

A `CLEAR_SYSTEM_DATA` audit entry with actor, IP, user agent, timestamp and table
scope is inserted in the same transaction. If either the reset or audit write
fails, the transaction rolls back. The API reports failure rather than partial
success. The Settings page invalidates cached queries after success, including
the Audit Logs page.

Every Drizzle table must be explicitly classified in
`shared/system-data-reset.ts`; unclassified tables block the reset until reviewed.
An unexpected external foreign-key dependency also blocks the reset rather than
being cascaded away.

## Verification safety

The regression suite creates its own complete `test_clear_*` schema inside the
disposable PostgreSQL cluster started by `npm test`. It seeds every business
table and protected table, tests password/permission rejection, forced rollback,
unexpected dependencies and repeated successful resets. Never test a successful
reset against the development or production database.
