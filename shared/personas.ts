import type { PersonaRoleKey } from "./schema";
import { isDemoApiAllowed, isDemoPageAllowed, isDemoViewer } from "./demo-viewer";

export type PersonaUserLike = {
  roles?: Array<{ name: string }> | null;
  permissions?: readonly string[] | null;
};

const ROLE_ALIASES: Record<PersonaRoleKey, readonly string[]> = {
  end_user: ["end_user", "end user", "employee"],
  it_agent: ["it_agent", "it agent", "it staff", "it support staff", "helpdesk agent", "help desk agent"],
  cab_member: ["cab_member", "cab member", "cab approver"],
  it_manager: ["it_manager", "it manager", "it operations manager"],
  auditor: ["auditor", "compliance auditor"],
};

const IT_AGENT_PAGE_PREFIXES = [
  "/dashboard", "/assets", "/consumables", "/inventory", "/assignments",
  "/maintenance", "/asset-requests", "/asset-disposal", "/asset-audits", "/asset-handovers",
  "/incidents", "/service-requests", "/problems", "/knowledge-base",
  "/service-catalog", "/network-topology", "/backup-schedules", "/reports/tickets", "/reports/problems",
];

const MANAGER_PAGE_PREFIXES = [
  ...IT_AGENT_PAGE_PREFIXES,
  "/changes", "/applications", "/servers", "/purchase-orders", "/budgets",
  "/contracts", "/employees", "/vendors", "/locations", "/departments", "/kpis",
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function matchesPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function getPersonaRoleKeys(roleNames: readonly string[] = []): PersonaRoleKey[] {
  const normalizedNames = new Set(roleNames.map(normalize));
  return (Object.keys(ROLE_ALIASES) as PersonaRoleKey[]).filter(key =>
    ROLE_ALIASES[key].some(alias => normalizedNames.has(normalize(alias))),
  );
}

export function isSystemAdministrator(user: PersonaUserLike | null | undefined): boolean {
  if (!user) return false;
  if (isDemoViewer(user.roles?.map(role => role.name) ?? [])) return false;
  return user.permissions?.includes("system_admin") === true ||
    user.roles?.some(role => ["system_administrator", "administrator", "admin"].includes(normalize(role.name))) === true;
}

export function personaRolesForUser(user: PersonaUserLike | null | undefined): PersonaRoleKey[] {
  return getPersonaRoleKeys(user?.roles?.map(role => role.name) ?? []);
}

export function getPersonaHomePath(roleNames: readonly string[] = [], permissions: readonly string[] = []): string {
  // A shared landing URL does not grant executive API access. The dashboard
  // renders the appropriate workspace for the authenticated persona.
  return "/dashboard";
}

export function isPersonaPageAllowed(
  roleNames: readonly string[],
  permissions: readonly string[],
  requestedPath: string,
): boolean {
  if (isDemoViewer(roleNames)) return isDemoPageAllowed(requestedPath);
  if (permissions.includes("system_admin") || roleNames.some(name =>
    ["system_administrator", "administrator", "admin"].includes(normalize(name)),
  )) return true;

  const personas = getPersonaRoleKeys(roleNames);
  if (personas.length === 0) return true; // Keep custom, legacy roles governed by their existing permissions.
  const path = requestedPath.split(/[?#]/, 1)[0] || "/";
  if (path === "/" || path === "/dashboard") return true;

  return personas.some(persona => {
    if (persona === "end_user") {
      return ["/portal", "/service-catalog", "/my-assets", "/incidents", "/service-requests", "/knowledge-base"]
        .some(prefix => matchesPath(path, prefix));
    }
    if (persona === "it_agent") {
      return IT_AGENT_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "it_manager") {
      return MANAGER_PAGE_PREFIXES.some(prefix => matchesPath(path, prefix));
    }
    if (persona === "cab_member") {
      if (matchesPath(path, "/changes/new")) return false;
      return [
        "/dashboard", "/changes", "/applications", "/servers", "/network-topology", "/purchase-orders",
        "/budgets", "/contracts", "/employees", "/service-catalog", "/vendors",
      ].some(prefix => matchesPath(path, prefix));
    }
    return ["/assets", "/access-governance", "/audit-logs", "/network-topology", "/backup-schedules", "/knowledge-base"]
      .some(prefix => matchesPath(path, prefix));
  });
}

const COMMON_API_PREFIXES = [
  "/user", "/module-settings", "/modules", "/alerts", "/notifications",
  "/system/status", "/system/modules", "/dropdowns/options",
];

function isReadMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isTicketApiAllowed(path: string, method: string): boolean {
  const upperMethod = method.toUpperCase();
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
  if (path === "/changes") return isReadMethod(upperMethod);
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
  "/network-topology", "/backup-schedules",
];

const MANAGER_API_PREFIXES = [
  ...IT_AGENT_API_PREFIXES, "/changes", "/applications", "/servers",
  "/purchase-orders", "/budgets", "/contracts", "/employees", "/vendors",
  "/locations", "/departments", "/vendor-management", "/vendor-contracts",
];

export function isPersonaApiAllowed(
  roleNames: readonly string[],
  permissions: readonly string[],
  path: string,
  method: string,
): boolean {
  if (isDemoViewer(roleNames)) return isDemoApiAllowed(path, method);
  if (permissions.includes("system_admin") || roleNames.some(name =>
    ["system_administrator", "administrator", "admin"].includes(normalize(name)),
  )) return true;
  const personas = getPersonaRoleKeys(roleNames);
  if (personas.length === 0) return true;
  const apiPath = path.split("?", 1)[0] || "/";
  const upperMethod = method.toUpperCase();

  if (COMMON_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix))) return isReadMethod(upperMethod);
  return personas.some(persona => {
    if (persona === "end_user") {
      return (apiPath === "/my/assets" && isReadMethod(upperMethod)) ||
        (apiPath === "/my/asset-handovers" && isReadMethod(upperMethod)) ||
        (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath) && upperMethod === "POST") ||
        (apiPath === "/consumables" && isReadMethod(upperMethod)) ||
        isTicketApiAllowed(apiPath, upperMethod);
    }
    if (persona === "it_agent") {
      if (apiPath === "/employees" && isReadMethod(upperMethod)) return true;
      if (apiPath === "/my/asset-handovers") return isReadMethod(upperMethod);
      if (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath)) return upperMethod === "POST";
      return IT_AGENT_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix));
    }
    if (persona === "it_manager") {
      if (apiPath === "/my/asset-handovers") return isReadMethod(upperMethod);
      if (/^\/my\/asset-handovers\/[^/]+\/acknowledge$/.test(apiPath)) return upperMethod === "POST";
      return (apiPath === "/kpis" && isReadMethod(upperMethod)) || apiPath === "/dashboard/executive" ||
        (apiPath === "/cmdb" || matchesPath(apiPath, "/cmdb")) ||
        MANAGER_API_PREFIXES.some(prefix => matchesPath(apiPath, prefix));
    }
    if (persona === "cab_member") {
      if (matchesPath(apiPath, "/network-topology")) return isReadMethod(upperMethod);
      if (["/vendor-management", "/vendor-contracts"].some(prefix => matchesPath(apiPath, prefix))) return isReadMethod(upperMethod);
      if (["/service-catalog/options", "/service-catalog/items"].includes(apiPath)) return isReadMethod(upperMethod);
      if (apiPath === "/service-catalog/approvals") return isReadMethod(upperMethod);
      if (/^\/service-catalog\/approvals\/[^/]+\/decision$/.test(apiPath)) return upperMethod === "POST";
      return apiPath === "/dashboard/executive" || [
        "/changes", "/applications", "/servers", "/purchase-orders", "/budgets",
        "/contracts", "/employees", "/cmdb",
      ].some(prefix => matchesPath(apiPath, prefix));
    }
    if (!isReadMethod(upperMethod)) return false;
    if (apiPath === "/access-governance" || apiPath === "/access-governance/catalog" || apiPath === "/audit-logs") return true;
    if (matchesPath(apiPath, "/network-topology") || matchesPath(apiPath, "/backup-schedules")) return true;
    if (matchesPath(apiPath, "/kb/articles") || matchesPath(apiPath, "/kb/search")) return true;
    if (apiPath === "/employees") return true;
    return apiPath === "/assets" || /^\/assets\/[^/]+$/.test(apiPath);
  });
}
