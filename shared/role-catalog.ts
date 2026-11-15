export const STANDARD_ROLE_DEFINITIONS = [
  {
    key: "system_admin",
    label: "System Administrator",
    description: "Full system access with all permissions.",
    aliases: ["system_admin", "system_administrator", "system administrator", "administrator", "admin"],
  },
  {
    key: "it_manager",
    label: "IT Manager",
    description: "IT operations management, change governance, CMDB, financials, and offboarding.",
    aliases: ["it_manager", "it manager", "it operations manager", "manager"],
  },
  {
    key: "it_agent",
    label: "IT Agent",
    description: "IT operations: incident, request, problem, and IT asset workbenches.",
    aliases: ["it_agent", "it agent", "it staff", "it support staff", "helpdesk agent", "help desk agent"],
  },
  {
    key: "cab_member",
    label: "CAB Member",
    description: "Change approval, CMDB impact, financial review, and offboarding clearance.",
    aliases: ["cab_member", "cab member", "cab approver"],
  },
  {
    key: "auditor",
    label: "Auditor",
    description: "Read-only access governance, audit logs, and asset inventory.",
    aliases: ["auditor", "compliance auditor"],
  },
  {
    key: "asset_manager",
    label: "Asset Manager",
    description: "Asset and assignment management.",
    aliases: ["asset_manager", "asset manager"],
  },
  {
    key: "end_user",
    label: "End User",
    description: "Employee self-service: service catalog, personal tickets, and assigned assets.",
    aliases: ["end_user", "end user", "employee"],
  },
  {
    key: "read_only_user",
    label: "Read Only User",
    description: "Read-only role template; permissions are assigned explicitly by an administrator.",
    aliases: ["read_only_user", "read only user", "readonly user"],
  },
] as const;

export type StandardRoleKey = (typeof STANDARD_ROLE_DEFINITIONS)[number]["key"];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getStandardRoleKey(roleName: string | null | undefined): StandardRoleKey | null {
  if (!roleName) return null;
  const key = normalize(roleName);
  return STANDARD_ROLE_DEFINITIONS.find(role =>
    role.key === key || role.aliases.some(alias => normalize(alias) === key),
  )?.key ?? null;
}

export function getRoleDisplayName(roleName: string | null | undefined): string {
  if (!roleName) return "";
  const key = getStandardRoleKey(roleName);
  return key
    ? STANDARD_ROLE_DEFINITIONS.find(role => role.key === key)!.label
    : roleName;
}
