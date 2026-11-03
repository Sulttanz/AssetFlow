# Customer module feature gates

The application is one deployable service with one complete PostgreSQL schema.
Disabling a business module does **not** drop its tables, delete records, or remove
foreign keys. Users, roles, permissions, system settings, and reference dropdowns
remain shared infrastructure.

## Independently toggleable modules

| Key | Scope |
| --- | --- |
| `asset_management` | ITAM, employees/access governance, inventory, maintenance, financials, asset reports |
| `cmdb` | Applications, servers, configuration vault, network/firewall governance, backups |
| `itsm` | Incidents, requests, problems, changes/CAB, service catalog, knowledge base |
| `risk_management` | Standalone risk register |
| `project_management` | Portfolio, tasks/Kanban, project risks/changes, milestones, budgets, documents, resource reports |

Administrators toggle modules in Settings. The existing module-settings API and
registry supply defaults and persist customer selections. CMDB has its own flag;
Asset Management is no longer an always-on business module.

## Enforcement

- Central API namespace gates run after authentication and before persona checks.
  Individual feature routes also retain their existing permission checks.
- A disabled API returns HTTP 403 with:

  ```json
  {
    "error": "Feature Not Enabled",
    "code": "FEATURE_NOT_ENABLED",
    "moduleKey": "project_management",
    "message": "The project_management feature is not enabled for this customer."
  }
  ```

- Sidebar sections, report links, persona workspaces, and executive dashboard
  sections respect the same keys. Module settings refresh every 15 seconds and on
  window focus. APIs consult the persisted setting on every request.
- Disabled-module direct UI URLs display a disabled-feature state.
- Shared executive/alert aggregates omit queries and results for disabled modules.

## Optional relationships

Project details/options omit ITAM lookups when ITAM is disabled and return empty
asset arrays. Project edits preserve existing asset associations in that state;
attempts to create new asset links receive the standard 403 response. Re-enabling
ITAM makes the preserved links available again.

Project tasks, risks, change requests, milestones, budgets, and documents use
project-owned tables rather than ITSM or standalone GRC workflows.

ITSM project-name/options lookups are skipped when Project Management is disabled.
Non-empty new project references require that module. CMDB change impact options,
target validation, and impact calculations are skipped when CMDB is disabled;
existing configuration links are retained. Inventory fulfillment requires ITAM.

ITSM's direct project and asset references are nullable. Optional association
tables can have required child keys: absence of an association row means the
parent project has no external dependency. Internal child ownership keys remain
required to protect integrity.

This model supports **licensed feature isolation in a complete shared schema**.
It does not support physically dropping selected module tables or deploying a
partial schema. A future standalone-package design would need separate migration
and integration contracts.
