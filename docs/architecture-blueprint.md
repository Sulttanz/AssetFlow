# Enterprise IT Operations Platform — Current Architecture & Database Blueprint

> **Scope.** This is a source-code inventory of the current workspace, not a review of production data or a compliance certification. The primary sources are `client/src/App.tsx`, `client/src/components/layout/sidebar.tsx`, `shared/schema.ts`, `shared/modules.ts`, `shared/personas.ts`, `server/routes.ts`, `server/storage.ts`, `server/index.ts`, and SQL migrations. Re-check these files after route, schema, or permission changes.

## 1. Architecture at a glance

| Layer | Implementation |
|---|---|
| Client | React 18 + TypeScript, Vite, Wouter routes, TanStack Query, Tailwind/shadcn-style shared UI |
| API | Node.js + Express in `server/`; route registration is centralized in `server/routes.ts` with some route groups in dedicated modules |
| Data access | Drizzle ORM; `shared/schema.ts` is the PostgreSQL schema and shared insert/select type source; `server/storage.ts` exposes storage interfaces and implementations |
| Database | PostgreSQL via `pg`; `@neondatabase/serverless` is also installed for managed deployments |
| Authentication | Express sessions, Passport local authentication, PostgreSQL session store |
| Migrations | Additive on-prem SQL migrations under `migrations/onprem/`; startup checks and applies checksummed migrations to `onprem_deploy.sql_migrations` under an advisory lock. Development has separate migration/schema-sync scripts. |
| Deployment shape | Modular monolith: one application and complete shared database; licensing turns business modules on/off without deleting their tables or customer data. |

There are **93 Drizzle `pgTable` definitions** in `shared/schema.ts`. No Prisma schema or `db/schema.ts` is present. The on-prem migration ledger and dropdown-duplicate archive are operational support tables outside those 93 application tables.

### Migration and schema ownership

- `shared/schema.ts` describes current tables, columns, indexes, checks, references, and shared Zod-derived input/output types.
- `migrations/*.sql` contains development/compatibility migrations.
- `migrations/onprem/*.sql` contains the on-prem startup migration stream.
- `server/startup-migrations.ts` sorts the SQL files, verifies additive-only statements, checks SHA-256 checksums, serializes concurrent startup with a PostgreSQL advisory lock, and records applied files in `onprem_deploy.sql_migrations`.
- The application does not physically omit a module’s tables when a license is disabled. This is feature isolation in a complete schema, not separate per-module database packages.

## 2. Page routes and navigation

### 2.1 Registered client routes

The route registry lives in `client/src/App.tsx`. Public routes are `/auth` and `/initialize`; `/` redirects through the authenticated home redirect. The remaining routes are protected and may additionally require a module, a permission, or ITSM workbench access.

#### Core, identity, organization, and administration

| Route | Page / notes |
|---|---|
| `/` | Home redirect |
| `/dashboard` | Persona-aware dashboard |
| `/knowledge-base` | Core Knowledge Base / System Manual; not gated by ITSM |
| `/users` | User management; `user_view` |
| `/roles` | Role management; `role_view` |
| `/permissions` | Permission management; `permission_view` |
| `/dropdowns`, `/system/dropdowns` | Same dropdown-management page; `system_admin` |
| `/system-settings`, `/settings` | System settings and application settings |
| `/audit-logs` | Audit log viewer; `audit_view` or `system_admin` |
| `/employees` | Employee lifecycle; asset-management module and employee/offboarding permissions |
| `/access-governance` | Access grants and reviews; asset-management module and access/employee permissions |
| `/locations`, `/departments` | Organization reference data; asset-management module |

#### ITAM, procurement, and asset operations

| Route | Page / notes |
|---|---|
| `/assets` | Asset register |
| `/my-assets` | Current user’s assigned assets; `my_assets_view` |
| `/assignments` | Asset assignment register |
| `/asset-handovers` | Digital handover and custody receipts |
| `/asset-disposal` | Disposal lifecycle |
| `/bookings` | Asset bookings |
| `/asset-requests` | Asset requests |
| `/asset-audits` | Asset audit sessions and findings |
| `/consumables`, `/inventory` | Same consumables/inventory page |
| `/maintenance` | Maintenance schedules and records |
| `/vendors` | Vendor and contract lifecycle |
| `/purchase-orders` | Purchase orders and receiving |
| `/budgets` | Budgets |
| `/contracts` | Contracts |

These routes are generally gated by `asset_management`; financial and employee views additionally apply their specific permission requirements.

#### Project management

| Route | Page / notes |
|---|---|
| `/projects` | Project portfolio |
| `/projects/:id` | Project workspace/detail |
| `/reports/project-allocations` | Project resource allocation report |

These routes are gated by `project_management`; report and data operations additionally require project permissions.

#### CMDB and infrastructure

| Route | Page / notes |
|---|---|
| `/applications` | CMDB applications |
| `/servers` | Server/infrastructure register |
| `/network-topology` | Zones, devices, links, firewall rules and reviews |
| `/backup-schedules` | Backup schedules, runs, restore tests and evidence |

These are gated by `cmdb` and page-specific permissions.

#### ITSM and risk

| Route | Page / notes |
|---|---|
| `/portal` | Self-service landing; `itsm` |
| `/service-catalog` | Service catalog and approval queue (`?tab=approvals`) |
| `/incidents`, `/incidents/new` | Incident intake |
| `/incidents/tracker` | Agent incident workbench |
| `/service-requests`, `/service-requests/new` | Request intake |
| `/service-requests/tracker` | Service-request workbench |
| `/problems` | Problem management workbench |
| `/changes`, `/changes/new` | Change management and new RFC |
| `/changes/tracker` | Change/CAB tracker |
| `/kpis` | ITSM KPI dashboard |
| `/sla-policies` | SLA policy administration; ITSM module and `system_admin` |
| `/risks`, `/risk-management` | Same standalone risk register; `risk_management` |

`/itsm` and `/grc` are **not** registered page paths. ITSM is represented by the routes above. Risk management has a dedicated module key, but there is no separate `grc` feature key or `/grc` page.

#### Analytics and reports routes

`/reports` is the current expandable report catalog. It is not the older tabbed `client/src/pages/reports.tsx` component; that legacy component is not mounted at `/reports`.

| Route | Page / state |
|---|---|
| `/reports` | Category/report-card index |
| `/reports/personnel` | Employee directory alias |
| `/reports/employee-directory` | Employee directory and status |
| `/reports/workload-heatmap` | Resource workload report |
| `/reports/account-activity` | Access/onboarding/offboarding report |
| `/reports/hardware-lifecycle` | Existing depreciation report under lifecycle label |
| `/reports/consumables-stock` | Live consumables stock report |
| `/reports/project-variance` | Planned analytics page |
| `/reports/project-velocity` | Planned analytics page |
| `/reports/risk-heatmap` | Planned analytics page |
| `/reports/itsm-mttr` | Existing ticket report |
| `/reports/itsm-sla` | Planned analytics page |
| `/reports/itsm-cab` | Existing change report |
| `/reports/project-allocations` | Project resource allocation report |
| `/reports/asset-summary` | Asset summary |
| `/reports/lifecycle` | Asset lifecycle |
| `/reports/hardware-inventory` | IT Components & Configuration Compliance report |
| `/reports/assignments` | Assignment report |
| `/reports/maintenance` | Maintenance report |
| `/reports/purchase-orders` | Purchase-order report |
| `/reports/budget` | Budget report |
| `/reports/department` | Department report |
| `/reports/warranties` | Warranty report |
| `/reports/vendor-analysis` | Vendor analysis |
| `/reports/released-assets` | Released-assets report |
| `/reports/depreciation` | Depreciation report |
| `/reports/missing-data` | Asset missing-data report |
| `/reports/assignment-history` | Assignment history |
| `/reports/tickets` | Ticket report |
| `/reports/problems` | Problem report |
| `/reports/changes` | Change report |
| `/reports/kb-articles` | Knowledge Base usage report |

#### Imports and aliases

| Route | Page / notes |
|---|---|
| `/import`, `/migration` | Same Data Migration Center |
| `/inventory` | Alias of `/consumables` |
| `/dropdowns` | Alias of `/system/dropdowns` |
| `/risk-management` | Alias of `/risks` |

Unmatched paths render `NotFound`.

### 2.2 Sidebar tree (`client/src/components/layout/sidebar.tsx`)

Section visibility is conditional on persona, permissions, and module state. This is the configured tree; individual entries can be hidden for a persona or missing permission.

```text
Overview
  Dashboard                                  /dashboard
  Knowledge Base / System Manual             /knowledge-base
  KPI Dashboard                              /kpis                    [ITSM]

Employee Support                            [ITSM]
  Self-Service Portal / My Tickets           /portal
  Service Catalog                            /service-catalog
  Approval Queue                             /service-catalog?tab=approvals

My Assets                                   [Asset Management]
  My Assigned Assets                         /my-assets

Asset Management                            [Asset Management]
  Assets                                     /assets
  Consumables                                /consumables
  Employees                                  /employees
  Access Governance                          /access-governance
  Assignments                                /assignments
  Asset Handovers                            /asset-handovers
  Asset Disposal                             /asset-disposal
  Bookings                                   /bookings
  Asset Requests                             /asset-requests

CMDB & Infrastructure                       [CMDB]
  Applications                               /applications
  Servers                                    /servers
  Network Topology                           /network-topology
  Backup & Restore                           /backup-schedules

Organization                                [Asset Management]
  Locations                                  /locations
  Departments                                /departments
  Vendors                                    /vendors

Financial                                   [Asset Management]
  Purchase Orders                            /purchase-orders
  Budgets                                    /budgets
  Contracts                                  /contracts

Project Management                          [Project Management]
  Projects                                   /projects
  Resource Allocation                        /reports/project-allocations

Operations                                  [Asset Management]
  Maintenance                                /maintenance
  Asset Audits                               /asset-audits

IT Service Management                       [ITSM]
  Incidents                                  /incidents
  Incident Tracker                           /incidents/tracker
  Service Requests                           /service-requests
  Request Tracker                            /service-requests/tracker
  Problems                                   /problems
  Changes                                    /changes
  Change Tracker                             /changes/tracker
  Service Catalog                            /service-catalog

Risk Management & Compliance
  Risk Register                              /risks                    [Risk Management]
  IT Components & Compliance                 /reports/hardware-inventory [Asset Management]

Analytics & Reports
  Reports                                    /reports
    Employee & Personal
      Employee Directory & Status Report     /reports/employee-directory
      Resource Workload Heatmap              /reports/workload-heatmap
      Account Access & Onboarding Activity   /reports/account-activity
    IT Asset Management
      Hardware Depreciation & Lifecycle      /reports/hardware-lifecycle
      Consumable Stock & Reorder Alerts      /reports/consumables-stock
    Project Management & Governance
      Schedule & Budget Variance             /reports/project-variance
      Task & Milestone Velocity              /reports/project-velocity
      PMI RMP Risk Heatmap                   /reports/risk-heatmap
    ITSM Service Desk
      Incident MTTR & P1-P4 Breakdown        /reports/itsm-mttr
      SLA Breach & Escalation Metrics        /reports/itsm-sla
      Change Enablement (CAB) Success Rates  /reports/itsm-cab

Tools
  Data Migration Center                      /import
  Settings                                   /settings

System
  User Management                            /users
  Roles                                      /roles
  Permissions                                /permissions
  Dropdowns                                  /system/dropdowns
  Audit Logs                                 /audit-logs
  System Settings                            /system-settings
  SLA Policies                               /sla-policies
```

The report tree has four categories; GRC is not currently a report category. The standalone risk register and IT-components compliance report appear in the separate Risk Management & Compliance section.

## 3. PostgreSQL schema inventory and relationships

The names below are physical PostgreSQL table names from `shared/schema.ts`. The right-hand arrows summarize declared Drizzle foreign-key references. Tables without an arrow have no declared `.references()` in the schema (some may still be related by application logic or non-FK identifiers).

### 3.1 Identity, organization, system configuration

**Tables:** `employees`, `employee_access_rights`, `employee_offboarding_clearances`, `locations`, `departments`, `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `cab_stream_leases`, `system_settings`, `audit_logs`, `data_migration_batches`, `dropdown_options`, `settings`, `module_settings`.

**References:**
- `employee_access_rights.employee_id → employees.id`
- `employee_offboarding_clearances.employee_id → employees.id`; `signed_by → users.id`
- `user_roles.user_id → users.id`; `role_id → roles.id`
- `role_permissions.role_id → roles.id`; `permission_id → permissions.id`
- `audit_logs.user_id → users.id`
- `data_migration_batches.created_by_id → users.id`
- `module_settings` stores one enabled state per module key; the module registry supplies defaults.

`employees` has department, location, manager and lifecycle fields, but those fields are not declared as FK references in this table definition. `sessions` is the PostgreSQL-backed session store. `cab_stream_leases` holds expiring user/session leases and does not declare a user FK in the current schema.

### 3.2 Project management and governance

**Tables:** `projects`, `project_baselines`, `project_managers`, `project_team_members`, `project_milestones`, `project_assets`, `project_tasks`, `project_risks`, `project_changes`, `project_documents`.

**References:**
- `projects.created_by → users.id`
- `project_baselines.project_id → projects.id`; `approved_by → users.id`
- `project_managers.project_id → projects.id`; `user_id → users.id`
- `project_team_members.project_id → projects.id`; `user_id → users.id`
- `project_milestones.project_id → projects.id`
- `project_assets.project_id → projects.id`; `asset_id → assets.id` (optional cross-module association)
- `project_tasks.project_id → projects.id`; `assignee_id → users.id`
- `project_risks.project_id → projects.id`; `owner_id → users.id`
- `project_changes.project_id → projects.id`; `requested_by → users.id`
- `project_documents.project_id → projects.id`; `uploaded_by → users.id`

Project risk and change records are project-owned tables. The optional `project_assets` association points into ITAM; asset access/linking is module-aware in routes and storage.

### 3.3 ITAM, inventory, procurement, finance and maintenance

**Tables:** `assets`, `software_license_allocations`, `assignments`, `asset_handovers`, `vendors`, `warehouse_locations`, `consumables`, `consumable_stock_movements`, `consumable_dispatch_log`, `purchase_orders`, `purchase_order_items`, `purchase_order_item_receipts`, `budgets`, `maintenance_schedules`, `maintenance_records`, `contracts`, `vendor_contracts`, `vendor_contract_assets`, `vendor_contract_purchase_orders`, `vendor_contract_servers`, `asset_bookings`, `asset_disposal_records`, `asset_audit_sessions`, `asset_audit_items`, `asset_relationships`, `asset_requests`, `asset_attachments`.

**References:**
- `assets.location_id → locations.id`; `department_id → departments.id`; `primary_vendor_id → vendors.id`
- `software_license_allocations.asset_id → assets.id`; `employee_id → employees.id`
- `assignments.asset_id → assets.id`; `employee_id → employees.id`
- `asset_handovers.employee_id → employees.id`; `asset_id → assets.id`; `assignment_id → assignments.id`; `issued_by_user_id → users.id`
- `consumables.warehouse_location_id → warehouse_locations.id`; `vendor_id → vendors.id`
- `consumable_stock_movements.consumable_id → consumables.id`; from/to locations → `warehouse_locations.id`; recipient/actor → `users.id`; optional service request and purchase order references
- `consumable_dispatch_log.consumable_id → consumables.id`; `warehouse_location_id → warehouse_locations.id`; service request → `service_requests.id`; requester/agent → `users.id`
- `purchase_orders.vendor_id → vendors.id`; `department_id → departments.id`
- `purchase_order_items.purchase_order_id → purchase_orders.id`; optional asset, consumable, and warehouse references
- `purchase_order_item_receipts.purchase_order_id → purchase_orders.id`; `purchase_order_item_id → purchase_order_items.id`
- `budgets.department_id → departments.id`; `location_id → locations.id`
- `maintenance_schedules.asset_id → assets.id`; `maintenance_records.asset_id → assets.id`; `schedule_id → maintenance_schedules.id`
- `contracts.vendor_id → vendors.id`; `asset_id → assets.id`; `owner_id → employees.id`
- `vendor_contracts.vendor_id → vendors.id`; legacy contract association → `contracts.id`
- vendor contract link tables point to `vendor_contracts.id` plus assets, purchase orders, or servers
- `asset_bookings.asset_id → assets.id`; requester/approver → `employees.id`
- `asset_disposal_records.asset_id → assets.id`; approval → `employees.id`; disposer → `users.id`
- `asset_audit_sessions.conducted_by → users.id`; optional location/department references
- `asset_audit_items.session_id → asset_audit_sessions.id`; `asset_id → assets.id`; verifier → `users.id`
- `asset_relationships.parent_asset_id` and `child_asset_id → assets.id`
- `asset_requests.requested_by → employees.id`; reviewer → `users.id`; optional assigned asset → `assets.id`
- `asset_attachments.asset_id → assets.id`; uploader → `users.id`

The `assets` row also contains the software licensing and cloud/SaaS fields (license type/quantity/expiry/used seats; provider, tenant ID, billing cycle, recurring cost, auto-renewal) alongside physical asset, security, finance, lifecycle and audit metadata.

### 3.4 CMDB, network, firewall and backup governance

**Tables:** `cmdb_applications`, `servers`, `application_server_links`, `network_zones`, `it_component_compliance_reviews`, `network_devices`, `network_device_links`, `firewall_rules`, `firewall_rule_reviews`, `backup_schedules`, `backup_job_runs`, `backup_restore_tests`, `configuration_documents`.

**References:**
- `cmdb_applications` business owner and technical owner reference `employees.id`
- `application_server_links.application_id → cmdb_applications.id`; `server_id → servers.id`
- `network_zones.created_by_id → users.id`
- `it_component_compliance_reviews.reviewed_by_id → users.id` (component itself is polymorphic via `component_type` + `component_id`)
- `network_devices.zone_id → network_zones.id`; optional asset → `assets.id`; creator → `users.id`
- `network_device_links.source_device_id` and `target_device_id → network_devices.id`; creator → `users.id`
- `firewall_rules.firewall_device_id → network_devices.id`; source/destination zones → `network_zones.id`; owner/creator → `users.id`; optional change → `changes.id`
- `firewall_rule_reviews.firewall_rule_id → firewall_rules.id`; reviewer → `users.id`
- `backup_schedules.server_id → servers.id`; application → `cmdb_applications.id`; owner/creator → `users.id`
- `backup_job_runs.schedule_id → backup_schedules.id`; logger → `users.id`
- `backup_restore_tests.schedule_id → backup_schedules.id`; tester → `users.id`
- `configuration_documents` links to an application and/or server and uploader (`users.id`)

`change_ci_links` (below) is the inverse impact map from a change to one application or server; CMDB application/server dependency is represented by `application_server_links`.

### 3.5 ITSM, service catalog, changes and risk register

**Tables:** `tickets`, `ticket_comments`, `ticket_attachments`, `sla_policies`, `problems`, `problem_incidents`, `catalog_items`, `service_catalog_items`, `changes`, `incidents`, `incident_activities`, `service_requests`, `service_request_activities`, `service_requests_approvals`, `kb_ticket_links`, `risk_register`, `change_risk_links`, `change_ci_links`, `change_approvals`, `change_environment_stages`, `change_pirs`.

**References:**
- legacy `tickets.asset_id → assets.id`; requester/assignee → `users.id`; department → `departments.id`
- ticket comments and attachments can reference legacy tickets and/or dedicated incidents/service requests, plus user authors/uploaders
- `sla_policies` has no FK; it is a target-rule table selected by ticket type/category/priority
- `problems` assigned/created users → `users.id`; department → `departments.id`
- `problem_incidents.problem_id → problems.id`; optional legacy ticket and incident references
- `catalog_items.consumable_id → consumables.id`
- `service_catalog_items.id → catalog_items.id` (shared/legacy catalog identity)
- `changes` requested/assigned users → `users.id`; department → `departments.id`; optional `project_id → projects.id`
- `incidents` creator, assignee, assigned-to and requester → `users.id`; optional project, SLA policy, asset, and change request references
- `incident_activities.incident_id → incidents.id`; actor → `users.id`
- `service_requests` legacy/structured catalog IDs, requester/creator/assignee, optional project, fulfilled asset and activity/approval links
- `service_request_activities.service_request_id → service_requests.id`; actor → `users.id`
- `service_requests_approvals.ticket_id → service_requests.id`; approver → `users.id`
- `kb_ticket_links.article_id → kb_articles.id`; optional incident/service request and linker user
- `risk_register.change_id → changes.id` is nullable; owner/creator → `users.id`
- `change_risk_links.change_request_id → changes.id`; `risk_id → risk_register.id`
- `change_ci_links.change_request_id → changes.id`; exactly one of application/server target is required by a check constraint
- `change_approvals.change_id → changes.id`; live approver/remover users are nullable while labels/history preserve departed identity
- `change_environment_stages.change_id → changes.id`; assignee/deployer → `users.id`
- `change_pirs.change_id → changes.id`

`tickets` is retained as a legacy unified ticket store; new operational paths have dedicated `incidents` and `service_requests` tables. `catalog_items` is retained beside the structured `service_catalog_items` extension for backward-compatible stock/fulfillment links.

### 3.6 Knowledge Base and policy evidence

**Tables:** `kb_articles`, `kb_article_versions`, `kb_article_attachments`, `kb_article_control_mappings`.

**References:** articles’ author/owner/reviewer → users; versions → article and actor; attachments → article and uploader; control mappings → article and mapping/removal users. `kb_ticket_links` is listed with ITSM because it connects articles to tickets.

System-manual entries are marked `is_system_guide`; repository Markdown files under `docs/system-manual/` are synced to these protected records. Article version snapshots, official-document attachments, and compliance-control mappings are represented separately.

## 4. SLA configuration, priority targets and timers

### Policy configuration

`sla_policies` contains:

| Field | Meaning |
|---|---|
| `name` | Policy label |
| `ticket_type` | Optional `incident` / `service_request` scope |
| `category` | Optional ticket category scope |
| `priority` | Target key (`critical`, `high`, `medium`, `low`) |
| `response_hours`, `resolution_hours` | Numeric target durations |
| `is_active` | Whether the rule participates in target selection |

`/sla-policies` is the configuration UI; `/api/sla-policies` provides list/create/update/delete. Create, update, and delete require `system_admin`; GET requires authentication. The page itself requires the ITSM module and `system_admin`.

### Priority and fallback rules

`shared/schema.ts` defines:

- `TICKET_PRIORITY_MATRIX`: impact × urgency derives the legacy priority levels `critical`, `high`, `medium`, `low`.
- `TICKET_SLA_HOURS`: fallback targets: critical `1h` response / `4h` resolution; high `2h` / `8h`; medium `4h` / `24h`; low `8h` / `72h`.
- Dedicated incident priority maps `P1 → critical`, `P2 → high`, `P3 → medium`, `P4 → low`.

`server/storage.ts::computeTicketSlaDates` looks for an active database policy in this order: ticket type + category + priority; ticket type + priority with no category; priority-only with no type/category; then the hard-coded fallback. A specifically supplied incident `slaPolicyId` can select an active policy directly.

### Runtime timer fields and lifecycle

There is no separate SLA timer/event table. The deadline and response/resolution timestamps are stored on ticket records:

- Legacy `tickets`: `sla_response_due_at`, `sla_resolution_due_at`, `first_responded_at`, `resolved_at`.
- Dedicated `incidents`: `sla_policy_id`, `response_due_at`, `resolve_due_at`, `first_responded_at`, `resolved_at`, `closed_at`.
- Dedicated `service_requests`: `fulfillment_due_at`, `target_fulfillment_date`, `completed_at`, and fulfillment status; it does not store a policy FK.
- `incident_activities` records status changes and SLA compliance/escalation details.

Incident transitions are centralized in `server/incident-lifecycle.ts`: allowed transitions are checked, resolution/closure requires resolution metadata, timestamps are set, and response/resolution SLA status is included in activity events.

### Important implementation boundary

`server/index.ts` runs a five-minute SLA enforcement job (first run after a 30-second delay) against **legacy `tickets`**. It escalates overdue open tickets to critical and writes an internal breach comment. It does not currently sweep the newer `incidents` or `service_requests` tables in that job. The current `/reports/itsm-mttr` route also reads `/api/reports/tickets`, which returns legacy tickets, not the dedicated `incidents` table. These are important data coverage distinctions when interpreting SLA/MTTR numbers.

The policy API is not currently listed in `moduleForApiPath`’s central ITSM API prefix map. The page and write endpoints enforce ITSM/admin access, but the authenticated GET endpoint does not have the same explicit server module gate. Treat this as a route-gating discrepancy in the current code, not as a statement that all SLA policies are universally exposed.

Vendor SLA fields (`vendors.response_time_requirement`, `resolution_time_requirement`, `sla_level`, `support_hours`, and `vendor_contracts.sla_tier`) describe supplier contracts; they are not the ticket SLA timer rules.

## 5. Feature flags, route gates and RBAC

### 5.1 Module registry

`shared/modules.ts` contains five toggleable modules. All currently have `core: false` and `defaultEnabled: true`.

| Key | Main scope |
|---|---|
| `asset_management` | Assets, employees/access governance, consumables, maintenance, procurement/finance, asset reports |
| `cmdb` | Applications, servers, configuration documents, network/firewall, backup governance |
| `itsm` | Incidents, requests, problems, changes/CAB, catalog and related service workflows |
| `risk_management` | Standalone risk register |
| `project_management` | Portfolio, tasks, milestones, project risks/changes, baselines, project documents and linked assets |

Module state is persisted in `module_settings`; registry defaults are used when no saved state exists.

### 5.2 Enforcement path

- `ProtectedRoute` checks authentication, the required module, persona page scope, and then named permissions.
- The sidebar filters sections and links by module, permission and persona.
- API middleware in `server/routes.ts` maps API paths through `moduleForApiPath`, then checks `isFeatureEnabled` and `isPersonaApiAllowed`.
- Individual handlers add `requireAuth`, `requireModule` and/or `requirePermission` as appropriate.
- A disabled module’s API returns HTTP 403 with `FEATURE_NOT_ENABLED`; a disabled page renders a “Feature Not Enabled” state.
- The registry and schema stay complete while disabled, preserving data and relationships.

API module ownership includes `/applications`, `/servers`, `/network-topology`, `/backup-schedules`, `/cmdb` → CMDB; asset/employee/finance/inventory/report namespaces → Asset Management; incident/request/change/problem/catalog and selected ITSM report namespaces → ITSM; `/projects` → Project Management; `/risks` and `/risk-users` → Risk Management. `/api/reports/personnel` is an explicit core exception. Knowledge Base endpoints are also core and independently available.

### 5.3 Role/persona model

The `roles`, `permissions`, `user_roles`, and `role_permissions` tables implement many-to-many RBAC. `shared/personas.ts` recognizes these workspace personas (the role table itself remains text-based and supports custom roles):

| Persona | Intended access boundary in current code |
|---|---|
| `end_user` | Self-service portal, service catalog, personal tickets, own assigned assets; no admin/system/CMDB pages |
| `it_agent` | Incident/request/problem and ITAM operations; workbench access has an additional check |
| `cab_member` | Change/CAB review, CMDB impact views, selected finance, employee/offboarding and service-catalog approval views |
| `it_manager` | Broad IT operations, asset/employee/finance, CMDB, projects, changes, import/report governance |
| `auditor` | Read-oriented assets, access governance, audit logs, network/backup review and compliance views |
| `system_admin` / administrator role | Full system permissions; bypasses persona-only restrictions where implemented |

Seed permissions are divided across identity (`user_*`, `role_*`, `permission_view`, `user_role_assign`, `system_admin`), ITAM (`asset_*`, `my_assets_view`, `assignment_*`, `maintenance_*`, `employee_*`), governance (`access_governance_view`, `offboarding_approve`, `audit_view`, `compliance_view`), CMDB/finance (`cmdb_view`, `finance_view`), ITSM (`ticket_view_all`, `ticket_manage`, `change_view_all`, `change_approve`, `change_manage`), and projects (`project_view`, `project_manage`). The bootstrap also has legacy roles such as System Administrator, IT Manager, Asset Manager and Read Only User alongside persona roles.

**Caveat:** role names alone do not grant all page capabilities. Route-level permission declarations and API-handler permissions are additional checks; the exact grants are the role-permission rows in the active database.

## 6. Analytics and report data map

### 6.1 Current nested report categories

| Category | Child reports | Status/data source |
|---|---|---|
| Employee & Personal | Employee Directory & Status; Resource Workload Heatmap; Account Access & Onboarding Activity | Live; all use `/api/reports/personnel`. Directory and activity use employee/access/clearance aggregates. Workload conditionally includes asset, project-task and ITSM counts for enabled modules. |
| IT Asset Management | Hardware Depreciation & Lifecycle; Consumable Stock & Reorder Alerts | Live. Lifecycle link currently renders the depreciation report backed by `/api/reports/depreciation` and `assets`; stock uses `/api/consumables`, `consumables` and warehouse data. |
| Project Management & Governance | Schedule & Budget Variance; Task & Milestone Velocity; PMI RMP Risk Heatmap | **Planned** detail pages; project baselines/tasks/milestones/project risks exist, but these portfolio analytics pages have no report data engine yet. |
| ITSM Service Desk | Incident MTTR & P1-P4 Breakdown; SLA Breach & Escalation Metrics; Change Enablement (CAB) Success Rates | MTTR page is live but reads legacy `/api/reports/tickets`; SLA report is **Planned**; CAB link uses `/api/reports/changes`. |

The `/reports` landing page itself is a navigation catalog and makes no report-data query. There is no GRC category on the current report hub.

### 6.2 Dedicated report routes and sources

| UI route | API/data source | State |
|---|---|---|
| `/reports/personnel`, `/reports/employee-directory`, `/reports/workload-heatmap`, `/reports/account-activity` | `GET /api/reports/personnel` → employees, employee access rights, offboarding clearances, and enabled-module allocation summaries | Live |
| `/reports/hardware-lifecycle`, `/reports/depreciation` | `GET /api/reports/depreciation` → assets | Live; lifecycle title is a route alias to depreciation view |
| `/reports/consumables-stock` | `GET /api/consumables` → consumables and warehouse locations | Live |
| `/reports/project-variance` | Planned report page; expected sources are projects + `project_baselines` | Planned |
| `/reports/project-velocity` | Planned report page; expected sources are project tasks + milestones | Planned |
| `/reports/risk-heatmap` | Planned report page; expected source is `project_risks` | Planned |
| `/reports/itsm-mttr`, `/reports/tickets` | `GET /api/reports/tickets` → legacy `tickets` via `storage.getTickets()` | Live, but not sourced from dedicated incidents/service requests |
| `/reports/itsm-sla` | Planned page; no dedicated trend endpoint | Planned |
| `/reports/itsm-cab`, `/reports/changes` | `GET /api/reports/changes` → changes plus approval/stage/report-summary data | Live |
| `/reports/problems` | `GET /api/reports/problems` → problems and linked incidents/tickets | Live |
| `/reports/project-allocations` | `/api/reports/project-allocations` → project/team allocation data | Live |
| `/reports/asset-summary` | `/api/reports/summary` → asset summary | Live |
| `/reports/lifecycle` | `/api/reports/lifecycle` → assets | Live |
| `/reports/hardware-inventory` | `/api/reports/it-components-compliance` → assets, servers/applications/software/license component records and compliance reviews | Live |
| `/reports/assignments` | `/api/reports/assignments` → assignments/assets/employees | Live |
| `/reports/maintenance` | `/api/reports/maintenance` → schedules/records/assets | Live |
| `/reports/purchase-orders` | `/api/reports/purchase-orders` → purchase orders and related procurement data | Live |
| `/reports/budget` | `/api/reports/budget` → budgets and purchase/asset spend data | Live |
| `/reports/department` | `/api/reports/department` → departments/assets | Live |
| `/reports/warranties` | `/api/reports/warranties` → asset warranty dates | Live |
| `/reports/vendor-analysis` | `/api/reports/vendors` → vendors/contracts/procurement | Live |
| `/reports/released-assets` | `/api/reports/released-assets` → assets/assignment lifecycle | Live |
| `/reports/missing-data` | `/api/reports/missing-data` → asset register completeness and compliance | Live |
| `/reports/assignment-history` | `/api/reports/assignment-history` → assignments/assets/employees | Live |
| `/reports/kb-articles` | `/api/reports/kb-articles` → Knowledge Base engagement | Live |

The UI is protected by `ProtectedRoute`; the report APIs also use authentication, module middleware and/or named permissions as configured. The report route’s module gate and the API path’s central module mapping are separate controls.

## 7. Architecture observations and current boundaries

1. **No `/itsm` or `/grc` landing route.** Use `/portal`, `/incidents`, `/service-requests`, `/changes`, `/risks`, and the dedicated workbenches.
2. **GRC is a capability grouping, not a single flag.** Risk management is independently switchable; audit/compliance views span asset and CMDB modules.
3. **One database, not independently deployable schemas.** The module license model preserves schema and data; it does not permit removing individual module tables.
4. **Legacy and dedicated ticket models coexist.** The schema retains `tickets` with comments/attachments and defines dedicated `incidents` and `service_requests`. Some existing reports and the periodic escalation job still use the legacy table.
5. **SLA admin API module check differs from its page check.** The page requires ITSM plus `system_admin`; GET `/api/sla-policies` is authenticated but is absent from the central `moduleForApiPath` ITSM mapping. Mutating APIs require `system_admin`.
6. **CAB report permission names do not align.** `/reports/itsm-cab` and its sidebar entry allow `ticket_view_all`, `change_view`, or `system_admin`, while the seeded CAB persona receives `change_view_all`. As written, a CAB-only user can be persona-allowed but fail the route/sidebar permission check.
7. **Planned report destinations are explicit.** Project portfolio variance/velocity/risk and SLA trend reporting show “Planned” rather than fabricated values.

This document describes the repository’s current declared schema and routes. Runtime database contents, enabled customer modules, and role-permission assignments can differ by deployment.
