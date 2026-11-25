import { PERSONA_ROLE_KEYS, type PersonaRoleKey } from "./schema";
import { isDemoApiAllowed, isDemoPageAllowed, isDemoViewer } from "./demo-viewer";
import { getStandardRoleKey } from "./role-catalog";

export type PersonaUserLike = {
  id?: string;
  employeeId?: string | null;
  assignedProjectIds?: readonly string[] | null;
  roles?: Array<{ name: string }> | null;
  permissions?: readonly string[] | null;
};

const ITAM_PAGE_PREFIXES = [
  "/dashboard", "/assets", "/my-assets", "/consumables", "/inventory", "/assignments",
  "/maintenance", "/asset-requests", "/asset-disposal", "/asset-audits", "/asset-handovers",
  "/service-contracts", "/locations", "/departments", "/vendors",
  "/reports", "/reports/hardware-lifecycle", "/reports/consumables-stock",
];

const IT_AGENT_PAGE_PREFIXES = [
  ...ITAM_PAGE_PREFIXES, "/portal", "/incidents", "/service-requests", "/incidents/new",
  "/service-requests/new", "/incidents/tracker", "/service-requests/tracker",
  "/problems", "/knowledge-base", "/service-catalog", "/incident-catalog",
  "/changes", "/changes/new", "/changes/tracker",
  "/reports", "/reports/tickets", "/reports/problems", "/reports/itsm-mttr", "/reports/itsm-sla",
];

const MANAGER_PAGE_PREFIXES = [
  ...IT_AGENT_PAGE_PREFIXES,
  "/incident-catalog",
  "/changes", "/applications", "/servers", "/network-topology", "/backup-schedules", "/purchase-orders", "/budgets",
  "/procure-to-pay", "/finance/quotations", "/finance/purchase-orders", "/finance/invoices",
  "/finance/returns", "/finance/budgets", "/finance/contracts", "/finance/tax-settings", "/reports/procurement-finance",
  "/contracts", "/employees", "/access-governance", "/vendors", "/locations", "/departments", "/kpis", "/projects",
  "/reports", "/migration", "/import", "/reports/project-variance", "/reports/project-velocity",
  "/reports/risk-heatmap", "/reports/itsm-cab", "/reports/enterprise-operations",
];

const ASSET_MANAGER_PAGE_PREFIXES = [
  ...ITAM_PAGE_PREFIXES,
  "/portal", "/incidents/new", "/service-requests/new", "/service-catalog", "/knowledge-base",
];

const CAB_MEMBER_PAGE_PREFIXES = [
  "/dashboard", "/portal", "/changes", "/changes/tracker", "/service-catalog",
  "/incidents/new", "/service-requests/new", "/knowledge-base",
];

const AUDITOR_PAGE_PREFIXES = [
  "/dashboard", "/assets", "/access-governance", "/audit-logs", "/network-topology",
  "/backup-schedules", "/knowledge-base", "/reports/hardware-lifecycle", "/reports/consumables-stock",
];

function matchesPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function getPersonaRoleKeys(roleNames: readonly string[] = []): PersonaRoleKey[] {
  const normalizedNames = new Set(roleNames.map(getStandardRoleKey).filter((key): key is NonNullable<typeof key> => key !== null));
  return PERSONA_ROLE_KEYS.filter(key => normalizedNames.has(key));
}

export function isSystemAdministrator(user: PersonaUserLike | null | undefined): boolean {
  if (!user) return false;
  if (isDemoViewer(user.roles?.map(role => role.name) ?? [])) return false;
  return user.permissions?.includes("system_admin") === true ||
    user.roles?.some(role => getStandardRoleKey(role.name) === "system_admin") === true;
}

export function personaRolesForUser(user: PersonaUserLike | null | undefined): PersonaRoleKey[] {
  return getPersonaRoleKeys(user?.roles?.map(role => role.name) ?? []);
}

export function getPersonaHomePath(roleNames: readonly string[] = [], permissions: readonly string[] = []): string {
  const personas = getPersonaRoleKeys(roleNames);
  if (personas.length === 1 && personas[0] === "end_user") return "/portal";
  // Other roles keep the common Dashboard landing page; its content and links
  // remain filtered by the same persona policy.
  return "/dashboard";
}

export function isPersonaPageAllowed(
  roleNames: readonly string[],
  permissions: readonly string[],
  requestedPath: string,
  employeeId?: string | null,
  assignedProjectIds: readonly string[] = [],
): boolean {
  const path = requestedPath.split(/[?#]/, 1)[0] || "/";
  if (path === "/knowledge-base" || path === "/profile") return true;
  const readOnlyMutationPath = /\/(?:new|create|edit|manage)(?:\/|$)/i.test(path);
  if (isDemoViewer(roleNames)) return !readOnlyMutationPath && isDemoPageAllowed(requestedPath);
  if (permissions.includes("system_admin") || roleNames.some(name => getStandardRoleKey(name) === "system_admin")) return true;
  if (path === "/risks" || path === "/risk-management") {
    return permissions.some(permission => ["risk_manage", "change_manage", "compliance_view", "audit_view"].includes(permission));
  }

  const personas = getPersonaRoleKeys(roleNames);
  if (personas.length === 0) return true; // Keep custom, legacy roles governed by their existing permissions.

  return personas.some(persona => {
    if (persona === "end_user") {
      if (path === "/my-assets") return Boolean(employeeId);
      if (path === "/changes/new") return assignedProjectIds.length > 0;
      return ["/portal", "/service-catalog", "/incidents/new", "/service-requests/new"]
        .includes(path);
    }
    if (persona === "it_agent") {
      return IT_AGENT_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "asset_manager") {
      return ASSET_MANAGER_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "it_manager") {
      return MANAGER_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "cab_member") {
      if (path === "/changes/new") return false;
      return CAB_MEMBER_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "auditor" || persona === "read_only_user") {
      if (readOnlyMutationPath) return false;
      return AUDITOR_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    return ["/dashboard"]
      .some(prefix => matchesPath(path, prefix));
  });
}

const COMMON_API_PREFIXES = [
  "/user", "/module-settings", "/modules", "/alerts", "/notifications",
  "/system/status", "/system/version", "/system/modules", "/module-status", "/dropdowns",
];

function isReadMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isTicketApiAllowed(path: string, method: string): boolean {
  const upperMethod = method.toUpperCase();
  if (path === "/portal/incidents/options") return isReadMethod(upperMethod);
  if (/^\/incidents\/[^/]+\/comments$/.test(path)) return upperMethod === "POST";
  if (path === "/service-catalog/options" || /^\/service-catalog\/items(?:\/[^/]+)?$/.test(path)) return isReadMethod(upperMethod);
  if (/^\/service-catalog\/items\/[^/]+\/request$/.test(path)) return upperMethod === "POST";
  if (/^\/service-requests\/[^/]+\/catalog-approval$/.test(path)) return isReadMethod(upperMethod);
  if (["/incidents", "/service-requests"].includes(path)) return ["GET", "POST"].includes(upperMethod);
  if (matchesPath(path, "/catalog/items")) {
    return upperMethod === "GET" || (upperMethod === "POST" && /\/request$/.test(path));
  }
  if (["/incidents/options", "/service-requests/options", "/catalog", "/knowledge-base", "/kb", "/kb-articles"].some(prefix => matchesPath(path, prefix))) {
    return isReadMethod(upperMethod);
  }
  const root = ["/incidents", "/service-requests"].find(prefix => matchesPath(path, prefix));
  if (root) {
    const detail = new RegExp(`^${root}/(?!events$|projects$|options$)[^/]+$`).test(path);
    const activity = new RegExp(`^${root}/(?!events$|projects$|options$)[^/]+/activity$`).test(path);
    const attachment = new RegExp(`^${root}/[^/]+/attachments(?:/[^/]+)?$`).test(path);
    if (attachment) return ["GET", "POST"].includes(upperMethod);
    if (detail || activity) return isReadMethod(upperMethod);
  }
  if (["/tickets/my-requests", "/tickets/my-assigned"].includes(path)) return isReadMethod(upperMethod);
  return false;
}

const IT_AGENT_API_PREFIXES = [
  "/incidents", "/service-requests", "/tickets", "/problems", "/catalog", "/service-catalog",
  "/knowledge-base", "/kb", "/kb-articles", "/assets", "/assignments", "/maintenance",
  "/maintenance-schedules", "/maintenance-records", "/asset-bookings", "/asset-handovers",
  "/asset-disposal", "/asset-requests", "/asset-audits", "/consumables",
  "/warehouses", "/inventory", "/vendors", "/locations", "/departments",
  "/assignment-groups",
];

const ASSET_MANAGER_API_PREFIXES = [
  "/assets", "/assignments", "/maintenance", "/maintenance-schedules", "/maintenance-records",
  "/asset-bookings", "/asset-handovers", "/asset-disposal", "/asset-requests", "/asset-audits",
  "/consumables", "/warehouses", "/inventory", "/vendors", "/locations", "/departments",
  "/contracts", "/service-contracts", "/reports/hardware-lifecycle", "/reports/consumables-stock",
  "/reports/asset-summary", "/reports/lifecycle", "/reports/assignments", "/reports/maintenance",
  "/reports/warranties", "/reports/vendor-analysis", "/vendor-management", "/vendor-contracts",
];

const MANAGER_API_PREFIXES = [
  ...IT_AGENT_API_PREFIXES, "/incident-catalog", "/changes", "/applications", "/servers",
  "/network-topology", "/backup-schedules",
  "/purchase-orders", "/budgets", "/contracts", "/employees", "/vendors",
  "/vendor-quotations", "/purchase-invoices", "/purchase-returns",
  "/reports/procurement-finance", "/reports/tickets", "/reports/problems", "/reports/changes",
  "/reports/enterprise-operations", "/reports/itsm-mttr", "/reports/itsm-sla", "/reports/itsm-cab",
  "/reports/project-variance", "/reports/project-velocity", "/reports/risk-heatmap",
  "/locations", "/departments", "/vendor-management", "/vendor-contracts", "/projects",
];

export function isPersonaApiAllowed(
  roleNames: readonly string[],
  permissions: readonly string[],
  path: string,
  method: string,
  employeeId?: string | null,
): boolean {
  if (isDemoViewer(roleNames)) return isDemoApiAllowed(path, method);
  if (permissions.includes("system_admin") || roleNames.some(name => getStandardRoleKey(name) === "system_admin")) return true;
  const personas = getPersonaRoleKeys(roleNames);
  if (personas.length === 0) return true;
  const apiPath = path.split("?", 1)[0] || "/";
  const upperMethod = method.toUpperCase();

  if (apiPath === "/profile") return ["GET", "PATCH"].includes(upperMethod);
  if (apiPath === "/profile/password") return upperMethod === "POST";

  if (COMMON_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix))) return isReadMethod(upperMethod);
  if (["/risks", "/risk-users", "/risk-management"].some(prefix => matchesPath(apiPath, prefix))) {
    return permissions.some(permission => ["risk_manage", "change_manage"].includes(permission)) ||
      (isReadMethod(upperMethod) && permissions.some(permission => ["compliance_view", "audit_view"].includes(permission)));
  }
  return personas.some(persona => {
    if (persona === "end_user") {
      const projectChangeAccess = matchesPath(apiPath, "/changes") &&
        (isReadMethod(upperMethod) || (apiPath === "/changes" && upperMethod === "POST"));
      return projectChangeAccess || (Boolean(employeeId) && (
        (apiPath === "/my/assets" && isReadMethod(upperMethod)) ||
        (apiPath === "/my/asset-handovers" && isReadMethod(upperMethod)) ||
        (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath) && upperMethod === "POST")
      )) || isTicketApiAllowed(apiPath, upperMethod);
    }
    if (persona === "it_agent") {
      if (apiPath === "/employees" && isReadMethod(upperMethod)) return true;
      if (apiPath === "/users" || apiPath === "/users/employee-options") return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/assignment-groups")) return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/contracts") || matchesPath(apiPath, "/service-contracts")) return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/vendor-management") || matchesPath(apiPath, "/vendor-contracts")) return isReadMethod(upperMethod);
      if (Boolean(employeeId) && (
        (apiPath === "/my/assets" && isReadMethod(upperMethod)) ||
        (apiPath === "/my/asset-handovers" && isReadMethod(upperMethod)) ||
        (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath) && upperMethod === "POST")
      )) return true;
      if (matchesPath(apiPath, "/reports")) return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/incident-catalog")) return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/service-catalog")) return isReadMethod(upperMethod) ||
        /^\/service-catalog\/items\/[^/]+\/request$/.test(apiPath) && upperMethod === "POST";
      if (matchesPath(apiPath, "/changes")) {
        if (isReadMethod(upperMethod)) return true;
        return upperMethod !== "DELETE" && (
          apiPath === "/changes" ||
          /^\/changes\/[^/]+(?:\/(?:assign|submit|start|complete|cancel|stages\/init|stages\/[^/]+))?$/.test(apiPath)
        );
      }
      if (apiPath === "/my/asset-handovers") return isReadMethod(upperMethod);
      if (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath)) return upperMethod === "POST";
      return IT_AGENT_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix));
    }
    if (persona === "asset_manager") {
      if (apiPath === "/users" || apiPath === "/users/employee-options") return isReadMethod(upperMethod);
      if (apiPath === "/employees") return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/reports")) return isReadMethod(upperMethod);
      if (Boolean(employeeId) && (
        (apiPath === "/my/assets" && isReadMethod(upperMethod)) ||
        (apiPath === "/my/asset-handovers" && isReadMethod(upperMethod)) ||
        (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath) && upperMethod === "POST")
      )) return true;
      if (matchesPath(apiPath, "/service-catalog")) return isTicketApiAllowed(apiPath, upperMethod);
      return isTicketApiAllowed(apiPath, upperMethod) ||
        ASSET_MANAGER_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix));
    }
    if (persona === "it_manager") {
      if (apiPath === "/users" || apiPath === "/users/employee-options") return isReadMethod(upperMethod);
      if (Boolean(employeeId) && (
        (apiPath === "/my/assets" && isReadMethod(upperMethod)) ||
        (apiPath === "/my/asset-handovers" && isReadMethod(upperMethod)) ||
        (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath) && upperMethod === "POST")
      )) return true;
      if (matchesPath(apiPath, "/reports")) return isReadMethod(upperMethod);
      return (apiPath === "/kpis" && isReadMethod(upperMethod)) ||
        (apiPath === "/dashboard/executive" && isReadMethod(upperMethod)) ||
        (matchesPath(apiPath, "/cmdb") && isReadMethod(upperMethod)) ||
        MANAGER_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix));
    }
    if (persona === "cab_member") {
      if (apiPath === "/users" || apiPath === "/users/employee-options") return isReadMethod(upperMethod);
      if (isTicketApiAllowed(apiPath, upperMethod)) return true;
      if (apiPath === "/service-catalog/approvals") return isReadMethod(upperMethod);
      if (/^\/service-catalog\/approvals\/[^/]+\/decision$/.test(apiPath)) return upperMethod === "POST";
      if (/^\/service-requests\/[^/]+\/catalog-approval$/.test(apiPath)) return isReadMethod(upperMethod);
      if (matchesPath(apiPath, "/changes") && isReadMethod(upperMethod)) return true;
      if (apiPath === "/cmdb/change-options") return isReadMethod(upperMethod);
      return /^\/changes\/[^/]+\/approvals\/[^/]+$/.test(apiPath) && upperMethod === "PUT";
    }
    if (persona === "auditor" || persona === "read_only_user") {
      if (!isReadMethod(upperMethod)) return false;
      if (apiPath === "/access-governance" || matchesPath(apiPath, "/access-governance/catalog") || apiPath === "/audit-logs") return true;
      if (matchesPath(apiPath, "/network-topology") || matchesPath(apiPath, "/backup-schedules")) return true;
      if (matchesPath(apiPath, "/kb/articles") || matchesPath(apiPath, "/kb/search") || apiPath === "/kb/options") return true;
      if (apiPath === "/employees") return true;
      return apiPath === "/assets" || /^\/assets\/[^/]+$/.test(apiPath);
    }
    return apiPath === "/dashboard" && isReadMethod(upperMethod);
  });
}
