import type { UserWithDetails } from "@shared/schema";

const ITSM_WORKBENCH_ROLES = new Set([
  "it staff",
  "it support staff",
  "manager",
  "system administrator",
  "administrator",
  "admin",
  "it manager",
  "helpdesk agent",
  "help desk agent",
]);

export function canAccessItsmWorkbench(user: UserWithDetails | null | undefined): boolean {
  if (!user) return false;
  if (user.permissions?.some(permission =>
    ["system_admin", "ticket_manage", "ticket_view_all"].includes(permission),
  )) return true;
  return user.roles?.some(role => ITSM_WORKBENCH_ROLES.has(role.name.trim().toLowerCase())) ?? false;
}
