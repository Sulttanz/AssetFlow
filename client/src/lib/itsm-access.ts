import type { UserWithDetails } from "@shared/schema";
import { personaRolesForUser } from "@shared/personas";

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
  if (personaRolesForUser(user).some(role => ["it_agent", "it_manager", "cab_member"].includes(role))) return true;
  return user.roles?.some(role => ITSM_WORKBENCH_ROLES.has(role.name.trim().toLowerCase())) ?? false;
}
