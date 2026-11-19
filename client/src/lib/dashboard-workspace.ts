import type { UserWithDetails } from "@shared/schema";
import { getPersonaRoleKeys, isPersonaPageAllowed } from "@shared/personas";

export interface WorkspaceLink {
  title: string;
  description: string;
  href: string;
  moduleKey?: string;
  permission?: string[];
}

export function dashboardWorkspace(user: UserWithDetails) {
  const roleNames = user.roles?.map(role => role.name) ?? [];
  const roles = getPersonaRoleKeys(roleNames);
  const readOnly = roles.includes("auditor") || roles.includes("read_only_user");
  const manager = roles.includes("it_manager");
  const assetManager = roles.includes("asset_manager");
  const cabMember = roles.includes("cab_member");
  const itAgent = roles.includes("it_agent");

  let description = "Your employee support workspace.";
  let links: WorkspaceLink[];

  if (readOnly) {
    description = "Your read-only compliance and inventory review workspace.";
    links = [
      { title: "Access Governance", description: "Review employee access and expiry status.", href: "/access-governance", moduleKey: "asset_management", permission: ["access_governance_view", "system_admin"] },
      { title: "Asset Inventory", description: "Inspect hardware inventory and custody records.", href: "/assets", moduleKey: "asset_management", permission: ["asset_view", "system_admin"] },
      { title: "Audit Logs", description: "Review recorded system activity.", href: "/audit-logs", permission: ["audit_view", "system_admin"] },
      { title: "Network Topology", description: "Review network configuration and firewall evidence.", href: "/network-topology", moduleKey: "cmdb", permission: ["cmdb_view", "audit_view", "compliance_view", "system_admin"] },
      { title: "Backup & Restore", description: "Inspect backup compliance and restore verification.", href: "/backup-schedules", moduleKey: "cmdb", permission: ["audit_view", "compliance_view", "system_admin"] },
      { title: "Knowledge Base / System Manual", description: "Read published procedures and system documentation.", href: "/knowledge-base" },
    ];
  } else if (manager) {
    description = "Your IT operations and management workspace.";
    links = [
      { title: "Incident Tracker", description: "Review and manage incident workloads.", href: "/incidents/tracker", moduleKey: "itsm" },
      { title: "Request Tracker", description: "Review and manage service request fulfillment.", href: "/service-requests/tracker", moduleKey: "itsm" },
      { title: "Problems", description: "Investigate recurring issues and known errors.", href: "/problems", moduleKey: "itsm" },
      { title: "Changes & CAB", description: "Review RFCs, approvals, and implementation stages.", href: "/changes", moduleKey: "itsm", permission: ["change_view_all", "change_manage", "system_admin"] },
      { title: "Assets", description: "Manage hardware and software asset lifecycles.", href: "/assets", moduleKey: "asset_management", permission: ["asset_view", "asset_update", "system_admin"] },
      { title: "Projects", description: "Monitor delivery plans, milestones, and risks.", href: "/projects", moduleKey: "project_management", permission: ["project_view", "project_manage", "system_admin"] },
      { title: "Vendors Management", description: "Review suppliers, contracts, and performance.", href: "/vendors", moduleKey: "asset_management" },
      { title: "Analytics & Reports", description: "Review operational, financial, and governance KPIs.", href: "/reports" },
    ];
  } else if (assetManager) {
    description = "Your IT asset lifecycle and inventory workspace.";
    links = [
      { title: "Assets", description: "Manage hardware, software, assignments, and lifecycle records.", href: "/assets", moduleKey: "asset_management", permission: ["asset_view", "asset_update", "system_admin"] },
      { title: "Consumables & Inventory", description: "Monitor stock, warehouses, issues, and adjustments.", href: "/consumables", moduleKey: "asset_management", permission: ["inventory_view", "asset_view", "system_admin"] },
      { title: "Assignments & Handovers", description: "Record issue, return, and custody events.", href: "/assignments", moduleKey: "asset_management", permission: ["assignment_create", "assignment_update", "assignment_return", "system_admin"] },
      { title: "Maintenance", description: "Plan and record asset maintenance.", href: "/maintenance", moduleKey: "asset_management", permission: ["maintenance_create", "maintenance_update", "asset_view", "system_admin"] },
      { title: "Vendors Management", description: "Manage suppliers and vendor relationships.", href: "/vendors", moduleKey: "asset_management" },
      { title: "Contracts", description: "Track warranties and support agreements.", href: "/service-contracts", moduleKey: "asset_management", permission: ["asset_view", "system_admin"] },
      { title: "Employee Self Service", description: "Track your tickets and submit IT requests.", href: "/portal", moduleKey: "itsm" },
      { title: "My Assigned Assets", description: "View your own equipment and custody receipts.", href: "/my-assets", moduleKey: "asset_management", permission: ["my_assets_view", "system_admin"] },
    ];
  } else if (cabMember) {
    description = "Your change advisory and approval workspace.";
    links = [
      { title: "Change Approvals", description: "Review assigned changes and record CAB decisions.", href: "/changes", moduleKey: "itsm", permission: ["change_view_all", "change_approve", "system_admin"] },
      { title: "Change Tracker", description: "Follow change implementation and status.", href: "/changes/tracker", moduleKey: "itsm", permission: ["change_view_all", "change_approve", "system_admin"] },
      { title: "Employee Self Service", description: "Track your tickets and submit IT requests.", href: "/portal", moduleKey: "itsm" },
      { title: "Service Catalog", description: "Browse services and submit a request.", href: "/service-catalog", moduleKey: "itsm" },
    ];
  } else if (itAgent) {
    description = "Your IT operations workspace.";
    links = [
      { title: "Incident Tracker", description: "Triage, assign, and resolve incidents.", href: "/incidents/tracker", moduleKey: "itsm" },
      { title: "Request Tracker", description: "Fulfill and manage service requests.", href: "/service-requests/tracker", moduleKey: "itsm" },
      { title: "Problems", description: "Investigate recurring issues and known errors.", href: "/problems", moduleKey: "itsm" },
      { title: "Changes", description: "Create and execute approved changes.", href: "/changes", moduleKey: "itsm", permission: ["change_view_all", "change_manage", "system_admin"] },
      { title: "Incident Catalog", description: "Use approved incident templates.", href: "/incident-catalog", moduleKey: "itsm" },
      { title: "Assets", description: "Open the asset inventory workbench.", href: "/assets", moduleKey: "asset_management", permission: ["asset_view", "asset_update", "system_admin"] },
      { title: "Employee Self Service", description: "Track tickets and submit service requests.", href: "/portal", moduleKey: "itsm" },
      { title: "Knowledge Base / System Manual", description: "Find procedures, runbooks, and system guidance.", href: "/knowledge-base" },
    ];
  } else {
    links = [
      { title: "Employee Self Service", description: "Track your requests and report an issue.", href: "/portal", moduleKey: "itsm" },
      { title: "Service Catalog", description: "Browse services and submit a new request.", href: "/service-catalog", moduleKey: "itsm" },
      { title: "My Assigned Assets", description: "View your equipment and custody receipts.", href: "/my-assets", moduleKey: "asset_management", permission: ["my_assets_view", "system_admin"] },
      { title: "Knowledge Base / System Manual", description: "Find platform guidance and published employee guides.", href: "/knowledge-base" },
    ];
  }

  if (manager) {
    links.push({
      title: "Project Portfolio",
      description: "Manage project delivery, tasks, milestones, risks, and budgets.",
      href: "/projects",
      moduleKey: "project_management",
      permission: ["project_view", "project_manage", "system_admin"],
    });
  }

  return {
    description,
    links: links.filter(link =>
      isPersonaPageAllowed(roleNames, user.permissions ?? [], link.href, user.employeeId) &&
      (!link.permission || link.permission.some(permission => user.permissions?.includes(permission))),
    ),
  };
}
