# Complete System Deep Dive — Technical Specification

> **Snapshot:** 06-11-2026. This document is generated from the current workspace source. It documents declared code, schema and route registrations; it does not inspect production database contents or certify operational/compliance outcomes. Re-run this audit after schema, route, permission, or job changes.

## 1. Executive architecture and audit scope

| Layer | Current implementation | Source of truth |
|---|---|---|
| Browser application | React 18 + TypeScript, Vite, Wouter, TanStack Query, Tailwind v4 and shadcn/Radix-style components; page chunks use lazy imports | `client/src/main.tsx`, `client/src/App.tsx`, `vite.config.ts` |
| API | Node.js + Express; one process entry point, centrally registered routes plus focused route modules | `server/index.ts`, `server/routes.ts`, `server/*.ts` |
| Data access | Drizzle ORM for PostgreSQL; shared inferred models and Zod insert schemas | `shared/schema.ts`, `server/storage.ts` |
| Database | PostgreSQL (`pg`), with Neon serverless client also used for notification listener paths | `server/db.ts`, `server/cab-events.ts` |
| Authentication | Passport local strategy, Express session, PostgreSQL session store; password hash uses Node `scrypt` + per-password salt | `server/auth.ts` |
| Authorization | Session auth, named permission middleware, persona checks, module licensing checks, demo-viewer allowlist | `server/auth.ts`, `server/routes.ts`, `shared/personas.ts`, `shared/demo-viewer.ts` |
| Migrations | Drizzle config supports push workflows; startup on-prem migrations are sorted, checksummed, advisory-lock protected and restricted to allowlisted additive statements | `drizzle.config.ts`, `server/startup-migrations.ts`, `migrations/` |
| Deployment | Single modular monolith serving API and Vite-built client; cloud/on-prem deployment guidance in `DEPLOYMENT.md` | `server/index.ts`, `server/vite.ts`, `DEPLOYMENT.md` |

**Inventory totals:** 93 Drizzle PostgreSQL tables, 1215 declared columns, 88 client route registrations, 392 literal API method/path registrations, 383 inventoried files, and 49 SQL migration files.

There is no `db/` directory in this workspace. The schema is `shared/schema.ts`; no Prisma schema was found. `onprem_deploy.sql_migrations` and `onprem_deploy.dropdown_duplicate_archive` are runtime operations tables created outside the 93 Drizzle application-table definitions. `connect-pg-simple` also owns the `sessions` persistence table represented in the schema.

### 1.1 Build, test and database commands

| Command | Configured operation |
|---|---|
| `npm run dev` | `NODE_ENV=development tsx server/index.ts` |
| `npm start` | `NODE_ENV=production node dist/index.js` |
| `npm run check` | TypeScript compiler (`tsc`) |
| `npm test` | `node scripts/run-full-vitest.mjs` |
| `npm run build` | Security audit gate, Vite client build, then esbuild server bundle |
| `npm run audit:security` | `npm audit --audit-level=moderate` |
| `npm run db:push` | `drizzle-kit push` |
| `npm run db:sync:dev` | CAB development schema synchronization script |

## 2. Full file inventory and directory tree

The listing includes code, tests, docs, SQL migrations and maintenance scripts under the source roots. It excludes `node_modules/`, `.git/`, `dist/`, `.cache/`, screenshot collections, uploaded attachments and runtime upload binaries. Root configuration files are listed separately. `db/` is absent.

### Root configuration and operational documents

- `.dockerignore`
- `.gitignore`
- `.replit`
- `DEPLOYMENT.md`
- `QA_ASSESSMENT_REPORT.md`
- `SYSTEM_NAVIGATION_FEATURE_MAP.md`
- `components.json`
- `drizzle.config.ts`
- `package-lock.json`
- `package.json`
- `replit.md`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `docs/complete-system-deep-dive.md` — this generated report

### `client/src/` — 213 files

```text
components/
  access-governance/
    searchable-picker.test.tsx
    searchable-picker.tsx
  assets/
    asset-expiry-badges.tsx
    asset-form.tsx
    asset-qr-modal.tsx
    software-seat-allocations.tsx
  assignments/
    assignment-form.tsx
  auth/
    auth-page.css
  cmdb/
    change-impact-selector.tsx
    configuration-documents.tsx
  dashboard/
    persona-dashboard.tsx
  employees/
    employee-access-entitlements.tsx
    employee-form.tsx
    employee-offboarding-dialog.tsx
  knowledge-base/
    article-detail-dialog.tsx
    article-editor-dialog.test.tsx
    article-editor-dialog.tsx
    policy-governance-panel.tsx
    ticket-knowledge-links.tsx
    types.ts
  layout/
    header.tsx
    sidebar.test.tsx
    sidebar.tsx
  projects/
    project-baseline-panel.test.tsx
    project-baseline-panel.tsx
    project-changes-tab.tsx
    project-documents-tab.tsx
    project-editor-dialog.tsx
    project-overview-tab.tsx
    project-risk-register-tab.tsx
    project-tasks-tab.tsx
    searchable-multi-picker.tsx
  roles/
    role-form.tsx
  service-catalog/
    approval-queue.tsx
    catalog-item-editor.tsx
    dynamic-fields.tsx
    service-request-dialog.tsx
    types.ts
  ui/
    accordion.tsx
    alert-dialog.tsx
    alert.tsx
    aspect-ratio.tsx
    avatar.tsx
    badge.tsx
    breadcrumb.tsx
    button.tsx
    calendar-date-field.tsx
    calendar.tsx
    card.tsx
    carousel.tsx
    chart.tsx
    checkbox.tsx
    collapsible.tsx
    command.tsx
    context-menu.tsx
    date-input.test.tsx
    date-input.tsx
    design-system.test.tsx
    dialog.tsx
    drawer.tsx
    dropdown-menu.tsx
    filter-bar.tsx
    form.tsx
    hover-card.tsx
    input-otp.tsx
    input.tsx
    label.tsx
    menubar.tsx
    navigation-menu.tsx
    pagination.tsx
    popover.tsx
    progress.tsx
    radio-group.tsx
    resizable.tsx
    scroll-area.tsx
    select.tsx
    separator.tsx
    sheet.tsx
    sidebar.tsx
    skeleton.tsx
    slider.tsx
    switch.tsx
    table.tsx
    tabs.tsx
    textarea.tsx
    toast.tsx
    toaster.tsx
    toggle-group.tsx
    toggle.tsx
    tooltip.tsx
  users/
    user-form.tsx
  vendors/
    contract-editor.tsx
    types.ts
    vendor-editor.tsx
    vendor-form.tsx
  report-filters.tsx
hooks/
  cab-events-server.test.tsx
  use-auth-cab-events.test.tsx
  use-auth.tsx
  use-mobile.tsx
  use-modules.ts
  use-toast.ts
lib/
  asset-expiry.test.ts
  asset-expiry.ts
  dashboard-workspace.ts
  date-utils.ts
  depreciation.ts
  itsm-access.ts
  knowledge-base-filters.test.ts
  knowledge-base-filters.ts
  mobile-table-layout.test.ts
  mobile-table-layout.ts
  navigation-active.test.ts
  navigation-active.ts
  project-management-api.ts
  protected-route.tsx
  queryClient.ts
  report-utils.ts
  utils.ts
  zod-resolver.ts
pages/
  reports/
    asset-summary.tsx
    assignment-history.tsx
    assignments.tsx
    budget.tsx
    changes.test.tsx
    changes.tsx
    consumables-stock.tsx
    department.tsx
    depreciation.tsx
    hardware-inventory.tsx
    knowledge-base.tsx
    lifecycle.tsx
    maintenance.tsx
    missing-data.tsx
    personnel-detail.test.tsx
    personnel-detail.tsx
    planned-report.tsx
    problems.tsx
    purchase-orders.tsx
    released-assets.tsx
    tickets.tsx
    vendor-analysis.tsx
    warranties.tsx
  access-governance.tsx
  applications.tsx
  asset-audits.tsx
  asset-bookings.tsx
  asset-disposal.tsx
  asset-handovers.tsx
  asset-requests.tsx
  assets.tsx
  assignments.tsx
  audit-logs.tsx
  auth-page.test.tsx
  auth-page.tsx
  backup-schedules.tsx
  budgets.tsx
  change-tracker.tsx
  changes.test.tsx
  changes.tsx
  consumables.tsx
  contracts.tsx
  dashboard-landing.test.tsx
  dashboard.tsx
  data-migration-center.tsx
  departments.tsx
  dropdown-management.tsx
  employees.tsx
  import.tsx
  incident-service-requests.tsx
  incident-tracker.tsx
  knowledge-base.tsx
  kpis.tsx
  locations.tsx
  maintenance.tsx
  managers.tsx
  my-assigned-assets.tsx
  my-assigned-tickets.tsx
  my-requests.tsx
  network-topology.tsx
  new-change.tsx
  new-incident.tsx
  new-service-request.tsx
  not-found.tsx
  permissions.tsx
  portal.tsx
  problems.tsx
  project-allocations-report.tsx
  project-workspace.test.tsx
  project-workspace.tsx
  projects.test.tsx
  projects.tsx
  purchase-orders.tsx
  reports-dashboard.test.tsx
  reports-dashboard.tsx
  reports.tsx
  risk-management.tsx
  roles.tsx
  servers.tsx
  service-catalog.tsx
  service-request-tracker.tsx
  settings.tsx
  sla-policies.tsx
  system-initialization.tsx
  system-settings.tsx
  tickets.tsx
  users.tsx
  vendors.test.tsx
  vendors.tsx
types/
  project-management.ts
App.tsx
index.css
main.tsx
```

### `server/` — 83 files

```text
access-governance.test.ts
asset-handovers.test.ts
asset-handovers.ts
asset-licensing.test.ts
asset-licensing.ts
asset-spreadsheet.test.ts
auth-inactive-session.test.ts
auth.ts
backup-governance.test.ts
backup-governance.ts
cab-account-deletion.test.ts
cab-alert-storage.test.ts
cab-assignment-plan.test.ts
cab-cross-session.test.ts
cab-events.test.ts
cab-events.ts
cab-gate.ts
cab-stream-access.test.ts
change-list-batching.test.ts
change-overview-plan.test.ts
change-pagination.test.ts
change-report-page.test.ts
change-report-routes.test.ts
change-report-summary.test.ts
change-risk-routes.test.ts
change-stage-history.test.ts
change-stage-history.ts
change-vote-db.test.ts
change-vote.test.ts
cmdb-schema.test.ts
data-migration-center.test.ts
data-migration-center.ts
date-format.test.ts
db.ts
demo-viewer.test.ts
demo-viewer.ts
depreciation.ts
dev-cab-schema-sync.test.ts
dropdown-integrity.test.ts
dropdown-integrity.ts
dropdown-routes.test.ts
employee-governance-schema.test.ts
incident-lifecycle.test.ts
incident-lifecycle.ts
index.ts
it-components-compliance-report.ts
knowledge-governance.test.ts
knowledge-governance.ts
knowledge-manual-sync.ts
maintenance-storage.test.ts
maintenance-utils.test.ts
module-access.ts
module-boundaries.test.ts
module-isolation.test.ts
module-middleware.test.ts
network-topology.ts
personnel-report.ts
project-baseline.test.ts
project-management-validation.test.ts
project-management.routes.test.ts
project-management.ts
project-risk-governance.test.ts
project-workspace.integration.test.ts
project-workspace.ts
report-export.test.ts
report-export.ts
routes.ts
security-middleware.test.ts
security-middleware.ts
service-catalog.test.ts
service-catalog.ts
startup-migrations.test.ts
startup-migrations.ts
storage.ts
system-clear-data-route.ts
system-data-reset.test.ts
system-data-reset.ts
test-database.ts
ticket-request-cancel.test.ts
user-deactivation-session.test.ts
vendor-contracts.test.ts
vendor-contracts.ts
vite.ts
```

### `shared/` — 17 files

```text
access-governance.ts
data-migration-modules.ts
date-format.ts
demo-viewer.ts
dropdown-utils.ts
kb-governance.ts
maintenance-utils.ts
modules.test.ts
modules.ts
personas.test.ts
personas.ts
project-management.ts
schema.ts
service-catalog.ts
system-data-reset.ts
vendor-contracts.ts
version.ts
```

### `docs/` — 12 files

```text
system-manual/
  employee-self-service-directory-management.md
  grc-compliance.md
  it-asset-management-cmdb-operations.md
  itil-incident-change-operations.md
  platform-architecture-getting-started.md
  platform-user-guide.md
  pmp-project-control-pmi-rmp-risk-register.md
  universal-bulk-data-import-engine.md
architecture-blueprint.md
modular-monolith.md
system-architecture-blueprint.html
system-data-reset.md
```

### `migrations/` — 49 files

```text
onprem/
  20261019_system_version.sql
  20261020_incident_management.sql
  20261021_service_request_management.sql
  20261022_intake_workflow_project_link.sql
  20261023_ticket_on_behalf_closure_notes.sql
  20261024_asset_sam_cloud_finops.sql
  20261025_maintenance_log_analytics.sql
  20261026_consumables_inventory.sql
  20261027_warehouse_site.sql
  20261028_seed_consumable_categories.sql
  20261029_employee_offboarding_access_entitlements.sql
  20261030_access_governance_catalog.sql
  20261031_cmdb_applications_servers_documents.sql
  20261101_access_expiry_offboarding_clearances.sql
  20261102_cmdb_dependency_change_impact.sql
  20261103_knowledge_policy_governance.sql
  20261104_structured_service_catalog.sql
  20261105_cab_escalation_review_version.sql
  20261105_vendor_sla_contract_lifecycle.sql
  20261106_asset_handovers.sql
  20261107_network_backup_policy_compliance.sql
  20261108_it_component_compliance_reviews.sql
  20261109_data_migration_center.sql
  20261110_cab_assignment_history_lookup_idx.sql
  20261111_enterprise_project_management.sql
  20261112_project_delivery_governance.sql
  20261113_project_document_versions.sql
  20261114_project_workspace_timestamps.sql
  20261115_project_baselines_risk_residuals.sql
  20261116_protected_knowledge_system_manual.sql
  20261117_kb_platform_architecture_category.sql
  20261118_employee_support_kb_category.sql
  20261119_itam_cmdb_kb_category.sql
  20261120_project_management_kb_category.sql
  20261121_itil_service_operations_kb_category.sql
  20261122_grc_compliance_kb_category.sql
  20261123_kb_manual_author_labels.sql
20260929_asset_compliance_fields.sql
20260929_cab_remover_label.sql
20260929_preserve_cab_approval_history.sql
20261004_cab_pending_approver_lookup_idx.sql
20261004_cab_stream_leases.sql
20261005_change_stage_attempt_history.sql
20261007_cab_pending_overview_count_idx.sql
20261018_archive_legacy_ticket_source.sql
20261018_cab_assignment_history_lookup_idx.sql
20261018_standalone_risk_register.sql
20261019_split_incidents_service_requests.sql
20261105_cab_escalation_review_version.sql
```

### `scripts/` — 9 files

```text
fixtures/
  cab-schema-sync-legacy.sql
build-audit-gate-check.mjs
initialize-vitest-schema.ts
post-merge.sh
provision-demo-viewer.ts
run-cab-schema-sync-test.mjs
run-full-vitest.mjs
sync-dev-cab-schema.mjs
test-dropdown-integrity.mjs
```

## 3. Client routes and navigation

### 3.1 Registered Wouter routes

The route table is extracted from `client/src/App.tsx`. `Route` entries are public; `ProtectedRoute` entries run authentication, persona, module and/or permission checks. Permission arrays mean any listed permission unless the component implementation says otherwise.

| Route | Component | Type | Module gate | Required permission | Any-of permissions |
|---|---|---|---|---|---|
| `/auth` | `AuthPage` (App.tsx:L95) | Route | `—` | `—` | `—` |
| `/initialize` | `SystemInitialization` (App.tsx:L96) | Route | `—` | `—` | `—` |
| `/` | `HomeRedirect` (App.tsx:L108) | ProtectedRoute | `—` | `—` | `—` |
| `/dashboard` | `Dashboard` (App.tsx:L109) | ProtectedRoute | `—` | `—` | `—` |
| `/projects` | `Projects` (App.tsx:L110) | ProtectedRoute | `project_management` | `—` | `—` |
| `/projects/:id` | `ProjectWorkspace` (App.tsx:L111) | ProtectedRoute | `project_management` | `—` | `—` |
| `/reports/project-allocations` | `ProjectAllocationsReport` (App.tsx:L112) | ProtectedRoute | `project_management` | `—` | `["project_view", "project_manage", "system_admin"]` |
| `/portal` | `PortalPage` (App.tsx:L113) | ProtectedRoute | `itsm` | `—` | `—` |
| `/assets` | `Assets` (App.tsx:L114) | ProtectedRoute | `asset_management` | `—` | `["asset_view", "asset_update", "asset_create", "compliance_view"]` |
| `/my-assets` | `MyAssignedAssets` (App.tsx:L115) | ProtectedRoute | `asset_management` | `my_assets_view` | `—` |
| `/employees` | `Employees` (App.tsx:L116) | ProtectedRoute | `asset_management` | `—` | `["employee_update", "offboarding_approve", "system_admin"]` |
| `/access-governance` | `AccessGovernance` (App.tsx:L117) | ProtectedRoute | `asset_management` | `—` | `["employee_update", "access_governance_view", "system_admin"]` |
| `/applications` | `Applications` (App.tsx:L118) | ProtectedRoute | `cmdb` | `—` | `["asset_update", "cmdb_view", "system_admin"]` |
| `/servers` | `Servers` (App.tsx:L119) | ProtectedRoute | `cmdb` | `—` | `["asset_update", "cmdb_view", "system_admin"]` |
| `/network-topology` | `NetworkTopology` (App.tsx:L120) | ProtectedRoute | `cmdb` | `—` | `["asset_update", "cmdb_view", "audit_view", "compliance_view", "system_admin"]` |
| `/backup-schedules` | `BackupSchedules` (App.tsx:L121) | ProtectedRoute | `cmdb` | `—` | `["asset_update", "audit_view", "compliance_view", "system_admin"]` |
| `/users` | `Users` (App.tsx:L122) | ProtectedRoute | `—` | `user_view` | `—` |
| `/roles` | `Roles` (App.tsx:L123) | ProtectedRoute | `—` | `role_view` | `—` |
| `/permissions` | `Permissions` (App.tsx:L124) | ProtectedRoute | `—` | `permission_view` | `—` |
| `/dropdowns` | `DropdownManagement` (App.tsx:L125) | ProtectedRoute | `—` | `system_admin` | `—` |
| `/system/dropdowns` | `DropdownManagement` (App.tsx:L126) | ProtectedRoute | `—` | `system_admin` | `—` |
| `/system-settings` | `SystemSettings` (App.tsx:L127) | ProtectedRoute | `—` | `—` | `—` |
| `/audit-logs` | `AuditLogs` (App.tsx:L128) | ProtectedRoute | `—` | `—` | `["audit_view", "system_admin"]` |
| `/assignments` | `Assignments` (App.tsx:L129) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/asset-handovers` | `AssetHandovers` (App.tsx:L130) | ProtectedRoute | `asset_management` | `—` | `["assignment_create", "assignment_return", "assignment_update", "asset_view", "system_admin"]` |
| `/locations` | `Locations` (App.tsx:L131) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/departments` | `Departments` (App.tsx:L132) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/vendors` | `Vendors` (App.tsx:L133) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/purchase-orders` | `PurchaseOrders` (App.tsx:L134) | ProtectedRoute | `asset_management` | `—` | `["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]` |
| `/consumables` | `Consumables` (App.tsx:L135) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/inventory` | `Consumables` (App.tsx:L136) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/budgets` | `Budgets` (App.tsx:L137) | ProtectedRoute | `asset_management` | `—` | `["finance_view", "budget_create", "budget_update", "system_admin"]` |
| `/maintenance` | `Maintenance` (App.tsx:L138) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports` | `Reports` (App.tsx:L139) | ProtectedRoute | `—` | `—` | `—` |
| `/reports/personnel` | `PersonnelDetailReport` (App.tsx:L140) | ProtectedRoute | `—` | `—` | `—` |
| `/reports/employee-directory` | `PersonnelDetailReport` (App.tsx:L141) | ProtectedRoute | `—` | `—` | `—` |
| `/reports/workload-heatmap` | `PersonnelDetailReport` (App.tsx:L142) | ProtectedRoute | `—` | `—` | `—` |
| `/reports/account-activity` | `PersonnelDetailReport` (App.tsx:L143) | ProtectedRoute | `—` | `—` | `—` |
| `/reports/hardware-lifecycle` | `DepreciationReport` (App.tsx:L144) | ProtectedRoute | `asset_management` | `—` | `["asset_view", "asset_update", "system_admin"]` |
| `/reports/consumables-stock` | `ConsumablesStockReport` (App.tsx:L145) | ProtectedRoute | `asset_management` | `—` | `["asset_view", "inventory_view", "system_admin"]` |
| `/reports/project-variance` | `PlannedAnalyticsReport` (App.tsx:L146) | ProtectedRoute | `project_management` | `—` | `["project_view", "project_manage", "system_admin"]` |
| `/reports/project-velocity` | `PlannedAnalyticsReport` (App.tsx:L147) | ProtectedRoute | `project_management` | `—` | `["project_view", "project_manage", "system_admin"]` |
| `/reports/risk-heatmap` | `PlannedAnalyticsReport` (App.tsx:L148) | ProtectedRoute | `project_management` | `—` | `["project_view", "project_manage", "system_admin"]` |
| `/reports/itsm-mttr` | `TicketReport` (App.tsx:L149) | ProtectedRoute | `itsm` | `—` | `["ticket_view_all", "system_admin"]` |
| `/reports/itsm-sla` | `PlannedAnalyticsReport` (App.tsx:L150) | ProtectedRoute | `itsm` | `—` | `["ticket_view_all", "system_admin"]` |
| `/reports/itsm-cab` | `ChangesReport` (App.tsx:L151) | ProtectedRoute | `itsm` | `—` | `["ticket_view_all", "change_view", "system_admin"]` |
| `/reports/asset-summary` | `AssetSummaryReport` (App.tsx:L152) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/lifecycle` | `LifecycleReport` (App.tsx:L153) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/hardware-inventory` | `HardwareInventoryReport` (App.tsx:L154) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/assignments` | `AssignmentsReport` (App.tsx:L155) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/maintenance` | `MaintenanceReport` (App.tsx:L156) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/purchase-orders` | `PurchaseOrdersReport` (App.tsx:L157) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/budget` | `BudgetReport` (App.tsx:L158) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/department` | `DepartmentReport` (App.tsx:L159) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/warranties` | `WarrantiesReport` (App.tsx:L160) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/vendor-analysis` | `VendorAnalysisReport` (App.tsx:L161) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/released-assets` | `ReleasedAssetsReport` (App.tsx:L162) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/depreciation` | `DepreciationReport` (App.tsx:L163) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/missing-data` | `MissingDataReport` (App.tsx:L164) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/reports/assignment-history` | `AssignmentHistoryReport` (App.tsx:L165) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/import` | `DataMigrationCenter` (App.tsx:L166) | ProtectedRoute | `—` | `—` | `—` |
| `/migration` | `DataMigrationCenter` (App.tsx:L167) | ProtectedRoute | `—` | `—` | `—` |
| `/settings` | `Settings` (App.tsx:L168) | ProtectedRoute | `—` | `—` | `—` |
| `/asset-disposal` | `AssetDisposal` (App.tsx:L169) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/bookings` | `AssetBookings` (App.tsx:L170) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/contracts` | `Contracts` (App.tsx:L171) | ProtectedRoute | `asset_management` | `—` | `["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]` |
| `/asset-audits` | `AssetAudits` (App.tsx:L172) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/asset-requests` | `AssetRequests` (App.tsx:L173) | ProtectedRoute | `asset_management` | `—` | `—` |
| `/incidents/new` | `NewIncidentPage` (App.tsx:L174) | ProtectedRoute | `itsm` | `—` | `—` |
| `/service-requests/new` | `NewServiceRequestPage` (App.tsx:L175) | ProtectedRoute | `itsm` | `—` | `—` |
| `/changes/new` | `NewChangePage` (App.tsx:L176) | ProtectedRoute | `itsm` | `—` | `—` |
| `/incidents/tracker` | `IncidentTracker` (App.tsx:L177) | ProtectedRoute | `itsm` | `—` | `—` |
| `/service-requests/tracker` | `ServiceRequestTracker` (App.tsx:L178) | ProtectedRoute | `itsm` | `—` | `—` |
| `/incidents` | `NewIncidentPage` (App.tsx:L179) | ProtectedRoute | `itsm` | `—` | `—` |
| `/service-requests` | `NewServiceRequestPage` (App.tsx:L180) | ProtectedRoute | `itsm` | `—` | `—` |
| `/reports/tickets` | `TicketReport` (App.tsx:L181) | ProtectedRoute | `itsm` | `—` | `—` |
| `/reports/problems` | `ProblemsReport` (App.tsx:L182) | ProtectedRoute | `itsm` | `—` | `—` |
| `/reports/changes` | `ChangesReport` (App.tsx:L183) | ProtectedRoute | `itsm` | `—` | `—` |
| `/reports/kb-articles` | `KnowledgeBaseReport` (App.tsx:L184) | ProtectedRoute | `—` | `—` | `—` |
| `/sla-policies` | `SlaPolicies` (App.tsx:L185) | ProtectedRoute | `itsm` | `system_admin` | `—` |
| `/knowledge-base` | `KnowledgeBase` (App.tsx:L186) | ProtectedRoute | `—` | `—` | `—` |
| `/problems` | `Problems` (App.tsx:L187) | ProtectedRoute | `itsm` | `—` | `—` |
| `/service-catalog` | `ServiceCatalog` (App.tsx:L188) | ProtectedRoute | `itsm` | `—` | `—` |
| `/changes` | `Changes` (App.tsx:L189) | ProtectedRoute | `itsm` | `—` | `—` |
| `/changes/tracker` | `ChangeTracker` (App.tsx:L190) | ProtectedRoute | `itsm` | `—` | `—` |
| `/risks` | `RiskManagement` (App.tsx:L191) | ProtectedRoute | `risk_management` | `—` | `—` |
| `/risk-management` | `RiskManagement` (App.tsx:L192) | ProtectedRoute | `risk_management` | `—` | `—` |
| `/kpis` | `KpiDashboard` (App.tsx:L193) | ProtectedRoute | `itsm` | `—` | `—` |

The wildcard/no-path `Route` wrapper provides the authenticated shell and sidebar; `NotFound` handles unmatched paths. `/` redirects to `/dashboard`. `client/src/pages/reports.tsx` exists in the tree but is not mounted by the current route registry; `/reports` mounts `reports-dashboard.tsx`.

### 3.2 Sidebar navigation tree and visibility rules

The source configuration is `client/src/components/layout/sidebar.tsx`. The tree below reflects its sections, labels, targets, module flags and permission checks; some labels change by persona.

- **Overview** (core)
  - Dashboard → `/dashboard`.
  - Knowledge Base / System Manual → `/knowledge-base` (global, core).
  - KPI Dashboard → `/kpis` (`itsm`; visible to ITSM staff).
- **Employee Support** (`itsm`)
  - My Tickets for end users / Self-Service Portal for others → `/portal`.
  - Service Catalog → `/service-catalog` (visibility depends on persona).
  - Approval Queue → `/service-catalog?tab=approvals` (when the current catalog viewer can approve).
- **My Assets** (`asset_management`)
  - My Assigned Assets → `/my-assets` (`my_assets_view` or `system_admin`).
- **Asset Management** (`asset_management`)
  - Assets `/assets`; Consumables `/consumables`; Employees `/employees` (`employee_update`, `offboarding_approve`, or `system_admin`); Access Governance `/access-governance` (`employee_update`, `access_governance_view`, or `system_admin`); Assignments `/assignments`; Asset Handovers `/asset-handovers` (assignment/asset read permissions); Asset Disposal `/asset-disposal`; Bookings `/bookings`; Asset Requests `/asset-requests`.
- **CMDB & Infrastructure** (`cmdb`)
  - Applications `/applications` and Servers `/servers` (`asset_update`, `cmdb_view`, or `system_admin`); Network Topology `/network-topology` (asset/CMDB/audit/compliance read permission); Backup & Restore `/backup-schedules` (asset update/audit/compliance permission).
- **Organization** (`asset_management`): Locations `/locations`; Departments `/departments`; Vendors `/vendors`.
- **Financial** (`asset_management`): Purchase Orders `/purchase-orders`; Budgets `/budgets`; Contracts `/contracts`.
- **Project Management** (`project_management`): Projects `/projects`; Resource Allocation `/reports/project-allocations` (`project_view`, `project_manage`, or `system_admin`).
- **Operations** (`asset_management`): Maintenance `/maintenance`; Asset Audits `/asset-audits`.
- **IT Service Management** (`itsm`): Incidents `/incidents`; Incident Tracker `/incidents/tracker`; Service Requests `/service-requests`; Request Tracker `/service-requests/tracker`; Problems `/problems`; Changes `/changes`; Change Tracker `/changes/tracker`; Service Catalog `/service-catalog`.
- **Risk Management & Compliance**: Risk Register `/risks` (`risk_management`); IT Components & Compliance `/reports/hardware-inventory` (`asset_management` plus asset/audit/compliance permission).
- **Analytics & Reports**: Reports `/reports` is the expandable parent. The current nested categories/leaves are:
  - Employee & Personal (always visible): Employee Directory & Status Report `/reports/employee-directory`; Resource Workload Heatmap `/reports/workload-heatmap`; Account Access & Onboarding Activity `/reports/account-activity`.
  - IT Asset Management (`asset_management`, category permissions `asset_view`, `asset_update`, `inventory_view`, `system_admin`): Hardware Depreciation & Lifecycle `/reports/hardware-lifecycle`; Consumable Stock & Reorder Alerts `/reports/consumables-stock`; each leaf has its own any-permission rule.
  - Project Management & Governance (`project_management`, `project_view`, `project_manage`, `system_admin`): Schedule & Budget Variance `/reports/project-variance`; Task & Milestone Velocity `/reports/project-velocity`; PMI RMP Risk Heatmap `/reports/risk-heatmap`.
  - ITSM Service Desk (`itsm`, category permissions `ticket_view_all`, `change_view`, `system_admin`): Incident MTTR & P1-P4 Breakdown `/reports/itsm-mttr`; SLA Breach & Escalation Metrics `/reports/itsm-sla`; Change Enablement (CAB) Success Rates `/reports/itsm-cab`.
  - There is no GRC category in this report submenu. Leaf visibility is further filtered by its declared module, permission and persona rules.
- **Tools**: Data Migration Center `/import` (admin/IT manager/legacy manager, and at least one business module enabled); Settings `/settings`.
- **System**: User Management `/users`; Roles `/roles`; Permissions `/permissions`; Dropdowns `/system/dropdowns`; Audit Logs `/audit-logs`; System Settings `/system-settings`; SLA Policies `/sla-policies` (`itsm`). Each route may impose its own permission check.

Sidebar visibility is not authorization by itself. The client filters items by permission, module and persona (`hasPermission`, `isModuleEnabled`, `isPersonaPageAllowed`); the server separately applies route guards and the central API gate. Mobile navigation is a 288px slide-out Sheet from the shared shell.

## 4. Module licensing, RBAC and authentication

### 4.1 Module registry

`shared/modules.ts` declares the only customer-switchable modules. All entries are `core: false`, default enabled, and backed by `module_settings`; disabled modules retain their tables and data.

| Key | Customer label | Default | Main domain |
|---|---|---:|---|
| `asset_management` | Asset Management | enabled | Hardware, employees, assignments, inventory, procurement, maintenance, finance and asset reports |
| `cmdb` | CMDB & Infrastructure | enabled | Applications, servers, configuration documents, network/firewall and backup governance |
| `itsm` | ITSM (Incident & Service Requests) | enabled | Incident, service request, problem, change, service catalog, ticket and selected reports |
| `risk_management` | Risk Management | enabled | Standalone risk register and risk assessments |
| `project_management` | Project Management | enabled | Projects, baselines, teams, milestones, tasks, project risks/changes/documents |

`server/module-access.ts` resolves the DB setting or registry default; unknown feature keys fail closed. `checkModuleEnabled()` returns the standard 403 `FEATURE_NOT_ENABLED` payload when a valid module is disabled.

### 4.2 Central API module map

`moduleForApiPath()` in `server/routes.ts` applies longest-prefix matching. The effective prefix families are:

- `cmdb`: `/applications`, `/servers`, `/network-topology`, `/backup-schedules`, `/cmdb`.
- `asset_management`: `/assets`, `/my/assets`, `/dashboard/stats`, `/assignments`, `/maintenance`, `/maintenance-schedules`, `/maintenance-records`, `/asset-bookings`, `/asset-disposal`, `/asset-requests`, `/asset-audits`, `/asset-handovers`, `/employees`, `/departments`, `/locations`, `/vendors`, `/purchase-orders`, `/budgets`, `/contracts`, `/reports`, `/import/assets`.
- `itsm`: `/incidents`, `/service-requests`, `/tickets`, `/changes`, `/problems`, `/catalog`, `/service-catalog`, `/reports/tickets`, `/reports/problems`, `/reports/changes`, `/kpis`.
- `project_management`: `/projects`.
- `risk_management`: `/risks`, `/risk-users`.
- Core exceptions: `/kb`, `/kb-articles`, `/reports/kb-articles`, `/reports/personnel` bypass this module map. The central middleware also marks `/access-governance`, `/applications`, `/servers`, `/audit-logs`, `/my/assets`, `/my/asset-handovers`, `/dashboard/executive`, `/cmdb`, `/consumables`, `/data-migrations`, and `/import` as persona-checked paths.

Routes may also include explicit `requireModule(...)`; those checks complement rather than replace the central map. A concrete exception to audit: `/api/sla-policies` GET is authenticated but not covered by the central ITSM prefix map, although its UI is ITSM-gated.

### 4.3 Roles and permissions

`shared/personas.ts` recognizes normalized aliases for five persona keys: `end_user`, `it_agent`, `cab_member`, `it_manager`, `auditor`. Legacy names such as System Administrator, IT Manager, Asset Manager, Manager and Read Only User are also seeded/used. Effective access is a combination of persona checks and DB permissions—not role labels alone.

| Persona | Client-side intended scope | API-side intended scope |
|---|---|---|
| `end_user` | Portal, catalog, own incidents/service requests, Knowledge Base and assigned assets | Own/request and assigned ticket reads, ticket create, limited consumable and handover self-service |
| `it_agent` | Incident/request/problem desks, ITAM operations, KB, infrastructure/network/backup | Ticket/workbench and operational APIs, asset and handover operations subject to permissions |
| `cab_member` | CAB changes, approvals, impact context, select infrastructure/financial pages | Read-only changes/infrastructure/financial plus approval decisions/catalog approvals as guarded |
| `it_manager` | Broad operations, CMDB, projects, financials, employees and reports | Manager API prefixes, executive dashboard and CMDB APIs |
| `auditor` | Read-focused access governance, audit, infrastructure/backup, KB and component report | Read-only API allowlist for access/audit/network/backup/KB/employees/assets |
| Demo viewer | Safe read-only exploration; mutating APIs are blocked by guard | Explicit allowlist in `shared/demo-viewer.ts` |

Database RBAC is normalized through `users`, `roles`, `permissions`, `user_roles`, `role_permissions`; enforcement middleware is `requireAuth`, `requirePermission`, and `requireAnyPermission`. Permission categories include identity (`user_*`, `role_*`, `permission_view`, `user_role_assign`, `system_admin`), ITAM (`asset_*`, `assignment_*`, `maintenance_*`, `employee_*`), governance (`access_governance_view`, `offboarding_approve`, `audit_view`, `compliance_view`), CMDB/finance (`cmdb_view`, `finance_view`), ITSM (`ticket_*`, `change_*`, `risk_manage`) and projects (`project_view`, `project_manage`). Exact effective grants are stored in the DB.

### 4.4 Authentication and security layers

- `server/index.ts` installs security headers, JSON/urlencoded parsing, API security middleware, import/data-migration rate limits, clear-data rate limiting and request logging.
- `server/auth.ts` uses Passport Local, `express-session`, `connect-pg-simple` and a PostgreSQL `sessions` store. Passwords are scrypt hashes with random salt; login attempts are rate-limited. Sessions are HTTP-only, SameSite Strict, secure in production and expire after 24 hours.
- The demo-viewer API guard is installed before API handlers and restricts actions even when a route itself is generally readable.
- Central module/persona middleware is installed in `registerRoutes`; individual endpoint guards and body validation remain important. Route handlers use Zod/Drizzle-Zod schemas for create/update payloads where defined.
- `server/security-middleware.ts` supplies headers, API abuse/rate-limit checks, import limits and system-reset limits.

## 5. Complete Drizzle database schema

### 5.1 Interpretation and limits

Each entry below is the `pgTable` definition in `shared/schema.ts`. Property name is the TypeScript/Drizzle property; database name is the SQL column. The complete expression is shown so SQL type, nullability (`.notNull()` absent means nullable unless primary key), default, uniqueness, reference and enum/check behavior remain visible. Table rules include indexes, unique indexes, checks and custom key declarations. Foreign-key actions are reported where declared on the column; custom table-level FK declarations appear in table rules. This is the code schema, not live introspection of the connected database.

Select/insert TypeScript shapes are generally derived as `typeof table.$inferSelect` and `createInsertSchema(table)`; individual `insert*Schema` declarations omit server-owned IDs, timestamps and lifecycle fields as appropriate. `shared/schema.ts` also defines `relations()` and shared Zod types used by client and server.

### 5.2 Identity, organization and platform configuration (18 tables)

#### `employees` — Drizzle export `employees` — `shared/schema.ts:L8`

**Columns (17):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L9`.
- `employeeId` / `employee_id` — text; nullable. Definition: <code>text("employee_id").unique()</code> Source: `shared/schema.ts:L10`.
- `firstName` / `first_name` — text; not null. Definition: <code>text("first_name").notNull()</code> Source: `shared/schema.ts:L11`.
- `lastName` / `last_name` — text; not null. Definition: <code>text("last_name").notNull()</code> Source: `shared/schema.ts:L12`.
- `email` / `email` — text; not null. Definition: <code>text("email").notNull().unique()</code> Source: `shared/schema.ts:L13`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("active")</code> Source: `shared/schema.ts:L14`.
- `offboardedDate` / `offboarded_date` — date; nullable. Definition: <code>date("offboarded_date")</code> Source: `shared/schema.ts:L15`.
- `offboardedReason` / `offboarded_reason` — text; nullable. Definition: <code>text("offboarded_reason")</code> Source: `shared/schema.ts:L16`.
- `department` / `department` — text; nullable. Definition: <code>text("department")</code> Source: `shared/schema.ts:L17`.
- `position` / `position` — text; not null. Definition: <code>text("position").notNull()</code> Source: `shared/schema.ts:L18`.
- `phone` / `phone` — text; nullable. Definition: <code>text("phone")</code> Source: `shared/schema.ts:L19`.
- `mobile` / `mobile` — text; nullable. Definition: <code>text("mobile")</code> Source: `shared/schema.ts:L20`.
- `startDate` / `start_date` — date; nullable. Definition: <code>date("start_date")</code> Source: `shared/schema.ts:L21`.
- `salary` / `salary` — decimal; nullable. Definition: <code>decimal("salary", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L22`.
- `managerId` / `manager_id` — varchar; nullable. Definition: <code>varchar("manager_id")</code> Source: `shared/schema.ts:L23`.
- `departmentId` / `department_id` — varchar; nullable. Definition: <code>varchar("department_id")</code> Source: `shared/schema.ts:L24`.
- `locationId` / `location_id` — varchar; nullable. Definition: <code>varchar("location_id")</code> Source: `shared/schema.ts:L25`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `employee_access_rights` — Drizzle export `employeeAccessRights` — `shared/schema.ts:L28`

**Columns (16):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L29`.
- `employeeId` / `employee_id` — varchar; not null; FK → employees.id (ON DELETE RESTRICT). Definition: <code>varchar("employee_id").notNull().references(() =&gt; employees.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L30`.
- `applicationName` / `application_name` — text; not null. Definition: <code>text("application_name").notNull()</code> Source: `shared/schema.ts:L31`.
- `accessType` / `access_type` — text; not null. Definition: <code>text("access_type").notNull().default("application")</code> Source: `shared/schema.ts:L32`.
- `catalogSource` / `catalog_source` — text; not null. Definition: <code>text("catalog_source").notNull().default("legacy")</code> Source: `shared/schema.ts:L33`.
- `catalogItemId` / `catalog_item_id` — text; nullable. Definition: <code>text("catalog_item_id")</code> Source: `shared/schema.ts:L34`.
- `privilegeLevel` / `privilege_level` — text; not null. Definition: <code>text("privilege_level").notNull()</code> Source: `shared/schema.ts:L35`.
- `accountUsername` / `account_username` — text; nullable. Definition: <code>text("account_username")</code> Source: `shared/schema.ts:L36`.
- `businessJustification` / `business_justification` — text; not null. Definition: <code>text("business_justification").notNull().default("Legacy access record - justification pending review")</code> Source: `shared/schema.ts:L37`.
- `grantDate` / `grant_date` — date; not null. Definition: <code>date("grant_date").notNull().default(sql`CURRENT_DATE`)</code> Source: `shared/schema.ts:L38`.
- `expiresAt` / `expires_at` — date; nullable. Definition: <code>date("expires_at")</code> Source: `shared/schema.ts:L39`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("active")</code> Source: `shared/schema.ts:L40`.
- `revokedAt` / `revoked_at` — timestamp; nullable. Definition: <code>timestamp("revoked_at")</code> Source: `shared/schema.ts:L41`.
- `revocationReason` / `revocation_reason` — text; nullable. Definition: <code>text("revocation_reason")</code> Source: `shared/schema.ts:L42`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L43`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L44`.
**Declared column foreign keys:** `employeeId` → `employees.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- index: <code>index("employee_access_rights_employee_idx")</code>
- index: <code>index("employee_access_rights_catalog_idx")</code>
- index: <code>index("employee_access_rights_expiry_idx")</code>

#### `employee_offboarding_clearances` — Drizzle export `employeeOffboardingClearances` — `shared/schema.ts:L51`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L52`.
- `employeeId` / `employee_id` — varchar; not null; FK → employees.id (ON DELETE RESTRICT). Definition: <code>varchar("employee_id").notNull().references(() =&gt; employees.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L53`.
- `offboardingDate` / `offboarding_date` — date; not null. Definition: <code>date("offboarding_date").notNull()</code> Source: `shared/schema.ts:L54`.
- `clearanceType` / `clearance_type` — text; not null. Definition: <code>text("clearance_type").notNull()</code> Source: `shared/schema.ts:L55`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull()</code> Source: `shared/schema.ts:L56`.
- `note` / `note` — text; nullable. Definition: <code>text("note")</code> Source: `shared/schema.ts:L57`.
- `signedBy` / `signed_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("signed_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L58`.
- `signedAt` / `signed_at` — timestamp; not null. Definition: <code>timestamp("signed_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L59`.
**Declared column foreign keys:** `employeeId` → `employees.id` (ON DELETE RESTRICT); `signedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("employee_offboarding_clearance_type_check", sql`${table.clearanceType} IN ('physical_asset_return', 'credential_vpn_revocation', 'license_reallocation')`)</code>
- check: <code>check("employee_offboarding_clearance_status_check", sql`${table.status} IN ('verified', 'waived')`)</code>
- index: <code>index("employee_offboarding_clearance_employee_idx")</code>

#### `locations` — Drizzle export `locations` — `shared/schema.ts:L67`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L68`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L69`.
- `address` / `address` — text; nullable. Definition: <code>text("address")</code> Source: `shared/schema.ts:L70`.
- `city` / `city` — text; nullable. Definition: <code>text("city")</code> Source: `shared/schema.ts:L71`.
- `state` / `state` — text; nullable. Definition: <code>text("state")</code> Source: `shared/schema.ts:L72`.
- `zipCode` / `zip_code` — text; nullable. Definition: <code>text("zip_code")</code> Source: `shared/schema.ts:L73`.
- `country` / `country` — text; nullable. Definition: <code>text("country").default("USA")</code> Source: `shared/schema.ts:L74`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L75`.
- `managerId` / `manager_id` — varchar; nullable. Definition: <code>varchar("manager_id")</code> Source: `shared/schema.ts:L76`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `departments` — Drizzle export `departments` — `shared/schema.ts:L79`

**Columns (6):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L80`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull().unique()</code> Source: `shared/schema.ts:L81`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L82`.
- `managerId` / `manager_id` — varchar; nullable. Definition: <code>varchar("manager_id")</code> Source: `shared/schema.ts:L83`.
- `budget` / `budget` — decimal; nullable. Definition: <code>decimal("budget", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L84`.
- `locationId` / `location_id` — varchar; nullable. Definition: <code>varchar("location_id")</code> Source: `shared/schema.ts:L85`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `users` — Drizzle export `users` — `shared/schema.ts:L787`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L788`.
- `username` / `username` — text; not null. Definition: <code>text("username").notNull().unique()</code> Source: `shared/schema.ts:L789`.
- `email` / `email` — text; not null. Definition: <code>text("email").notNull().unique()</code> Source: `shared/schema.ts:L790`.
- `password` / `password` — text; not null. Definition: <code>text("password").notNull()</code> Source: `shared/schema.ts:L791`.
- `firstName` / `first_name` — text; not null. Definition: <code>text("first_name").notNull()</code> Source: `shared/schema.ts:L792`.
- `lastName` / `last_name` — text; not null. Definition: <code>text("last_name").notNull()</code> Source: `shared/schema.ts:L793`.
- `isActive` / `is_active` — boolean; nullable. Definition: <code>boolean("is_active").default(true)</code> Source: `shared/schema.ts:L794`.
- `lastLogin` / `last_login` — timestamp; nullable. Definition: <code>timestamp("last_login")</code> Source: `shared/schema.ts:L795`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L796`.
- `createdBy` / `created_by` — varchar; nullable. Definition: <code>varchar("created_by")</code> Source: `shared/schema.ts:L797`.
- `twoFactorEnabled` / `two_factor_enabled` — boolean; nullable. Definition: <code>boolean("two_factor_enabled").default(false)</code> Source: `shared/schema.ts:L798`.
- `twoFactorSecret` / `two_factor_secret` — text; nullable. Definition: <code>text("two_factor_secret")</code> Source: `shared/schema.ts:L799`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `roles` — Drizzle export `roles` — `shared/schema.ts:L813`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L814`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull().unique()</code> Source: `shared/schema.ts:L815`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L816`.
- `isSystemRole` / `is_system_role` — boolean; nullable. Definition: <code>boolean("is_system_role").default(false)</code> Source: `shared/schema.ts:L817`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L818`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `permissions` — Drizzle export `permissions` — `shared/schema.ts:L821`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L822`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull().unique()</code> Source: `shared/schema.ts:L823`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L824`.
- `resource` / `resource` — text; nullable. Definition: <code>text("resource")</code> Source: `shared/schema.ts:L825`.
- `action` / `action` — text; nullable. Definition: <code>text("action")</code> Source: `shared/schema.ts:L826`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `user_roles` — Drizzle export `userRoles` — `shared/schema.ts:L829`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L830`.
- `userId` / `user_id` — varchar; not null; FK → users.id. Definition: <code>varchar("user_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L831`.
- `roleId` / `role_id` — varchar; not null; FK → roles.id. Definition: <code>varchar("role_id").notNull().references(() =&gt; roles.id)</code> Source: `shared/schema.ts:L832`.
- `assignedAt` / `assigned_at` — timestamp; nullable. Definition: <code>timestamp("assigned_at").default(sql`now()`)</code> Source: `shared/schema.ts:L833`.
- `assignedBy` / `assigned_by` — varchar; nullable. Definition: <code>varchar("assigned_by")</code> Source: `shared/schema.ts:L834`.
**Declared column foreign keys:** `userId` → `users.id`; `roleId` → `roles.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `role_permissions` — Drizzle export `rolePermissions` — `shared/schema.ts:L837`

**Columns (3):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L838`.
- `roleId` / `role_id` — varchar; not null; FK → roles.id. Definition: <code>varchar("role_id").notNull().references(() =&gt; roles.id)</code> Source: `shared/schema.ts:L839`.
- `permissionId` / `permission_id` — varchar; not null; FK → permissions.id. Definition: <code>varchar("permission_id").notNull().references(() =&gt; permissions.id)</code> Source: `shared/schema.ts:L840`.
**Declared column foreign keys:** `roleId` → `roles.id`; `permissionId` → `permissions.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `sessions` — Drizzle export `sessions` — `shared/schema.ts:L843`

**Columns (3):**
- `sid` / `sid` — varchar; primary key. Definition: <code>varchar("sid").primaryKey()</code> Source: `shared/schema.ts:L844`.
- `sess` / `sess` — text; not null. Definition: <code>text("sess").notNull()</code> Source: `shared/schema.ts:L845`.
- `expire` / `expire` — timestamp; not null. Definition: <code>timestamp("expire").notNull()</code> Source: `shared/schema.ts:L846`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `cab_stream_leases` — Drizzle export `cabStreamLeases` — `shared/schema.ts:L849`

**Columns (4):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id", { length: 36 }).primaryKey()</code> Source: `shared/schema.ts:L850`.
- `userId` / `user_id` — varchar; not null. Definition: <code>varchar("user_id").notNull()</code> Source: `shared/schema.ts:L851`.
- `sessionId` / `session_id` — text; not null. Definition: <code>text("session_id").notNull()</code> Source: `shared/schema.ts:L852`.
- `expiresAt` / `expires_at` — timestamp; not null. Definition: <code>timestamp("expires_at", { withTimezone: true }).notNull()</code> Source: `shared/schema.ts:L853`.
**Table-level indexes / checks / constraints:**
- index: <code>index("cab_stream_leases_user_expiry_idx")</code>
- index: <code>index("cab_stream_leases_expiry_idx")</code>

#### `system_settings` — Drizzle export `systemSettings` — `shared/schema.ts:L859`

**Columns (7):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L860`.
- `key` / `key` — text; not null. Definition: <code>text("key").notNull().unique()</code> Source: `shared/schema.ts:L861`.
- `value` / `value` — text; nullable. Definition: <code>text("value")</code> Source: `shared/schema.ts:L862`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L863`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L864`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L865`.
- `updatedBy` / `updated_by` — varchar; nullable. Definition: <code>varchar("updated_by")</code> Source: `shared/schema.ts:L866`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `audit_logs` — Drizzle export `auditLogs` — `shared/schema.ts:L870`

**Columns (11):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L871`.
- `userId` / `user_id` — varchar; nullable; FK → users.id. Definition: <code>varchar("user_id").references(() =&gt; users.id)</code> Source: `shared/schema.ts:L872`.
- `action` / `action` — text; not null. Definition: <code>text("action").notNull()</code> Source: `shared/schema.ts:L873`.
- `tableName` / `table_name` — text; not null. Definition: <code>text("table_name").notNull()</code> Source: `shared/schema.ts:L874`.
- `recordId` / `record_id` — text; not null. Definition: <code>text("record_id").notNull()</code> Source: `shared/schema.ts:L875`.
- `recordName` / `record_name` — text; nullable. Definition: <code>text("record_name")</code> Source: `shared/schema.ts:L876`.
- `oldValues` / `old_values` — text; nullable. Definition: <code>text("old_values")</code> Source: `shared/schema.ts:L877`.
- `newValues` / `new_values` — text; nullable. Definition: <code>text("new_values")</code> Source: `shared/schema.ts:L878`.
- `timestamp` / `timestamp` — timestamp; not null. Definition: <code>timestamp("timestamp").default(sql`now()`).notNull()</code> Source: `shared/schema.ts:L879`.
- `ipAddress` / `ip_address` — text; nullable. Definition: <code>text("ip_address")</code> Source: `shared/schema.ts:L880`.
- `userAgent` / `user_agent` — text; nullable. Definition: <code>text("user_agent")</code> Source: `shared/schema.ts:L881`.
**Declared column foreign keys:** `userId` → `users.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `data_migration_batches` — Drizzle export `dataMigrationBatches` — `shared/schema.ts:L884`

**Columns (14):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L885`.
- `moduleKey` / `module_key` — text; not null. Definition: <code>text("module_key").notNull()</code> Source: `shared/schema.ts:L886`.
- `fileName` / `file_name` — text; not null. Definition: <code>text("file_name").notNull()</code> Source: `shared/schema.ts:L887`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("preview")</code> Source: `shared/schema.ts:L888`.
- `totalRows` / `total_rows` — integer; not null. Definition: <code>integer("total_rows").notNull()</code> Source: `shared/schema.ts:L889`.
- `validRows` / `valid_rows` — integer; not null. Definition: <code>integer("valid_rows").notNull()</code> Source: `shared/schema.ts:L890`.
- `invalidRows` / `invalid_rows` — integer; not null. Definition: <code>integer("invalid_rows").notNull()</code> Source: `shared/schema.ts:L891`.
- `importedRows` / `imported_rows` — integer; not null. Definition: <code>integer("imported_rows").notNull().default(0)</code> Source: `shared/schema.ts:L892`.
- `failedRows` / `failed_rows` — integer; not null. Definition: <code>integer("failed_rows").notNull().default(0)</code> Source: `shared/schema.ts:L893`.
- `previewData` / `preview_data` — jsonb; nullable. Definition: <code>jsonb("preview_data").$type&lt;Array&lt;Record&lt;string, unknown&gt;&gt; | null&gt;()</code> Source: `shared/schema.ts:L894`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L895`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L896`.
- `expiresAt` / `expires_at` — timestamp; not null. Definition: <code>timestamp("expires_at").notNull()</code> Source: `shared/schema.ts:L897`.
- `completedAt` / `completed_at` — timestamp; nullable. Definition: <code>timestamp("completed_at")</code> Source: `shared/schema.ts:L898`.
**Declared column foreign keys:** `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("data_migration_batches_status_check", sql`${table.status} IN ('preview', 'imported', 'failed', 'expired')`)</code>
- check: <code>check("data_migration_batches_counts_check", sql`${table.totalRows} &gt;= 0 AND ${table.validRows} &gt;= 0 AND ${table.invalidRows} &gt;= 0 AND ${table.importedRows} &gt;= 0 AND ${table.failedRows} &gt;= 0`)</code>
- index: <code>index("data_migration_batches_actor_date_idx")</code>
- index: <code>index("data_migration_batches_expiry_idx")</code>

#### `dropdown_options` — Drizzle export `dropdownOptions` — `shared/schema.ts:L1174`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1175`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L1176`.
- `value` / `value` — text; not null. Definition: <code>text("value").notNull()</code> Source: `shared/schema.ts:L1177`.
- `label` / `label` — text; not null. Definition: <code>text("label").notNull()</code> Source: `shared/schema.ts:L1178`.
- `isActive` / `is_active` — boolean; nullable. Definition: <code>boolean("is_active").default(true)</code> Source: `shared/schema.ts:L1179`.
- `displayOrder` / `display_order` — integer; nullable. Definition: <code>integer("display_order").default(0)</code> Source: `shared/schema.ts:L1180`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1181`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1182`.
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("dropdown_options_category_value_ci_unique")</code>

#### `settings` — Drizzle export `settings` — `shared/schema.ts:L1189`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1190`.
- `key` / `key` — text; not null. Definition: <code>text("key").notNull().unique()</code> Source: `shared/schema.ts:L1191`.
- `value` / `value` — text; not null. Definition: <code>text("value").notNull()</code> Source: `shared/schema.ts:L1192`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L1193`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").default(sql`now()`).notNull()</code> Source: `shared/schema.ts:L1194`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `module_settings` — Drizzle export `moduleSettings` — `shared/schema.ts:L1199`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1200`.
- `moduleKey` / `module_key` — text; not null. Definition: <code>text("module_key").notNull().unique()</code> Source: `shared/schema.ts:L1201`.
- `enabled` / `enabled` — boolean; not null. Definition: <code>boolean("enabled").notNull().default(true)</code> Source: `shared/schema.ts:L1202`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1203`.
- `updatedBy` / `updated_by` — varchar; nullable. Definition: <code>varchar("updated_by")</code> Source: `shared/schema.ts:L1204`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

### 5.3 ITAM, procurement and operations (27 tables)

#### `assets` — Drizzle export `assets` — `shared/schema.ts:L277`

**Columns (146):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L278`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L281`.
- `assetTag` / `asset_tag` — text; nullable. Definition: <code>text("asset_tag").unique()</code> Source: `shared/schema.ts:L282`.
- `type` / `type` — text; not null. Definition: <code>text("type").notNull()</code> Source: `shared/schema.ts:L283`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L284`.
- `serialNumber` / `serial_number` — text; nullable. Definition: <code>text("serial_number")</code> Source: `shared/schema.ts:L285`.
- `model` / `model` — text; nullable. Definition: <code>text("model")</code> Source: `shared/schema.ts:L286`.
- `manufacturer` / `manufacturer` — text; nullable. Definition: <code>text("manufacturer")</code> Source: `shared/schema.ts:L287`.
- `processor` / `processor` — text; nullable. Definition: <code>text("processor")</code> Source: `shared/schema.ts:L288`.
- `ram` / `ram` — text; nullable. Definition: <code>text("ram")</code> Source: `shared/schema.ts:L289`.
- `storage` / `storage` — text; nullable. Definition: <code>text("storage")</code> Source: `shared/schema.ts:L290`.
- `version` / `version` — text; nullable. Definition: <code>text("version")</code> Source: `shared/schema.ts:L291`.
- `barcode` / `barcode` — text; nullable. Definition: <code>text("barcode")</code> Source: `shared/schema.ts:L292`.
- `qrCode` / `qr_code` — text; nullable. Definition: <code>text("qr_code")</code> Source: `shared/schema.ts:L293`.
- `informationClassification` / `information_classification` — text; nullable. Definition: <code>text("information_classification")</code> Source: `shared/schema.ts:L296`.
- `securityLevel` / `security_level` — text; nullable. Definition: <code>text("security_level")</code> Source: `shared/schema.ts:L297`.
- `criticalityRating` / `criticality_rating` — text; nullable. Definition: <code>text("criticality_rating")</code> Source: `shared/schema.ts:L298`.
- `threatLevel` / `threat_level` — text; nullable. Definition: <code>text("threat_level")</code> Source: `shared/schema.ts:L299`.
- `vulnerabilityStatus` / `vulnerability_status` — text; nullable. Definition: <code>text("vulnerability_status")</code> Source: `shared/schema.ts:L300`.
- `riskAssessmentScore` / `risk_assessment_score` — text; nullable. Definition: <code>text("risk_assessment_score")</code> Source: `shared/schema.ts:L301`.
- `dataSensitivityLevel` / `data_sensitivity_level` — text; nullable. Definition: <code>text("data_sensitivity_level")</code> Source: `shared/schema.ts:L302`.
- `assetOwner` / `asset_owner` — text; nullable. Definition: <code>text("asset_owner")</code> Source: `shared/schema.ts:L305`.
- `assetCustodian` / `asset_custodian` — text; nullable. Definition: <code>text("asset_custodian")</code> Source: `shared/schema.ts:L306`.
- `responsibleManager` / `responsible_manager` — text; nullable. Definition: <code>text("responsible_manager")</code> Source: `shared/schema.ts:L307`.
- `technicalContact` / `technical_contact` — text; nullable. Definition: <code>text("technical_contact")</code> Source: `shared/schema.ts:L308`.
- `locationId` / `location_id` — varchar; nullable; FK → locations.id. Definition: <code>varchar("location_id").references(() =&gt; locations.id)</code> Source: `shared/schema.ts:L309`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id. Definition: <code>varchar("department_id").references(() =&gt; departments.id)</code> Source: `shared/schema.ts:L310`.
- `siteBuilding` / `site_building` — text; nullable. Definition: <code>text("site_building")</code> Source: `shared/schema.ts:L311`.
- `primaryVendorId` / `primary_vendor_id` — varchar; nullable; FK → vendors.id. Definition: <code>varchar("primary_vendor_id").references(() =&gt; vendors.id)</code> Source: `shared/schema.ts:L314`.
- `vendor` / `vendor` — text; nullable. Definition: <code>text("vendor")</code> Source: `shared/schema.ts:L315`.
- `contractNumber` / `contract_number` — text; nullable. Definition: <code>text("contract_number")</code> Source: `shared/schema.ts:L316`.
- `contractStartDate` / `contract_start_date` — date; nullable. Definition: <code>date("contract_start_date")</code> Source: `shared/schema.ts:L317`.
- `contractEndDate` / `contract_end_date` — date; nullable. Definition: <code>date("contract_end_date")</code> Source: `shared/schema.ts:L318`.
- `supportLevel` / `support_level` — text; nullable. Definition: <code>text("support_level")</code> Source: `shared/schema.ts:L319`.
- `operatingSystem` / `operating_system` — text; nullable. Definition: <code>text("operating_system")</code> Source: `shared/schema.ts:L322`.
- `ipAddress` / `ip_address` — text; nullable. Definition: <code>text("ip_address")</code> Source: `shared/schema.ts:L323`.
- `macAddress` / `mac_address` — text; nullable. Definition: <code>text("mac_address")</code> Source: `shared/schema.ts:L324`.
- `specifications` / `specifications` — text; nullable. Definition: <code>text("specifications")</code> Source: `shared/schema.ts:L325`.
- `configurationDetails` / `configuration_details` — text; nullable. Definition: <code>text("configuration_details")</code> Source: `shared/schema.ts:L326`.
- `dependencies` / `dependencies` — text; nullable. Definition: <code>text("dependencies")</code> Source: `shared/schema.ts:L327`.
- `interfaces` / `interfaces` — text; nullable. Definition: <code>text("interfaces")</code> Source: `shared/schema.ts:L328`.
- `networkZone` / `network_zone` — text; nullable. Definition: <code>text("network_zone")</code> Source: `shared/schema.ts:L329`.
- `domainWorkgroup` / `domain_workgroup` — text; nullable. Definition: <code>text("domain_workgroup")</code> Source: `shared/schema.ts:L330`.
- `installedSoftware` / `installed_software` — text; nullable. Definition: <code>text("installed_software")</code> Source: `shared/schema.ts:L331`.
- `hardwareSpecifications` / `hardware_specifications` — text; nullable. Definition: <code>text("hardware_specifications")</code> Source: `shared/schema.ts:L332`.
- `acquisitionDate` / `acquisition_date` — date; nullable. Definition: <code>date("acquisition_date")</code> Source: `shared/schema.ts:L335`.
- `purchaseDate` / `purchase_date` — date; nullable. Definition: <code>date("purchase_date")</code> Source: `shared/schema.ts:L336`.
- `installationDate` / `installation_date` — date; nullable. Definition: <code>date("installation_date")</code> Source: `shared/schema.ts:L337`.
- `goLiveDate` / `go_live_date` — date; nullable. Definition: <code>date("go_live_date")</code> Source: `shared/schema.ts:L338`.
- `lastUpdateDate` / `last_update_date` — date; nullable. Definition: <code>date("last_update_date")</code> Source: `shared/schema.ts:L339`.
- `nextScheduledUpdate` / `next_scheduled_update` — date; nullable. Definition: <code>date("next_scheduled_update")</code> Source: `shared/schema.ts:L340`.
- `warrantyStartDate` / `warranty_start_date` — date; nullable. Definition: <code>date("warranty_start_date")</code> Source: `shared/schema.ts:L341`.
- `warrantyExpiry` / `warranty_expiry` — date; nullable. Definition: <code>date("warranty_expiry")</code> Source: `shared/schema.ts:L342`.
- `plannedDisposalDate` / `planned_disposal_date` — date; nullable. Definition: <code>date("planned_disposal_date")</code> Source: `shared/schema.ts:L343`.
- `lifecycleStatus` / `lifecycle_status` — text; nullable. Definition: <code>text("lifecycle_status")</code> Source: `shared/schema.ts:L344`.
- `disposalMethod` / `disposal_method` — text; nullable. Definition: <code>text("disposal_method")</code> Source: `shared/schema.ts:L345`.
- `dataDestructionRequirements` / `data_destruction_requirements` — text; nullable. Definition: <code>text("data_destruction_requirements")</code> Source: `shared/schema.ts:L346`.
- `complianceStatus` / `compliance_status` — text; nullable. Definition: <code>text("compliance_status")</code> Source: `shared/schema.ts:L349`.
- `applicableRegulations` / `applicable_regulations` — text; nullable. Definition: <code>text("applicable_regulations")</code> Source: `shared/schema.ts:L350`.
- `securityControlsImplemented` / `security_controls_implemented` — text; nullable. Definition: <code>text("security_controls_implemented")</code> Source: `shared/schema.ts:L351`.
- `encryptionStatus` / `encryption_status` — text; nullable. Definition: <code>text("encryption_status")</code> Source: `shared/schema.ts:L352`.
- `accessControlMethod` / `access_control_method` — text; nullable. Definition: <code>text("access_control_method")</code> Source: `shared/schema.ts:L353`.
- `backupStatus` / `backup_status` — text; nullable. Definition: <code>text("backup_status")</code> Source: `shared/schema.ts:L354`.
- `monitoringStatus` / `monitoring_status` — text; nullable. Definition: <code>text("monitoring_status")</code> Source: `shared/schema.ts:L355`.
- `antivirusEdrStatus` / `antivirus_edr_status` — text; nullable. Definition: <code>text("antivirus_edr_status")</code> Source: `shared/schema.ts:L356`.
- `patchManagementStatus` / `patch_management_status` — text; nullable. Definition: <code>text("patch_management_status")</code> Source: `shared/schema.ts:L357`.
- `configurationBaseline` / `configuration_baseline` — text; nullable. Definition: <code>text("configuration_baseline")</code> Source: `shared/schema.ts:L358`.
- `securityScanResults` / `security_scan_results` — text; nullable. Definition: <code>text("security_scan_results")</code> Source: `shared/schema.ts:L359`.
- `purchasePrice` / `purchase_price` — decimal; nullable. Definition: <code>decimal("purchase_price", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L362`.
- `currentBookValue` / `current_book_value` — decimal; nullable. Definition: <code>decimal("current_book_value", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L363`.
- `currentValue` / `current_value` — decimal; nullable. Definition: <code>decimal("current_value", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L364`.
- `depreciationRate` / `depreciation_rate` — decimal; nullable. Definition: <code>decimal("depreciation_rate", { precision: 5, scale: 2 }).default("20.00")</code> Source: `shared/schema.ts:L365`.
- `depreciationSchedule` / `depreciation_schedule` — text; nullable. Definition: <code>text("depreciation_schedule")</code> Source: `shared/schema.ts:L366`.
- `licenseType` / `license_type` — text; nullable. Definition: <code>text("license_type")</code> Source: `shared/schema.ts:L367`.
- `licenseQuantity` / `license_quantity` — integer; nullable. Definition: <code>integer("license_quantity")</code> Source: `shared/schema.ts:L368`.
- `licenseExpiryDate` / `license_expiry_date` — date; nullable. Definition: <code>date("license_expiry_date")</code> Source: `shared/schema.ts:L369`.
- `maintenanceCosts` / `maintenance_costs` — decimal; nullable. Definition: <code>decimal("maintenance_costs", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L370`.
- `budgetCode` / `budget_code` — text; nullable. Definition: <code>text("budget_code")</code> Source: `shared/schema.ts:L371`.
- `costCenter` / `cost_center` — text; nullable. Definition: <code>text("cost_center")</code> Source: `shared/schema.ts:L372`.
- `purchaseOrderNumber` / `purchase_order_number` — text; nullable. Definition: <code>text("purchase_order_number")</code> Source: `shared/schema.ts:L373`.
- `invoiceNumber` / `invoice_number` — text; nullable. Definition: <code>text("invoice_number")</code> Source: `shared/schema.ts:L374`.
- `annualBudgetAllocation` / `annual_budget_allocation` — decimal; nullable. Definition: <code>decimal("annual_budget_allocation", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L375`.
- `budgetCategory` / `budget_category` — text; nullable. Definition: <code>text("budget_category")</code> Source: `shared/schema.ts:L376`.
- `budgetApprovalStatus` / `budget_approval_status` — text; nullable. Definition: <code>text("budget_approval_status")</code> Source: `shared/schema.ts:L377`.
- `budgetApprovalDate` / `budget_approval_date` — date; nullable. Definition: <code>date("budget_approval_date")</code> Source: `shared/schema.ts:L378`.
- `budgetApprovedBy` / `budget_approved_by` — text; nullable. Definition: <code>text("budget_approved_by")</code> Source: `shared/schema.ts:L379`.
- `yearToDateSpend` / `year_to_date_spend` — decimal; nullable. Definition: <code>decimal("year_to_date_spend", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L380`.
- `remainingBudget` / `remaining_budget` — decimal; nullable. Definition: <code>decimal("remaining_budget", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L381`.
- `budgetUtilizationPercent` / `budget_utilization_percent` — decimal; nullable. Definition: <code>decimal("budget_utilization_percent", { precision: 5, scale: 2 })</code> Source: `shared/schema.ts:L382`.
- `forecastAnnualCost` / `forecast_annual_cost` — decimal; nullable. Definition: <code>decimal("forecast_annual_cost", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L383`.
- `budgetAlertThreshold` / `budget_alert_threshold` — decimal; nullable. Definition: <code>decimal("budget_alert_threshold", { precision: 5, scale: 2 })</code> Source: `shared/schema.ts:L384`.
- `budgetOverage` / `budget_overage` — decimal; nullable. Definition: <code>decimal("budget_overage", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L385`.
- `nextYearBudgetRequest` / `next_year_budget_request` — decimal; nullable. Definition: <code>decimal("next_year_budget_request", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L386`.
- `budgetOwner` / `budget_owner` — text; nullable. Definition: <code>text("budget_owner")</code> Source: `shared/schema.ts:L387`.
- `budgetJustification` / `budget_justification` — text; nullable. Definition: <code>text("budget_justification")</code> Source: `shared/schema.ts:L388`.
- `roiBusinessValue` / `roi_business_value` — text; nullable. Definition: <code>text("roi_business_value")</code> Source: `shared/schema.ts:L389`.
- `authorizedUsers` / `authorized_users` — text; nullable. Definition: <code>text("authorized_users")</code> Source: `shared/schema.ts:L392`.
- `accessRightsMatrix` / `access_rights_matrix` — text; nullable. Definition: <code>text("access_rights_matrix")</code> Source: `shared/schema.ts:L393`.
- `administratorAccounts` / `administrator_accounts` — text; nullable. Definition: <code>text("administrator_accounts")</code> Source: `shared/schema.ts:L394`.
- `usageRestrictions` / `usage_restrictions` — text; nullable. Definition: <code>text("usage_restrictions")</code> Source: `shared/schema.ts:L395`.
- `dataClassificationHandled` / `data_classification_handled` — text; nullable. Definition: <code>text("data_classification_handled")</code> Source: `shared/schema.ts:L396`.
- `businessPurpose` / `business_purpose` — text; nullable. Definition: <code>text("business_purpose")</code> Source: `shared/schema.ts:L397`.
- `approvedUseCases` / `approved_use_cases` — text; nullable. Definition: <code>text("approved_use_cases")</code> Source: `shared/schema.ts:L398`.
- `geographicRestrictions` / `geographic_restrictions` — text; nullable. Definition: <code>text("geographic_restrictions")</code> Source: `shared/schema.ts:L399`.
- `monitoringTools` / `monitoring_tools` — text; nullable. Definition: <code>text("monitoring_tools")</code> Source: `shared/schema.ts:L402`.
- `performanceMetrics` / `performance_metrics` — text; nullable. Definition: <code>text("performance_metrics")</code> Source: `shared/schema.ts:L403`.
- `availabilityRequirements` / `availability_requirements` — text; nullable. Definition: <code>text("availability_requirements")</code> Source: `shared/schema.ts:L404`.
- `recoveryTimeObjective` / `recovery_time_objective` — text; nullable. Definition: <code>text("recovery_time_objective")</code> Source: `shared/schema.ts:L405`.
- `recoveryPointObjective` / `recovery_point_objective` — text; nullable. Definition: <code>text("recovery_point_objective")</code> Source: `shared/schema.ts:L406`.
- `backupFrequency` / `backup_frequency` — text; nullable. Definition: <code>text("backup_frequency")</code> Source: `shared/schema.ts:L407`.
- `backupRetentionPeriod` / `backup_retention_period` — text; nullable. Definition: <code>text("backup_retention_period")</code> Source: `shared/schema.ts:L408`.
- `lastSuccessfulBackup` / `last_successful_backup` — date; nullable. Definition: <code>date("last_successful_backup")</code> Source: `shared/schema.ts:L409`.
- `disasterRecoveryPriority` / `disaster_recovery_priority` — text; nullable. Definition: <code>text("disaster_recovery_priority")</code> Source: `shared/schema.ts:L410`.
- `documentationLinks` / `documentation_links` — text; nullable. Definition: <code>text("documentation_links")</code> Source: `shared/schema.ts:L413`.
- `cmdbId` / `cmdb_id` — text; nullable. Definition: <code>text("cmdb_id")</code> Source: `shared/schema.ts:L414`.
- `changeManagementHistory` / `change_management_history` — text; nullable. Definition: <code>text("change_management_history")</code> Source: `shared/schema.ts:L415`.
- `incidentHistory` / `incident_history` — text; nullable. Definition: <code>text("incident_history")</code> Source: `shared/schema.ts:L416`.
- `lastSecurityAssessmentDate` / `last_security_assessment_date` — date; nullable. Definition: <code>date("last_security_assessment_date")</code> Source: `shared/schema.ts:L417`.
- `lastAuditDate` / `last_audit_date` — date; nullable. Definition: <code>date("last_audit_date")</code> Source: `shared/schema.ts:L418`.
- `nextAuditDate` / `next_audit_date` — date; nullable. Definition: <code>date("next_audit_date")</code> Source: `shared/schema.ts:L419`.
- `auditFindings` / `audit_findings` — text; nullable. Definition: <code>text("audit_findings")</code> Source: `shared/schema.ts:L420`.
- `remediationStatus` / `remediation_status` — text; nullable. Definition: <code>text("remediation_status")</code> Source: `shared/schema.ts:L421`.
- `assetRegistryEntryDate` / `asset_registry_entry_date` — date; nullable. Definition: <code>date("asset_registry_entry_date")</code> Source: `shared/schema.ts:L422`.
- `lastUpdatedDate` / `last_updated_date` — timestamp; nullable. Definition: <code>timestamp("last_updated_date").defaultNow()</code> Source: `shared/schema.ts:L423`.
- `updatedBy` / `updated_by` — text; nullable. Definition: <code>text("updated_by")</code> Source: `shared/schema.ts:L424`.
- `physicalSecurityLevel` / `physical_security_level` — text; nullable. Definition: <code>text("physical_security_level")</code> Source: `shared/schema.ts:L427`.
- `environmentalRequirements` / `environmental_requirements` — text; nullable. Definition: <code>text("environmental_requirements")</code> Source: `shared/schema.ts:L428`.
- `powerRequirements` / `power_requirements` — text; nullable. Definition: <code>text("power_requirements")</code> Source: `shared/schema.ts:L429`.
- `fireSuppression` / `fire_suppression` — text; nullable. Definition: <code>text("fire_suppression")</code> Source: `shared/schema.ts:L430`.
- `physicalAccessControls` / `physical_access_controls` — text; nullable. Definition: <code>text("physical_access_controls")</code> Source: `shared/schema.ts:L431`.
- `condition` / `condition` — text; nullable. Definition: <code>text("condition").default("good")</code> Source: `shared/schema.ts:L432`.
- `assetCondition` / `asset_condition` — text; nullable. Definition: <code>text("asset_condition")</code> Source: `shared/schema.ts:L433`.
- `maintenanceHistory` / `maintenance_history` — text; nullable. Definition: <code>text("maintenance_history")</code> Source: `shared/schema.ts:L434`.
- `depreciationMethod` / `depreciation_method` — text; nullable. Definition: <code>text("depreciation_method").default("straight-line")</code> Source: `shared/schema.ts:L437`.
- `usefulLifeYears` / `useful_life_years` — integer; nullable. Definition: <code>integer("useful_life_years")</code> Source: `shared/schema.ts:L438`.
- `residualValue` / `residual_value` — decimal; nullable. Definition: <code>decimal("residual_value", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L439`.
- `licenseKey` / `license_key` — text; nullable. Definition: <code>text("license_key")</code> Source: `shared/schema.ts:L442`.
- `usedSeats` / `used_seats` — integer; nullable. Definition: <code>integer("used_seats").default(0)</code> Source: `shared/schema.ts:L443`.
- `cloudProvider` / `cloud_provider` — text; nullable. Definition: <code>text("cloud_provider")</code> Source: `shared/schema.ts:L446`.
- `tenantAccountId` / `tenant_account_id` — text; nullable. Definition: <code>text("tenant_account_id")</code> Source: `shared/schema.ts:L447`.
- `billingCycle` / `billing_cycle` — text; nullable. Definition: <code>text("billing_cycle")</code> Source: `shared/schema.ts:L448`.
- `recurringCost` / `recurring_cost` — decimal; nullable. Definition: <code>decimal("recurring_cost", { precision: 12, scale: 2 })</code> Source: `shared/schema.ts:L449`.
- `autoRenewal` / `auto_renewal` — boolean; not null. Definition: <code>boolean("auto_renewal").notNull().default(false)</code> Source: `shared/schema.ts:L450`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("available")</code> Source: `shared/schema.ts:L453`.
- `nextMaintenanceDate` / `next_maintenance_date` — date; nullable. Definition: <code>date("next_maintenance_date")</code> Source: `shared/schema.ts:L454`.
- `lastMaintenanceDate` / `last_maintenance_date` — date; nullable. Definition: <code>date("last_maintenance_date")</code> Source: `shared/schema.ts:L455`.
**Declared column foreign keys:** `locationId` → `locations.id`; `departmentId` → `departments.id`; `primaryVendorId` → `vendors.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `software_license_allocations` — Drizzle export `softwareLicenseAllocations` — `shared/schema.ts:L459`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L460`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L461`.
- `employeeId` / `employee_id` — varchar; not null; FK → employees.id (ON DELETE RESTRICT). Definition: <code>varchar("employee_id").notNull().references(() =&gt; employees.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L462`.
- `allocatedAt` / `allocated_at` — timestamp; not null. Definition: <code>timestamp("allocated_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L463`.
- `releasedAt` / `released_at` — timestamp; nullable. Definition: <code>timestamp("released_at")</code> Source: `shared/schema.ts:L464`.
**Declared column foreign keys:** `assetId` → `assets.id` (ON DELETE CASCADE); `employeeId` → `employees.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- index: <code>index("software_license_allocations_asset_idx")</code>
- uniqueIndex: <code>uniqueIndex("software_license_allocations_active_employee_idx")</code>

#### `assignments` — Drizzle export `assignments` — `shared/schema.ts:L473`

**Columns (6):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L474`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id. Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id)</code> Source: `shared/schema.ts:L475`.
- `employeeId` / `employee_id` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("employee_id").references(() =&gt; employees.id, { onDelete: 'set null' })</code> Source: `shared/schema.ts:L476`.
- `assignedDate` / `assigned_date` — date; not null. Definition: <code>date("assigned_date").notNull()</code> Source: `shared/schema.ts:L477`.
- `returnedDate` / `returned_date` — date; nullable. Definition: <code>date("returned_date")</code> Source: `shared/schema.ts:L478`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L479`.
**Declared column foreign keys:** `assetId` → `assets.id`; `employeeId` → `employees.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_handovers` — Drizzle export `assetHandovers` — `shared/schema.ts:L482`

**Columns (15):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L483`.
- `handoverNumber` / `handover_number` — text; not null. Definition: <code>text("handover_number").notNull().unique()</code> Source: `shared/schema.ts:L484`.
- `type` / `type` — text; not null. Definition: <code>text("type").notNull()</code> Source: `shared/schema.ts:L485`.
- `employeeId` / `employee_id` — varchar; not null; FK → employees.id (ON DELETE RESTRICT). Definition: <code>varchar("employee_id").notNull().references(() =&gt; employees.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L486`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE RESTRICT). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L487`.
- `assignmentId` / `assignment_id` — varchar; not null; FK → assignments.id (ON DELETE RESTRICT). Definition: <code>varchar("assignment_id").notNull().references(() =&gt; assignments.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L488`.
- `issuedByUserId` / `issued_by_user_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("issued_by_user_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L489`.
- `handoverDate` / `handover_date` — date; not null. Definition: <code>date("handover_date").notNull()</code> Source: `shared/schema.ts:L490`.
- `condition` / `condition` — text; not null. Definition: <code>text("condition").notNull()</code> Source: `shared/schema.ts:L491`.
- `includedAccessories` / `included_accessories` — jsonb; not null. Definition: <code>jsonb("included_accessories").$type&lt;string[]&gt;().notNull().default(sql`'[]'::jsonb`)</code> Source: `shared/schema.ts:L492`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L493`.
- `acknowledged` / `acknowledged` — boolean; not null. Definition: <code>boolean("acknowledged").notNull().default(false)</code> Source: `shared/schema.ts:L494`.
- `acknowledgedAt` / `acknowledged_at` — timestamp; nullable. Definition: <code>timestamp("acknowledged_at")</code> Source: `shared/schema.ts:L495`.
- `signatureData` / `signature_data` — text; nullable. Definition: <code>text("signature_data")</code> Source: `shared/schema.ts:L496`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L497`.
**Declared column foreign keys:** `employeeId` → `employees.id` (ON DELETE RESTRICT); `assetId` → `assets.id` (ON DELETE RESTRICT); `assignmentId` → `assignments.id` (ON DELETE RESTRICT); `issuedByUserId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("asset_handovers_type_check", sql`${table.type} IN ('Issue / Assignment', 'Return / Offboarding', 'Replacement / Swap')`)</code>
- check: <code>check("asset_handovers_condition_check", sql`${table.condition} IN ('New', 'Excellent', 'Fair', 'Needs Repair')`)</code>
- check: <code>check("asset_handovers_accessories_array_check", sql`jsonb_typeof(${table.includedAccessories}) = 'array'`)</code>
- check: <code>check("asset_handovers_acknowledgement_check", sql`(${table.acknowledged} = false AND ${table.acknowledgedAt} IS NULL AND ${table.signatureData} IS NULL) OR (${table.acknowledged} = true AND ${table.acknowledgedAt} IS NOT NULL AND ${table.signatureData} IS NOT NULL)`)</code>
- index: <code>index("asset_handovers_employee_created_idx")</code>
- index: <code>index("asset_handovers_asset_created_idx")</code>
- index: <code>index("asset_handovers_assignment_idx")</code>

#### `vendors` — Drizzle export `vendors` — `shared/schema.ts:L509`

**Columns (103):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L510`.
- `code` / `code` — text; nullable. Definition: <code>text("code")</code> Source: `shared/schema.ts:L511`.
- `primaryContactName` / `primary_contact_name` — text; nullable. Definition: <code>text("primary_contact_name")</code> Source: `shared/schema.ts:L512`.
- `primaryContactEmail` / `primary_contact_email` — text; nullable. Definition: <code>text("primary_contact_email")</code> Source: `shared/schema.ts:L513`.
- `primaryContactPhone` / `primary_contact_phone` — text; nullable. Definition: <code>text("primary_contact_phone")</code> Source: `shared/schema.ts:L514`.
- `supportHotline` / `support_hotline` — text; nullable. Definition: <code>text("support_hotline")</code> Source: `shared/schema.ts:L515`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull().unique()</code> Source: `shared/schema.ts:L518`.
- `contactPerson` / `contact_person` — text; nullable. Definition: <code>text("contact_person")</code> Source: `shared/schema.ts:L519`.
- `email` / `email` — text; nullable. Definition: <code>text("email")</code> Source: `shared/schema.ts:L520`.
- `phone` / `phone` — text; nullable. Definition: <code>text("phone")</code> Source: `shared/schema.ts:L521`.
- `alternatePhone` / `alternate_phone` — text; nullable. Definition: <code>text("alternate_phone")</code> Source: `shared/schema.ts:L522`.
- `address` / `address` — text; nullable. Definition: <code>text("address")</code> Source: `shared/schema.ts:L523`.
- `city` / `city` — text; nullable. Definition: <code>text("city")</code> Source: `shared/schema.ts:L524`.
- `state` / `state` — text; nullable. Definition: <code>text("state")</code> Source: `shared/schema.ts:L525`.
- `zipCode` / `zip_code` — text; nullable. Definition: <code>text("zip_code")</code> Source: `shared/schema.ts:L526`.
- `country` / `country` — text; nullable. Definition: <code>text("country").default("USA")</code> Source: `shared/schema.ts:L527`.
- `website` / `website` — text; nullable. Definition: <code>text("website")</code> Source: `shared/schema.ts:L528`.
- `taxId` / `tax_id` — text; nullable. Definition: <code>text("tax_id")</code> Source: `shared/schema.ts:L529`.
- `technicalContactName` / `technical_contact_name` — text; nullable. Definition: <code>text("technical_contact_name")</code> Source: `shared/schema.ts:L532`.
- `technicalContactEmail` / `technical_contact_email` — text; nullable. Definition: <code>text("technical_contact_email")</code> Source: `shared/schema.ts:L533`.
- `technicalContactPhone` / `technical_contact_phone` — text; nullable. Definition: <code>text("technical_contact_phone")</code> Source: `shared/schema.ts:L534`.
- `supportContactName` / `support_contact_name` — text; nullable. Definition: <code>text("support_contact_name")</code> Source: `shared/schema.ts:L535`.
- `supportContactEmail` / `support_contact_email` — text; nullable. Definition: <code>text("support_contact_email")</code> Source: `shared/schema.ts:L536`.
- `supportContactPhone` / `support_contact_phone` — text; nullable. Definition: <code>text("support_contact_phone")</code> Source: `shared/schema.ts:L537`.
- `emergencyContactName` / `emergency_contact_name` — text; nullable. Definition: <code>text("emergency_contact_name")</code> Source: `shared/schema.ts:L538`.
- `emergencyContactEmail` / `emergency_contact_email` — text; nullable. Definition: <code>text("emergency_contact_email")</code> Source: `shared/schema.ts:L539`.
- `emergencyContactPhone` / `emergency_contact_phone` — text; nullable. Definition: <code>text("emergency_contact_phone")</code> Source: `shared/schema.ts:L540`.
- `vendorType` / `vendor_type` — text; nullable. Definition: <code>text("vendor_type")</code> Source: `shared/schema.ts:L543`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L544`.
- `vendorRiskRating` / `vendor_risk_rating` — text; nullable. Definition: <code>text("vendor_risk_rating")</code> Source: `shared/schema.ts:L545`.
- `businessCriticalityLevel` / `business_criticality_level` — text; nullable. Definition: <code>text("business_criticality_level")</code> Source: `shared/schema.ts:L546`.
- `dataAccessLevel` / `data_access_level` — text; nullable. Definition: <code>text("data_access_level")</code> Source: `shared/schema.ts:L547`.
- `geographicLocation` / `geographic_location` — text; nullable. Definition: <code>text("geographic_location")</code> Source: `shared/schema.ts:L548`.
- `vendorSecurityCertification` / `vendor_security_certification` — text; nullable. Definition: <code>text("vendor_security_certification")</code> Source: `shared/schema.ts:L551`.
- `securityAssessmentDate` / `security_assessment_date` — date; nullable. Definition: <code>date("security_assessment_date")</code> Source: `shared/schema.ts:L552`.
- `securityAssessmentStatus` / `security_assessment_status` — text; nullable. Definition: <code>text("security_assessment_status")</code> Source: `shared/schema.ts:L553`.
- `complianceStatus` / `compliance_status` — text; nullable. Definition: <code>text("compliance_status")</code> Source: `shared/schema.ts:L554`.
- `dataProcessingAgreement` / `data_processing_agreement` — boolean; nullable. Definition: <code>boolean("data_processing_agreement").default(false)</code> Source: `shared/schema.ts:L555`.
- `dpaSignedDate` / `dpa_signed_date` — date; nullable. Definition: <code>date("dpa_signed_date")</code> Source: `shared/schema.ts:L556`.
- `dpaExpiryDate` / `dpa_expiry_date` — date; nullable. Definition: <code>date("dpa_expiry_date")</code> Source: `shared/schema.ts:L557`.
- `cybersecurityInsurance` / `cybersecurity_insurance` — boolean; nullable. Definition: <code>boolean("cybersecurity_insurance").default(false)</code> Source: `shared/schema.ts:L558`.
- `backgroundCheckCompleted` / `background_check_completed` — boolean; nullable. Definition: <code>boolean("background_check_completed").default(false)</code> Source: `shared/schema.ts:L559`.
- `contractNumber` / `contract_number` — text; nullable. Definition: <code>text("contract_number")</code> Source: `shared/schema.ts:L562`.
- `contractType` / `contract_type` — text; nullable. Definition: <code>text("contract_type")</code> Source: `shared/schema.ts:L563`.
- `contractStartDate` / `contract_start_date` — date; nullable. Definition: <code>date("contract_start_date")</code> Source: `shared/schema.ts:L564`.
- `contractEndDate` / `contract_end_date` — date; nullable. Definition: <code>date("contract_end_date")</code> Source: `shared/schema.ts:L565`.
- `contractValue` / `contract_value` — decimal; nullable. Definition: <code>decimal("contract_value", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L566`.
- `paymentTerms` / `payment_terms` — text; nullable. Definition: <code>text("payment_terms").default("Net 30")</code> Source: `shared/schema.ts:L567`.
- `renewalTerms` / `renewal_terms` — text; nullable. Definition: <code>text("renewal_terms")</code> Source: `shared/schema.ts:L568`.
- `terminationClause` / `termination_clause` — text; nullable. Definition: <code>text("termination_clause")</code> Source: `shared/schema.ts:L569`.
- `contractOwner` / `contract_owner` — text; nullable. Definition: <code>text("contract_owner")</code> Source: `shared/schema.ts:L570`.
- `slaLevel` / `sla_level` — text; nullable. Definition: <code>text("sla_level")</code> Source: `shared/schema.ts:L573`.
- `uptimeRequirement` / `uptime_requirement` — text; nullable. Definition: <code>text("uptime_requirement")</code> Source: `shared/schema.ts:L574`.
- `responseTimeRequirement` / `response_time_requirement` — text; nullable. Definition: <code>text("response_time_requirement")</code> Source: `shared/schema.ts:L575`.
- `resolutionTimeRequirement` / `resolution_time_requirement` — text; nullable. Definition: <code>text("resolution_time_requirement")</code> Source: `shared/schema.ts:L576`.
- `penaltyClause` / `penalty_clause` — text; nullable. Definition: <code>text("penalty_clause")</code> Source: `shared/schema.ts:L577`.
- `supportHours` / `support_hours` — text; nullable. Definition: <code>text("support_hours")</code> Source: `shared/schema.ts:L578`.
- `supportLevel` / `support_level` — text; nullable. Definition: <code>text("support_level")</code> Source: `shared/schema.ts:L579`.
- `escalationProcess` / `escalation_process` — text; nullable. Definition: <code>text("escalation_process")</code> Source: `shared/schema.ts:L580`.
- `performanceRating` / `performance_rating` — decimal; nullable. Definition: <code>decimal("performance_rating", { precision: 3, scale: 2 })</code> Source: `shared/schema.ts:L583`.
- `rating` / `rating` — integer; nullable. Definition: <code>integer("rating").default(5)</code> Source: `shared/schema.ts:L584`.
- `lastPerformanceReview` / `last_performance_review` — date; nullable. Definition: <code>date("last_performance_review")</code> Source: `shared/schema.ts:L585`.
- `kpiMet` / `kpi_met` — boolean; nullable. Definition: <code>boolean("kpi_met")</code> Source: `shared/schema.ts:L586`.
- `issueResolutionRate` / `issue_resolution_rate` — decimal; nullable. Definition: <code>decimal("issue_resolution_rate", { precision: 5, scale: 2 })</code> Source: `shared/schema.ts:L587`.
- `customerSatisfactionScore` / `customer_satisfaction_score` — decimal; nullable. Definition: <code>decimal("customer_satisfaction_score", { precision: 3, scale: 2 })</code> Source: `shared/schema.ts:L588`.
- `subcontractorsUsed` / `subcontractors_used` — boolean; nullable. Definition: <code>boolean("subcontractors_used").default(false)</code> Source: `shared/schema.ts:L591`.
- `subcontractorDetails` / `subcontractor_details` — text; nullable. Definition: <code>text("subcontractor_details")</code> Source: `shared/schema.ts:L592`.
- `thirdPartyRiskAssessment` / `third_party_risk_assessment` — text; nullable. Definition: <code>text("third_party_risk_assessment")</code> Source: `shared/schema.ts:L593`.
- `supplyChainRisk` / `supply_chain_risk` — text; nullable. Definition: <code>text("supply_chain_risk")</code> Source: `shared/schema.ts:L594`.
- `geopoliticalRisk` / `geopolitical_risk` — text; nullable. Definition: <code>text("geopolitical_risk")</code> Source: `shared/schema.ts:L595`.
- `financialStability` / `financial_stability` — text; nullable. Definition: <code>text("financial_stability")</code> Source: `shared/schema.ts:L596`.
- `businessContinuityPlan` / `business_continuity_plan` — boolean; nullable. Definition: <code>boolean("business_continuity_plan").default(false)</code> Source: `shared/schema.ts:L597`.
- `disasterRecoveryPlan` / `disaster_recovery_plan` — boolean; nullable. Definition: <code>boolean("disaster_recovery_plan").default(false)</code> Source: `shared/schema.ts:L598`.
- `lastAuditDate` / `last_audit_date` — date; nullable. Definition: <code>date("last_audit_date")</code> Source: `shared/schema.ts:L601`.
- `nextAuditDate` / `next_audit_date` — date; nullable. Definition: <code>date("next_audit_date")</code> Source: `shared/schema.ts:L602`.
- `auditFindings` / `audit_findings` — text; nullable. Definition: <code>text("audit_findings")</code> Source: `shared/schema.ts:L603`.
- `correctionPlanStatus` / `correction_plan_status` — text; nullable. Definition: <code>text("correction_plan_status")</code> Source: `shared/schema.ts:L604`.
- `regulatoryRequirements` / `regulatory_requirements` — text; nullable. Definition: <code>text("regulatory_requirements")</code> Source: `shared/schema.ts:L605`.
- `industryStandards` / `industry_standards` — text; nullable. Definition: <code>text("industry_standards")</code> Source: `shared/schema.ts:L606`.
- `certificationExpiryDates` / `certification_expiry_dates` — text; nullable. Definition: <code>text("certification_expiry_dates")</code> Source: `shared/schema.ts:L607`.
- `preferredVendor` / `preferred_vendor` — boolean; nullable. Definition: <code>boolean("preferred_vendor").default(false)</code> Source: `shared/schema.ts:L610`.
- `volumeDiscounts` / `volume_discounts` — text; nullable. Definition: <code>text("volume_discounts")</code> Source: `shared/schema.ts:L611`.
- `currencyCode` / `currency_code` — text; nullable. Definition: <code>text("currency_code").default("USD")</code> Source: `shared/schema.ts:L612`.
- `bankingDetails` / `banking_details` — text; nullable. Definition: <code>text("banking_details")</code> Source: `shared/schema.ts:L613`.
- `creditRating` / `credit_rating` — text; nullable. Definition: <code>text("credit_rating")</code> Source: `shared/schema.ts:L614`.
- `insuranceCoverage` / `insurance_coverage` — text; nullable. Definition: <code>text("insurance_coverage")</code> Source: `shared/schema.ts:L615`.
- `bondingRequirement` / `bonding_requirement` — boolean; nullable. Definition: <code>boolean("bonding_requirement").default(false)</code> Source: `shared/schema.ts:L616`.
- `diversityClassification` / `diversity_classification` — text; nullable. Definition: <code>text("diversity_classification")</code> Source: `shared/schema.ts:L617`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("active")</code> Source: `shared/schema.ts:L620`.
- `isActive` / `is_active` — text; nullable. Definition: <code>text("is_active").default("true")</code> Source: `shared/schema.ts:L621`.
- `onboardingStatus` / `onboarding_status` — text; nullable. Definition: <code>text("onboarding_status")</code> Source: `shared/schema.ts:L622`.
- `offboardingDate` / `offboarding_date` — date; nullable. Definition: <code>date("offboarding_date")</code> Source: `shared/schema.ts:L623`.
- `onboardingDate` / `onboarding_date` — date; nullable. Definition: <code>date("onboarding_date")</code> Source: `shared/schema.ts:L624`.
- `lastContactDate` / `last_contact_date` — date; nullable. Definition: <code>date("last_contact_date")</code> Source: `shared/schema.ts:L625`.
- `nextReviewDate` / `next_review_date` — date; nullable. Definition: <code>date("next_review_date")</code> Source: `shared/schema.ts:L626`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L629`.
- `internalNotes` / `internal_notes` — text; nullable. Definition: <code>text("internal_notes")</code> Source: `shared/schema.ts:L630`.
- `documentationLinks` / `documentation_links` — text; nullable. Definition: <code>text("documentation_links")</code> Source: `shared/schema.ts:L631`.
- `attachments` / `attachments` — text; nullable. Definition: <code>text("attachments")</code> Source: `shared/schema.ts:L632`.
- `createdDate` / `created_date` — timestamp; nullable. Definition: <code>timestamp("created_date").defaultNow()</code> Source: `shared/schema.ts:L635`.
- `lastUpdatedDate` / `last_updated_date` — timestamp; nullable. Definition: <code>timestamp("last_updated_date").defaultNow()</code> Source: `shared/schema.ts:L636`.
- `createdBy` / `created_by` — text; nullable. Definition: <code>text("created_by")</code> Source: `shared/schema.ts:L637`.
- `lastUpdatedBy` / `last_updated_by` — text; nullable. Definition: <code>text("last_updated_by")</code> Source: `shared/schema.ts:L638`.
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("vendors_code_normalized_unique")</code>

#### `warehouse_locations` — Drizzle export `warehouseLocations` — `shared/schema.ts:L643`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L644`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L645`.
- `code` / `code` — text; not null. Definition: <code>text("code").notNull().unique()</code> Source: `shared/schema.ts:L646`.
- `site` / `site` — text; nullable. Definition: <code>text("site")</code> Source: `shared/schema.ts:L647`.
- `storageRoom` / `storage_room` — text; nullable. Definition: <code>text("storage_room")</code> Source: `shared/schema.ts:L648`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L649`.
- `isActive` / `is_active` — boolean; not null. Definition: <code>boolean("is_active").notNull().default(true)</code> Source: `shared/schema.ts:L650`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L651`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `consumables` — Drizzle export `consumables` — `shared/schema.ts:L654`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L655`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L656`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull().default("Other")</code> Source: `shared/schema.ts:L657`.
- `modelPartNumber` / `model_part_number` — text; nullable. Definition: <code>text("model_part_number")</code> Source: `shared/schema.ts:L658`.
- `quantityInStock` / `quantity_in_stock` — integer; not null. Definition: <code>integer("quantity_in_stock").notNull().default(0)</code> Source: `shared/schema.ts:L659`.
- `minReorderLevel` / `min_reorder_level` — integer; not null. Definition: <code>integer("min_reorder_level").notNull().default(0)</code> Source: `shared/schema.ts:L660`.
- `warehouseLocationId` / `warehouse_location_id` — varchar; not null; FK → warehouse_locations.id. Definition: <code>varchar("warehouse_location_id").notNull().references(() =&gt; warehouseLocations.id)</code> Source: `shared/schema.ts:L661`.
- `storageRoom` / `storage_room` — text; nullable. Definition: <code>text("storage_room")</code> Source: `shared/schema.ts:L662`.
- `unitCost` / `unit_cost` — decimal; not null. Definition: <code>decimal("unit_cost", { precision: 12, scale: 2 }).notNull().default("0.00")</code> Source: `shared/schema.ts:L663`.
- `vendorId` / `vendor_id` — varchar; nullable; FK → vendors.id (ON DELETE SET NULL). Definition: <code>varchar("vendor_id").references(() =&gt; vendors.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L664`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L665`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L666`.
**Declared column foreign keys:** `warehouseLocationId` → `warehouse_locations.id`; `vendorId` → `vendors.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("consumables_location_idx")</code>
- index: <code>index("consumables_category_idx")</code>

#### `consumable_stock_movements` — Drizzle export `consumableStockMovements` — `shared/schema.ts:L672`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L673`.
- `consumableId` / `consumable_id` — varchar; not null; FK → consumables.id. Definition: <code>varchar("consumable_id").notNull().references(() =&gt; consumables.id)</code> Source: `shared/schema.ts:L674`.
- `movementType` / `movement_type` — text; not null. Definition: <code>text("movement_type").notNull()</code> Source: `shared/schema.ts:L675`.
- `quantity` / `quantity` — integer; not null. Definition: <code>integer("quantity").notNull()</code> Source: `shared/schema.ts:L676`.
- `fromWarehouseLocationId` / `from_warehouse_location_id` — varchar; nullable; FK → warehouse_locations.id. Definition: <code>varchar("from_warehouse_location_id").references(() =&gt; warehouseLocations.id)</code> Source: `shared/schema.ts:L677`.
- `toWarehouseLocationId` / `to_warehouse_location_id` — varchar; nullable; FK → warehouse_locations.id. Definition: <code>varchar("to_warehouse_location_id").references(() =&gt; warehouseLocations.id)</code> Source: `shared/schema.ts:L678`.
- `recipientUserId` / `recipient_user_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("recipient_user_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L679`.
- `actorId` / `actor_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("actor_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L680`.
- `serviceRequestId` / `service_request_id` — varchar; nullable; FK → service_requests.id (ON DELETE SET NULL). Definition: <code>varchar("service_request_id").references(() =&gt; serviceRequests.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L681`.
- `purchaseOrderId` / `purchase_order_id` — varchar; nullable; FK → purchase_orders.id (ON DELETE SET NULL). Definition: <code>varchar("purchase_order_id").references(() =&gt; purchaseOrders.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L682`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L683`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L684`.
**Declared column foreign keys:** `consumableId` → `consumables.id`; `fromWarehouseLocationId` → `warehouse_locations.id`; `toWarehouseLocationId` → `warehouse_locations.id`; `recipientUserId` → `users.id` (ON DELETE SET NULL); `actorId` → `users.id` (ON DELETE SET NULL); `serviceRequestId` → `service_requests.id` (ON DELETE SET NULL); `purchaseOrderId` → `purchase_orders.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("consumable_stock_movements_item_idx")</code>

#### `consumable_dispatch_log` — Drizzle export `consumableDispatchLog` — `shared/schema.ts:L687`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L688`.
- `consumableId` / `consumable_id` — varchar; not null; FK → consumables.id. Definition: <code>varchar("consumable_id").notNull().references(() =&gt; consumables.id)</code> Source: `shared/schema.ts:L689`.
- `warehouseLocationId` / `warehouse_location_id` — varchar; not null; FK → warehouse_locations.id. Definition: <code>varchar("warehouse_location_id").notNull().references(() =&gt; warehouseLocations.id)</code> Source: `shared/schema.ts:L690`.
- `serviceRequestId` / `service_request_id` — varchar; not null; FK → service_requests.id. Definition: <code>varchar("service_request_id").notNull().references(() =&gt; serviceRequests.id)</code> Source: `shared/schema.ts:L691`.
- `serviceRequestNumber` / `service_request_number` — text; not null. Definition: <code>text("service_request_number").notNull()</code> Source: `shared/schema.ts:L692`.
- `requesterId` / `requester_id` — varchar; not null; FK → users.id. Definition: <code>varchar("requester_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L693`.
- `agentId` / `agent_id` — varchar; not null; FK → users.id. Definition: <code>varchar("agent_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L694`.
- `quantity` / `quantity` — integer; not null. Definition: <code>integer("quantity").notNull()</code> Source: `shared/schema.ts:L695`.
- `dispatchedAt` / `dispatched_at` — timestamp; not null. Definition: <code>timestamp("dispatched_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L696`.
**Declared column foreign keys:** `consumableId` → `consumables.id`; `warehouseLocationId` → `warehouse_locations.id`; `serviceRequestId` → `service_requests.id`; `requesterId` → `users.id`; `agentId` → `users.id`
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("consumable_dispatch_request_unique")</code>
- index: <code>index("consumable_dispatch_log_item_idx")</code>

#### `purchase_orders` — Drizzle export `purchaseOrders` — `shared/schema.ts:L703`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L704`.
- `poNumber` / `po_number` — text; not null. Definition: <code>text("po_number").notNull().unique()</code> Source: `shared/schema.ts:L705`.
- `vendorId` / `vendor_id` — varchar; nullable; FK → vendors.id. Definition: <code>varchar("vendor_id").references(() =&gt; vendors.id)</code> Source: `shared/schema.ts:L706`.
- `vendor` / `vendor` — text; nullable. Definition: <code>text("vendor")</code> Source: `shared/schema.ts:L707`.
- `reference` / `reference` — text; nullable. Definition: <code>text("reference")</code> Source: `shared/schema.ts:L708`.
- `orderDate` / `order_date` — date; not null. Definition: <code>date("order_date").notNull()</code> Source: `shared/schema.ts:L709`.
- `expectedDelivery` / `expected_delivery` — date; nullable. Definition: <code>date("expected_delivery")</code> Source: `shared/schema.ts:L710`.
- `actualDelivery` / `actual_delivery` — date; nullable. Definition: <code>date("actual_delivery")</code> Source: `shared/schema.ts:L711`.
- `totalAmount` / `total_amount` — decimal; not null. Definition: <code>decimal("total_amount", { precision: 12, scale: 2 }).notNull()</code> Source: `shared/schema.ts:L712`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("pending")</code> Source: `shared/schema.ts:L713`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id. Definition: <code>varchar("department_id").references(() =&gt; departments.id)</code> Source: `shared/schema.ts:L714`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L715`.
- `assetsCreated` / `assets_created` — boolean; not null. Definition: <code>boolean("assets_created").notNull().default(false)</code> Source: `shared/schema.ts:L716`.
**Declared column foreign keys:** `vendorId` → `vendors.id`; `departmentId` → `departments.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `purchase_order_items` — Drizzle export `purchaseOrderItems` — `shared/schema.ts:L719`

**Columns (14):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L720`.
- `purchaseOrderId` / `purchase_order_id` — varchar; not null; FK → purchase_orders.id. Definition: <code>varchar("purchase_order_id").notNull().references(() =&gt; purchaseOrders.id)</code> Source: `shared/schema.ts:L721`.
- `assetId` / `asset_id` — varchar; nullable; FK → assets.id. Definition: <code>varchar("asset_id").references(() =&gt; assets.id)</code> Source: `shared/schema.ts:L722`.
- `description` / `description` — text; not null. Definition: <code>text("description").notNull()</code> Source: `shared/schema.ts:L723`.
- `assetType` / `asset_type` — text; nullable. Definition: <code>text("asset_type").default("other")</code> Source: `shared/schema.ts:L724`.
- `itemType` / `item_type` — text; not null. Definition: <code>text("item_type").notNull().default("asset")</code> Source: `shared/schema.ts:L725`.
- `consumableId` / `consumable_id` — varchar; nullable; FK → consumables.id (ON DELETE SET NULL). Definition: <code>varchar("consumable_id").references(() =&gt; consumables.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L726`.
- `consumableCategory` / `consumable_category` — text; nullable. Definition: <code>text("consumable_category")</code> Source: `shared/schema.ts:L727`.
- `modelPartNumber` / `model_part_number` — text; nullable. Definition: <code>text("model_part_number")</code> Source: `shared/schema.ts:L728`.
- `warehouseLocationId` / `warehouse_location_id` — varchar; nullable; FK → warehouse_locations.id (ON DELETE SET NULL). Definition: <code>varchar("warehouse_location_id").references(() =&gt; warehouseLocations.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L729`.
- `serialNumber` / `serial_number` — text; nullable. Definition: <code>text("serial_number")</code> Source: `shared/schema.ts:L730`.
- `quantity` / `quantity` — integer; not null. Definition: <code>integer("quantity").notNull().default(1)</code> Source: `shared/schema.ts:L731`.
- `unitPrice` / `unit_price` — decimal; not null. Definition: <code>decimal("unit_price", { precision: 10, scale: 2 }).notNull()</code> Source: `shared/schema.ts:L732`.
- `totalPrice` / `total_price` — decimal; not null. Definition: <code>decimal("total_price", { precision: 10, scale: 2 }).notNull()</code> Source: `shared/schema.ts:L733`.
**Declared column foreign keys:** `purchaseOrderId` → `purchase_orders.id`; `assetId` → `assets.id`; `consumableId` → `consumables.id` (ON DELETE SET NULL); `warehouseLocationId` → `warehouse_locations.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `purchase_order_item_receipts` — Drizzle export `purchaseOrderItemReceipts` — `shared/schema.ts:L736`

**Columns (4):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L737`.
- `purchaseOrderId` / `purchase_order_id` — varchar; not null; FK → purchase_orders.id. Definition: <code>varchar("purchase_order_id").notNull().references(() =&gt; purchaseOrders.id)</code> Source: `shared/schema.ts:L738`.
- `purchaseOrderItemId` / `purchase_order_item_id` — varchar; not null; FK → purchase_order_items.id. Definition: <code>varchar("purchase_order_item_id").notNull().unique().references(() =&gt; purchaseOrderItems.id)</code> Source: `shared/schema.ts:L739`.
- `processedAt` / `processed_at` — timestamp; not null. Definition: <code>timestamp("processed_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L740`.
**Declared column foreign keys:** `purchaseOrderId` → `purchase_orders.id`; `purchaseOrderItemId` → `purchase_order_items.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `budgets` — Drizzle export `budgets` — `shared/schema.ts:L743`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L744`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L745`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id. Definition: <code>varchar("department_id").references(() =&gt; departments.id)</code> Source: `shared/schema.ts:L746`.
- `locationId` / `location_id` — varchar; nullable; FK → locations.id. Definition: <code>varchar("location_id").references(() =&gt; locations.id)</code> Source: `shared/schema.ts:L747`.
- `fiscalYear` / `fiscal_year` — integer; not null. Definition: <code>integer("fiscal_year").notNull()</code> Source: `shared/schema.ts:L748`.
- `budgetAmount` / `budget_amount` — decimal; not null. Definition: <code>decimal("budget_amount", { precision: 15, scale: 2 }).notNull()</code> Source: `shared/schema.ts:L749`.
- `spentAmount` / `spent_amount` — decimal; nullable. Definition: <code>decimal("spent_amount", { precision: 15, scale: 2 }).default("0.00")</code> Source: `shared/schema.ts:L750`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L751`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L752`.
**Declared column foreign keys:** `departmentId` → `departments.id`; `locationId` → `locations.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `maintenance_schedules` — Drizzle export `maintenanceSchedules` — `shared/schema.ts:L756`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L757`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id. Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id)</code> Source: `shared/schema.ts:L758`.
- `maintenanceType` / `maintenance_type` — text; not null. Definition: <code>text("maintenance_type").notNull()</code> Source: `shared/schema.ts:L759`.
- `frequency` / `frequency` — text; not null. Definition: <code>text("frequency").notNull()</code> Source: `shared/schema.ts:L760`.
- `nextDue` / `next_due` — date; not null. Definition: <code>date("next_due").notNull()</code> Source: `shared/schema.ts:L761`.
- `estimatedCost` / `estimated_cost` — decimal; nullable. Definition: <code>decimal("estimated_cost", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L762`.
- `priority` / `priority` — text; nullable. Definition: <code>text("priority").default("medium")</code> Source: `shared/schema.ts:L763`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L764`.
- `isActive` / `is_active` — text; nullable. Definition: <code>text("is_active").default("true")</code> Source: `shared/schema.ts:L765`.
**Declared column foreign keys:** `assetId` → `assets.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `maintenance_records` — Drizzle export `maintenanceRecords` — `shared/schema.ts:L768`

**Columns (15):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L769`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id. Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id)</code> Source: `shared/schema.ts:L770`.
- `scheduleId` / `schedule_id` — varchar; nullable; FK → maintenance_schedules.id. Definition: <code>varchar("schedule_id").references(() =&gt; maintenanceSchedules.id)</code> Source: `shared/schema.ts:L771`.
- `maintenanceDate` / `maintenance_date` — date; not null. Definition: <code>date("maintenance_date").notNull()</code> Source: `shared/schema.ts:L772`.
- `maintenanceType` / `maintenance_type` — text; not null. Definition: <code>text("maintenance_type").notNull()</code> Source: `shared/schema.ts:L773`.
- `performedBy` / `performed_by` — text; not null. Definition: <code>text("performed_by").notNull()</code> Source: `shared/schema.ts:L774`.
- `cost` / `cost` — decimal; nullable. Definition: <code>decimal("cost", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L775`.
- `estimatedCost` / `estimated_cost` — decimal; nullable. Definition: <code>decimal("estimated_cost", { precision: 10, scale: 2 })</code> Source: `shared/schema.ts:L776`.
- `scheduledDate` / `scheduled_date` — date; nullable. Definition: <code>date("scheduled_date")</code> Source: `shared/schema.ts:L777`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L778`.
- `workPerformed` / `work_performed` — text; nullable. Definition: <code>text("work_performed")</code> Source: `shared/schema.ts:L779`.
- `partsReplaced` / `parts_replaced` — text; nullable. Definition: <code>text("parts_replaced")</code> Source: `shared/schema.ts:L780`.
- `nextMaintenanceDate` / `next_maintenance_date` — date; nullable. Definition: <code>date("next_maintenance_date")</code> Source: `shared/schema.ts:L781`.
- `condition` / `condition` — text; nullable. Definition: <code>text("condition")</code> Source: `shared/schema.ts:L782`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L783`.
**Declared column foreign keys:** `assetId` → `assets.id`; `scheduleId` → `maintenance_schedules.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `contracts` — Drizzle export `contracts` — `shared/schema.ts:L1213`

**Columns (19):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1214`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L1215`.
- `contractNumber` / `contract_number` — text; nullable. Definition: <code>text("contract_number")</code> Source: `shared/schema.ts:L1216`.
- `contractType` / `contract_type` — text; nullable. Definition: <code>text("contract_type").default("service")</code> Source: `shared/schema.ts:L1217`.
- `vendorId` / `vendor_id` — varchar; nullable; FK → vendors.id (ON DELETE SET NULL). Definition: <code>varchar("vendor_id").references(() =&gt; vendors.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1218`.
- `assetId` / `asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1219`.
- `startDate` / `start_date` — date; nullable. Definition: <code>date("start_date")</code> Source: `shared/schema.ts:L1220`.
- `endDate` / `end_date` — date; nullable. Definition: <code>date("end_date")</code> Source: `shared/schema.ts:L1221`.
- `renewalDate` / `renewal_date` — date; nullable. Definition: <code>date("renewal_date")</code> Source: `shared/schema.ts:L1222`.
- `value` / `value` — decimal; nullable. Definition: <code>decimal("value", { precision: 15, scale: 2 })</code> Source: `shared/schema.ts:L1223`.
- `currency` / `currency` — text; not null. Definition: <code>text("currency").notNull().default("USD")</code> Source: `shared/schema.ts:L1224`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("active")</code> Source: `shared/schema.ts:L1225`.
- `ownerId` / `owner_id` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1226`.
- `renewalTerms` / `renewal_terms` — text; nullable. Definition: <code>text("renewal_terms")</code> Source: `shared/schema.ts:L1227`.
- `terminationClause` / `termination_clause` — text; nullable. Definition: <code>text("termination_clause")</code> Source: `shared/schema.ts:L1228`.
- `documentUrl` / `document_url` — text; nullable. Definition: <code>text("document_url")</code> Source: `shared/schema.ts:L1229`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1230`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1231`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1232`.
**Declared column foreign keys:** `vendorId` → `vendors.id` (ON DELETE SET NULL); `assetId` → `assets.id` (ON DELETE SET NULL); `ownerId` → `employees.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `vendor_contracts` — Drizzle export `vendorContracts` — `shared/schema.ts:L1236`

**Columns (14):**
- `id` / `id` — varchar; primary key; FK → contracts.id (ON DELETE RESTRICT). Definition: <code>varchar("id").primaryKey().references(() =&gt; contracts.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1237`.
- `vendorId` / `vendor_id` — varchar; not null; FK → vendors.id (ON DELETE RESTRICT). Definition: <code>varchar("vendor_id").notNull().references(() =&gt; vendors.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1238`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L1239`.
- `contractNumber` / `contract_number` — text; not null. Definition: <code>text("contract_number").notNull()</code> Source: `shared/schema.ts:L1240`.
- `contractType` / `contract_type` — text; not null. Definition: <code>text("contract_type").notNull()</code> Source: `shared/schema.ts:L1241`.
- `startDate` / `start_date` — date; not null. Definition: <code>date("start_date").notNull()</code> Source: `shared/schema.ts:L1242`.
- `endDate` / `end_date` — date; not null. Definition: <code>date("end_date").notNull()</code> Source: `shared/schema.ts:L1243`.
- `renewalNoticeDays` / `renewal_notice_days` — integer; not null. Definition: <code>integer("renewal_notice_days").notNull().default(30)</code> Source: `shared/schema.ts:L1244`.
- `cost` / `cost` — decimal; not null. Definition: <code>decimal("cost", { precision: 15, scale: 2 }).notNull().default("0")</code> Source: `shared/schema.ts:L1245`.
- `currency` / `currency` — text; not null. Definition: <code>text("currency").notNull().default("USD")</code> Source: `shared/schema.ts:L1246`.
- `slaTier` / `sla_tier` — text; nullable. Definition: <code>text("sla_tier")</code> Source: `shared/schema.ts:L1247`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("Active")</code> Source: `shared/schema.ts:L1248`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L1249`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L1250`.
**Declared column foreign keys:** `id` → `contracts.id` (ON DELETE RESTRICT); `vendorId` → `vendors.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("vendor_contracts_number_unique")</code>
- index: <code>index("vendor_contracts_vendor_idx")</code>
- index: <code>index("vendor_contracts_end_date_idx")</code>
- check: <code>check("vendor_contracts_dates_check", sql`${table.endDate} &gt;= ${table.startDate}`)</code>
- check: <code>check("vendor_contracts_cost_check", sql`${table.cost} &gt;= 0`)</code>
- check: <code>check("vendor_contracts_notice_check", sql`${table.renewalNoticeDays} BETWEEN 0 AND 3650`)</code>
- check: <code>check("vendor_contracts_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`)</code>
- check: <code>check("vendor_contracts_status_check", sql`${table.status} IN ('Active', 'Expiring Soon', 'Expired', 'Terminated')`)</code>

#### `vendor_contract_assets` — Drizzle export `vendorContractAssets` — `shared/schema.ts:L1261`

**Columns (3):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1262`.
- `contractId` / `contract_id` — varchar; not null; FK → vendor_contracts.id (ON DELETE CASCADE). Definition: <code>varchar("contract_id").notNull().references(() =&gt; vendorContracts.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1263`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE RESTRICT). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1264`.
**Declared column foreign keys:** `contractId` → `vendor_contracts.id` (ON DELETE CASCADE); `assetId` → `assets.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("vendor_contract_assets_unique")</code>

#### `vendor_contract_purchase_orders` — Drizzle export `vendorContractPurchaseOrders` — `shared/schema.ts:L1266`

**Columns (3):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1267`.
- `contractId` / `contract_id` — varchar; not null; FK → vendor_contracts.id (ON DELETE CASCADE). Definition: <code>varchar("contract_id").notNull().references(() =&gt; vendorContracts.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1268`.
- `purchaseOrderId` / `purchase_order_id` — varchar; not null; FK → purchase_orders.id (ON DELETE RESTRICT). Definition: <code>varchar("purchase_order_id").notNull().references(() =&gt; purchaseOrders.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1269`.
**Declared column foreign keys:** `contractId` → `vendor_contracts.id` (ON DELETE CASCADE); `purchaseOrderId` → `purchase_orders.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("vendor_contract_purchase_orders_unique")</code>

#### `vendor_contract_servers` — Drizzle export `vendorContractServers` — `shared/schema.ts:L1271`

**Columns (3):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1272`.
- `contractId` / `contract_id` — varchar; not null; FK → vendor_contracts.id (ON DELETE CASCADE). Definition: <code>varchar("contract_id").notNull().references(() =&gt; vendorContracts.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1273`.
- `serverId` / `server_id` — varchar; not null; FK → servers.id (ON DELETE RESTRICT). Definition: <code>varchar("server_id").notNull().references(() =&gt; servers.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1274`.
**Declared column foreign keys:** `contractId` → `vendor_contracts.id` (ON DELETE CASCADE); `serverId` → `servers.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("vendor_contract_servers_unique")</code>

#### `asset_bookings` — Drizzle export `assetBookings` — `shared/schema.ts:L1277`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1278`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1279`.
- `requestedBy` / `requested_by` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("requested_by").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1280`.
- `startDate` / `start_date` — date; not null. Definition: <code>date("start_date").notNull()</code> Source: `shared/schema.ts:L1281`.
- `endDate` / `end_date` — date; not null. Definition: <code>date("end_date").notNull()</code> Source: `shared/schema.ts:L1282`.
- `purpose` / `purpose` — text; nullable. Definition: <code>text("purpose")</code> Source: `shared/schema.ts:L1283`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("pending")</code> Source: `shared/schema.ts:L1284`.
- `approvedBy` / `approved_by` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("approved_by").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1285`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1286`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1287`.
**Declared column foreign keys:** `assetId` → `assets.id` (ON DELETE CASCADE); `requestedBy` → `employees.id` (ON DELETE SET NULL); `approvedBy` → `employees.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_disposal_records` — Drizzle export `assetDisposalRecords` — `shared/schema.ts:L1290`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1291`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE RESTRICT). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1292`.
- `disposalDate` / `disposal_date` — date; not null. Definition: <code>date("disposal_date").notNull()</code> Source: `shared/schema.ts:L1293`.
- `disposalMethod` / `disposal_method` — text; not null. Definition: <code>text("disposal_method").notNull()</code> Source: `shared/schema.ts:L1294`.
- `reason` / `reason` — text; nullable. Definition: <code>text("reason")</code> Source: `shared/schema.ts:L1295`.
- `approvedBy` / `approved_by` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("approved_by").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1296`.
- `dataDestructionConfirmed` / `data_destruction_confirmed` — boolean; nullable. Definition: <code>boolean("data_destruction_confirmed").default(false)</code> Source: `shared/schema.ts:L1297`.
- `dataDestructionMethod` / `data_destruction_method` — text; nullable. Definition: <code>text("data_destruction_method")</code> Source: `shared/schema.ts:L1298`.
- `certificateNumber` / `certificate_number` — text; nullable. Definition: <code>text("certificate_number")</code> Source: `shared/schema.ts:L1299`.
- `proceedsAmount` / `proceeds_amount` — decimal; nullable. Definition: <code>decimal("proceeds_amount", { precision: 12, scale: 2 })</code> Source: `shared/schema.ts:L1300`.
- `disposedBy` / `disposed_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("disposed_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1301`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1302`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1303`.
**Declared column foreign keys:** `assetId` → `assets.id` (ON DELETE RESTRICT); `approvedBy` → `employees.id` (ON DELETE SET NULL); `disposedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_audit_sessions` — Drizzle export `assetAuditSessions` — `shared/schema.ts:L1306`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1307`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L1308`.
- `startDate` / `start_date` — date; not null. Definition: <code>date("start_date").notNull()</code> Source: `shared/schema.ts:L1309`.
- `endDate` / `end_date` — date; nullable. Definition: <code>date("end_date")</code> Source: `shared/schema.ts:L1310`.
- `conductedBy` / `conducted_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("conducted_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1311`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("draft")</code> Source: `shared/schema.ts:L1312`.
- `locationId` / `location_id` — varchar; nullable; FK → locations.id (ON DELETE SET NULL). Definition: <code>varchar("location_id").references(() =&gt; locations.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1313`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id (ON DELETE SET NULL). Definition: <code>varchar("department_id").references(() =&gt; departments.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1314`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1315`.
- `totalAssets` / `total_assets` — integer; nullable. Definition: <code>integer("total_assets").default(0)</code> Source: `shared/schema.ts:L1316`.
- `verifiedCount` / `verified_count` — integer; nullable. Definition: <code>integer("verified_count").default(0)</code> Source: `shared/schema.ts:L1317`.
- `missingCount` / `missing_count` — integer; nullable. Definition: <code>integer("missing_count").default(0)</code> Source: `shared/schema.ts:L1318`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1319`.
**Declared column foreign keys:** `conductedBy` → `users.id` (ON DELETE SET NULL); `locationId` → `locations.id` (ON DELETE SET NULL); `departmentId` → `departments.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_audit_items` — Drizzle export `assetAuditItems` — `shared/schema.ts:L1322`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1323`.
- `sessionId` / `session_id` — varchar; not null; FK → asset_audit_sessions.id (ON DELETE CASCADE). Definition: <code>varchar("session_id").notNull().references(() =&gt; assetAuditSessions.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1324`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE RESTRICT). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1325`.
- `expectedLocation` / `expected_location` — text; nullable. Definition: <code>text("expected_location")</code> Source: `shared/schema.ts:L1326`.
- `actualLocation` / `actual_location` — text; nullable. Definition: <code>text("actual_location")</code> Source: `shared/schema.ts:L1327`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("pending")</code> Source: `shared/schema.ts:L1328`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1329`.
- `verifiedAt` / `verified_at` — timestamp; nullable. Definition: <code>timestamp("verified_at")</code> Source: `shared/schema.ts:L1330`.
- `verifiedBy` / `verified_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("verified_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1331`.
**Declared column foreign keys:** `sessionId` → `asset_audit_sessions.id` (ON DELETE CASCADE); `assetId` → `assets.id` (ON DELETE RESTRICT); `verifiedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_relationships` — Drizzle export `assetRelationships` — `shared/schema.ts:L1334`

**Columns (6):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1335`.
- `parentAssetId` / `parent_asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("parent_asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1336`.
- `childAssetId` / `child_asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("child_asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1337`.
- `relationshipType` / `relationship_type` — text; not null. Definition: <code>text("relationship_type").notNull().default("connected-to")</code> Source: `shared/schema.ts:L1338`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1339`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1340`.
**Declared column foreign keys:** `parentAssetId` → `assets.id` (ON DELETE CASCADE); `childAssetId` → `assets.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_requests` — Drizzle export `assetRequests` — `shared/schema.ts:L1343`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1344`.
- `requestedBy` / `requested_by` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("requested_by").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1345`.
- `assetType` / `asset_type` — text; not null. Definition: <code>text("asset_type").notNull()</code> Source: `shared/schema.ts:L1346`.
- `assetCategory` / `asset_category` — text; nullable. Definition: <code>text("asset_category")</code> Source: `shared/schema.ts:L1347`.
- `justification` / `justification` — text; not null. Definition: <code>text("justification").notNull()</code> Source: `shared/schema.ts:L1348`.
- `priority` / `priority` — text; nullable. Definition: <code>text("priority").default("medium")</code> Source: `shared/schema.ts:L1349`.
- `status` / `status` — text; nullable. Definition: <code>text("status").default("pending")</code> Source: `shared/schema.ts:L1350`.
- `reviewedBy` / `reviewed_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("reviewed_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1351`.
- `reviewedAt` / `reviewed_at` — timestamp; nullable. Definition: <code>timestamp("reviewed_at")</code> Source: `shared/schema.ts:L1352`.
- `reviewNotes` / `review_notes` — text; nullable. Definition: <code>text("review_notes")</code> Source: `shared/schema.ts:L1353`.
- `assignedAssetId` / `assigned_asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1354`.
- `neededByDate` / `needed_by_date` — date; nullable. Definition: <code>date("needed_by_date")</code> Source: `shared/schema.ts:L1355`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1356`.
**Declared column foreign keys:** `requestedBy` → `employees.id` (ON DELETE SET NULL); `reviewedBy` → `users.id` (ON DELETE SET NULL); `assignedAssetId` → `assets.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `asset_attachments` — Drizzle export `assetAttachments` — `shared/schema.ts:L1359`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1360`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1361`.
- `fileName` / `file_name` — text; not null. Definition: <code>text("file_name").notNull()</code> Source: `shared/schema.ts:L1362`.
- `originalName` / `original_name` — text; not null. Definition: <code>text("original_name").notNull()</code> Source: `shared/schema.ts:L1363`.
- `fileType` / `file_type` — text; nullable. Definition: <code>text("file_type")</code> Source: `shared/schema.ts:L1364`.
- `fileSize` / `file_size` — integer; nullable. Definition: <code>integer("file_size")</code> Source: `shared/schema.ts:L1365`.
- `filePath` / `file_path` — text; not null. Definition: <code>text("file_path").notNull()</code> Source: `shared/schema.ts:L1366`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L1367`.
- `uploadedBy` / `uploaded_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("uploaded_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1368`.
- `uploadedAt` / `uploaded_at` — timestamp; nullable. Definition: <code>timestamp("uploaded_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1369`.
**Declared column foreign keys:** `assetId` → `assets.id` (ON DELETE CASCADE); `uploadedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

### 5.4 CMDB, infrastructure and compliance (13 tables)

#### `cmdb_applications` — Drizzle export `cmdbApplications` — `shared/schema.ts:L906`

**Columns (11):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L907`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L908`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L909`.
- `vendor` / `vendor` — text; nullable. Definition: <code>text("vendor")</code> Source: `shared/schema.ts:L910`.
- `businessOwner` / `business_owner` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("business_owner").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L911`.
- `technicalOwner` / `technical_owner` — varchar; nullable; FK → employees.id (ON DELETE SET NULL). Definition: <code>varchar("technical_owner").references(() =&gt; employees.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L912`.
- `hostingType` / `hosting_type` — text; not null. Definition: <code>text("hosting_type").notNull()</code> Source: `shared/schema.ts:L913`.
- `criticalityRating` / `criticality_rating` — text; not null. Definition: <code>text("criticality_rating").notNull().default("P3")</code> Source: `shared/schema.ts:L914`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("active")</code> Source: `shared/schema.ts:L915`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L916`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L917`.
**Declared column foreign keys:** `businessOwner` → `employees.id` (ON DELETE SET NULL); `technicalOwner` → `employees.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("cmdb_applications_name_ci_unique")</code>
- index: <code>index("cmdb_applications_category_status_idx")</code>

#### `servers` — Drizzle export `servers` — `shared/schema.ts:L924`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L925`.
- `hostname` / `hostname` — text; not null. Definition: <code>text("hostname").notNull()</code> Source: `shared/schema.ts:L926`.
- `ipAddress` / `ip_address` — text; nullable. Definition: <code>text("ip_address")</code> Source: `shared/schema.ts:L927`.
- `osPlatform` / `os_platform` — text; not null. Definition: <code>text("os_platform").notNull()</code> Source: `shared/schema.ts:L928`.
- `environment` / `environment` — text; not null. Definition: <code>text("environment").notNull()</code> Source: `shared/schema.ts:L929`.
- `cpuRamSpecs` / `cpu_ram_specs` — text; nullable. Definition: <code>text("cpu_ram_specs")</code> Source: `shared/schema.ts:L930`.
- `location` / `location` — text; nullable. Definition: <code>text("location")</code> Source: `shared/schema.ts:L931`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("online")</code> Source: `shared/schema.ts:L932`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L933`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L934`.
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("servers_hostname_ci_unique")</code>
- index: <code>index("servers_environment_status_idx")</code>

#### `application_server_links` — Drizzle export `applicationServerLinks` — `shared/schema.ts:L941`

**Columns (4):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L942`.
- `applicationId` / `application_id` — varchar; not null; FK → cmdb_applications.id (ON DELETE CASCADE). Definition: <code>varchar("application_id").notNull().references(() =&gt; cmdbApplications.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L943`.
- `serverId` / `server_id` — varchar; not null; FK → servers.id (ON DELETE CASCADE). Definition: <code>varchar("server_id").notNull().references(() =&gt; servers.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L944`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L945`.
**Declared column foreign keys:** `applicationId` → `cmdb_applications.id` (ON DELETE CASCADE); `serverId` → `servers.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("application_server_links_pair_unique")</code>
- index: <code>index("application_server_links_server_idx")</code>
- index: <code>index("application_server_links_application_idx")</code>

#### `network_zones` — Drizzle export `networkZones` — `shared/schema.ts:L954`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L955`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L956`.
- `code` / `code` — text; not null. Definition: <code>text("code").notNull()</code> Source: `shared/schema.ts:L957`.
- `cidr` / `cidr` — text; nullable. Definition: <code>text("cidr")</code> Source: `shared/schema.ts:L958`.
- `securityLevel` / `security_level` — text; not null. Definition: <code>text("security_level").notNull().default("internal")</code> Source: `shared/schema.ts:L959`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L960`.
- `isActive` / `is_active` — boolean; not null. Definition: <code>boolean("is_active").notNull().default(true)</code> Source: `shared/schema.ts:L961`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L962`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L963`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L964`.
**Declared column foreign keys:** `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("network_zones_name_ci_unique")</code>
- uniqueIndex: <code>uniqueIndex("network_zones_code_ci_unique")</code>
- index: <code>index("network_zones_active_idx")</code>

#### `it_component_compliance_reviews` — Drizzle export `itComponentComplianceReviews` — `shared/schema.ts:L975`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L976`.
- `componentType` / `component_type` — text; not null. Definition: <code>text("component_type").notNull()</code> Source: `shared/schema.ts:L977`.
- `componentId` / `component_id` — varchar; not null. Definition: <code>varchar("component_id").notNull()</code> Source: `shared/schema.ts:L978`.
- `baselineStandard` / `baseline_standard` — text; nullable. Definition: <code>text("baseline_standard")</code> Source: `shared/schema.ts:L979`.
- `complianceStatus` / `compliance_status` — text; not null. Definition: <code>text("compliance_status").notNull().default("pending_review")</code> Source: `shared/schema.ts:L980`.
- `lastReviewedAt` / `last_reviewed_at` — date; nullable. Definition: <code>date("last_reviewed_at")</code> Source: `shared/schema.ts:L981`.
- `reviewFrequency` / `review_frequency` — text; not null. Definition: <code>text("review_frequency").notNull().default("quarterly")</code> Source: `shared/schema.ts:L982`.
- `findings` / `findings` — text; nullable. Definition: <code>text("findings")</code> Source: `shared/schema.ts:L983`.
- `remediationNotes` / `remediation_notes` — text; nullable. Definition: <code>text("remediation_notes")</code> Source: `shared/schema.ts:L984`.
- `reviewedById` / `reviewed_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("reviewed_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L985`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L986`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L987`.
**Declared column foreign keys:** `reviewedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("it_component_compliance_reviews_component_unique")</code>
- index: <code>index("it_component_compliance_reviews_status_idx")</code>
- check: <code>check("it_component_compliance_reviews_status_check", sql`${table.complianceStatus} IN ('compliant', 'non_compliant', 'pending_review')`)</code>
- check: <code>check("it_component_compliance_reviews_frequency_check", sql`${table.reviewFrequency} IN ('monthly', 'quarterly', 'annual')`)</code>

#### `network_devices` — Drizzle export `networkDevices` — `shared/schema.ts:L996`

**Columns (16):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L997`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L998`.
- `deviceType` / `device_type` — text; not null. Definition: <code>text("device_type").notNull()</code> Source: `shared/schema.ts:L999`.
- `hostname` / `hostname` — text; nullable. Definition: <code>text("hostname")</code> Source: `shared/schema.ts:L1000`.
- `managementIp` / `management_ip` — text; nullable. Definition: <code>text("management_ip")</code> Source: `shared/schema.ts:L1001`.
- `manufacturer` / `manufacturer` — text; nullable. Definition: <code>text("manufacturer")</code> Source: `shared/schema.ts:L1002`.
- `model` / `model` — text; nullable. Definition: <code>text("model")</code> Source: `shared/schema.ts:L1003`.
- `serialNumber` / `serial_number` — text; nullable. Definition: <code>text("serial_number")</code> Source: `shared/schema.ts:L1004`.
- `firmwareVersion` / `firmware_version` — text; nullable. Definition: <code>text("firmware_version")</code> Source: `shared/schema.ts:L1005`.
- `zoneId` / `zone_id` — varchar; nullable; FK → network_zones.id (ON DELETE SET NULL). Definition: <code>varchar("zone_id").references(() =&gt; networkZones.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1006`.
- `assetId` / `asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1007`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("active")</code> Source: `shared/schema.ts:L1008`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1009`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1010`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1011`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1012`.
**Declared column foreign keys:** `zoneId` → `network_zones.id` (ON DELETE SET NULL); `assetId` → `assets.id` (ON DELETE SET NULL); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("network_devices_hostname_ci_unique")</code>
- index: <code>index("network_devices_zone_status_idx")</code>
- index: <code>index("network_devices_type_status_idx")</code>
- check: <code>check("network_devices_type_check", sql`${table.deviceType} IN ('firewall', 'router', 'switch', 'access_point', 'load_balancer', 'other')`)</code>
- check: <code>check("network_devices_status_check", sql`${table.status} IN ('active', 'maintenance', 'retired')`)</code>

#### `network_device_links` — Drizzle export `networkDeviceLinks` — `shared/schema.ts:L1026`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1027`.
- `sourceDeviceId` / `source_device_id` — varchar; not null; FK → network_devices.id (ON DELETE RESTRICT). Definition: <code>varchar("source_device_id").notNull().references(() =&gt; networkDevices.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1028`.
- `targetDeviceId` / `target_device_id` — varchar; not null; FK → network_devices.id (ON DELETE RESTRICT). Definition: <code>varchar("target_device_id").notNull().references(() =&gt; networkDevices.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1029`.
- `linkType` / `link_type` — text; not null. Definition: <code>text("link_type").notNull().default("connection")</code> Source: `shared/schema.ts:L1030`.
- `sourceInterface` / `source_interface` — text; nullable. Definition: <code>text("source_interface")</code> Source: `shared/schema.ts:L1031`.
- `targetInterface` / `target_interface` — text; nullable. Definition: <code>text("target_interface")</code> Source: `shared/schema.ts:L1032`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L1033`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1034`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1035`.
**Declared column foreign keys:** `sourceDeviceId` → `network_devices.id` (ON DELETE RESTRICT); `targetDeviceId` → `network_devices.id` (ON DELETE RESTRICT); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("network_device_links_pair_unique")</code>
- check: <code>check("network_device_links_distinct_devices_check", sql`${table.sourceDeviceId} &lt;&gt; ${table.targetDeviceId}`)</code>
- index: <code>index("network_device_links_target_idx")</code>

#### `firewall_rules` — Drizzle export `firewallRules` — `shared/schema.ts:L1046`

**Columns (21):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1047`.
- `ruleReference` / `rule_reference` — text; nullable. Definition: <code>text("rule_reference")</code> Source: `shared/schema.ts:L1048`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L1049`.
- `firewallDeviceId` / `firewall_device_id` — varchar; not null; FK → network_devices.id (ON DELETE RESTRICT). Definition: <code>varchar("firewall_device_id").notNull().references(() =&gt; networkDevices.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1050`.
- `sourceZoneId` / `source_zone_id` — varchar; nullable; FK → network_zones.id (ON DELETE SET NULL). Definition: <code>varchar("source_zone_id").references(() =&gt; networkZones.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1051`.
- `sourceAddresses` / `source_addresses` — text; not null. Definition: <code>text("source_addresses").notNull().default("any")</code> Source: `shared/schema.ts:L1052`.
- `destinationZoneId` / `destination_zone_id` — varchar; nullable; FK → network_zones.id (ON DELETE SET NULL). Definition: <code>varchar("destination_zone_id").references(() =&gt; networkZones.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1053`.
- `destinationAddresses` / `destination_addresses` — text; not null. Definition: <code>text("destination_addresses").notNull().default("any")</code> Source: `shared/schema.ts:L1054`.
- `protocol` / `protocol` — text; not null. Definition: <code>text("protocol").notNull().default("any")</code> Source: `shared/schema.ts:L1055`.
- `ports` / `ports` — text; nullable. Definition: <code>text("ports")</code> Source: `shared/schema.ts:L1056`.
- `action` / `action` — text; not null. Definition: <code>text("action").notNull()</code> Source: `shared/schema.ts:L1057`.
- `businessJustification` / `business_justification` — text; not null. Definition: <code>text("business_justification").notNull()</code> Source: `shared/schema.ts:L1058`.
- `ownerId` / `owner_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1059`.
- `changeId` / `change_id` — varchar; nullable; FK → changes.id (ON DELETE SET NULL). Definition: <code>varchar("change_id").references(() =&gt; changes.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1060`.
- `reviewIntervalDays` / `review_interval_days` — integer; not null. Definition: <code>integer("review_interval_days").notNull().default(90)</code> Source: `shared/schema.ts:L1061`.
- `nextReviewDueAt` / `next_review_due_at` — date; nullable. Definition: <code>date("next_review_due_at")</code> Source: `shared/schema.ts:L1062`.
- `lastReviewedAt` / `last_reviewed_at` — timestamp; nullable. Definition: <code>timestamp("last_reviewed_at")</code> Source: `shared/schema.ts:L1063`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("active")</code> Source: `shared/schema.ts:L1064`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1065`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1066`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1067`.
**Declared column foreign keys:** `firewallDeviceId` → `network_devices.id` (ON DELETE RESTRICT); `sourceZoneId` → `network_zones.id` (ON DELETE SET NULL); `destinationZoneId` → `network_zones.id` (ON DELETE SET NULL); `ownerId` → `users.id` (ON DELETE SET NULL); `changeId` → `changes.id` (ON DELETE SET NULL); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("firewall_rules_device_reference_ci_unique")</code>
- index: <code>index("firewall_rules_review_due_idx")</code>
- index: <code>index("firewall_rules_device_idx")</code>
- check: <code>check("firewall_rules_action_check", sql`${table.action} IN ('allow', 'deny')`)</code>
- check: <code>check("firewall_rules_status_check", sql`${table.status} IN ('active', 'inactive')`)</code>
- check: <code>check("firewall_rules_review_interval_check", sql`${table.reviewIntervalDays} BETWEEN 1 AND 3650`)</code>
- check: <code>check("firewall_rules_justification_check", sql`length(trim(${table.businessJustification})) &gt;= 10`)</code>

#### `firewall_rule_reviews` — Drizzle export `firewallRuleReviews` — `shared/schema.ts:L1084`

**Columns (7):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1085`.
- `firewallRuleId` / `firewall_rule_id` — varchar; not null; FK → firewall_rules.id (ON DELETE RESTRICT). Definition: <code>varchar("firewall_rule_id").notNull().references(() =&gt; firewallRules.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1086`.
- `reviewerId` / `reviewer_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("reviewer_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1087`.
- `reviewedAt` / `reviewed_at` — timestamp; not null. Definition: <code>timestamp("reviewed_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1088`.
- `outcome` / `outcome` — text; not null. Definition: <code>text("outcome").notNull()</code> Source: `shared/schema.ts:L1089`.
- `nextReviewDueAt` / `next_review_due_at` — date; nullable. Definition: <code>date("next_review_due_at")</code> Source: `shared/schema.ts:L1090`.
- `notes` / `notes` — text; not null. Definition: <code>text("notes").notNull()</code> Source: `shared/schema.ts:L1091`.
**Declared column foreign keys:** `firewallRuleId` → `firewall_rules.id` (ON DELETE RESTRICT); `reviewerId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("firewall_rule_reviews_rule_date_idx")</code>
- check: <code>check("firewall_rule_reviews_outcome_check", sql`${table.outcome} IN ('approved', 'changes_requested', 'revoked')`)</code>
- check: <code>check("firewall_rule_reviews_notes_check", sql`length(trim(${table.notes})) &gt;= 5`)</code>

#### `backup_schedules` — Drizzle export `backupSchedules` — `shared/schema.ts:L1099`

**Columns (16):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1100`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L1101`.
- `serverId` / `server_id` — varchar; nullable; FK → servers.id (ON DELETE RESTRICT). Definition: <code>varchar("server_id").references(() =&gt; servers.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1102`.
- `applicationId` / `application_id` — varchar; nullable; FK → cmdb_applications.id (ON DELETE RESTRICT). Definition: <code>varchar("application_id").references(() =&gt; cmdbApplications.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1103`.
- `backupType` / `backup_type` — text; not null. Definition: <code>text("backup_type").notNull().default("full")</code> Source: `shared/schema.ts:L1104`.
- `frequency` / `frequency` — text; not null. Definition: <code>text("frequency").notNull()</code> Source: `shared/schema.ts:L1105`.
- `customFrequency` / `custom_frequency` — text; nullable. Definition: <code>text("custom_frequency")</code> Source: `shared/schema.ts:L1106`.
- `retentionDays` / `retention_days` — integer; not null. Definition: <code>integer("retention_days").notNull()</code> Source: `shared/schema.ts:L1107`.
- `retentionPolicy` / `retention_policy` — text; nullable. Definition: <code>text("retention_policy")</code> Source: `shared/schema.ts:L1108`.
- `destination` / `destination` — text; not null. Definition: <code>text("destination").notNull()</code> Source: `shared/schema.ts:L1109`.
- `ownerId` / `owner_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1110`.
- `isActive` / `is_active` — boolean; not null. Definition: <code>boolean("is_active").notNull().default(true)</code> Source: `shared/schema.ts:L1111`.
- `nextDueAt` / `next_due_at` — timestamp; nullable. Definition: <code>timestamp("next_due_at")</code> Source: `shared/schema.ts:L1112`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1113`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1114`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1115`.
**Declared column foreign keys:** `serverId` → `servers.id` (ON DELETE RESTRICT); `applicationId` → `cmdb_applications.id` (ON DELETE RESTRICT); `ownerId` → `users.id` (ON DELETE SET NULL); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("backup_schedules_one_target_check", sql`num_nonnulls(${table.serverId}, ${table.applicationId}) = 1`)</code>
- check: <code>check("backup_schedules_type_check", sql`${table.backupType} IN ('full', 'incremental', 'differential', 'snapshot')`)</code>
- check: <code>check("backup_schedules_frequency_check", sql`${table.frequency} IN ('hourly', 'daily', 'weekly', 'monthly', 'custom')`)</code>
- check: <code>check("backup_schedules_retention_check", sql`${table.retentionDays} BETWEEN 1 AND 36500`)</code>
- index: <code>index("backup_schedules_active_due_idx")</code>
- index: <code>index("backup_schedules_server_idx")</code>
- index: <code>index("backup_schedules_application_idx")</code>

#### `backup_job_runs` — Drizzle export `backupJobRuns` — `shared/schema.ts:L1130`

**Columns (11):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1131`.
- `scheduleId` / `schedule_id` — varchar; not null; FK → backup_schedules.id (ON DELETE RESTRICT). Definition: <code>varchar("schedule_id").notNull().references(() =&gt; backupSchedules.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1132`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull()</code> Source: `shared/schema.ts:L1133`.
- `startedAt` / `started_at` — timestamp; not null. Definition: <code>timestamp("started_at").notNull()</code> Source: `shared/schema.ts:L1134`.
- `completedAt` / `completed_at` — timestamp; nullable. Definition: <code>timestamp("completed_at")</code> Source: `shared/schema.ts:L1135`.
- `dataSizeMb` / `data_size_mb` — integer; nullable. Definition: <code>integer("data_size_mb")</code> Source: `shared/schema.ts:L1136`.
- `restorePoint` / `restore_point` — text; nullable. Definition: <code>text("restore_point")</code> Source: `shared/schema.ts:L1137`.
- `evidenceReference` / `evidence_reference` — text; nullable. Definition: <code>text("evidence_reference")</code> Source: `shared/schema.ts:L1138`.
- `notes` / `notes` — text; not null. Definition: <code>text("notes").notNull()</code> Source: `shared/schema.ts:L1139`.
- `loggedById` / `logged_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("logged_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1140`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1141`.
**Declared column foreign keys:** `scheduleId` → `backup_schedules.id` (ON DELETE RESTRICT); `loggedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("backup_job_runs_schedule_started_idx")</code>
- index: <code>index("backup_job_runs_status_started_idx")</code>
- check: <code>check("backup_job_runs_status_check", sql`${table.status} IN ('success', 'failed', 'partial')`)</code>
- check: <code>check("backup_job_runs_size_check", sql`${table.dataSizeMb} IS NULL OR ${table.dataSizeMb} &gt;= 0`)</code>
- check: <code>check("backup_job_runs_time_order_check", sql`${table.completedAt} IS NULL OR ${table.completedAt} &gt;= ${table.startedAt}`)</code>
- check: <code>check("backup_job_runs_notes_check", sql`length(trim(${table.notes})) &gt;= 5`)</code>

#### `backup_restore_tests` — Drizzle export `backupRestoreTests` — `shared/schema.ts:L1152`

**Columns (11):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1153`.
- `scheduleId` / `schedule_id` — varchar; not null; FK → backup_schedules.id (ON DELETE RESTRICT). Definition: <code>varchar("schedule_id").notNull().references(() =&gt; backupSchedules.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1154`.
- `testedAt` / `tested_at` — timestamp; not null. Definition: <code>timestamp("tested_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1155`.
- `outcome` / `outcome` — text; not null. Definition: <code>text("outcome").notNull()</code> Source: `shared/schema.ts:L1156`.
- `recoveryPoint` / `recovery_point` — text; nullable. Definition: <code>text("recovery_point")</code> Source: `shared/schema.ts:L1157`.
- `measuredRtoMinutes` / `measured_rto_minutes` — integer; nullable. Definition: <code>integer("measured_rto_minutes")</code> Source: `shared/schema.ts:L1158`.
- `measuredRpoMinutes` / `measured_rpo_minutes` — integer; nullable. Definition: <code>integer("measured_rpo_minutes")</code> Source: `shared/schema.ts:L1159`.
- `evidenceReference` / `evidence_reference` — text; nullable. Definition: <code>text("evidence_reference")</code> Source: `shared/schema.ts:L1160`.
- `notes` / `notes` — text; not null. Definition: <code>text("notes").notNull()</code> Source: `shared/schema.ts:L1161`.
- `testerId` / `tester_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("tester_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1162`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1163`.
**Declared column foreign keys:** `scheduleId` → `backup_schedules.id` (ON DELETE RESTRICT); `testerId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("backup_restore_tests_schedule_tested_idx")</code>
- check: <code>check("backup_restore_tests_outcome_check", sql`${table.outcome} IN ('passed', 'failed', 'partial')`)</code>
- check: <code>check("backup_restore_tests_rto_check", sql`${table.measuredRtoMinutes} IS NULL OR ${table.measuredRtoMinutes} &gt;= 0`)</code>
- check: <code>check("backup_restore_tests_rpo_check", sql`${table.measuredRpoMinutes} IS NULL OR ${table.measuredRpoMinutes} &gt;= 0`)</code>
- check: <code>check("backup_restore_tests_notes_check", sql`length(trim(${table.notes})) &gt;= 5`)</code>

#### `configuration_documents` — Drizzle export `configurationDocuments` — `shared/schema.ts:L1372`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1373`.
- `applicationId` / `application_id` — varchar; nullable; FK → cmdb_applications.id (ON DELETE RESTRICT). Definition: <code>varchar("application_id").references(() =&gt; cmdbApplications.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1374`.
- `serverId` / `server_id` — varchar; nullable; FK → servers.id (ON DELETE RESTRICT). Definition: <code>varchar("server_id").references(() =&gt; servers.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1375`.
- `documentType` / `document_type` — text; not null. Definition: <code>text("document_type").notNull()</code> Source: `shared/schema.ts:L1376`.
- `version` / `version` — integer; not null. Definition: <code>integer("version").notNull().default(1)</code> Source: `shared/schema.ts:L1377`.
- `originalName` / `original_name` — text; not null. Definition: <code>text("original_name").notNull()</code> Source: `shared/schema.ts:L1378`.
- `fileName` / `file_name` — text; not null. Definition: <code>text("file_name").notNull()</code> Source: `shared/schema.ts:L1379`.
- `fileType` / `file_type` — text; nullable. Definition: <code>text("file_type")</code> Source: `shared/schema.ts:L1380`.
- `fileSize` / `file_size` — integer; nullable. Definition: <code>integer("file_size")</code> Source: `shared/schema.ts:L1381`.
- `filePath` / `file_path` — text; not null. Definition: <code>text("file_path").notNull()</code> Source: `shared/schema.ts:L1382`.
- `uploadedBy` / `uploaded_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("uploaded_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1383`.
- `uploadedAt` / `uploaded_at` — timestamp; not null. Definition: <code>timestamp("uploaded_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1384`.
**Declared column foreign keys:** `applicationId` → `cmdb_applications.id` (ON DELETE RESTRICT); `serverId` → `servers.id` (ON DELETE RESTRICT); `uploadedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("configuration_documents_one_parent_check", sql`num_nonnulls(${table.applicationId}, ${table.serverId}) = 1`)</code>
- index: <code>index("configuration_documents_application_idx")</code>
- index: <code>index("configuration_documents_server_idx")</code>
- uniqueIndex: <code>uniqueIndex("configuration_documents_app_version_unique")</code>
- uniqueIndex: <code>uniqueIndex("configuration_documents_server_version_unique")</code>

### 5.5 ITSM and service management (18 tables)

#### `tickets` — Drizzle export `tickets` — `shared/schema.ts:L1405`

**Columns (24):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1406`.
- `ticketNumber` / `ticket_number` — text; not null. Definition: <code>text("ticket_number").notNull().unique()</code> Source: `shared/schema.ts:L1407`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L1408`.
- `description` / `description` — text; not null. Definition: <code>text("description").notNull()</code> Source: `shared/schema.ts:L1409`.
- `type` / `type` — text; not null. Definition: <code>text("type").notNull().default("incident")</code> Source: `shared/schema.ts:L1410`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L1411`.
- `impact` / `impact` — text; nullable. Definition: <code>text("impact")</code> Source: `shared/schema.ts:L1412`.
- `urgency` / `urgency` — text; nullable. Definition: <code>text("urgency")</code> Source: `shared/schema.ts:L1413`.
- `priority` / `priority` — text; not null. Definition: <code>text("priority").notNull().default("medium")</code> Source: `shared/schema.ts:L1414`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("open")</code> Source: `shared/schema.ts:L1415`.
- `assetId` / `asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1416`.
- `requesterId` / `requester_id` — varchar; not null; FK → users.id. Definition: <code>varchar("requester_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L1417`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1418`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id (ON DELETE SET NULL). Definition: <code>varchar("department_id").references(() =&gt; departments.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1419`.
- `catalogItemId` / `catalog_item_id` — varchar; nullable. Definition: <code>varchar("catalog_item_id")</code> Source: `shared/schema.ts:L1420`.
- `dueDate` / `due_date` — date; nullable. Definition: <code>date("due_date")</code> Source: `shared/schema.ts:L1421`.
- `resolutionCode` / `resolution_code` — text; nullable. Definition: <code>text("resolution_code")</code> Source: `shared/schema.ts:L1422`.
- `reopenCount` / `reopen_count` — integer; not null. Definition: <code>integer("reopen_count").notNull().default(0)</code> Source: `shared/schema.ts:L1423`.
- `slaResponseDueAt` / `sla_response_due_at` — timestamp; nullable. Definition: <code>timestamp("sla_response_due_at")</code> Source: `shared/schema.ts:L1424`.
- `slaResolutionDueAt` / `sla_resolution_due_at` — timestamp; nullable. Definition: <code>timestamp("sla_resolution_due_at")</code> Source: `shared/schema.ts:L1425`.
- `firstRespondedAt` / `first_responded_at` — timestamp; nullable. Definition: <code>timestamp("first_responded_at")</code> Source: `shared/schema.ts:L1426`.
- `resolvedAt` / `resolved_at` — timestamp; nullable. Definition: <code>timestamp("resolved_at")</code> Source: `shared/schema.ts:L1427`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1428`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1429`.
**Declared column foreign keys:** `assetId` → `assets.id` (ON DELETE SET NULL); `requesterId` → `users.id`; `assignedToId` → `users.id` (ON DELETE SET NULL); `departmentId` → `departments.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `ticket_comments` — Drizzle export `ticketComments` — `shared/schema.ts:L1432`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1433`.
- `ticketId` / `ticket_id` — varchar; not null; FK → tickets.id (ON DELETE CASCADE). Definition: <code>varchar("ticket_id").notNull().references(() =&gt; tickets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1434`.
- `incidentId` / `incident_id` — varchar; nullable; FK → incidents.id (ON DELETE CASCADE). Definition: <code>varchar("incident_id").references(() =&gt; incidents.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1435`.
- `serviceRequestId` / `service_request_id` — varchar; nullable; FK → service_requests.id (ON DELETE CASCADE). Definition: <code>varchar("service_request_id").references(() =&gt; serviceRequests.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1436`.
- `authorId` / `author_id` — varchar; not null; FK → users.id. Definition: <code>varchar("author_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L1437`.
- `message` / `message` — text; not null. Definition: <code>text("message").notNull()</code> Source: `shared/schema.ts:L1438`.
- `isInternal` / `is_internal` — boolean; nullable. Definition: <code>boolean("is_internal").default(false)</code> Source: `shared/schema.ts:L1439`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1440`.
**Declared column foreign keys:** `ticketId` → `tickets.id` (ON DELETE CASCADE); `incidentId` → `incidents.id` (ON DELETE CASCADE); `serviceRequestId` → `service_requests.id` (ON DELETE CASCADE); `authorId` → `users.id`
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `ticket_attachments` — Drizzle export `ticketAttachments` — `shared/schema.ts:L1443`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1444`.
- `ticketId` / `ticket_id` — varchar; nullable; FK → tickets.id (ON DELETE CASCADE). Definition: <code>varchar("ticket_id").references(() =&gt; tickets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1445`.
- `incidentId` / `incident_id` — varchar; nullable; FK → incidents.id (ON DELETE CASCADE). Definition: <code>varchar("incident_id").references(() =&gt; incidents.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1446`.
- `serviceRequestId` / `service_request_id` — varchar; nullable; FK → service_requests.id (ON DELETE CASCADE). Definition: <code>varchar("service_request_id").references(() =&gt; serviceRequests.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L1447`.
- `fileName` / `file_name` — text; not null. Definition: <code>text("file_name").notNull()</code> Source: `shared/schema.ts:L1448`.
- `originalName` / `original_name` — text; not null. Definition: <code>text("original_name").notNull()</code> Source: `shared/schema.ts:L1449`.
- `fileType` / `file_type` — text; nullable. Definition: <code>text("file_type")</code> Source: `shared/schema.ts:L1450`.
- `fileSize` / `file_size` — integer; nullable. Definition: <code>integer("file_size")</code> Source: `shared/schema.ts:L1451`.
- `filePath` / `file_path` — text; not null. Definition: <code>text("file_path").notNull()</code> Source: `shared/schema.ts:L1452`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L1453`.
- `uploadedBy` / `uploaded_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("uploaded_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1454`.
- `uploadedAt` / `uploaded_at` — timestamp; nullable. Definition: <code>timestamp("uploaded_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1455`.
**Declared column foreign keys:** `ticketId` → `tickets.id` (ON DELETE CASCADE); `incidentId` → `incidents.id` (ON DELETE CASCADE); `serviceRequestId` → `service_requests.id` (ON DELETE CASCADE); `uploadedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `sla_policies` — Drizzle export `slaPolicies` — `shared/schema.ts:L1471`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1472`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L1473`.
- `ticketType` / `ticket_type` — text; nullable. Definition: <code>text("ticket_type")</code> Source: `shared/schema.ts:L1474`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L1475`.
- `priority` / `priority` — text; not null. Definition: <code>text("priority").notNull()</code> Source: `shared/schema.ts:L1476`.
- `responseHours` / `response_hours` — real; not null. Definition: <code>real("response_hours").notNull()</code> Source: `shared/schema.ts:L1477`.
- `resolutionHours` / `resolution_hours` — real; not null. Definition: <code>real("resolution_hours").notNull()</code> Source: `shared/schema.ts:L1478`.
- `isActive` / `is_active` — boolean; nullable. Definition: <code>boolean("is_active").default(true)</code> Source: `shared/schema.ts:L1479`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1480`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1481`.
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `problems` — Drizzle export `problems` — `shared/schema.ts:L2006`

**Columns (18):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2007`.
- `problemNumber` / `problem_number` — text; not null. Definition: <code>text("problem_number").notNull().unique()</code> Source: `shared/schema.ts:L2008`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2009`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L2010`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("open")</code> Source: `shared/schema.ts:L2011`.
- `priority` / `priority` — text; not null. Definition: <code>text("priority").notNull().default("medium")</code> Source: `shared/schema.ts:L2012`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L2013`.
- `rootCause` / `root_cause` — text; nullable. Definition: <code>text("root_cause")</code> Source: `shared/schema.ts:L2014`.
- `workaround` / `workaround` — text; nullable. Definition: <code>text("workaround")</code> Source: `shared/schema.ts:L2015`.
- `resolution` / `resolution` — text; nullable. Definition: <code>text("resolution")</code> Source: `shared/schema.ts:L2016`.
- `knownError` / `known_error` — boolean; nullable. Definition: <code>boolean("known_error").default(false)</code> Source: `shared/schema.ts:L2017`.
- `knownErrorDate` / `known_error_date` — timestamp; nullable. Definition: <code>timestamp("known_error_date")</code> Source: `shared/schema.ts:L2018`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2019`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id (ON DELETE SET NULL). Definition: <code>varchar("department_id").references(() =&gt; departments.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2020`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2021`.
- `resolvedAt` / `resolved_at` — timestamp; nullable. Definition: <code>timestamp("resolved_at")</code> Source: `shared/schema.ts:L2022`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2023`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2024`.
**Declared column foreign keys:** `assignedToId` → `users.id` (ON DELETE SET NULL); `departmentId` → `departments.id` (ON DELETE SET NULL); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `problem_incidents` — Drizzle export `problemIncidents` — `shared/schema.ts:L2027`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2028`.
- `problemId` / `problem_id` — varchar; not null; FK → problems.id (ON DELETE CASCADE). Definition: <code>varchar("problem_id").notNull().references(() =&gt; problems.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2029`.
- `ticketId` / `ticket_id` — varchar; not null; FK → tickets.id (ON DELETE CASCADE). Definition: <code>varchar("ticket_id").notNull().references(() =&gt; tickets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2030`.
- `incidentId` / `incident_id` — varchar; nullable; FK → incidents.id (ON DELETE CASCADE). Definition: <code>varchar("incident_id").references(() =&gt; incidents.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2031`.
- `linkedAt` / `linked_at` — timestamp; nullable. Definition: <code>timestamp("linked_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2032`.
**Declared column foreign keys:** `problemId` → `problems.id` (ON DELETE CASCADE); `ticketId` → `tickets.id` (ON DELETE CASCADE); `incidentId` → `incidents.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `catalog_items` — Drizzle export `catalogItems` — `shared/schema.ts:L2043`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2044`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull()</code> Source: `shared/schema.ts:L2045`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L2046`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L2047`.
- `icon` / `icon` — text; nullable. Definition: <code>text("icon")</code> Source: `shared/schema.ts:L2048`.
- `fulfillmentTeam` / `fulfillment_team` — text; nullable. Definition: <code>text("fulfillment_team")</code> Source: `shared/schema.ts:L2049`.
- `consumableId` / `consumable_id` — varchar; nullable; FK → consumables.id (ON DELETE SET NULL). Definition: <code>varchar("consumable_id").references(() =&gt; consumables.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2050`.
- `slaHours` / `sla_hours` — integer; nullable. Definition: <code>integer("sla_hours")</code> Source: `shared/schema.ts:L2051`.
- `approvalRequired` / `approval_required` — boolean; nullable. Definition: <code>boolean("approval_required").default(false)</code> Source: `shared/schema.ts:L2052`.
- `isActive` / `is_active` — boolean; nullable. Definition: <code>boolean("is_active").default(true)</code> Source: `shared/schema.ts:L2053`.
- `displayOrder` / `display_order` — integer; nullable. Definition: <code>integer("display_order").default(0)</code> Source: `shared/schema.ts:L2054`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2055`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2056`.
**Declared column foreign keys:** `consumableId` → `consumables.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `service_catalog_items` — Drizzle export `serviceCatalogItems` — `shared/schema.ts:L2064`

**Columns (12):**
- `id` / `id` — varchar; primary key; FK → catalog_items.id (ON DELETE RESTRICT). Definition: <code>varchar("id").primaryKey().references(() =&gt; catalogItems.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L2065`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2066`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L2067`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L2068`.
- `icon` / `icon` — text; nullable. Definition: <code>text("icon")</code> Source: `shared/schema.ts:L2069`.
- `slaHours` / `sla_hours` — integer; not null. Definition: <code>integer("sla_hours").notNull().default(24)</code> Source: `shared/schema.ts:L2070`.
- `requiresApproval` / `requires_approval` — boolean; not null. Definition: <code>boolean("requires_approval").notNull().default(false)</code> Source: `shared/schema.ts:L2071`.
- `approverRole` / `approver_role` — text; nullable. Definition: <code>text("approver_role")</code> Source: `shared/schema.ts:L2072`.
- `customFieldsSchema` / `custom_fields_schema` — jsonb; not null. Definition: <code>jsonb("custom_fields_schema").$type&lt;CatalogField[]&gt;().notNull().default(sql`'[]'::jsonb`)</code> Source: `shared/schema.ts:L2073`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("Active")</code> Source: `shared/schema.ts:L2074`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L2075`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L2076`.
**Declared column foreign keys:** `id` → `catalog_items.id` (ON DELETE RESTRICT)
**Table-level indexes / checks / constraints:**
- index: <code>index("service_catalog_items_status_category_idx")</code>
- check: <code>check("service_catalog_items_valid_status", sql`${table.status} IN ('Active', 'Inactive')`)</code>
- check: <code>check("service_catalog_items_positive_sla", sql`${table.slaHours} &gt; 0`)</code>
- check: <code>check("service_catalog_items_approver_check", sql`NOT ${table.requiresApproval} OR ${table.approverRole} IN ('Manager', 'IT Director') AND ${table.approverRole} IS NOT NULL`)</code>

#### `changes` — Drizzle export `changes` — `shared/schema.ts:L2088`

**Columns (28):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2089`.
- `changeNumber` / `change_number` — text; not null. Definition: <code>text("change_number").notNull().unique()</code> Source: `shared/schema.ts:L2090`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2091`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L2092`.
- `type` / `type` — text; not null. Definition: <code>text("type").notNull().default("normal")</code> Source: `shared/schema.ts:L2093`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("draft")</code> Source: `shared/schema.ts:L2094`.
- `priority` / `priority` — text; not null. Definition: <code>text("priority").notNull().default("medium")</code> Source: `shared/schema.ts:L2095`.
- `risk` / `risk` — text; nullable. Definition: <code>text("risk").default("low")</code> Source: `shared/schema.ts:L2096`.
- `impact` / `impact` — text; nullable. Definition: <code>text("impact")</code> Source: `shared/schema.ts:L2097`.
- `rollbackPlan` / `rollback_plan` — text; nullable. Definition: <code>text("rollback_plan")</code> Source: `shared/schema.ts:L2098`.
- `implementationPlan` / `implementation_plan` — text; nullable. Definition: <code>text("implementation_plan")</code> Source: `shared/schema.ts:L2099`.
- `testPlan` / `test_plan` — text; nullable. Definition: <code>text("test_plan")</code> Source: `shared/schema.ts:L2100`.
- `scheduledStart` / `scheduled_start` — timestamp; nullable. Definition: <code>timestamp("scheduled_start")</code> Source: `shared/schema.ts:L2101`.
- `scheduledEnd` / `scheduled_end` — timestamp; nullable. Definition: <code>timestamp("scheduled_end")</code> Source: `shared/schema.ts:L2102`.
- `actualStart` / `actual_start` — timestamp; nullable. Definition: <code>timestamp("actual_start")</code> Source: `shared/schema.ts:L2103`.
- `actualEnd` / `actual_end` — timestamp; nullable. Definition: <code>timestamp("actual_end")</code> Source: `shared/schema.ts:L2104`.
- `assignedAt` / `assigned_at` — timestamp; nullable. Definition: <code>timestamp("assigned_at")</code> Source: `shared/schema.ts:L2105`.
- `submittedAt` / `submitted_at` — timestamp; nullable. Definition: <code>timestamp("submitted_at")</code> Source: `shared/schema.ts:L2106`.
- `approvedAt` / `approved_at` — timestamp; nullable. Definition: <code>timestamp("approved_at")</code> Source: `shared/schema.ts:L2107`.
- `cabRequired` / `cab_required` — boolean; nullable. Definition: <code>boolean("cab_required").default(false)</code> Source: `shared/schema.ts:L2108`.
- `cabReviewVersion` / `cab_review_version` — integer; not null. Definition: <code>integer("cab_review_version").notNull().default(1)</code> Source: `shared/schema.ts:L2109`.
- `cabScheduledFor` / `cab_scheduled_for` — timestamp; nullable. Definition: <code>timestamp("cab_scheduled_for")</code> Source: `shared/schema.ts:L2110`.
- `requestedById` / `requested_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("requested_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2111`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2112`.
- `departmentId` / `department_id` — varchar; nullable; FK → departments.id (ON DELETE SET NULL). Definition: <code>varchar("department_id").references(() =&gt; departments.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2113`.
- `projectId` / `project_id` — varchar; nullable; FK → projects.id (ON DELETE SET NULL). Definition: <code>varchar("project_id").references(() =&gt; projects.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2114`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2115`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2116`.
**Declared column foreign keys:** `requestedById` → `users.id` (ON DELETE SET NULL); `assignedToId` → `users.id` (ON DELETE SET NULL); `departmentId` → `departments.id` (ON DELETE SET NULL); `projectId` → `projects.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `incidents` — Drizzle export `incidents` — `shared/schema.ts:L2121`

**Columns (27):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2122`.
- `incidentNumber` / `incident_number` — text; not null. Definition: <code>text("incident_number").notNull().unique()</code> Source: `shared/schema.ts:L2123`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2124`.
- `description` / `description` — text; not null. Definition: <code>text("description").notNull()</code> Source: `shared/schema.ts:L2125`.
- `urgency` / `urgency` — text; not null. Definition: <code>text("urgency").notNull().default("medium")</code> Source: `shared/schema.ts:L2126`.
- `impact` / `impact` — text; not null. Definition: <code>text("impact").notNull().default("medium")</code> Source: `shared/schema.ts:L2127`.
- `priority` / `priority` — text; not null. Definition: <code>text("priority").notNull().default("P3")</code> Source: `shared/schema.ts:L2128`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("New")</code> Source: `shared/schema.ts:L2129`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L2130`.
- `creatorId` / `creator_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("creator_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2131`.
- `projectId` / `project_id` — varchar; nullable; FK → projects.id (ON DELETE SET NULL). Definition: <code>varchar("project_id").references(() =&gt; projects.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2132`.
- `slaPolicyId` / `sla_policy_id` — varchar; nullable; FK → sla_policies.id (ON DELETE SET NULL). Definition: <code>varchar("sla_policy_id").references(() =&gt; slaPolicies.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2133`.
- `assignmentGroup` / `assignment_group` — text; nullable. Definition: <code>text("assignment_group")</code> Source: `shared/schema.ts:L2134`.
- `assigneeId` / `assignee_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assignee_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2135`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2136`.
- `requesterId` / `requester_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("requester_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2137`.
- `assetId` / `asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2138`.
- `changeRequestId` / `change_request_id` — varchar; nullable; FK → changes.id (ON DELETE SET NULL). Definition: <code>varchar("change_request_id").references(() =&gt; changes.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2139`.
- `responseDueAt` / `response_due_at` — timestamp; nullable. Definition: <code>timestamp("response_due_at")</code> Source: `shared/schema.ts:L2140`.
- `resolveDueAt` / `resolve_due_at` — timestamp; nullable. Definition: <code>timestamp("resolve_due_at")</code> Source: `shared/schema.ts:L2141`.
- `firstRespondedAt` / `first_responded_at` — timestamp; nullable. Definition: <code>timestamp("first_responded_at")</code> Source: `shared/schema.ts:L2142`.
- `resolvedAt` / `resolved_at` — timestamp; nullable. Definition: <code>timestamp("resolved_at")</code> Source: `shared/schema.ts:L2143`.
- `closedAt` / `closed_at` — timestamp; nullable. Definition: <code>timestamp("closed_at")</code> Source: `shared/schema.ts:L2144`.
- `resolutionCode` / `resolution_code` — text; nullable. Definition: <code>text("resolution_code")</code> Source: `shared/schema.ts:L2145`.
- `resolutionNotes` / `resolution_notes` — text; nullable. Definition: <code>text("resolution_notes")</code> Source: `shared/schema.ts:L2146`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2147`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2148`.
**Declared column foreign keys:** `creatorId` → `users.id` (ON DELETE SET NULL); `projectId` → `projects.id` (ON DELETE SET NULL); `slaPolicyId` → `sla_policies.id` (ON DELETE SET NULL); `assigneeId` → `users.id` (ON DELETE SET NULL); `assignedToId` → `users.id` (ON DELETE SET NULL); `requesterId` → `users.id` (ON DELETE SET NULL); `assetId` → `assets.id` (ON DELETE SET NULL); `changeRequestId` → `changes.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("incidents_status_priority_idx")</code>
- index: <code>index("incidents_assigned_to_idx")</code>
- index: <code>index("incidents_project_id_idx")</code>
- index: <code>index("incidents_creator_id_idx")</code>

#### `incident_activities` — Drizzle export `incidentActivities` — `shared/schema.ts:L2156`

**Columns (6):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2157`.
- `incidentId` / `incident_id` — varchar; not null; FK → incidents.id (ON DELETE CASCADE). Definition: <code>varchar("incident_id").notNull().references(() =&gt; incidents.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2158`.
- `actorId` / `actor_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("actor_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2159`.
- `action` / `action` — text; not null. Definition: <code>text("action").notNull()</code> Source: `shared/schema.ts:L2160`.
- `details` / `details` — text; nullable. Definition: <code>text("details")</code> Source: `shared/schema.ts:L2161`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2162`.
**Declared column foreign keys:** `incidentId` → `incidents.id` (ON DELETE CASCADE); `actorId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("incident_activities_incident_created_idx")</code>

#### `service_requests` — Drizzle export `serviceRequests` — `shared/schema.ts:L2165`

**Columns (27):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2166`.
- `requestNumber` / `request_number` — text; not null. Definition: <code>text("request_number").notNull().unique()</code> Source: `shared/schema.ts:L2167`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2168`.
- `description` / `description` — text; not null. Definition: <code>text("description").notNull()</code> Source: `shared/schema.ts:L2169`.
- `catalogItemId` / `catalog_item_id` — varchar; nullable; FK → catalog_items.id (ON DELETE SET NULL). Definition: <code>varchar("catalog_item_id").references(() =&gt; catalogItems.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2170`.
- `serviceCatalogItemId` / `service_catalog_item_id` — varchar; nullable; FK → service_catalog_items.id (ON DELETE RESTRICT). Definition: <code>varchar("service_catalog_item_id").references(() =&gt; serviceCatalogItems.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L2171`.
- `requesterId` / `requester_id` — varchar; not null; FK → users.id. Definition: <code>varchar("requester_id").notNull().references(() =&gt; users.id)</code> Source: `shared/schema.ts:L2172`.
- `creatorId` / `creator_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("creator_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2173`.
- `projectId` / `project_id` — varchar; nullable; FK → projects.id (ON DELETE SET NULL). Definition: <code>varchar("project_id").references(() =&gt; projects.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2174`.
- `assignmentGroup` / `assignment_group` — text; nullable. Definition: <code>text("assignment_group")</code> Source: `shared/schema.ts:L2175`.
- `assigneeId` / `assignee_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assignee_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2176`.
- `fulfillmentStage` / `fulfillment_stage` — text; nullable. Definition: <code>text("fulfillment_stage")</code> Source: `shared/schema.ts:L2177`.
- `fulfillmentStatus` / `fulfillment_status` — text; not null. Definition: <code>text("fulfillment_status").notNull().default("Submitted")</code> Source: `shared/schema.ts:L2178`.
- `approvalStatus` / `approval_status` — text; not null. Definition: <code>text("approval_status").notNull().default("pending")</code> Source: `shared/schema.ts:L2179`.
- `cost` / `cost` — real; not null. Definition: <code>real("cost").notNull().default(0)</code> Source: `shared/schema.ts:L2180`.
- `requestedQuantity` / `requested_quantity` — integer; not null. Definition: <code>integer("requested_quantity").notNull().default(1)</code> Source: `shared/schema.ts:L2181`.
- `customFieldValues` / `custom_field_values` — jsonb; not null. Definition: <code>jsonb("custom_field_values").$type&lt;Record&lt;string, string | number | boolean&gt;&gt;().notNull().default(sql`'{}'::jsonb`)</code> Source: `shared/schema.ts:L2182`.
- `catalogSchemaSnapshot` / `catalog_schema_snapshot` — jsonb; not null. Definition: <code>jsonb("catalog_schema_snapshot").$type&lt;CatalogField[]&gt;().notNull().default(sql`'[]'::jsonb`)</code> Source: `shared/schema.ts:L2183`.
- `fulfilledAssetId` / `fulfilled_asset_id` — varchar; nullable; FK → assets.id (ON DELETE SET NULL). Definition: <code>varchar("fulfilled_asset_id").references(() =&gt; assets.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2184`.
- `targetFulfillmentDate` / `target_fulfillment_date` — date; nullable. Definition: <code>date("target_fulfillment_date")</code> Source: `shared/schema.ts:L2185`.
- `fulfillmentDueAt` / `fulfillment_due_at` — timestamp; nullable. Definition: <code>timestamp("fulfillment_due_at")</code> Source: `shared/schema.ts:L2186`.
- `completedAt` / `completed_at` — timestamp; nullable. Definition: <code>timestamp("completed_at")</code> Source: `shared/schema.ts:L2187`.
- `closureNote` / `closure_note` — text; nullable. Definition: <code>text("closure_note")</code> Source: `shared/schema.ts:L2188`.
- `category` / `category` — text; nullable. Definition: <code>text("category")</code> Source: `shared/schema.ts:L2189`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2190`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2191`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2192`.
**Declared column foreign keys:** `catalogItemId` → `catalog_items.id` (ON DELETE SET NULL); `serviceCatalogItemId` → `service_catalog_items.id` (ON DELETE RESTRICT); `requesterId` → `users.id`; `creatorId` → `users.id` (ON DELETE SET NULL); `projectId` → `projects.id` (ON DELETE SET NULL); `assigneeId` → `users.id` (ON DELETE SET NULL); `fulfilledAssetId` → `assets.id` (ON DELETE SET NULL); `assignedToId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("service_requests_status_idx")</code>
- index: <code>index("service_requests_requester_idx")</code>
- index: <code>index("service_requests_project_idx")</code>

#### `service_request_activities` — Drizzle export `serviceRequestActivities` — `shared/schema.ts:L2199`

**Columns (6):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2200`.
- `serviceRequestId` / `service_request_id` — varchar; not null; FK → service_requests.id (ON DELETE CASCADE). Definition: <code>varchar("service_request_id").notNull().references(() =&gt; serviceRequests.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2201`.
- `actorId` / `actor_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("actor_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2202`.
- `action` / `action` — text; not null. Definition: <code>text("action").notNull()</code> Source: `shared/schema.ts:L2203`.
- `details` / `details` — text; nullable. Definition: <code>text("details")</code> Source: `shared/schema.ts:L2204`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2205`.
**Declared column foreign keys:** `serviceRequestId` → `service_requests.id` (ON DELETE CASCADE); `actorId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("service_request_activities_request_created_idx")</code>

#### `service_requests_approvals` — Drizzle export `serviceRequestsApprovals` — `shared/schema.ts:L2208`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2209`.
- `ticketId` / `ticket_id` — varchar; not null; FK → service_requests.id (ON DELETE RESTRICT). Definition: <code>varchar("ticket_id").notNull().references(() =&gt; serviceRequests.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L2210`.
- `approverId` / `approver_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("approver_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2211`.
- `approverRole` / `approver_role` — text; not null. Definition: <code>text("approver_role").notNull()</code> Source: `shared/schema.ts:L2212`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("Pending")</code> Source: `shared/schema.ts:L2213`.
- `comments` / `comments` — text; nullable. Definition: <code>text("comments")</code> Source: `shared/schema.ts:L2214`.
- `decidedAt` / `decided_at` — timestamp; nullable. Definition: <code>timestamp("decided_at")</code> Source: `shared/schema.ts:L2215`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().defaultNow()</code> Source: `shared/schema.ts:L2216`.
**Declared column foreign keys:** `ticketId` → `service_requests.id` (ON DELETE RESTRICT); `approverId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("service_requests_approvals_ticket_unique")</code>
- index: <code>index("service_requests_approvals_pending_role_idx")</code>
- check: <code>check("service_requests_approvals_valid_role", sql`${table.approverRole} IN ('Manager', 'IT Director')`)</code>
- check: <code>check("service_requests_approvals_valid_status", sql`${table.status} IN ('Pending', 'Approved', 'Rejected')`)</code>
- check: <code>check("service_requests_approvals_decision_note", sql`${table.status} = 'Pending' OR (${table.decidedAt} IS NOT NULL AND length(trim(${table.comments})) &gt;= 5 AND ${table.comments} IS NOT NULL)`)</code>

#### `change_ci_links` — Drizzle export `changeCiLinks` — `shared/schema.ts:L2284`

**Columns (5):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2285`.
- `changeRequestId` / `change_request_id` — varchar; not null; FK → changes.id (ON DELETE CASCADE). Definition: <code>varchar("change_request_id").notNull().references(() =&gt; changes.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2286`.
- `applicationId` / `application_id` — varchar; nullable; FK → cmdb_applications.id (ON DELETE CASCADE). Definition: <code>varchar("application_id").references(() =&gt; cmdbApplications.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2287`.
- `serverId` / `server_id` — varchar; nullable; FK → servers.id (ON DELETE CASCADE). Definition: <code>varchar("server_id").references(() =&gt; servers.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2288`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L2289`.
**Declared column foreign keys:** `changeRequestId` → `changes.id` (ON DELETE CASCADE); `applicationId` → `cmdb_applications.id` (ON DELETE CASCADE); `serverId` → `servers.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- check: <code>check("change_ci_links_one_target_check", sql`num_nonnulls(${table.applicationId}, ${table.serverId}) = 1`)</code>
- uniqueIndex: <code>uniqueIndex("change_ci_links_application_unique")</code>
- uniqueIndex: <code>uniqueIndex("change_ci_links_server_unique")</code>
- index: <code>index("change_ci_links_change_idx")</code>
- index: <code>index("change_ci_links_application_idx")</code>
- index: <code>index("change_ci_links_server_idx")</code>

#### `change_approvals` — Drizzle export `changeApprovals` — `shared/schema.ts:L2299`

**Columns (14):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2300`.
- `changeId` / `change_id` — varchar; not null; FK → changes.id (ON DELETE CASCADE). Definition: <code>varchar("change_id").notNull().references(() =&gt; changes.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2301`.
- `approverId` / `approver_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("approver_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2303`.
- `originalApproverId` / `original_approver_id` — varchar; not null. Definition: <code>varchar("original_approver_id").notNull()</code> Source: `shared/schema.ts:L2304`.
- `approverLabel` / `approver_label` — text; not null. Definition: <code>text("approver_label").notNull()</code> Source: `shared/schema.ts:L2305`.
- `decision` / `decision` — text; nullable. Definition: <code>text("decision")</code> Source: `shared/schema.ts:L2306`.
- `comments` / `comments` — text; nullable. Definition: <code>text("comments")</code> Source: `shared/schema.ts:L2307`.
- `decidedAt` / `decided_at` — timestamp; nullable. Definition: <code>timestamp("decided_at")</code> Source: `shared/schema.ts:L2308`.
- `reviewVersion` / `review_version` — integer; not null. Definition: <code>integer("review_version").notNull().default(1)</code> Source: `shared/schema.ts:L2309`.
- `decisionHistory` / `decision_history` — jsonb; not null. Definition: <code>jsonb("decision_history").$type&lt;Array&lt;{ decision: string; comments: string | null; decidedAt: string | null; supersededAt: string; reviewVersion: number; reason: string; }&gt;&gt;().notNull().default(sql`'[]'::jsonb`)</code> Source: `shared/schema.ts:L2310`.
- `removedAt` / `removed_at` — timestamp; nullable. Definition: <code>timestamp("removed_at")</code> Source: `shared/schema.ts:L2318`.
- `removedById` / `removed_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("removed_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2319`.
- `removedByLabel` / `removed_by_label` — text; nullable. Definition: <code>text("removed_by_label")</code> Source: `shared/schema.ts:L2320`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2321`.
**Declared column foreign keys:** `changeId` → `changes.id` (ON DELETE CASCADE); `approverId` → `users.id` (ON DELETE SET NULL); `removedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("change_approvals_change_original_approver_idx")</code>
- index: <code>index("change_approvals_pending_approver_change_idx")</code>
- index: <code>index("change_approvals_active_pending_count_idx")</code>

#### `change_environment_stages` — Drizzle export `changeEnvironmentStages` — `shared/schema.ts:L2340`

**Columns (15):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2341`.
- `changeId` / `change_id` — varchar; not null; FK → changes.id (ON DELETE CASCADE). Definition: <code>varchar("change_id").notNull().references(() =&gt; changes.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2342`.
- `environment` / `environment` — text; not null. Definition: <code>text("environment").notNull()</code> Source: `shared/schema.ts:L2343`.
- `order` / `order` — integer; not null. Definition: <code>integer("order").notNull()</code> Source: `shared/schema.ts:L2344`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("pending")</code> Source: `shared/schema.ts:L2345`.
- `assignedToId` / `assigned_to_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assigned_to_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2346`.
- `dueDate` / `due_date` — timestamp; nullable. Definition: <code>timestamp("due_date")</code> Source: `shared/schema.ts:L2347`.
- `startedAt` / `started_at` — timestamp; nullable. Definition: <code>timestamp("started_at")</code> Source: `shared/schema.ts:L2348`.
- `completedAt` / `completed_at` — timestamp; nullable. Definition: <code>timestamp("completed_at")</code> Source: `shared/schema.ts:L2349`.
- `attempts` / `attempts` — jsonb; not null. Definition: <code>jsonb("attempts").$type&lt;ChangeEnvironmentStageAttempt[]&gt;().notNull().default(sql`'[]'::jsonb`)</code> Source: `shared/schema.ts:L2350`.
- `notes` / `notes` — text; nullable. Definition: <code>text("notes")</code> Source: `shared/schema.ts:L2351`.
- `evidence` / `evidence` — text; nullable. Definition: <code>text("evidence")</code> Source: `shared/schema.ts:L2352`.
- `deployedById` / `deployed_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("deployed_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2353`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2354`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2355`.
**Declared column foreign keys:** `changeId` → `changes.id` (ON DELETE CASCADE); `assignedToId` → `users.id` (ON DELETE SET NULL); `deployedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

#### `change_pirs` — Drizzle export `changePIRs` — `shared/schema.ts:L2359`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2360`.
- `changeId` / `change_id` — varchar; not null; FK → changes.id (ON DELETE CASCADE). Definition: <code>varchar("change_id").notNull().unique().references(() =&gt; changes.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2361`.
- `outcome` / `outcome` — text; not null. Definition: <code>text("outcome").notNull().default("successful")</code> Source: `shared/schema.ts:L2362`.
- `summary` / `summary` — text; not null. Definition: <code>text("summary").notNull()</code> Source: `shared/schema.ts:L2363`.
- `lessonsLearned` / `lessons_learned` — text; nullable. Definition: <code>text("lessons_learned")</code> Source: `shared/schema.ts:L2364`.
- `incidentsCaused` / `incidents_caused` — text; nullable. Definition: <code>text("incidents_caused")</code> Source: `shared/schema.ts:L2365`.
- `followUpActions` / `follow_up_actions` — text; nullable. Definition: <code>text("follow_up_actions")</code> Source: `shared/schema.ts:L2366`.
- `completedById` / `completed_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("completed_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2367`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2368`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2369`.
**Declared column foreign keys:** `changeId` → `changes.id` (ON DELETE CASCADE); `completedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:** none declared in the `pgTable` callback.

### 5.6 Project Management (10 tables)

#### `projects` — Drizzle export `projects` — `shared/schema.ts:L88`

**Columns (15):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L89`.
- `name` / `name` — text; not null. Definition: <code>text("name").notNull().unique()</code> Source: `shared/schema.ts:L91`.
- `title` / `title` — varchar; not null. Definition: <code>varchar("title", { length: 255 }).notNull().default("")</code> Source: `shared/schema.ts:L92`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L93`.
- `status` / `status` — varchar; not null. Definition: <code>varchar("status", { length: 50 }).notNull().default("Planning")</code> Source: `shared/schema.ts:L94`.
- `healthStatus` / `health_status` — varchar; not null. Definition: <code>varchar("health_status", { length: 50 }).notNull().default("On Track")</code> Source: `shared/schema.ts:L95`.
- `startDate` / `start_date` — timestamp; not null. Definition: <code>timestamp("start_date", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L96`.
- `targetEndDate` / `target_end_date` — timestamp; not null. Definition: <code>timestamp("target_end_date", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L97`.
- `actualEndDate` / `actual_end_date` — timestamp; nullable. Definition: <code>timestamp("actual_end_date", { withTimezone: true })</code> Source: `shared/schema.ts:L98`.
- `budget` / `budget` — decimal; not null. Definition: <code>decimal("budget", { precision: 12, scale: 2 }).notNull().default("0.00")</code> Source: `shared/schema.ts:L99`.
- `actualSpend` / `actual_spend` — decimal; not null. Definition: <code>decimal("actual_spend", { precision: 12, scale: 2 }).notNull().default("0.00")</code> Source: `shared/schema.ts:L100`.
- `createdBy` / `created_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L101`.
- `isActive` / `is_active` — boolean; not null. Definition: <code>boolean("is_active").notNull().default(true)</code> Source: `shared/schema.ts:L102`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L103`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L104`.
**Declared column foreign keys:** `createdBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("projects_status_check", sql`${table.status} IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled')`)</code>
- check: <code>check("projects_health_status_check", sql`${table.healthStatus} IN ('On Track', 'At Risk', 'Delayed')`)</code>
- check: <code>check("projects_target_end_after_start_check", sql`${table.targetEndDate} &gt;= ${table.startDate}`)</code>
- check: <code>check("projects_budget_nonnegative_check", sql`${table.budget} &gt;= 0`)</code>
- check: <code>check("projects_actual_spend_nonnegative_check", sql`${table.actualSpend} &gt;= 0`)</code>
- index: <code>index("projects_status_idx")</code>
- index: <code>index("projects_health_status_idx")</code>
- index: <code>index("projects_created_by_idx")</code>

#### `project_baselines` — Drizzle export `projectBaselines` — `shared/schema.ts:L116`

**Columns (9):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L117`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L118`.
- `versionNumber` / `version_number` — varchar; not null. Definition: <code>varchar("version_number", { length: 20 }).notNull()</code> Source: `shared/schema.ts:L119`.
- `baselineBudget` / `baseline_budget` — decimal; not null. Definition: <code>decimal("baseline_budget", { precision: 12, scale: 2 }).notNull()</code> Source: `shared/schema.ts:L120`.
- `baselineStartDate` / `baseline_start_date` — date; not null. Definition: <code>date("baseline_start_date").notNull()</code> Source: `shared/schema.ts:L121`.
- `baselineTargetEndDate` / `baseline_target_end_date` — date; not null. Definition: <code>date("baseline_target_end_date").notNull()</code> Source: `shared/schema.ts:L122`.
- `approvedBy` / `approved_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("approved_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L123`.
- `revisionNote` / `revision_note` — text; nullable. Definition: <code>text("revision_note")</code> Source: `shared/schema.ts:L124`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L125`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `approvedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("project_baselines_project_version_uq")</code>
- index: <code>index("project_baselines_project_created_idx")</code>
- check: <code>check("project_baselines_budget_nonnegative_check", sql`${table.baselineBudget} &gt;= 0`)</code>
- check: <code>check("project_baselines_target_after_start_check", sql`${table.baselineTargetEndDate} &gt;= ${table.baselineStartDate}`)</code>

#### `project_managers` — Drizzle export `projectManagers` — `shared/schema.ts:L133`

**Columns (3):**
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L134`.
- `userId` / `user_id` — varchar; not null; FK → users.id (ON DELETE CASCADE). Definition: <code>varchar("user_id").notNull().references(() =&gt; users.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L135`.
- `isPrimary` / `is_primary` — boolean; not null. Definition: <code>boolean("is_primary").notNull().default(false)</code> Source: `shared/schema.ts:L136`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `userId` → `users.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- primaryKey: <code>primaryKey({ columns: [table.projectId, table.userId], name: "project_managers_pk" })</code>
- uniqueIndex: <code>uniqueIndex("project_managers_one_primary_idx")</code>
- index: <code>index("project_managers_user_project_idx")</code>

#### `project_team_members` — Drizzle export `projectTeamMembers` — `shared/schema.ts:L143`

**Columns (4):**
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L144`.
- `userId` / `user_id` — varchar; not null; FK → users.id (ON DELETE CASCADE). Definition: <code>varchar("user_id").notNull().references(() =&gt; users.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L145`.
- `roleTitle` / `role_title` — varchar; not null. Definition: <code>varchar("role_title", { length: 100 }).notNull().default("Team Member")</code> Source: `shared/schema.ts:L146`.
- `assignedAt` / `assigned_at` — timestamp; not null. Definition: <code>timestamp("assigned_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L147`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `userId` → `users.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- primaryKey: <code>primaryKey({ columns: [table.projectId, table.userId], name: "project_team_members_pk" })</code>
- index: <code>index("project_team_members_user_project_idx")</code>

#### `project_milestones` — Drizzle export `projectMilestones` — `shared/schema.ts:L153`

**Columns (8):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L154`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L155`.
- `title` / `title` — varchar; not null. Definition: <code>varchar("title", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L156`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L157`.
- `dueDate` / `due_date` — timestamp; not null. Definition: <code>timestamp("due_date", { withTimezone: true }).notNull()</code> Source: `shared/schema.ts:L158`.
- `completionDate` / `completion_date` — timestamp; nullable. Definition: <code>timestamp("completion_date", { withTimezone: true })</code> Source: `shared/schema.ts:L159`.
- `status` / `status` — varchar; not null. Definition: <code>varchar("status", { length: 50 }).notNull().default("Pending")</code> Source: `shared/schema.ts:L160`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L161`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- check: <code>check("project_milestones_status_check", sql`${table.status} IN ('Pending', 'In Progress', 'Completed', 'Delayed')`)</code>
- index: <code>index("project_milestones_project_due_idx")</code>

#### `project_assets` — Drizzle export `projectAssets` — `shared/schema.ts:L167`

**Columns (3):**
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L168`.
- `assetId` / `asset_id` — varchar; not null; FK → assets.id (ON DELETE CASCADE). Definition: <code>varchar("asset_id").notNull().references(() =&gt; assets.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L169`.
- `associationType` / `association_type` — varchar; not null. Definition: <code>varchar("association_type", { length: 50 }).notNull().default("Deployed")</code> Source: `shared/schema.ts:L170`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `assetId` → `assets.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- primaryKey: <code>primaryKey({ columns: [table.projectId, table.assetId], name: "project_assets_pk" })</code>
- check: <code>check("project_assets_association_type_check", sql`${table.associationType} IN ('Deployed', 'Decommissioned', 'Upgraded')`)</code>
- index: <code>index("project_assets_asset_project_idx")</code>

#### `project_tasks` — Drizzle export `projectTasks` — `shared/schema.ts:L177`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L178`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L179`.
- `title` / `title` — varchar; not null. Definition: <code>varchar("title", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L180`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L181`.
- `status` / `status` — varchar; not null. Definition: <code>varchar("status", { length: 50 }).notNull().default("Backlog")</code> Source: `shared/schema.ts:L182`.
- `priority` / `priority` — varchar; not null. Definition: <code>varchar("priority", { length: 20 }).notNull().default("Medium")</code> Source: `shared/schema.ts:L183`.
- `assigneeId` / `assignee_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("assignee_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L184`.
- `estimatedHours` / `estimated_hours` — decimal; not null. Definition: <code>decimal("estimated_hours", { precision: 6, scale: 2 }).notNull().default("0.00")</code> Source: `shared/schema.ts:L185`.
- `loggedHours` / `logged_hours` — decimal; not null. Definition: <code>decimal("logged_hours", { precision: 6, scale: 2 }).notNull().default("0.00")</code> Source: `shared/schema.ts:L186`.
- `dueDate` / `due_date` — timestamp; nullable. Definition: <code>timestamp("due_date", { withTimezone: true })</code> Source: `shared/schema.ts:L187`.
- `sortOrder` / `sort_order` — integer; not null. Definition: <code>integer("sort_order").notNull().default(0)</code> Source: `shared/schema.ts:L188`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L189`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `assigneeId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("project_tasks_status_check", sql`${table.status} IN ('Backlog', 'To Do', 'In Progress', 'In Review', 'Done')`)</code>
- check: <code>check("project_tasks_priority_check", sql`${table.priority} IN ('Low', 'Medium', 'High', 'Critical')`)</code>
- check: <code>check("project_tasks_estimated_hours_check", sql`${table.estimatedHours} &gt;= 0`)</code>
- check: <code>check("project_tasks_logged_hours_check", sql`${table.loggedHours} &gt;= 0`)</code>
- index: <code>index("project_tasks_project_status_order_idx")</code>
- index: <code>index("project_tasks_assignee_project_idx")</code>

#### `project_risks` — Drizzle export `projectRisks` — `shared/schema.ts:L199`

**Columns (17):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L200`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L201`.
- `title` / `title` — varchar; not null. Definition: <code>varchar("title", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L202`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L203`.
- `category` / `category` — varchar; not null. Definition: <code>varchar("category", { length: 50 }).notNull().default("Technical")</code> Source: `shared/schema.ts:L204`.
- `probability` / `probability` — integer; not null. Definition: <code>integer("probability").notNull()</code> Source: `shared/schema.ts:L205`.
- `impact` / `impact` — integer; not null. Definition: <code>integer("impact").notNull()</code> Source: `shared/schema.ts:L206`.
- `riskScore` / `risk_score` — integer; nullable. Definition: <code>integer("risk_score").generatedAlwaysAs(sql`probability * impact`)</code> Source: `shared/schema.ts:L207`.
- `residualProbability` / `residual_probability` — integer; nullable. Definition: <code>integer("residual_probability")</code> Source: `shared/schema.ts:L208`.
- `residualImpact` / `residual_impact` — integer; nullable. Definition: <code>integer("residual_impact")</code> Source: `shared/schema.ts:L209`.
- `mitigationStrategy` / `mitigation_strategy` — text; nullable. Definition: <code>text("mitigation_strategy")</code> Source: `shared/schema.ts:L210`.
- `contingencyPlan` / `contingency_plan` — text; nullable. Definition: <code>text("contingency_plan")</code> Source: `shared/schema.ts:L211`.
- `reviewDate` / `review_date` — date; nullable. Definition: <code>date("review_date")</code> Source: `shared/schema.ts:L212`.
- `status` / `status` — varchar; not null. Definition: <code>varchar("status", { length: 50 }).notNull().default("Identified")</code> Source: `shared/schema.ts:L213`.
- `ownerId` / `owner_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L214`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L215`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L216`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `ownerId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("project_risks_category_check", sql`${table.category} IN ('Technical', 'Financial', 'Operational', 'Schedule', 'Compliance')`)</code>
- check: <code>check("project_risks_probability_check", sql`${table.probability} BETWEEN 1 AND 5`)</code>
- check: <code>check("project_risks_impact_check", sql`${table.impact} BETWEEN 1 AND 5`)</code>
- check: <code>check("project_risks_residual_probability_check", sql`${table.residualProbability} IS NULL OR ${table.residualProbability} BETWEEN 1 AND 5`)</code>
- check: <code>check("project_risks_residual_impact_check", sql`${table.residualImpact} IS NULL OR ${table.residualImpact} BETWEEN 1 AND 5`)</code>
- check: <code>check("project_risks_status_check", sql`${table.status} IN ('Identified', 'Mitigated', 'Accepted', 'Closed')`)</code>
- index: <code>index("project_risks_project_status_idx")</code>
- index: <code>index("project_risks_owner_project_idx")</code>

#### `project_changes` — Drizzle export `projectChanges` — `shared/schema.ts:L228`

**Columns (10):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L229`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L230`.
- `rfcNumber` / `rfc_number` — varchar; not null. Definition: <code>varchar("rfc_number", { length: 50 }).notNull()</code> Source: `shared/schema.ts:L231`.
- `title` / `title` — varchar; not null. Definition: <code>varchar("title", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L232`.
- `reason` / `reason` — text; nullable. Definition: <code>text("reason")</code> Source: `shared/schema.ts:L233`.
- `impactAnalysis` / `impact_analysis` — text; nullable. Definition: <code>text("impact_analysis")</code> Source: `shared/schema.ts:L234`.
- `status` / `status` — varchar; not null. Definition: <code>varchar("status", { length: 50 }).notNull().default("Draft")</code> Source: `shared/schema.ts:L235`.
- `requestedBy` / `requested_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("requested_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L236`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L237`.
- `updatedAt` / `updated_at` — timestamp; not null. Definition: <code>timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L238`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `requestedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("project_changes_status_check", sql`${table.status} IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Implemented')`)</code>
- uniqueIndex: <code>uniqueIndex("project_changes_rfc_number_uq")</code>
- index: <code>index("project_changes_project_status_idx")</code>

#### `project_documents` — Drizzle export `projectDocuments` — `shared/schema.ts:L245`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L246`.
- `projectId` / `project_id` — varchar; not null; FK → projects.id (ON DELETE CASCADE). Definition: <code>varchar("project_id").notNull().references(() =&gt; projects.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L247`.
- `name` / `name` — varchar; not null. Definition: <code>varchar("name", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L248`.
- `version` / `version` — varchar; not null. Definition: <code>varchar("version", { length: 50 }).notNull().default("1.0")</code> Source: `shared/schema.ts:L249`.
- `fileUrl` / `file_url` — text; not null. Definition: <code>text("file_url").notNull()</code> Source: `shared/schema.ts:L250`.
- `category` / `category` — varchar; not null. Definition: <code>varchar("category", { length: 50 }).notNull().default("Charter")</code> Source: `shared/schema.ts:L251`.
- `uploadedBy` / `uploaded_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("uploaded_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L252`.
- `filePath` / `file_path` — text; not null. Definition: <code>text("file_path").notNull()</code> Source: `shared/schema.ts:L253`.
- `originalName` / `original_name` — varchar; not null. Definition: <code>varchar("original_name", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L254`.
- `mimeType` / `mime_type` — varchar; not null. Definition: <code>varchar("mime_type", { length: 255 }).notNull()</code> Source: `shared/schema.ts:L255`.
- `fileSize` / `file_size` — integer; not null. Definition: <code>integer("file_size").notNull()</code> Source: `shared/schema.ts:L256`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L257`.
**Declared column foreign keys:** `projectId` → `projects.id` (ON DELETE CASCADE); `uploadedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("project_documents_category_check", sql`${table.category} IN ('Charter', 'SOW', 'Architecture', 'Handover', 'Other')`)</code>
- check: <code>check("project_documents_file_size_check", sql`${table.fileSize} &gt; 0`)</code>
- uniqueIndex: <code>uniqueIndex("project_documents_project_name_version_uq")</code>
- index: <code>index("project_documents_project_created_idx")</code>

### 5.7 Risk and GRC (2 tables)

#### `risk_register` — Drizzle export `risks` — `shared/schema.ts:L2250`

**Columns (19):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2251`.
- `changeId` / `change_id` — varchar; nullable; FK → changes.id (ON DELETE SET NULL). Definition: <code>varchar("change_id").references(() =&gt; changes.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2252`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L2253`.
- `description` / `description` — text; nullable. Definition: <code>text("description")</code> Source: `shared/schema.ts:L2254`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull().default("operational")</code> Source: `shared/schema.ts:L2255`.
- `likelihood` / `likelihood` — integer; not null. Definition: <code>integer("likelihood").notNull()</code> Source: `shared/schema.ts:L2256`.
- `impact` / `impact` — integer; not null. Definition: <code>integer("impact").notNull()</code> Source: `shared/schema.ts:L2257`.
- `riskScore` / `risk_score` — integer; not null. Definition: <code>integer("risk_score").notNull().default(0)</code> Source: `shared/schema.ts:L2258`.
- `mitigation` / `mitigation` — text; nullable. Definition: <code>text("mitigation")</code> Source: `shared/schema.ts:L2259`.
- `contingency` / `contingency` — text; nullable. Definition: <code>text("contingency")</code> Source: `shared/schema.ts:L2260`.
- `ownerId` / `owner_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2261`.
- `dueDate` / `due_date` — date; nullable. Definition: <code>date("due_date")</code> Source: `shared/schema.ts:L2262`.
- `residualLikelihood` / `residual_likelihood` — integer; nullable. Definition: <code>integer("residual_likelihood")</code> Source: `shared/schema.ts:L2263`.
- `residualImpact` / `residual_impact` — integer; nullable. Definition: <code>integer("residual_impact")</code> Source: `shared/schema.ts:L2264`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("identified")</code> Source: `shared/schema.ts:L2265`.
- `acceptanceReason` / `acceptance_reason` — text; nullable. Definition: <code>text("acceptance_reason")</code> Source: `shared/schema.ts:L2266`.
- `createdById` / `created_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("created_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2267`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2268`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2269`.
**Declared column foreign keys:** `changeId` → `changes.id` (ON DELETE SET NULL); `ownerId` → `users.id` (ON DELETE SET NULL); `createdById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- index: <code>index("risk_register_change_status_idx")</code>
- index: <code>index("risk_register_owner_idx")</code>

#### `change_risk_links` — Drizzle export `changeRiskLinks` — `shared/schema.ts:L2275`

**Columns (4):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2276`.
- `changeRequestId` / `change_request_id` — varchar; not null; FK → changes.id (ON DELETE CASCADE). Definition: <code>varchar("change_request_id").notNull().references(() =&gt; changes.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2277`.
- `riskId` / `risk_id` — varchar; not null; FK → risk_register.id (ON DELETE CASCADE). Definition: <code>varchar("risk_id").notNull().references(() =&gt; risks.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2278`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L2279`.
**Declared column foreign keys:** `changeRequestId` → `changes.id` (ON DELETE CASCADE); `riskId` → `risk_register.id` (ON DELETE CASCADE)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("change_risk_links_pair_idx")</code>

### 5.8 Knowledge Base and documentation (5 tables)

#### `kb_articles` — Drizzle export `kbArticles` — `shared/schema.ts:L1918`

**Columns (23):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1919`.
- `title` / `title` — text; not null. Definition: <code>text("title").notNull()</code> Source: `shared/schema.ts:L1920`.
- `slug` / `slug` — text; not null. Definition: <code>text("slug").notNull().default(sql`gen_random_uuid()::text`)</code> Source: `shared/schema.ts:L1921`.
- `content` / `content` — text; not null. Definition: <code>text("content").notNull()</code> Source: `shared/schema.ts:L1922`.
- `category` / `category` — text; not null. Definition: <code>text("category").notNull()</code> Source: `shared/schema.ts:L1923`.
- `tags` / `tags` — text; nullable. Definition: <code>text("tags")</code> Source: `shared/schema.ts:L1924`.
- `status` / `status` — text; not null. Definition: <code>text("status").notNull().default("draft")</code> Source: `shared/schema.ts:L1925`.
- `views` / `views` — integer; nullable. Definition: <code>integer("views").default(0)</code> Source: `shared/schema.ts:L1926`.
- `helpfulCount` / `helpful_count` — integer; nullable. Definition: <code>integer("helpful_count").default(0)</code> Source: `shared/schema.ts:L1927`.
- `notHelpfulCount` / `not_helpful_count` — integer; nullable. Definition: <code>integer("not_helpful_count").default(0)</code> Source: `shared/schema.ts:L1928`.
- `authorId` / `author_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("author_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1929`.
- `ownerId` / `owner_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("owner_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1930`.
- `authorLabel` / `author_label` — text; nullable. Definition: <code>text("author_label")</code> Source: `shared/schema.ts:L1931`.
- `ownerLabel` / `owner_label` — text; nullable. Definition: <code>text("owner_label")</code> Source: `shared/schema.ts:L1932`.
- `reviewDate` / `review_date` — date; nullable. Definition: <code>date("review_date")</code> Source: `shared/schema.ts:L1933`.
- `version` / `version` — text; not null. Definition: <code>text("version").notNull().default("1.0")</code> Source: `shared/schema.ts:L1934`.
- `isPublic` / `is_public` — boolean; not null. Definition: <code>boolean("is_public").notNull().default(false)</code> Source: `shared/schema.ts:L1935`.
- `isSystemGuide` / `is_system_guide` — boolean; not null. Definition: <code>boolean("is_system_guide").notNull().default(false)</code> Source: `shared/schema.ts:L1936`.
- `reviewedById` / `reviewed_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("reviewed_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1937`.
- `reviewedAt` / `reviewed_at` — timestamp; nullable. Definition: <code>timestamp("reviewed_at")</code> Source: `shared/schema.ts:L1938`.
- `publishedAt` / `published_at` — timestamp; nullable. Definition: <code>timestamp("published_at")</code> Source: `shared/schema.ts:L1939`.
- `createdAt` / `created_at` — timestamp; nullable. Definition: <code>timestamp("created_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1940`.
- `updatedAt` / `updated_at` — timestamp; nullable. Definition: <code>timestamp("updated_at").default(sql`now()`)</code> Source: `shared/schema.ts:L1941`.
**Declared column foreign keys:** `authorId` → `users.id` (ON DELETE SET NULL); `ownerId` → `users.id` (ON DELETE SET NULL); `reviewedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("kb_articles_slug_unique_ci")</code>
- index: <code>index("kb_articles_visibility_idx")</code>

#### `kb_article_versions` — Drizzle export `kbArticleVersions` — `shared/schema.ts:L1947`

**Columns (7):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1948`.
- `articleId` / `article_id` — varchar; not null; FK → kb_articles.id (ON DELETE RESTRICT). Definition: <code>varchar("article_id").notNull().references(() =&gt; kbArticles.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1949`.
- `version` / `version` — text; not null. Definition: <code>text("version").notNull()</code> Source: `shared/schema.ts:L1950`.
- `snapshot` / `snapshot` — jsonb; not null. Definition: <code>jsonb("snapshot").$type&lt;Record&lt;string, unknown&gt;&gt;().notNull()</code> Source: `shared/schema.ts:L1951`.
- `actorId` / `actor_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("actor_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1952`.
- `changeNote` / `change_note` — text; not null. Definition: <code>text("change_note").notNull()</code> Source: `shared/schema.ts:L1953`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1954`.
**Declared column foreign keys:** `articleId` → `kb_articles.id` (ON DELETE RESTRICT); `actorId` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("kb_article_versions_article_version_unique")</code>

#### `kb_article_attachments` — Drizzle export `kbArticleAttachments` — `shared/schema.ts:L1957`

**Columns (12):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1958`.
- `articleId` / `article_id` — varchar; not null; FK → kb_articles.id (ON DELETE RESTRICT). Definition: <code>varchar("article_id").notNull().references(() =&gt; kbArticles.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1959`.
- `articleVersion` / `article_version` — text; not null. Definition: <code>text("article_version").notNull()</code> Source: `shared/schema.ts:L1960`.
- `documentType` / `document_type` — text; not null. Definition: <code>text("document_type").notNull().default("official_policy")</code> Source: `shared/schema.ts:L1961`.
- `version` / `version` — integer; not null. Definition: <code>integer("version").notNull().default(1)</code> Source: `shared/schema.ts:L1962`.
- `originalName` / `original_name` — text; not null. Definition: <code>text("original_name").notNull()</code> Source: `shared/schema.ts:L1963`.
- `fileName` / `file_name` — text; not null. Definition: <code>text("file_name").notNull()</code> Source: `shared/schema.ts:L1964`.
- `fileType` / `file_type` — text; nullable. Definition: <code>text("file_type")</code> Source: `shared/schema.ts:L1965`.
- `fileSize` / `file_size` — integer; nullable. Definition: <code>integer("file_size")</code> Source: `shared/schema.ts:L1966`.
- `filePath` / `file_path` — text; not null. Definition: <code>text("file_path").notNull()</code> Source: `shared/schema.ts:L1967`.
- `uploadedBy` / `uploaded_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("uploaded_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1968`.
- `uploadedAt` / `uploaded_at` — timestamp; not null. Definition: <code>timestamp("uploaded_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1969`.
**Declared column foreign keys:** `articleId` → `kb_articles.id` (ON DELETE RESTRICT); `uploadedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("kb_article_attachments_name_type_version_unique")</code>
- index: <code>index("kb_article_attachments_article_uploaded_idx")</code>

#### `kb_article_control_mappings` — Drizzle export `kbArticleControlMappings` — `shared/schema.ts:L1977`

**Columns (13):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L1978`.
- `articleId` / `article_id` — varchar; not null; FK → kb_articles.id (ON DELETE RESTRICT). Definition: <code>varchar("article_id").notNull().references(() =&gt; kbArticles.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L1979`.
- `articleVersion` / `article_version` — text; not null. Definition: <code>text("article_version").notNull()</code> Source: `shared/schema.ts:L1980`.
- `framework` / `framework` — text; not null. Definition: <code>text("framework").notNull()</code> Source: `shared/schema.ts:L1981`.
- `controlId` / `control_id` — text; not null. Definition: <code>text("control_id").notNull()</code> Source: `shared/schema.ts:L1982`.
- `controlTitle` / `control_title` — text; not null. Definition: <code>text("control_title").notNull()</code> Source: `shared/schema.ts:L1983`.
- `implementationNotes` / `implementation_notes` — text; nullable. Definition: <code>text("implementation_notes")</code> Source: `shared/schema.ts:L1984`.
- `mappedBy` / `mapped_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("mapped_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1985`.
- `isActive` / `is_active` — boolean; not null. Definition: <code>boolean("is_active").notNull().default(true)</code> Source: `shared/schema.ts:L1986`.
- `removedBy` / `removed_by` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("removed_by").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L1987`.
- `removedAt` / `removed_at` — timestamp; nullable. Definition: <code>timestamp("removed_at")</code> Source: `shared/schema.ts:L1988`.
- `removalNote` / `removal_note` — text; nullable. Definition: <code>text("removal_note")</code> Source: `shared/schema.ts:L1989`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L1990`.
**Declared column foreign keys:** `articleId` → `kb_articles.id` (ON DELETE RESTRICT); `mappedBy` → `users.id` (ON DELETE SET NULL); `removedBy` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- uniqueIndex: <code>uniqueIndex("kb_article_control_mappings_unique_ci")</code>
- index: <code>index("kb_article_control_mappings_framework_idx")</code>

#### `kb_ticket_links` — Drizzle export `kbTicketLinks` — `shared/schema.ts:L2225`

**Columns (7):**
- `id` / `id` — varchar; primary key. Definition: <code>varchar("id").primaryKey().default(sql`gen_random_uuid()`)</code> Source: `shared/schema.ts:L2226`.
- `articleId` / `article_id` — varchar; not null; FK → kb_articles.id (ON DELETE RESTRICT). Definition: <code>varchar("article_id").notNull().references(() =&gt; kbArticles.id, { onDelete: "restrict" })</code> Source: `shared/schema.ts:L2227`.
- `articleVersion` / `article_version` — text; not null. Definition: <code>text("article_version").notNull()</code> Source: `shared/schema.ts:L2228`.
- `incidentId` / `incident_id` — varchar; nullable; FK → incidents.id (ON DELETE CASCADE). Definition: <code>varchar("incident_id").references(() =&gt; incidents.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2229`.
- `serviceRequestId` / `service_request_id` — varchar; nullable; FK → service_requests.id (ON DELETE CASCADE). Definition: <code>varchar("service_request_id").references(() =&gt; serviceRequests.id, { onDelete: "cascade" })</code> Source: `shared/schema.ts:L2230`.
- `linkedById` / `linked_by_id` — varchar; nullable; FK → users.id (ON DELETE SET NULL). Definition: <code>varchar("linked_by_id").references(() =&gt; users.id, { onDelete: "set null" })</code> Source: `shared/schema.ts:L2231`.
- `createdAt` / `created_at` — timestamp; not null. Definition: <code>timestamp("created_at").notNull().default(sql`now()`)</code> Source: `shared/schema.ts:L2232`.
**Declared column foreign keys:** `articleId` → `kb_articles.id` (ON DELETE RESTRICT); `incidentId` → `incidents.id` (ON DELETE CASCADE); `serviceRequestId` → `service_requests.id` (ON DELETE CASCADE); `linkedById` → `users.id` (ON DELETE SET NULL)
**Table-level indexes / checks / constraints:**
- check: <code>check("kb_ticket_links_one_ticket", sql`num_nonnulls(${table.incidentId}, ${table.serviceRequestId}) = 1`)</code>
- uniqueIndex: <code>uniqueIndex("kb_ticket_links_incident_unique")</code>
- uniqueIndex: <code>uniqueIndex("kb_ticket_links_request_unique")</code>

### 5.9 Cross-entity and lifecycle observations

- Identity associations use users/roles/permissions and employee records; some legacy employee department/location/manager columns remain plain identifiers rather than declared FKs.
- Project records have project-owned managers, team members, baselines, milestones, tasks, risks, changes and documents; `project_assets` joins projects to assets. Project records can be used without creating those optional associations.
- CMDB applications and servers connect through `application_server_links`; change impact uses `change_ci_links`. Network topology uses zones/devices/links/firewall rules/reviews; backups are schedules with job-run and restore-test evidence records.
- ITAM hardware, software license allocations, employee assignments, handovers, vendors/contracts, warehouses/consumables, purchase orders/receipts, budgets, maintenance, bookings, disposal, audits, requests and attachments have their own declared FKs and indexes.
- ITSM retains legacy `tickets`/comments/attachments alongside dedicated `incidents`, `service_requests`, `problems`, `changes`, CAB approvals/stages/PIR and structured catalog approvals. Cross-module project/asset links are nullable where declared.
- The KB has article versions, attachment and control-mapping tables; `kb_ticket_links` links an article to exactly one incident or service request using a check constraint.
- Text-based status/type fields are generally checked by route Zod validation and selected database `check(...)` constraints; do not assume every text column has a DB enum.

## 6. API route catalog and backend controllers

### 6.1 Route registration conventions

The catalog lists every literal `app`/`router` HTTP method/path registration found in non-test TypeScript under `server/` (392 registrations). Aliases and method variants are separate rows. “Pre-handler registrations” are middleware/handler identifiers present at the route declaration; global prefix middleware, feature mappings, validation and authorization inside handler bodies are described separately.

Main routes live in `server/routes.ts`; focused route groups are implemented in `server/auth.ts`, `server/project-management.ts`, `server/project-workspace.ts`, `server/knowledge-governance.ts`, `server/service-catalog.ts`, `server/vendor-contracts.ts`, `server/asset-handovers.ts`, `server/network-topology.ts`, `server/backup-governance.ts`, `server/it-components-compliance-report.ts`, `server/data-migration-center.ts`, `server/personnel-report.ts`, and `server/system-clear-data-route.ts.

| Method | Exact API path | Controller file | Pre-handler registrations |
|---|---|---|---|

### Alerts

| GET | `/api/alerts` | `server/routes.ts:L4566` | `requireAuth` |

### Asset audits

| GET | `/api/asset-audits` | `server/routes.ts:L950` | `requireAuth` |
| POST | `/api/asset-audits` | `server/routes.ts:L959` | `requireAuth` |
| GET | `/api/asset-audits/:id` | `server/routes.ts:L974` | `requireAuth` |
| PUT | `/api/asset-audits/:id` | `server/routes.ts:L984` | `requireAuth` |
| GET | `/api/asset-audits/:id/items` | `server/routes.ts:L998` | `requireAuth` |
| POST | `/api/asset-audits/:id/items` | `server/routes.ts:L1007` | `requireAuth` |
| PUT | `/api/asset-audits/:sessionId/items/:itemId` | `server/routes.ts:L1028` | `requireAuth` |

### Asset bookings

| GET | `/api/asset-bookings` | `server/routes.ts:L852` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/asset-bookings` | `server/routes.ts:L861` | `requireAuth`, `requireModule('asset_management')` |
| DELETE | `/api/asset-bookings/:id` | `server/routes.ts:L897` | `requireAuth` |
| GET | `/api/asset-bookings/:id` | `server/routes.ts:L873` | `requireAuth` |
| PUT | `/api/asset-bookings/:id` | `server/routes.ts:L883` | `requireAuth` |

### Asset disposal

| GET | `/api/asset-disposal` | `server/routes.ts:L910` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/asset-disposal` | `server/routes.ts:L919` | `requireAuth`, `requireModule('asset_management')` |
| PUT | `/api/asset-disposal/:id` | `server/routes.ts:L935` | `requireAuth` |

### Asset handovers

| GET | `/api/asset-handovers` | `server/asset-handovers.ts:L155` | `requireAuth`, `requireAnyPermission("asset_view", "assignment_create", "assignment_return", "employee_view", "system_admin")` |
| POST | `/api/asset-handovers` | `server/asset-handovers.ts:L268` | `requireAuth`, `requireAnyPermission("assignment_create", "assignment_return", "system_admin")` |
| GET | `/api/asset-handovers/:id` | `server/asset-handovers.ts:L221` | `requireAuth` |
| GET | `/api/asset-handovers/options` | `server/asset-handovers.ts:L53` | `requireAuth`, `requireAnyPermission("assignment_create", "assignment_return", "asset_view", "system_admin")` |

### Asset requests

| GET | `/api/asset-requests` | `server/routes.ts:L1084` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/asset-requests` | `server/routes.ts:L1093` | `requireAuth`, `requireModule('asset_management')` |
| GET | `/api/asset-requests/:id` | `server/routes.ts:L2036` | `requireAuth` |
| PUT | `/api/asset-requests/:id` | `server/routes.ts:L2046` | `requireAuth` |
| POST | `/api/asset-requests/:id/approve` | `server/routes.ts:L2060` | `requireAuth`, `requirePermission('system_admin')` |
| POST | `/api/asset-requests/:id/fulfill` | `server/routes.ts:L2090` | `requireAuth`, `requirePermission('system_admin')` |
| POST | `/api/asset-requests/:id/reject` | `server/routes.ts:L2074` | `requireAuth`, `requirePermission('system_admin')` |

### Assets & ITAM

| GET | `/api/assets` | `server/routes.ts:L2600` | `requireAuth`, `requireModule('asset_management')`, `requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin")` |
| POST | `/api/assets` | `server/routes.ts:L2636` | `requireAuth`, `requireModule('asset_management')`, `requirePermission('asset_create')` |
| DELETE | `/api/assets/:id` | `server/routes.ts:L2725` | `requireAuth`, `requirePermission('asset_delete')` |
| GET | `/api/assets/:id` | `server/routes.ts:L2618` | `requireAuth`, `requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin")` |
| PUT | `/api/assets/:id` | `server/routes.ts:L2677` | `requireAuth`, `requirePermission('asset_update')` |
| GET | `/api/assets/:id/attachments` | `server/routes.ts:L3180` | `requireAuth` |
| POST | `/api/assets/:id/attachments` | `server/routes.ts:L3190` | `requireAuth`, `requireModule('asset_management')`, `requirePermission('asset_update')` |
| DELETE | `/api/assets/:id/attachments/:attachId` | `server/routes.ts:L3220` | `requireAuth`, `requireModule('asset_management')`, `requirePermission('asset_update')` |
| GET | `/api/assets/:id/depreciation-schedule` | `server/routes.ts:L6901` | `requireAuth` |
| GET | `/api/assets/:id/license-allocations` | `server/routes.ts:L2753` | `requireAuth`, `requireModule("asset_management")` |
| POST | `/api/assets/:id/license-allocations` | `server/routes.ts:L2767` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")` |
| POST | `/api/assets/:id/license-allocations/:allocationId/release` | `server/routes.ts:L2780` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")` |
| GET | `/api/assets/:id/relationships` | `server/routes.ts:L1053` | `requireAuth` |
| POST | `/api/assets/bulk-update` | `server/routes.ts:L2792` | `requireAuth`, `requirePermission('asset_update')` |
| GET | `/api/assignments` | `server/routes.ts:L4205` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/assignments` | `server/routes.ts:L4226` | `requireAuth`, `requireModule('asset_management')`, `requirePermission('assignment_create')` |
| DELETE | `/api/assignments/:id` | `server/routes.ts:L4287` | `requireAuth`, `requirePermission('assignment_delete')` |
| GET | `/api/assignments/:id` | `server/routes.ts:L4214` | `requireAuth` |
| PUT | `/api/assignments/:id` | `server/routes.ts:L4256` | `requireAuth`, `requirePermission('assignment_update')` |
| POST | `/api/assignments/:id/return` | `server/routes.ts:L4314` | `requireAuth`, `requirePermission('assignment_return')` |

### Attachments

| GET | `/api/uploads/:filename` | `server/routes.ts:L3457` | `requireAuth` |

### Audit and compliance

| GET | `/api/audit-logs` | `server/routes.ts:L7118` | `requireAuth`, `requireAnyPermission("audit_view", "system_admin")` |

### Authentication

| POST | `/api/auth/2fa/disable` | `server/routes.ts:L2160` | `requireAuth` |
| POST | `/api/auth/2fa/enable` | `server/routes.ts:L2138` | `requireAuth` |
| POST | `/api/auth/2fa/setup` | `server/routes.ts:L2121` | `requireAuth` |
| POST | `/api/auth/2fa/verify` | `server/routes.ts:L2169` |  |
| POST | `/api/auth/verify-password` | `server/routes.ts:L2105` | `requireAuth` |
| POST | `/api/login` | `server/auth.ts:L134` | `loginLimiter` |
| POST | `/api/logout` | `server/auth.ts:L165` |  |
| POST | `/api/register` | `server/auth.ts:L107` |  |

### Backup governance

| GET | `/api/backup-schedules` | `server/backup-governance.ts:L168` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/backup-schedules` | `server/backup-governance.ts:L195` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| PUT | `/api/backup-schedules/:id` | `server/backup-governance.ts:L208` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/backup-schedules/:id/restore-tests` | `server/backup-governance.ts:L285` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/backup-schedules/:id/runs` | `server/backup-governance.ts:L261` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/backup-schedules/options` | `server/backup-governance.ts:L154` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/backup-schedules/restore-tests` | `server/backup-governance.ts:L242` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/backup-schedules/runs` | `server/backup-governance.ts:L224` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |

### Bulk migration/import

| POST | `/api/data-migrations/:batchId/import` | `server/data-migration-center.ts:L1305` | `...guards`, `commitHandler` |
| POST | `/api/data-migrations/:moduleKey/preview` | `server/data-migration-center.ts:L1209` | `...guards`, `requireEnabledModule`, `parseMultipart`, `previewHandler` |
| GET | `/api/data-migrations/:moduleKey/template` | `server/data-migration-center.ts:L1169` | `...guards`, `requireEnabledModule`, `templateHandler` |
| GET | `/api/data-migrations/history` | `server/data-migration-center.ts:L1155` | `...guards`, `historyHandler` |
| GET | `/api/data-migrations/modules` | `server/data-migration-center.ts:L1121` | `...guards`, `moduleListHandler` |
| POST | `/api/import/:moduleKey/:batchId/commit` | `server/data-migration-center.ts:L1306` | `...guards`, `commitHandler` |
| POST | `/api/import/:moduleKey/preview` | `server/data-migration-center.ts:L1210` | `...guards`, `requireEnabledModule`, `parseMultipart`, `previewHandler` |
| GET | `/api/import/:moduleKey/template` | `server/data-migration-center.ts:L1170` | `...guards`, `requireEnabledModule`, `templateHandler` |
| GET | `/api/import/assets-export` | `server/routes.ts:L7284` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/import/excel` | `server/routes.ts:L7420` | `requireAuth` |
| POST | `/api/import/excel` | `server/routes.ts:L7427` | `requireAuth`, `upload.single('file')` |
| GET | `/api/import/history` | `server/data-migration-center.ts:L1156` | `...guards`, `historyHandler` |
| GET | `/api/import/modules` | `server/data-migration-center.ts:L1122` | `...guards`, `moduleListHandler` |
| GET | `/api/import/template` | `server/routes.ts:L7313` | `requireAuth` |
| GET | `/api/import/template` | `server/routes.ts:L7320` | `requireAuth` |

### CMDB

| GET | `/api/applications` | `server/routes.ts:L2891` | `requireAuth`, `requireModule("cmdb")`, `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` |
| POST | `/api/applications` | `server/routes.ts:L2942` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_create")` |
| PUT | `/api/applications/:id` | `server/routes.ts:L2958` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| GET | `/api/applications/:id/documents` | `server/routes.ts:L3350` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| POST | `/api/applications/:id/documents` | `server/routes.ts:L3354` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")`, `diskUpload.single("file")` |
| GET | `/api/applications/:id/documents/:documentId` | `server/routes.ts:L3357` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| GET | `/api/applications/:id/servers` | `server/routes.ts:L2977` | `requireAuth`, `requireModule("cmdb")`, `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` |
| GET | `/api/cmdb/application-options` | `server/routes.ts:L2878` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| GET | `/api/cmdb/change-options` | `server/routes.ts:L8553` | `requireAuth`, `requireModule("itsm")`, `requireModule("cmdb")` |
| GET | `/api/servers` | `server/routes.ts:L2998` | `requireAuth`, `requireModule("cmdb")`, `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` |
| POST | `/api/servers` | `server/routes.ts:L3035` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_create")` |
| PUT | `/api/servers/:id` | `server/routes.ts:L3056` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| GET | `/api/servers/:id/applications` | `server/routes.ts:L3083` | `requireAuth`, `requireModule("cmdb")`, `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` |
| GET | `/api/servers/:id/documents` | `server/routes.ts:L3361` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |
| POST | `/api/servers/:id/documents` | `server/routes.ts:L3365` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")`, `diskUpload.single("file")` |
| GET | `/api/servers/:id/documents/:documentId` | `server/routes.ts:L3368` | `requireAuth`, `requireModule("cmdb")`, `requirePermission("asset_update")` |

### Catalog

| GET | `/api/catalog/items` | `server/routes.ts:L8178` | `requireAuth` |
| POST | `/api/catalog/items` | `server/routes.ts:L8193` | `requireAuth`, `requirePermission("system_admin")` |
| DELETE | `/api/catalog/items/:id` | `server/routes.ts:L8218` | `requireAuth`, `requirePermission("system_admin")` |
| GET | `/api/catalog/items/:id` | `server/routes.ts:L8185` | `requireAuth` |
| PUT | `/api/catalog/items/:id` | `server/routes.ts:L8205` | `requireAuth`, `requirePermission("system_admin")` |
| POST | `/api/catalog/items/:id/request` | `server/routes.ts:L8228` | `requireAuth`, `requireModule("itsm")` |

### Changes and CAB

| GET | `/api/changes` | `server/routes.ts:L8579` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/changes` | `server/routes.ts:L8623` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| DELETE | `/api/changes/:changeId/approvals/:approvalId` | `server/routes.ts:L8831` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/changes/:changeId/approvals/:approvalId` | `server/routes.ts:L8859` | `requireAuth`, `requireModule("itsm")`, `requireAnyPermission("change_approve", "change_manage", "system_admin")` |
| DELETE | `/api/changes/:id` | `server/routes.ts:L8741` | `requireAuth`, `requirePermission("system_admin")` |
| GET | `/api/changes/:id` | `server/routes.ts:L8608` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/changes/:id` | `server/routes.ts:L8666` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| GET | `/api/changes/:id/approvals` | `server/routes.ts:L8749` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/changes/:id/approvals` | `server/routes.ts:L8761` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/assign` | `server/routes.ts:L8939` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/cancel` | `server/routes.ts:L9019` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/complete` | `server/routes.ts:L9009` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| GET | `/api/changes/:id/pir` | `server/routes.ts:L8906` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/changes/:id/pir` | `server/routes.ts:L8915` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| PUT | `/api/changes/:id/pir` | `server/routes.ts:L8930` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| GET | `/api/changes/:id/stages` | `server/routes.ts:L9030` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/changes/:id/stages/:stageId` | `server/routes.ts:L9047` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/stages/init` | `server/routes.ts:L9038` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/start` | `server/routes.ts:L8970` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| POST | `/api/changes/:id/submit` | `server/routes.ts:L8952` | `requireAuth`, `requireModule("itsm")`, `requirePermission("change_manage")` |
| GET | `/api/changes/events` | `server/routes.ts:L8381` | `requireAuth`, `requireModule("itsm")`, `cabEventsHandler` |
| GET | `/api/changes/pending-votes` | `server/routes.ts:L8603` | `requireAuth`, `requireModule("itsm")` |

### Compliance

| GET | `/api/compliance/assets/audit-due` | `server/routes.ts:L5884` | `requireAuth`, `requirePermission('compliance_view')` |
| GET | `/api/compliance/assets/security-classification/:classification` | `server/routes.ts:L5871` | `requireAuth`, `requirePermission('compliance_view')` |
| GET | `/api/compliance/assets/status/:status` | `server/routes.ts:L5900` | `requireAuth`, `requirePermission('compliance_view')` |
| GET | `/api/compliance/dashboard` | `server/routes.ts:L5926` | `requireAuth`, `requirePermission('compliance_view')` |
| GET | `/api/compliance/vendors/risk/:level` | `server/routes.ts:L5913` | `requireAuth`, `requirePermission('compliance_view')` |

### Employees & access governance

| GET | `/api/access-governance` | `server/routes.ts:L3817` | `requireAuth`, `requireModule("asset_management")`, `requireAnyPermission("employee_update", "access_governance_view", "system_admin")` |
| GET | `/api/access-governance/catalog` | `server/routes.ts:L3808` | `requireAuth`, `requireModule("asset_management")`, `requireAnyPermission("employee_update", "access_governance_view", "system_admin")` |
| GET | `/api/employees` | `server/routes.ts:L3679` | `requireAuth`, `requireModule('asset_management')` |
| POST | `/api/employees` | `server/routes.ts:L4154` | `requireAuth`, `requireModule('asset_management')`, `requirePermission('employee_create')` |
| DELETE | `/api/employees/:id` | `server/routes.ts:L4198` | `requireAuth`, `requirePermission('employee_delete')` |
| GET | `/api/employees/:id` | `server/routes.ts:L3688` | `requireAuth` |
| PUT | `/api/employees/:id` | `server/routes.ts:L4171` | `requireAuth`, `requirePermission('employee_update')` |
| GET | `/api/employees/:id/access-rights` | `server/routes.ts:L3933` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |
| POST | `/api/employees/:id/access-rights` | `server/routes.ts:L3944` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |
| PUT | `/api/employees/:id/access-rights/:rightId` | `server/routes.ts:L3991` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |
| POST | `/api/employees/:id/access-rights/:rightId/extend` | `server/routes.ts:L4064` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |
| POST | `/api/employees/:id/access-rights/:rightId/revoke` | `server/routes.ts:L4118` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |
| POST | `/api/employees/:id/offboard` | `server/routes.ts:L3710` | `requireAuth`, `requireModule("asset_management")`, `requireAnyPermission("employee_update", "offboarding_approve", "system_admin")` |
| GET | `/api/employees/:id/offboarding-review` | `server/routes.ts:L3700` | `requireAuth`, `requireModule("asset_management")`, `requireAnyPermission("employee_update", "offboarding_approve", "system_admin")` |
| POST | `/api/employees/:id/reactivate` | `server/routes.ts:L3776` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("employee_update")` |

### Financial

| GET | `/api/budgets` | `server/routes.ts:L5640` | `requireAuth`, `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")` |
| POST | `/api/budgets` | `server/routes.ts:L5649` | `requireAuth`, `requirePermission('budget_create')` |
| DELETE | `/api/budgets/:id` | `server/routes.ts:L5690` | `requireAuth`, `requirePermission('budget_delete')` |
| PUT | `/api/budgets/:id` | `server/routes.ts:L5666` | `requireAuth`, `requirePermission('budget_update')` |
| GET | `/api/contracts` | `server/routes.ts:L778` | `requireAuth`, `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")` |
| POST | `/api/contracts` | `server/routes.ts:L801` | `requireAuth`, `requirePermission('system_admin')` |
| DELETE | `/api/contracts/:id` | `server/routes.ts:L838` | `requireAuth`, `requirePermission('system_admin')` |
| GET | `/api/contracts/:id` | `server/routes.ts:L813` | `requireAuth` |
| PUT | `/api/contracts/:id` | `server/routes.ts:L823` | `requireAuth`, `requirePermission('system_admin')` |

### ITSM analytics

| GET | `/api/kpis` | `server/routes.ts:L9422` | `requireAuth` |

### Identity

| GET | `/api/permissions` | `server/routes.ts:L768` | `requireAuth`, `requirePermission('permission_view')` |
| GET | `/api/roles` | `server/routes.ts:L684` | `requireAuth`, `requirePermission('role_view')` |
| POST | `/api/roles` | `server/routes.ts:L705` | `requireAuth`, `requirePermission('role_create')` |
| DELETE | `/api/roles/:id` | `server/routes.ts:L746` | `requireAuth`, `requirePermission('role_delete')` |
| GET | `/api/roles/:id` | `server/routes.ts:L693` | `requireAuth`, `requirePermission('role_view')` |
| PUT | `/api/roles/:id` | `server/routes.ts:L722` | `requireAuth`, `requirePermission('role_update')` |
| GET | `/api/user` | `server/auth.ts:L176` |  |
| GET | `/api/users` | `server/routes.ts:L563` | `requireAuth`, `requirePermission('user_view')` |
| POST | `/api/users` | `server/routes.ts:L588` | `requireAuth`, `requirePermission('user_create')` |
| DELETE | `/api/users/:id` | `server/routes.ts:L661` | `requireAuth`, `requirePermission('user_delete')` |
| GET | `/api/users/:id` | `server/routes.ts:L574` | `requireAuth`, `requirePermission('user_view')` |
| PUT | `/api/users/:id` | `server/routes.ts:L614` | `requireAuth`, `requirePermission('user_update')` |
| GET | `/api/users/:id/permissions` | `server/routes.ts:L2239` | `requireAuth`, `requirePermission('user_view')` |
| GET | `/api/users/:id/roles` | `server/routes.ts:L2230` | `requireAuth`, `requirePermission('user_view')` |
| POST | `/api/users/:userId/roles` | `server/routes.ts:L2196` | `requireAuth`, `requirePermission('user_role_assign')` |
| DELETE | `/api/users/:userId/roles/:roleId` | `server/routes.ts:L2217` | `requireAuth`, `requirePermission('user_role_assign')` |

### Incidents

| GET | `/api/incidents` | `server/routes.ts:L1109` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/incidents` | `server/routes.ts:L1227` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/incidents/:id` | `server/routes.ts:L1195` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/incidents/:id` | `server/routes.ts:L1298` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| GET | `/api/incidents/:id/activity` | `server/routes.ts:L1208` | `requireAuth`, `requireModule("itsm")` |
| PATCH | `/api/incidents/:id/assignment` | `server/routes.ts:L1253` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| PATCH | `/api/incidents/:id/status` | `server/routes.ts:L1274` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| POST | `/api/incidents/:id/to-change` | `server/routes.ts:L1340` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| GET | `/api/incidents/options` | `server/routes.ts:L1146` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/incidents/projects` | `server/routes.ts:L1180` | `requireAuth`, `requireModule("itsm")`, `requireModule("project_management")`, `requirePermission("ticket_manage")` |

### Inventory

| GET | `/api/consumables` | `server/routes.ts:L5070` | `requireAuth`, `requireModule("asset_management")` |
| POST | `/api/consumables` | `server/routes.ts:L5099` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_create")` |
| PATCH | `/api/consumables/:id` | `server/routes.ts:L5125` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")` |
| POST | `/api/consumables/:id/draft-purchase-order` | `server/routes.ts:L5222` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("purchase_order_create")` |
| POST | `/api/consumables/:id/stock-movement` | `server/routes.ts:L5150` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")` |
| GET | `/api/consumables/options` | `server/routes.ts:L5053` | `requireAuth`, `requireModule("asset_management")` |
| GET | `/api/warehouse-locations` | `server/routes.ts:L5011` | `requireAuth`, `requireModule("asset_management")` |
| POST | `/api/warehouse-locations` | `server/routes.ts:L5019` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_create")` |
| PATCH | `/api/warehouse-locations/:id` | `server/routes.ts:L5047` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")` |
| PUT | `/api/warehouse-locations/:id` | `server/routes.ts:L5050` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")`, `updateWarehouseLocation` |
| PUT | `/api/warehouses/:id` | `server/routes.ts:L5051` | `requireAuth`, `requireModule("asset_management")`, `requirePermission("asset_update")`, `updateWarehouseLocation` |

### Legacy tickets

| GET | `/api/tickets` | `server/routes.ts:L1773` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets` | `server/routes.ts:L1842` | `requireAuth`, `requireModule('itsm')`, `requirePermission('ticket_manage')` |
| DELETE | `/api/tickets/:id` | `server/routes.ts:L1975` | `requireAuth`, `requireModule('itsm')`, `requirePermission('ticket_manage')` |
| GET | `/api/tickets/:id` | `server/routes.ts:L1827` | `requireAuth`, `requireModule('itsm')` |
| PUT | `/api/tickets/:id` | `server/routes.ts:L1855` | `requireAuth`, `requireModule('itsm')` |
| GET | `/api/tickets/:id/attachments` | `server/routes.ts:L3374` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/:id/attachments` | `server/routes.ts:L3391` | `requireAuth`, `requireModule('itsm')` |
| DELETE | `/api/tickets/:id/attachments/:attachId` | `server/routes.ts:L3433` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/:id/cancel-request` | `server/routes.ts:L1920` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/:id/close-request` | `server/routes.ts:L1900` | `requireAuth`, `requireModule('itsm')` |
| GET | `/api/tickets/:id/comments` | `server/routes.ts:L1988` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/:id/comments` | `server/routes.ts:L2005` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/:id/reopen-request` | `server/routes.ts:L1947` | `requireAuth`, `requireModule('itsm')` |
| GET | `/api/tickets/my-assigned` | `server/routes.ts:L1785` | `requireAuth`, `requireModule('itsm')` |
| GET | `/api/tickets/my-requests` | `server/routes.ts:L1795` | `requireAuth`, `requireModule('itsm')` |
| POST | `/api/tickets/my-requests` | `server/routes.ts:L1805` | `requireAuth`, `requireModule('itsm')` |

### Maintenance

| GET | `/api/maintenance-records` | `server/routes.ts:L5784` | `requireAuth` |
| POST | `/api/maintenance-records` | `server/routes.ts:L5793` | `requireAuth`, `requirePermission('maintenance_create')` |
| DELETE | `/api/maintenance-records/:id` | `server/routes.ts:L5847` | `requireAuth`, `requirePermission('maintenance_delete')` |
| PUT | `/api/maintenance-records/:id` | `server/routes.ts:L5823` | `requireAuth`, `requirePermission('maintenance_update')` |
| GET | `/api/maintenance-schedules` | `server/routes.ts:L5712` | `requireAuth` |
| POST | `/api/maintenance-schedules` | `server/routes.ts:L5721` | `requireAuth`, `requirePermission('maintenance_create')` |
| DELETE | `/api/maintenance-schedules/:id` | `server/routes.ts:L5762` | `requireAuth`, `requirePermission('maintenance_delete')` |
| PUT | `/api/maintenance-schedules/:id` | `server/routes.ts:L5738` | `requireAuth`, `requirePermission('maintenance_update')` |

### Module settings

| GET | `/api/module-settings` | `server/routes.ts:L7212` | `requireAuth` |
| PUT | `/api/module-settings/:moduleKey` | `server/routes.ts:L7237` | `requireAuth`, `requirePermission('system_admin')` |
| GET | `/api/module-settings/events` | `server/routes.ts:L7235` | `requireAuth`, `cabAccessEventsHandler` |

### Module status

| GET | `/api/module-status` | `server/routes.ts:L7194` |  |

### Network topology

| GET | `/api/network-topology/devices` | `server/network-topology.ts:L203` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/network-topology/devices` | `server/network-topology.ts:L219` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| PUT | `/api/network-topology/devices/:id` | `server/network-topology.ts:L228` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/network-topology/firewall-rules` | `server/network-topology.ts:L286` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/network-topology/firewall-rules` | `server/network-topology.ts:L309` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| PUT | `/api/network-topology/firewall-rules/:id` | `server/network-topology.ts:L325` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/network-topology/firewall-rules/:id/reviews` | `server/network-topology.ts:L343` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/network-topology/firewall-rules/:id/reviews` | `server/network-topology.ts:L354` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/network-topology/links` | `server/network-topology.ts:L243` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/network-topology/links` | `server/network-topology.ts:L255` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| DELETE | `/api/network-topology/links/:id` | `server/network-topology.ts:L273` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/network-topology/options` | `server/network-topology.ts:L162` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| GET | `/api/network-topology/zones` | `server/network-topology.ts:L178` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| POST | `/api/network-topology/zones` | `server/network-topology.ts:L181` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |
| PUT | `/api/network-topology/zones/:id` | `server/network-topology.ts:L190` | `requireAuth`, `requireAssetManagement`, `route(…, …)` |

### Organization

| GET | `/api/departments` | `server/routes.ts:L4850` | `requireAuth` |
| POST | `/api/departments` | `server/routes.ts:L4859` | `requireAuth`, `requirePermission('department_create')` |
| DELETE | `/api/departments/:id` | `server/routes.ts:L4900` | `requireAuth`, `requirePermission('department_delete')` |
| PUT | `/api/departments/:id` | `server/routes.ts:L4876` | `requireAuth`, `requirePermission('department_update')` |
| GET | `/api/locations` | `server/routes.ts:L4778` | `requireAuth` |
| POST | `/api/locations` | `server/routes.ts:L4787` | `requireAuth`, `requirePermission('location_create')` |
| DELETE | `/api/locations/:id` | `server/routes.ts:L4828` | `requireAuth`, `requirePermission('location_delete')` |
| PUT | `/api/locations/:id` | `server/routes.ts:L4804` | `requireAuth`, `requirePermission('location_update')` |

### Problems

| GET | `/api/problems` | `server/routes.ts:L8126` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/problems` | `server/routes.ts:L8139` | `requireAuth`, `requireModule("itsm")` |
| DELETE | `/api/problems/:id` | `server/routes.ts:L8155` | `requireAuth`, `requirePermission("system_admin")` |
| GET | `/api/problems/:id` | `server/routes.ts:L8131` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/problems/:id` | `server/routes.ts:L8147` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/problems/:id/link-incident` | `server/routes.ts:L8163` | `requireAuth`, `requireModule("itsm")` |
| DELETE | `/api/problems/:id/link-incident/:ticketId` | `server/routes.ts:L8170` | `requireAuth`, `requireModule("itsm")` |

### Procurement

| GET | `/api/purchase-orders` | `server/routes.ts:L5266` | `requireAuth`, `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")` |
| POST | `/api/purchase-orders` | `server/routes.ts:L5275` | `requireAuth`, `requirePermission('purchase_order_create')` |
| DELETE | `/api/purchase-orders/:id` | `server/routes.ts:L5452` | `requireAuth`, `requirePermission('purchase_order_delete')` |
| PUT | `/api/purchase-orders/:id` | `server/routes.ts:L5355` | `requireAuth`, `requirePermission('purchase_order_update')` |
| POST | `/api/purchase-orders/:id/create-assets` | `server/routes.ts:L5507` | `requireAuth`, `requirePermission('purchase_order_update')` |

### Projects

| GET | `/api/projects` | `server/project-management.ts:L350` | `requireAuth`, `enabled` |
| POST | `/api/projects` | `server/project-management.ts:L505` | `requireAuth`, `enabled` |
| DELETE | `/api/projects/:id` | `server/project-management.ts:L608` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id` | `server/project-management.ts:L427` | `requireAuth`, `enabled` |
| PUT | `/api/projects/:id` | `server/project-management.ts:L535` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/baselines` | `server/project-management.ts:L437` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/baselines` | `server/project-management.ts:L459` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/changes` | `server/project-workspace.ts:L450` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/changes` | `server/project-workspace.ts:L463` | `requireAuth`, `enabled` |
| DELETE | `/api/projects/:id/changes/:changeId` | `server/project-workspace.ts:L512` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/changes/:changeId` | `server/project-workspace.ts:L482` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/changes/:changeId/status` | `server/project-workspace.ts:L534` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/documents` | `server/project-workspace.ts:L565` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/documents` | `server/project-workspace.ts:L578` | `requireAuth`, `enabled`, `requireDocumentFile` |
| DELETE | `/api/projects/:id/documents/:documentId` | `server/project-workspace.ts:L659` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/documents/:documentId` | `server/project-workspace.ts:L626` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/documents/:documentId/download` | `server/project-workspace.ts:L646` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/milestones/:milestoneId` | `server/project-management.ts:L567` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/risks` | `server/project-workspace.ts:L338` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/risks` | `server/project-workspace.ts:L362` | `requireAuth`, `enabled` |
| DELETE | `/api/projects/:id/risks/:riskId` | `server/project-workspace.ts:L434` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/risks/:riskId` | `server/project-workspace.ts:L391` | `requireAuth`, `enabled` |
| GET | `/api/projects/:id/tasks` | `server/project-workspace.ts:L212` | `requireAuth`, `enabled` |
| POST | `/api/projects/:id/tasks` | `server/project-workspace.ts:L235` | `requireAuth`, `enabled` |
| DELETE | `/api/projects/:id/tasks/:taskId` | `server/project-workspace.ts:L322` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/tasks/:taskId` | `server/project-workspace.ts:L284` | `requireAuth`, `enabled` |
| PATCH | `/api/projects/:id/tasks/reorder` | `server/project-workspace.ts:L261` | `requireAuth`, `enabled` |
| GET | `/api/projects/options` | `server/project-management.ts:L321` | `requireAuth`, `enabled` |

### Report exports

| POST | `/api/report-exports/xlsx` | `server/routes.ts:L432` | `requireAuth`, `rateLimit(…)` |

### Reports and analytics

| GET | `/api/reports/asset-assignments` | `server/routes.ts:L6112` | `requireAuth` |
| GET | `/api/reports/asset-lifecycle` | `server/routes.ts:L6023` | `requireAuth` |
| GET | `/api/reports/asset-summary` | `server/routes.ts:L5977` | `requireAuth` |
| GET | `/api/reports/assets-by-department` | `server/routes.ts:L6374` | `requireAuth` |
| GET | `/api/reports/assignment-history` | `server/routes.ts:L6984` | `requireAuth` |
| GET | `/api/reports/assignments` | `server/routes.ts:L6191` | `requireAuth` |
| GET | `/api/reports/budget` | `server/routes.ts:L6719` | `requireAuth` |
| GET | `/api/reports/budget-analysis` | `server/routes.ts:L6335` | `requireAuth` |
| GET | `/api/reports/changes` | `server/routes.ts:L9084` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/reports/department` | `server/routes.ts:L6756` | `requireAuth` |
| GET | `/api/reports/depreciation` | `server/routes.ts:L6834` | `requireAuth` |
| GET | `/api/reports/expiring-warranties` | `server/routes.ts:L6405` | `requireAuth` |
| GET | `/api/reports/hardware` | `server/routes.ts:L6553` | `requireAuth` |
| GET | `/api/reports/hardware-inventory` | `server/routes.ts:L6082` | `requireAuth` |
| GET | `/api/reports/it-components-compliance` | `server/it-components-compliance-report.ts:L84` | `requireAuth`, `requireAssetManagement`, `requireComplianceRead` |
| PUT | `/api/reports/it-components-compliance/:componentType/:componentId/review` | `server/it-components-compliance-report.ts:L266` | `requireAuth`, `requireAssetManagement`, `requireAssetUpdate` |
| GET | `/api/reports/kb-articles` | `server/knowledge-governance.ts:L233` | `requireAuth`, `list()` |
| GET | `/api/reports/lifecycle` | `server/routes.ts:L6511` | `requireAuth` |
| GET | `/api/reports/maintenance` | `server/routes.ts:L6673` | `requireAuth` |
| GET | `/api/reports/maintenance-schedule` | `server/routes.ts:L6268` | `requireAuth` |
| GET | `/api/reports/missing-data` | `server/routes.ts:L6634` | `requireAuth` |
| GET | `/api/reports/personnel` | `server/personnel-report.ts:L24` | `requireAuth` |
| GET | `/api/reports/problems` | `server/routes.ts:L9079` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/reports/project-allocations` | `server/project-workspace.ts:L679` | `requireAuth`, `enabled` |
| GET | `/api/reports/purchase-orders` | `server/routes.ts:L6306` | `requireAuth` |
| GET | `/api/reports/purchase-orders-v2` | `server/routes.ts:L7088` | `requireAuth` |
| GET | `/api/reports/released-assets` | `server/routes.ts:L6929` | `requireAuth` |
| GET | `/api/reports/summary` | `server/routes.ts:L6488` | `requireAuth` |
| GET | `/api/reports/tickets` | `server/routes.ts:L2027` | `requireAuth`, `requireModule('itsm')`, `requirePermission('ticket_view_all')` |
| GET | `/api/reports/vendor-analysis` | `server/routes.ts:L6455` | `requireAuth` |
| GET | `/api/reports/vendors` | `server/routes.ts:L7056` | `requireAuth` |
| GET | `/api/reports/warranties` | `server/routes.ts:L6796` | `requireAuth` |

### Risk register

| GET | `/api/risk-users` | `server/routes.ts:L8256` | `requireAuth`, `requirePermission("change_manage")`, `requireModule("risk_management")` |
| GET | `/api/risks` | `server/routes.ts:L8266` | `requireAuth`, `requireModule("risk_management")` |
| POST | `/api/risks` | `server/routes.ts:L8298` | `requireAuth`, `requirePermission("change_manage")`, `requireModule("risk_management")` |
| PUT | `/api/risks/:riskId` | `server/routes.ts:L8335` | `requireAuth`, `requirePermission("change_manage")`, `requireModule("risk_management")` |

### SLA policies

| GET | `/api/sla-policies` | `server/routes.ts:L8070` | `requireAuth` |
| POST | `/api/sla-policies` | `server/routes.ts:L8079` | `requireAuth`, `requirePermission("system_admin")` |
| DELETE | `/api/sla-policies/:id` | `server/routes.ts:L8098` | `requireAuth`, `requirePermission("system_admin")` |
| PUT | `/api/sla-policies/:id` | `server/routes.ts:L8088` | `requireAuth`, `requirePermission("system_admin")` |

### Self-service APIs

| GET | `/api/my/asset-handovers` | `server/asset-handovers.ts:L419` | `requireAuth`, `requirePermission("my_assets_view")` |
| POST | `/api/my/asset-handovers/:id/acknowledge` | `server/asset-handovers.ts:L462` | `requireAuth`, `requirePermission("my_assets_view")` |
| GET | `/api/my/assets` | `server/routes.ts:L2568` | `requireAuth`, `requirePermission("my_assets_view")` |

### Service catalog and approvals

| GET | `/api/service-catalog/approvals` | `server/service-catalog.ts:L169` | `requireAuth`, `handle(…)` |
| POST | `/api/service-catalog/approvals/:id/decision` | `server/service-catalog.ts:L186` | `requireAuth`, `handle(…)` |
| GET | `/api/service-catalog/items` | `server/service-catalog.ts:L118` | `requireAuth`, `handle(…)` |
| GET | `/api/service-catalog/items/:id` | `server/service-catalog.ts:L124` | `requireAuth`, `handle(…)` |
| POST | `/api/service-catalog/items/:id/request` | `server/service-catalog.ts:L168` | `requireAuth`, `catalogRequestHandler` |
| GET | `/api/service-catalog/options` | `server/service-catalog.ts:L112` | `requireAuth`, `handle(…)` |

### Service requests

| GET | `/api/service-requests` | `server/routes.ts:L1360` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/service-requests` | `server/routes.ts:L1490` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/service-requests/:id` | `server/routes.ts:L1403` | `requireAuth`, `requireModule("itsm")` |
| PUT | `/api/service-requests/:id` | `server/routes.ts:L1687` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| GET | `/api/service-requests/:id/activity` | `server/routes.ts:L1470` | `requireAuth`, `requireModule("itsm")` |
| PATCH | `/api/service-requests/:id/approval` | `server/routes.ts:L1530` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| PATCH | `/api/service-requests/:id/assignment` | `server/routes.ts:L1547` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| GET | `/api/service-requests/:id/attachments` | `server/routes.ts:L3101` | `requireAuth`, `requireModule("itsm")` |
| POST | `/api/service-requests/:id/attachments` | `server/routes.ts:L3115` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/service-requests/:id/attachments/:attachId` | `server/routes.ts:L3162` | `requireAuth`, `requireModule("itsm")` |
| GET | `/api/service-requests/:id/catalog-approval` | `server/service-catalog.ts:L216` | `requireAuth`, `handle(…)` |
| PATCH | `/api/service-requests/:id/close` | `server/routes.ts:L1513` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |
| GET | `/api/service-requests/:id/consumable-options` | `server/routes.ts:L1416` | `requireAuth`, `requireModule("itsm")`, `requireModule("asset_management")`, `requirePermission("ticket_manage")` |
| POST | `/api/service-requests/:id/fulfill-consumable` | `server/routes.ts:L1608` | `requireAuth`, `requireModule("itsm")`, `requireModule("asset_management")`, `requirePermission("ticket_manage")` |
| PATCH | `/api/service-requests/:id/stage` | `server/routes.ts:L1570` | `requireAuth`, `requireModule("itsm")`, `requirePermission("ticket_manage")` |

### System administration

| POST | `/api/dropdowns/cleanup-duplicates` | `server/routes.ts:L7811` | `requireAuth`, `requirePermission('system_admin')` |
| POST | `/api/dropdowns/migrate-from-assets` | `server/routes.ts:L7824` | `requireAuth`, `requirePermission('system_admin')` |
| GET | `/api/dropdowns/options` | `server/routes.ts:L7728` |  |
| POST | `/api/dropdowns/options` | `server/routes.ts:L7751` | `requireAuth`, `requirePermission('system_admin')` |
| GET | `/api/dropdowns/options/:category` | `server/routes.ts:L7740` |  |
| DELETE | `/api/dropdowns/options/:id` | `server/routes.ts:L7798` | `requireAuth`, `requirePermission('system_admin')` |
| PUT | `/api/dropdowns/options/:id` | `server/routes.ts:L7773` | `requireAuth`, `requirePermission('system_admin')` |
| POST | `/api/dropdowns/seed` | `server/routes.ts:L7927` | `requireAuth`, `requirePermission('system_admin')` |
| GET | `/api/settings/:key` | `server/routes.ts:L7161` | `requireAuth` |
| PUT | `/api/settings/:key` | `server/routes.ts:L7173` | `requireAuth` |
| GET | `/api/system-settings` | `server/routes.ts:L2249` | `requireAuth`, `requirePermission('system_admin')` |
| PUT | `/api/system-settings` | `server/routes.ts:L2266` | `requireAuth`, `requirePermission('system_admin')` |
| POST | `/api/system/clear-data` | `server/system-clear-data-route.ts:L19` | `requireAuth`, `requireAdmin` |
| POST | `/api/system/seed-data` | `server/routes.ts:L2340` |  |
| POST | `/api/system/seed-itsm` | `server/routes.ts:L9137` | `requireAuth`, `requirePermission("system_admin")` |
| GET | `/api/system/status` | `server/routes.ts:L2323` |  |
| GET | `/api/system/update-check` | `server/routes.ts:L2304` | `requireAuth`, `requirePermission("system_admin")` |
| GET | `/api/system/version` | `server/routes.ts:L2290` |  |

### Vendors and contracts

| GET | `/api/vendor-contracts` | `server/vendor-contracts.ts:L154` | `requireAuth`, `handle(…)` |
| GET | `/api/vendor-management/options` | `server/vendor-contracts.ts:L117` | `requireAuth`, `handle(…)` |
| GET | `/api/vendor-management/vendors` | `server/vendor-contracts.ts:L127` | `requireAuth`, `handle(…)` |
| GET | `/api/vendors` | `server/routes.ts:L4922` | `requireAuth` |
| POST | `/api/vendors` | `server/routes.ts:L4931` | `requireAuth`, `requirePermission('vendor_create')` |
| DELETE | `/api/vendors/:id` | `server/routes.ts:L4986` | `requireAuth`, `requirePermission('vendor_delete')` |
| GET | `/api/vendors/:id` | `server/routes.ts:L4949` | `requireAuth` |
| PUT | `/api/vendors/:id` | `server/routes.ts:L4961` | `requireAuth`, `requirePermission('vendor_update')` |

### asset-relationships

| POST | `/api/asset-relationships` | `server/routes.ts:L1062` | `requireAuth` |
| DELETE | `/api/asset-relationships/:id` | `server/routes.ts:L1073` | `requireAuth` |

### dashboard

| GET | `/api/dashboard/executive` | `server/routes.ts:L4363` | `requireAuth` |
| GET | `/api/dashboard/stats` | `server/routes.ts:L4336` | `requireAuth` |

### kb

| GET | `/api/kb/articles` | `server/knowledge-governance.ts:L231` | `requireAuth`, `list()` |
| POST | `/api/kb/articles` | `server/knowledge-governance.ts:L262` | `requireAuth`, `route(…)` |
| DELETE | `/api/kb/articles/:id` | `server/knowledge-governance.ts:L283` | `requireAuth`, `route(…)` |
| GET | `/api/kb/articles/:id` | `server/knowledge-governance.ts:L234` | `requireAuth`, `route(…)` |
| PUT | `/api/kb/articles/:id` | `server/knowledge-governance.ts:L279` | `requireAuth`, `route(…)` |
| GET | `/api/kb/articles/:id/attachments` | `server/knowledge-governance.ts:L326` | `requireAuth`, `route(…)` |
| POST | `/api/kb/articles/:id/attachments` | `server/knowledge-governance.ts:L354` | `requireAuth`, `editorMiddleware`, `fileMiddleware`, `route(…)` |
| GET | `/api/kb/articles/:id/attachments/:attachmentId` | `server/knowledge-governance.ts:L409` | `requireAuth`, `route(…)` |
| GET | `/api/kb/articles/:id/controls` | `server/knowledge-governance.ts:L428` | `requireAuth`, `route(…)` |
| POST | `/api/kb/articles/:id/controls` | `server/knowledge-governance.ts:L446` | `requireAuth`, `editorMiddleware`, `route(…)` |
| POST | `/api/kb/articles/:id/controls/:mappingId/remove` | `server/knowledge-governance.ts:L473` | `requireAuth`, `editorMiddleware`, `route(…)` |
| POST | `/api/kb/articles/:id/rate` | `server/knowledge-governance.ts:L316` | `requireAuth`, `route(…)` |
| GET | `/api/kb/articles/:id/versions` | `server/knowledge-governance.ts:L239` | `requireAuth`, `route(…)` |
| GET | `/api/kb/options` | `server/knowledge-governance.ts:L221` | `requireAuth`, `route(…)` |
| GET | `/api/kb/search` | `server/knowledge-governance.ts:L232` | `requireAuth`, `list(…)` |

### 6.2 Global authorization, module gates and validation

1. Global security, request-size, session and rate-limit middleware is installed in `server/index.ts`; session authentication and the demo-viewer guard are configured by `setupAuth()` in `server/auth.ts`.
2. `registerRoutes()` registers the core personnel report and Excel report export, then installs a central `/api` middleware. For mapped/guarded paths it requires authentication, checks the enabled module, loads user roles/permissions, then calls `isPersonaApiAllowed()`; failures return 401/403 or a module-check 500.
3. Endpoint declarations add explicit `requireAuth`, `requirePermission`, `requireAnyPermission`, `requireModule` and route-specific upload/handler middleware. Registration order matters: `/api/report-exports/xlsx` and `/api/reports/personnel` are registered before the central `/api` middleware and have their own guards.
4. Body/query validation is implemented with shared `insert*Schema` values generated from Drizzle tables and focused Zod schemas in project, CMDB, network, backup, KB, catalog, vendor, report-export and migration controllers. Data migration additionally checks headers, types, allowed enums and referenced records before transactional commit.
5. `/api/tickets` has a route-prefix compatibility middleware in `server/routes.ts`; dedicated incidents/service requests coexist with legacy ticket endpoints, so API names alone do not imply identical underlying storage.

### 6.3 System state-clear operation

`POST /api/system/clear-data` is handled by `server/system-clear-data-route.ts`, calls the dependency-aware deletion plan in `server/system-data-reset.ts`, and records an audit event. It requires administrator password verification and rate limiting; reset exclusions preserve users, role/permission setup, core settings/lookups and system-guide KB records. The table plan is in `shared/system-data-reset.ts` and `docs/system-data-reset.md`.

## 7. State machines, SLA configuration and business timers

### 7.1 SLA policy and stored timers

`sla_policies` has `name`, optional `ticketType` and `category`, `priority`, `responseHours`, `resolutionHours`, `isActive`, and timestamps. Active policies are selected in `server/storage.ts` by priority and specificity: ticket type + category, ticket type without category, priority-only; otherwise hard-coded `TICKET_SLA_HOURS` defaults are used. Incident APIs validate `P1`–`P4`, map P1/P2/P3/P4 to critical/high/medium/low for target calculation, and accept an active SLA policy ID.

The hard-coded fallback priority calculation is impact × urgency (rows = impact, columns = urgency):

| Impact \ Urgency | High | Medium | Low |
|---|---|---|---|
| High | critical | high | medium |
| Medium | high | medium | low |
| Low | medium | low | low |

Fallback response / resolution targets are elapsed hours (not a business-hours calendar):

| Priority | Response target | Resolution target |
|---|---:|---:|
| critical (P1) | 1 hour | 4 hours |
| high (P2) | 2 hours | 8 hours |
| medium (P3) | 4 hours | 24 hours |
| low (P4) | 8 hours | 72 hours |

Legacy `tickets` stores `sla_response_due_at`, `sla_resolution_due_at`, `first_responded_at`, and `resolved_at`. Dedicated `incidents` stores `response_due_at`, `resolve_due_at`, `first_responded_at`, `resolved_at`, `closed_at`, and policy reference. `service_requests` stores fulfillment due timestamp/status fields. There is no separate timer/clock table; dates are persisted on business records and activity/audit tables carry event history.

`/sla-policies` is the policy UI; `/api/sla-policies` provides policy CRUD. Its page requires ITSM plus system administration, but GET policy access is not centrally ITSM-gated. See section 4.2.

### 7.2 Incident lifecycle

`server/incident-lifecycle.ts` permits `New → In Progress`; `In Progress → Pending | Resolved`; `Pending → In Progress | Resolved`; `Resolved → In Progress | Closed`; `Closed` is terminal. Transitions to Resolved/Closed require category, resolution code and resolution notes. It stamps first response, resolution and closure times, computes response/resolution SLA state (met/breached), and writes incident activity records; concurrent transitions lock and conditionally update the row.

### 7.3 Other lifecycle controls

- Service request approvals use `service_requests_approvals` and database checks for approver role, status and decision note. Catalog items may require Manager/IT Director approval.
- Changes use status, CAB approval records, environment stages, risk/CI links and post-implementation review records; a risk/type escalation after implementation starts or closure is blocked and must be resubmitted as a follow-up change.
- Project baseline versions preserve approved plan values. Project risks store inherent and residual likelihood/impact and mitigation/contingency fields; score is derived from probability × impact in application logic.
- Employee access rights can expire automatically; revocation, extension and expiration are audit logged.

## 8. Background services, imports, exports and file handling

| Service | Trigger / interval | Behavior | Source |
|---|---|---|---|
| Startup migration runner | Process startup, before serving | Applies sorted, checksummed additive SQL under PostgreSQL advisory lock; ledger `onprem_deploy.sql_migrations` | `server/index.ts`, `server/startup-migrations.ts` |
| System manual sync | Process startup | Reads Markdown recursively from `docs/system-manual/`, upserts system guides, versions changes and archives removed sources | `server/knowledge-manual-sync.ts` |
| Dropdown integrity | Process startup | Archives duplicate lookup rows to `onprem_deploy.dropdown_duplicate_archive`, removes duplicates, ensures case-insensitive unique index | `server/dropdown-integrity.ts` |
| CAB/access PostgreSQL listener | Process startup, reconnects with exponential backoff | LISTEN/NOTIFY events `cab_changes`, `cab_access`; server-sent events reconcile clients; DB leases enforce stream counts and expire every 60 seconds | `server/cab-events.ts` |
| Employee access expiry | Immediately on route registration, then every 5 minutes | Marks active grants whose expiry date has arrived as expired; writes audit log records | `server/routes.ts` |
| SLA enforcement | First after 30 seconds, then every 5 minutes | Scans legacy `tickets` past resolution deadline, escalates priority and adds one internal SLA breach comment; requires a system administrator attribution | `server/index.ts` |
| Migration preview expiry | Every 15 minutes | Expires staged migration preview data; previews are limited to one hour | `server/data-migration-center.ts` |
| Express session pruning | Every 15 minutes | PostgreSQL session store prunes expired sessions | `server/auth.ts` |

The periodic SLA worker currently targets legacy `tickets`, not dedicated `incidents` or `service_requests`. CAB streaming is a notification channel only; APIs remain authoritative. Backup governance routes record schedule/run/restore-test evidence and do not implement a backup execution agent in this codebase.

### 8.1 Bulk import and exports

- CSV and XLSX import wizard/controller: `/api/import/*` and compatibility `/api/data-migrations/*`; 10 MB upload limit, up to 5,000 rows per batch, header mapping/validation and FK lookup before transaction. Only managers/admins may preview/commit; each module key is checked against its feature flag. `shared/data-migration-modules.ts` defines modules and fields; `server/data-migration-center.ts` parses, stores preview rows, commits, logs, exports templates and records batch history.
- Asset spreadsheet upload/import/export logic also exists in `server/routes.ts`; distinguish it from the universal migration center.
- Excel report output: `POST /api/report-exports/xlsx` validates a strict Zod payload and uses ExcelJS; report pages also have client-side PDF/print/export handlers.
- Attachments are stored as files under server upload storage with metadata in relevant tables; project, KB, asset, ticket, CMDB configuration and handover pages each have their own upload/download paths and authorization.

## 9. Analytics, reports and stubs

`/reports` is an expandable navigation catalog, not a data dashboard itself. `reports-dashboard.tsx` defines main categories. All live APIs and their exact route/middleware declarations appear in section 6.

| UI route(s) | Component / data source | Status | Notes |
|---|---|---|---|
| `/reports` | `reports-dashboard.tsx`; navigation catalog | Live catalog | No report dataset query on landing page |
| `/reports/personnel`, `/reports/employee-directory`, `/reports/workload-heatmap`, `/reports/account-activity` | `PersonnelDetailReport` → `/api/reports/personnel`; employees, access grants, offboarding clearances and conditionally enabled module allocation summaries | Live | Core/authenticated API registered before central module middleware |
| `/reports/hardware-lifecycle`, `/reports/depreciation` | `DepreciationReport` → `/api/reports/depreciation` → assets | Live | Hardware lifecycle is a depreciation-view alias |
| `/reports/consumables-stock` | `ConsumablesStockReport` → `/api/consumables` | Live | Consumables and warehouse data |
| `/reports/project-variance`, `/reports/project-velocity`, `/reports/risk-heatmap` | `PlannedAnalyticsReport` | Planned | Baselines/tasks/milestones/project risks exist, but portfolio report endpoints are not implemented |
| `/reports/itsm-mttr`, `/reports/tickets` | `TicketReport` → `/api/reports/tickets` → legacy tickets | Live with source limitation | Does not directly report dedicated incidents/service requests |
| `/reports/itsm-sla` | `PlannedAnalyticsReport` | Planned | No dedicated trend endpoint |
| `/reports/itsm-cab`, `/reports/changes` | `ChangesReport` → `/api/reports/changes` | Live | CAB permission mismatch: UI check uses `change_view`; seeded CAB persona has `change_view_all` |
| `/reports/problems` | `ProblemsReport` → `/api/reports/problems` | Live | Problems plus linked ticket/incident data |
| `/reports/project-allocations` | `ProjectAllocationsReport` → `/api/reports/project-allocations` | Live | Project/team allocations |
| `/reports/asset-summary` | `AssetSummaryReport` → `/api/reports/summary` | Live | Asset aggregate |
| `/reports/lifecycle` | `LifecycleReport` → `/api/reports/lifecycle` | Live | Asset lifecycle |
| `/reports/hardware-inventory` | `HardwareInventoryReport` → `/api/reports/it-components-compliance` | Live | Multi-category IT components/compliance review |
| `/reports/assignments` | `AssignmentsReport` → `/api/reports/assignments` | Live | Assignments/assets/employees |
| `/reports/maintenance` | `MaintenanceReport` → `/api/reports/maintenance` | Live | Schedules and records |
| `/reports/purchase-orders` | `PurchaseOrdersReport` → `/api/reports/purchase-orders` | Live | Procurement data |
| `/reports/budget` | `BudgetReport` → `/api/reports/budget` | Live | Budget and spend data |
| `/reports/department` | `DepartmentReport` → `/api/reports/department` | Live | Department and asset data |
| `/reports/warranties` | `WarrantiesReport` → `/api/reports/warranties` | Live | Warranty expiry |
| `/reports/vendor-analysis` | `VendorAnalysisReport` → `/api/reports/vendors` | Live | Vendor/contracts/procurement |
| `/reports/released-assets` | `ReleasedAssetsReport` → `/api/reports/released-assets` | Live | Released/assignment lifecycle |
| `/reports/missing-data` | `MissingDataReport` → `/api/reports/missing-data` | Live | Asset completeness |
| `/reports/assignment-history` | `AssignmentHistoryReport` → `/api/reports/assignment-history` | Live | Assignment history |
| `/reports/kb-articles` | `KnowledgeBaseReport` → `/api/reports/kb-articles` | Live | Knowledge Base report endpoint is a core exception to ITSM gating |

No separate `/grc` page exists. Risk posture is available at `/risks`; the current report hub does not include a GRC report category.

## 10. Migration inventory and runtime-owned database objects

### 10.1 SQL migration files

The current workspace contains 49 SQL migrations. Startup executes the on-prem stream from `migrations/onprem/`; root-level migration files are compatibility/development artifacts and are not part of that startup directory.

### `migrations/` (12 files)
- `migrations/20260929_asset_compliance_fields.sql`
- `migrations/20260929_cab_remover_label.sql`
- `migrations/20260929_preserve_cab_approval_history.sql`
- `migrations/20261004_cab_pending_approver_lookup_idx.sql`
- `migrations/20261004_cab_stream_leases.sql`
- `migrations/20261005_change_stage_attempt_history.sql`
- `migrations/20261007_cab_pending_overview_count_idx.sql`
- `migrations/20261018_archive_legacy_ticket_source.sql`
- `migrations/20261018_cab_assignment_history_lookup_idx.sql`
- `migrations/20261018_standalone_risk_register.sql`
- `migrations/20261019_split_incidents_service_requests.sql`
- `migrations/20261105_cab_escalation_review_version.sql`

### `migrations/onprem/` (37 files)
- `migrations/onprem/20261019_system_version.sql`
- `migrations/onprem/20261020_incident_management.sql`
- `migrations/onprem/20261021_service_request_management.sql`
- `migrations/onprem/20261022_intake_workflow_project_link.sql`
- `migrations/onprem/20261023_ticket_on_behalf_closure_notes.sql`
- `migrations/onprem/20261024_asset_sam_cloud_finops.sql`
- `migrations/onprem/20261025_maintenance_log_analytics.sql`
- `migrations/onprem/20261026_consumables_inventory.sql`
- `migrations/onprem/20261027_warehouse_site.sql`
- `migrations/onprem/20261028_seed_consumable_categories.sql`
- `migrations/onprem/20261029_employee_offboarding_access_entitlements.sql`
- `migrations/onprem/20261030_access_governance_catalog.sql`
- `migrations/onprem/20261031_cmdb_applications_servers_documents.sql`
- `migrations/onprem/20261101_access_expiry_offboarding_clearances.sql`
- `migrations/onprem/20261102_cmdb_dependency_change_impact.sql`
- `migrations/onprem/20261103_knowledge_policy_governance.sql`
- `migrations/onprem/20261104_structured_service_catalog.sql`
- `migrations/onprem/20261105_cab_escalation_review_version.sql`
- `migrations/onprem/20261105_vendor_sla_contract_lifecycle.sql`
- `migrations/onprem/20261106_asset_handovers.sql`
- `migrations/onprem/20261107_network_backup_policy_compliance.sql`
- `migrations/onprem/20261108_it_component_compliance_reviews.sql`
- `migrations/onprem/20261109_data_migration_center.sql`
- `migrations/onprem/20261110_cab_assignment_history_lookup_idx.sql`
- `migrations/onprem/20261111_enterprise_project_management.sql`
- `migrations/onprem/20261112_project_delivery_governance.sql`
- `migrations/onprem/20261113_project_document_versions.sql`
- `migrations/onprem/20261114_project_workspace_timestamps.sql`
- `migrations/onprem/20261115_project_baselines_risk_residuals.sql`
- `migrations/onprem/20261116_protected_knowledge_system_manual.sql`
- `migrations/onprem/20261117_kb_platform_architecture_category.sql`
- `migrations/onprem/20261118_employee_support_kb_category.sql`
- `migrations/onprem/20261119_itam_cmdb_kb_category.sql`
- `migrations/onprem/20261120_project_management_kb_category.sql`
- `migrations/onprem/20261121_itil_service_operations_kb_category.sql`
- `migrations/onprem/20261122_grc_compliance_kb_category.sql`
- `migrations/onprem/20261123_kb_manual_author_labels.sql`

### 10.2 Runtime-owned support relations

- `onprem_deploy.sql_migrations`: migration name, checksum and applied timestamp; created by `server/startup-migrations.ts`.
- `onprem_deploy.dropdown_duplicate_archive`: deleted duplicate option ID, kept option ID, full original row JSON and archive timestamp; created by dropdown integrity cleanup.
- `sessions`: Express session state managed by `connect-pg-simple` and represented in the Drizzle schema.

## 11. Current high-value caveats for technical leads

1. This is a single database with feature gates, not independently installable module schemas. Licensing hides/blocks module routes but all business tables remain part of the shared schema.
2. Legacy `tickets` and dedicated `incidents`/`service_requests` coexist. SLA enforcement and MTTR reporting still query legacy `tickets`, so those metrics do not fully cover the dedicated workflows.
3. SLA policy page is ITSM-gated, while GET `/api/sla-policies` is only authenticated and absent from central ITSM module mapping.
4. CAB report page/sidebar permission key mismatch (`change_view` vs seeded `change_view_all`) can prevent CAB-only users from opening the CAB report.
5. Client declarations, sidebar visibility, `ProtectedRoute` authorization, central API persona/module gate and handler-level permissions are separate layers and can drift.
6. The `db/` directory is absent; Drizzle schema lives in `shared/schema.ts` and deployment migration files live under `migrations/`.
7. Backup schedules and restore checks are governance/evidence records; this repository does not contain a job runner that executes infrastructure backups.
8. The report inventory distinguishes live routes from planned placeholders; planned pages should not be described as implemented analytics.

## 12. Audit method, exclusions and coverage

- Schema definitions were enumerated from `pgTable(...)` declarations in `shared/schema.ts`; every declared column expression and table callback index/check/constraint was included above.
- Client paths and guards were enumerated from `Route` and `ProtectedRoute` declarations in `client/src/App.tsx`.
- API paths were enumerated from non-test TypeScript method calls on Express `app`/`router` objects under `server/`; mounted middleware prefixes and in-handler conditions are described separately.
- The source file tree includes inventoried source, test, docs, migration and script paths; generated/vendor/upload binary folders are intentionally excluded. The inventory count excludes this output file itself, which was created after scanning.
- Counts describe this workspace snapshot, not proof that the live database has every migration applied or that runtime feature settings match defaults.
- No secrets, database connection strings, or production records were read into this report.

