# System Navigation & Feature Map

**Scope:** Current frontend routes in `client/src/App.tsx`, sidebar navigation in `client/src/components/layout/sidebar.tsx`, page-level API usage, and the corresponding API/database model names in `server/routes.ts` and `shared/schema.ts`.

**How to read the data column:** API paths are the frontend-facing endpoints. Table names are the primary persisted entities behind those APIs; aggregate/report endpoints may join or derive values from additional tables.

## Navigation structure

Sidebar sections are independently collapsible. Sections marked with a module are hidden when that module is disabled. The Reports item has a second, independent submenu.

| Sidebar section | Items / submenus | Module gate |
|---|---|---|
| **Overview** | Dashboard (`/dashboard`); KPI Dashboard (`/kpis`) | None |
| **Asset Management** | Assets (`/assets`); Employees (`/employees`); Assignments (`/assignments`); Asset Disposal (`/asset-disposal`); Bookings (`/bookings`); Asset Requests (`/asset-requests`) | `asset_management` |
| **Organization** | Locations (`/locations`); Departments (`/departments`); Vendors (`/vendors`) | None |
| **Financial** | Purchase Orders (`/purchase-orders`); Budgets (`/budgets`); Contracts (`/contracts`) | None |
| **Operations** | Maintenance (`/maintenance`); Asset Audits (`/asset-audits`) | None |
| **IT Service Management** | Incidents (`/incidents`); Service Requests (`/service-requests`); Problems (`/problems`); Changes (`/changes`); Change Tracker (`/changes/tracker`); Service Catalog (`/service-catalog`); Knowledge Base (`/knowledge-base`) | `itsm` |
| **Risk Management** | Risk Register (`/risks`) | `risk_management` |
| **Analytics** | Reports hub and report submenu (listed below) | No section-level module gate; ITSM report links are included only when `itsm` is enabled |
| **Tools** | Import Data (`/import`); Settings (`/settings`) | None |
| **System** | User Management (`/users`); Roles (`/roles`); Permissions (`/permissions`); Dropdowns (`/dropdowns`); Audit Logs (`/audit-logs`); System Settings (`/system-settings`); SLA Policies (`/sla-policies`) | Permission guards vary by route |

The module registry defines `asset_management` as core (cannot be disabled), and `itsm` and `risk_management` as independently toggleable modules.

## Route and page inventory

### Entry and overview

| Route | Page / key features | APIs and primary data |
|---|---|---|
| `/` | Dashboard alias. | Same as `/dashboard`. |
| `/dashboard` | Summary cards and visualizations for asset totals/status/type, recent assignments, upcoming maintenance, budget overview, open tickets, and alerts. | `/api/dashboard/stats`, `/api/assets`, `/api/assignments`, `/api/maintenance-schedules`, `/api/budgets`, `/api/tickets`, `/api/kpis`, `/api/alerts`; principally `assets`, `assignments`, `maintenance_schedules`, `budgets`, and legacy `tickets` (plus derived KPI/alert data). |
| `/kpis` | KPI dashboard with operational metrics. | `/api/kpis`; aggregate data from asset, assignment, maintenance, finance, and ITSM records. |
| `/auth` | Sign-in screen; checks initialization/module status and provides sign-in flow. | `/api/system/status`, `/api/module-status`; authentication/session data uses `users`, `roles`, `user_roles`, and `sessions`. |
| `/initialize` | Initial system setup/seed-data screen. | `/api/system/seed-data`; seeds application data across the relevant domain tables. |

### Asset management, organization, finance, and operations

| Route | Page / key features | APIs and primary data |
|---|---|---|
| `/assets` | Asset register; create/edit, bulk update, and view asset details. | `/api/assets`, `/api/assets/bulk-update`, `/api/departments`, `/api/locations`, `/api/dashboard/stats`; `assets`, `departments`, `locations`. |
| `/employees` | Employee directory and employee record maintenance. | `/api/employees`; `employees`. |
| `/assignments` | Assign assets to employees, review current assignment state, return assets, and update assignment records. | `/api/assignments`, `/api/assignments/:id/return`, `/api/assets`, `/api/dashboard/stats`; `assignments`, `assets`, `employees`. |
| `/asset-disposal` | Record and review disposal of assets. | `/api/asset-disposal`, `/api/assets`, `/api/employees`; `asset_disposal_records`, `assets`, `employees`. |
| `/bookings` | Create and manage asset bookings, selecting assets and employees. | `/api/asset-bookings`, `/api/assets`, `/api/employees`; `asset_bookings`, `assets`, `employees`. |
| `/asset-requests` | Submit asset requests and administer approval, rejection, and fulfillment. | `/api/asset-requests`, `/api/asset-requests/:id/approve`, `/api/asset-requests/:id/reject`, `/api/asset-requests/:id/fulfill`, `/api/assets`, `/api/employees`, `/api/assignments`; `asset_requests`, `assets`, `employees`, `assignments`. |
| `/asset-audits` | Audit sessions and checklist items; start/manage sessions, record item results, and reference locations, departments, and assets. Includes missing-data reporting access. | `/api/asset-audits`, `/api/asset-audits/:id/items`, `/api/assets`, `/api/locations`, `/api/departments`, `/api/reports/missing-data`; `asset_audit_sessions`, `asset_audit_items`, `assets`, `locations`, `departments`. |
| `/locations` | Location list and location maintenance; links locations to employees/departments as needed. | `/api/locations`, `/api/employees`; `locations`, `employees`. |
| `/departments` | Department list and maintenance, with employee and location associations. | `/api/departments`, `/api/employees`, `/api/locations`; `departments`, `employees`, `locations`. |
| `/vendors` | Vendor directory and vendor record maintenance. | `/api/vendors`; `vendors`. |
| `/purchase-orders` | Purchase-order list and workflow; manage order items, update orders, duplicate orders, and create assets from received order lines. | `/api/purchase-orders`, `/api/purchase-orders/:id/create-assets`, `/api/vendors`, `/api/departments`, `/api/assets`; `purchase_orders`, `purchase_order_items`, `vendors`, `departments`, `assets`. |
| `/budgets` | Budget records, including create/edit and department/location association. | `/api/budgets`, `/api/departments`, `/api/locations`; `budgets`, `departments`, `locations`. |
| `/contracts` | Contract management; create, edit, and delete contracts with vendor, employee, and asset references. | `/api/contracts`, `/api/vendors`, `/api/employees`, `/api/assets`; `contracts`, `vendors`, `employees`, `assets`. |
| `/maintenance` | Tabs for **Schedules** and **Records**; schedule and record CRUD, maintenance status, overdue/upcoming summaries, and asset association. | `/api/maintenance-schedules`, `/api/maintenance-records`, `/api/assets`; `maintenance_schedules`, `maintenance_records`, `assets`. |

### IT Service Management

| Route | Page / key features | APIs and primary data |
|---|---|---|
| `/incidents` | Dedicated incident intake and list; urgency, impact, P1–P4 priority, status and SLA due dates; detail view can create a linked Change Request for authorized managers. | `/api/incidents`, `/api/incidents/:id`, `/api/incidents/:id/to-change`; `incidents`, `changes`, plus legacy-linked `ticket_comments`/`ticket_attachments` where applicable. |
| `/service-requests` | Dedicated service-request intake and list; catalog item, estimated cost, target date, approval/rejection, fulfillment, and optional in-store asset assignment. | `/api/service-requests`, `/api/service-requests/:id`, `/api/catalog/items?activeOnly=true`, `/api/assets`; `service_requests`, `catalog_items`, `assets`. |
| `/problems` | Problem register with create/edit/delete; tabs for **Details**, **RCA & Workaround**, and **Linked Incidents**; link/unlink incidents. | `/api/problems`, `/api/problems/:id/link-incident`, `/api/problems/:id/link-incident/:ticketId`, `/api/tickets`; `problems`, `problem_incidents`, and incident/legacy ticket references. |
| `/changes` | Change list and detail workflow; search and filter by type/status, create/edit/delete (permission-dependent), assignments, CAB approvals/votes, approval history, timeline, deployment stages, submit/start/complete/cancel actions, and Post-Implementation Review (PIR). | `/api/changes`, `/api/changes/pending-votes`, `/api/changes/:id`, `/api/changes/:id/approvals`, `/api/changes/:id/stages`, `/api/changes/:id/pir`, `/api/changes/:id/{submit,start,complete,cancel,assign}`, plus `/api/users` and `/api/departments`; `changes`, `change_approvals`, `change_environment_stages`, `change_pirs`, `users`, `departments`. |
| `/changes/tracker` | Change delivery portfolio and risk register view; search/filter portfolio, inspect risks linked to changes, and edit/add risks when authorized. | `/api/changes`, `/api/risks`, `/api/risk-users`; `changes`, `risk_register`, `change_risk_links`, `users`. |
| `/service-catalog` | Catalog item listing and management; create/edit/delete catalog items and request an item. | `/api/catalog/items`, `/api/catalog/items/:id`, `/api/catalog/items/:id/request`; `catalog_items`, `service_requests`. |
| `/knowledge-base` | Browse/search articles; article detail, ratings, review requests, and authorized article create/edit/delete/approve/reject. | `/api/kb/articles`, `/api/kb/search`, `/api/kb/articles/:id/{rate,request-review,approve,reject}`; `kb_articles`, `users` for authors/reviewers. |
| `/sla-policies` | Custom policy list and editor, built-in default reference, and create/edit/delete actions. Route requires `system_admin`. | `/api/sla-policies`; `sla_policies`. |

### Risk Management

| Route | Page / key features | APIs and primary data |
|---|---|---|
| `/risks` | Standalone risk register with risk scoring/assessment, ownership, mitigation tracking, and create/edit operations. | `/api/risks`, `/api/risk-users`; `risk_register`, `users`, `change_risk_links`. |
| `/risk-management` | Alias for the Risk Register page. | Same as `/risks`. |

### Analytics and reports

The Reports sidebar submenu links directly to individual report pages. `/reports` is a separate multi-tab summary page.

| Route | Report / key features | APIs and primary data |
|---|---|---|
| `/reports` | Tabbed report hub: **Summary**, **Lifecycle**, **Hardware**, **Assignments**, **Maintenance**, **Purchase Orders**, **Budget**, **Department**, **Warranties**, **Vendors**, **Released Assets**, **Depreciation**, and **Assignment History**. Includes export of the active tab. | `/api/reports/asset-summary`, `/api/reports/asset-lifecycle`, `/api/reports/hardware-inventory`, `/api/reports/asset-assignments`, `/api/reports/maintenance-schedule`, `/api/reports/purchase-orders`, `/api/reports/budget-analysis`, `/api/reports/assets-by-department`, `/api/reports/expiring-warranties`, `/api/reports/vendor-analysis`; tables vary by tab across assets, assignments, maintenance, purchase orders, budgets, departments, warranties, and vendors. |
| `/reports/asset-summary` | Asset totals, availability, assigned counts, value, status/type breakdowns, and asset details; Excel/PDF/print. | `/api/reports/summary`; `assets`. |
| `/reports/lifecycle` | Asset age/lifecycle and warranty status; Excel/PDF/print. | `/api/reports/lifecycle`; `assets`. |
| `/reports/hardware-inventory` | Hardware inventory report; Excel/PDF/print. | `/api/reports/hardware`; `assets`. |
| `/reports/assignments` | Asset utilization and allocation summary; Excel/PDF/print. | `/api/reports/assignments`; `assets`, `assignments`, `employees`. |
| `/reports/maintenance` | Scheduled, upcoming, overdue, completed, and maintenance breakdowns; Excel/PDF/print. | `/api/reports/maintenance`; `maintenance_schedules`, `maintenance_records`, `assets`. |
| `/reports/purchase-orders` | Purchase-order totals, value, status, and recent orders; Excel/PDF/print. | `/api/reports/purchase-orders`; `purchase_orders`, `purchase_order_items`, `vendors`. |
| `/reports/budget` | Budget, spending, remaining balance, utilization, and department details; Excel/PDF/print. | `/api/reports/budget`; `budgets`, `departments`. |
| `/reports/department` | Department-level asset counts and value; Excel/PDF/print. | `/api/reports/department`; `departments`, `assets`. |
| `/reports/warranties` | Active, expiring, expired, and warranty detail views; Excel/PDF/print. | `/api/reports/warranties`; `assets`, warranty fields. |
| `/reports/vendor-analysis` | Vendor count, purchase-order count, spend, average order value, and performance; Excel/PDF/print. | `/api/reports/vendors`; `vendors`, `purchase_orders`, `purchase_order_items`. |
| `/reports/released-assets` | Released-asset assignment history; Excel/PDF/print. | `/api/reports/released-assets`; `assets`, `assignments`. |
| `/reports/depreciation` | Asset depreciation values and schedules, including per-asset schedule detail; Excel/PDF/print. | `/api/reports/depreciation`, `/api/assets/:id/depreciation-schedule`; `assets`. |
| `/reports/missing-data` | Completeness metrics, missing fields, and asset editing from the report; Excel/PDF/print. | `/api/reports/missing-data`, `/api/assets/:id`; `assets`. |
| `/reports/assignment-history` | Assignment history report; export/print actions. | `/api/reports/assignment-history`; `assignments`, `assets`, `employees`. |
| `/reports/tickets` | Legacy ITSM ticket analytics with search/type/status/priority filters, summary metrics, Excel/PDF/print. | `/api/reports/tickets`; legacy `tickets`, `ticket_comments`, `ticket_attachments` (historical reporting source). |
| `/reports/problems` | Problem report. | `/api/reports/problems`; `problems`, `problem_incidents`. |
| `/reports/changes` | Change report with pagination, search, and status/type/risk filters. | `/api/reports/changes`; `changes`, `change_approvals`, `risk_register`, `change_risk_links`. |
| `/reports/kb-articles` | Knowledge-base article report. | `/api/reports/kb-articles`; `kb_articles`. |

### Tools and administration

| Route | Page / key features | APIs and primary data |
|---|---|---|
| `/import` | Asset import/export tooling, downloadable import template, and Excel upload. | `/api/import/assets-export`, `/api/import/template`, `/api/import/excel`; `assets` and related asset reference tables. |
| `/settings` | User/application preferences, module toggles (admin-controlled), asset ID generation mode, and two-factor-authentication setup/enable/disable. | `/api/settings/:key`, `/api/module-settings`, `/api/module-settings/:moduleKey`, `/api/auth/2fa/{setup,enable,disable}`, `/api/user`; `settings`, `module_settings`, `users`. |
| `/users` | User list/detail and user create/update/delete; role assignment is managed through user/role endpoints. Route requires `user_view`. | `/api/users`, `/api/users/:id`, `/api/users/:userId/roles`; `users`, `user_roles`, `roles`. |
| `/roles` | Role list and role permissions management. Route requires `role_view`. | `/api/roles`, `/api/permissions`; `roles`, `permissions`, `role_permissions`. |
| `/permissions` | Permission catalog. Route requires `permission_view`. | `/api/permissions`; `permissions`. |
| `/dropdowns` | Dropdown option management by category; create/edit/delete, duplicate cleanup, and migration of legacy asset values. Route requires `system_admin`. | `/api/dropdowns/options`, `/api/dropdowns/options/:category`, `/api/dropdowns/cleanup-duplicates`, `/api/dropdowns/migrate-from-assets`; `dropdown_options`, `assets`. |
| `/audit-logs` | Audit-log listing. | `/api/audit-logs`; `audit_logs`. |
| `/system-settings` | System-level settings view/update and system data reset action (server permission-gated). | `/api/system-settings`, `/api/system/clear-data`; `system_settings` and affected application tables. |

## Route access and visibility notes

- All routes except `/auth` and `/initialize` are inside the authenticated application layout. `/` and `/dashboard` both render the Dashboard.
- The router applies module gates to asset-management routes, ITSM routes, ITSM reports, and Risk Management routes. Additional permission gates are explicit on user/role/permission administration, dropdowns, and SLA policy routes; APIs may impose stricter permissions than the route shell.
- The sidebar hides the Asset Management, ITSM, or Risk Management section when its module is disabled. ITSM report links are conditionally added to the Reports submenu.
- `/risk-management` is a second route to the same page as `/risks`.
- `/knowledge-base` and some general/admin routes do not carry an explicit `requiredModule` prop in `App.tsx`; the sidebar still places Knowledge Base under the ITSM section, and API middleware remains authoritative.
- `client/src/pages/tickets.tsx`, `my-requests.tsx`, `my-assigned-tickets.tsx`, and `managers.tsx` exist in the page directory but are **not registered as frontend routes** in `App.tsx`. Legacy ticket APIs remain in the server for historical/read paths; ticket mutation endpoints are retired/guarded as described by the current server implementation.
- The catch-all route renders the Not Found page; it has no dedicated URL path.

## Primary database entities referenced

The page/API associations above use these Drizzle table names from `shared/schema.ts`:

- **Core organization/assets:** `assets`, `employees`, `assignments`, `locations`, `departments`, `vendors`, `purchase_orders`, `purchase_order_items`, `budgets`, `maintenance_schedules`, `maintenance_records`, `contracts`, `asset_bookings`, `asset_disposal_records`, `asset_requests`, `asset_audit_sessions`, `asset_audit_items`, `asset_relationships`, `asset_attachments`.
- **Identity/system:** `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `audit_logs`, `system_settings`, `settings`, `module_settings`, `dropdown_options`.
- **ITSM:** `incidents`, `service_requests`, legacy `tickets`, `ticket_comments`, `ticket_attachments`, `sla_policies`, `problems`, `problem_incidents`, `catalog_items`, `kb_articles`, `changes`, `change_approvals`, `change_environment_stages`, `change_pirs`.
- **Risk/change associations:** `risk_register` (Drizzle export `risks`), `change_risk_links`.

The dashboard, KPI, alert, and report endpoints may calculate values from multiple tables rather than correspond to a single stored table.
