import type { UserWithDetails } from "@shared/schema";
import { isPersonaPageAllowed, personaRolesForUser } from "@shared/personas";
import { canAccessItsmWorkbench } from "./itsm-access";

export interface WorkspaceLink {
  title: string;
  description: string;
  href: string;
  moduleKey?: string;
  permission?: string[];
}

export function dashboardWorkspace(user: UserWithDetails) {
  const auditor = personaRolesForUser(user).includes("auditor");
  const staff = canAccessItsmWorkbench(user);
  const links: WorkspaceLink[] = auditor ? [
    { title: "Access Governance", description: "Review employee entitlements and access expiry.", href: "/access-governance", moduleKey: "asset_management", permission: ["access_governance_view", "employee_update", "system_admin"] },
    { title: "Asset Inventory", description: "Inspect the asset register and ownership records.", href: "/assets", moduleKey: "asset_management" },
    { title: "Audit Logs", description: "Review recorded system activity.", href: "/audit-logs", permission: ["audit_view", "system_admin"] },
    { title: "Network Topology", description: "Review network devices and firewall evidence.", href: "/network-topology", moduleKey: "cmdb", permission: ["asset_update", "cmdb_view", "audit_view", "compliance_view", "system_admin"] },
    { title: "Backup & Restore", description: "Inspect backup compliance and restore verification.", href: "/backup-schedules", moduleKey: "cmdb", permission: ["asset_update", "audit_view", "compliance_view", "system_admin"] },
  ] : staff ? [
    { title: "Incident Tracker", description: "Review and manage incident workloads.", href: "/incidents/tracker", moduleKey: "itsm" },
    { title: "Request Tracker", description: "Review service request fulfillment.", href: "/service-requests/tracker", moduleKey: "itsm" },
    { title: "Problems", description: "Investigate recurring issues and known errors.", href: "/problems", moduleKey: "itsm" },
    { title: "Assets", description: "Open the asset inventory workbench.", href: "/assets", moduleKey: "asset_management" },
    { title: "Knowledge Base", description: "Find technical procedures and runbooks.", href: "/knowledge-base", moduleKey: "itsm" },
  ] : [
    { title: "My Tickets", description: "Track your requests and reported incidents.", href: "/portal", moduleKey: "itsm" },
    { title: "Service Catalog", description: "Browse services and submit a new request.", href: "/service-catalog", moduleKey: "itsm" },
    { title: "My Assigned Assets", description: "View your equipment and custody receipts.", href: "/my-assets", moduleKey: "asset_management", permission: ["my_assets_view", "system_admin"] },
    { title: "Knowledge Base", description: "Find published employee guides and policies.", href: "/knowledge-base", moduleKey: "itsm" },
  ];
  links.push({ title: "Project Portfolio", description: "Manage project delivery, tasks, milestones, risks, changes, and budgets.", href: "/projects", moduleKey: "project_management" });
  return {
    description: auditor ? "Your compliance review workspace." : staff ? "Your IT operations workspace." : "Your employee support workspace.",
    links: links.filter(link => isPersonaPageAllowed(user.roles?.map(role => role.name) ?? [], user.permissions ?? [], link.href) &&
      (!link.permission || link.permission.some(permission => user.permissions?.includes(permission)))),
  };
}
