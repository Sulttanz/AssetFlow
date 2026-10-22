import { db, pool } from "../server/db";
import { hashPassword } from "../server/auth";
import { permissions, rolePermissions, roles, userRoles, users } from "../shared/schema";
import { DEMO_VIEWER_ROLE } from "../shared/demo-viewer";
import { eq, inArray } from "drizzle-orm";

const username = "test-user";
const email = "test-user@demo.invalid";
const excludedResources = new Set(["users", "roles", "permissions", "settings", "system"]);
const excludedNames = new Set(["user_view", "role_view", "permission_view", "system_admin"]);

function approvedPermission(permission: typeof permissions.$inferSelect): boolean {
  return ["view", "view_own"].includes(permission.action ?? "") &&
    !excludedResources.has((permission.resource ?? "").toLowerCase()) &&
    !excludedNames.has(permission.name) &&
    !/(?:secret|credential|password|license_key)/i.test(permission.name);
}

async function main() {
  let password = "";
  for await (const chunk of process.stdin) password += chunk.toString();
  password = password.replace(/\r?\n$/, "");
  if (!password) throw new Error("Provide the password on stdin; it is never stored in this script.");

  const hashedPassword = await hashPassword(password);
  password = "";
  await db.transaction(async tx => {
    const [existingUser] = await tx.select().from(users).where(eq(users.username, username));
    if (existingUser) throw new Error("The requested username already exists; refusing to overwrite an account.");
    const [existingEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existingEmail) throw new Error("The reserved demo email already exists.");

    const [existingRole] = await tx.select().from(roles).where(eq(roles.name, DEMO_VIEWER_ROLE));
    if (existingRole) throw new Error("A Demo Viewer role already exists; review its permissions before provisioning.");
    const [role] = await tx.insert(roles).values({
      name: DEMO_VIEWER_ROLE,
      description: "Read-only platform exploration; no administration or record changes",
      isSystemRole: false,
    }).returning();
    const viewPermissions = (await tx.select().from(permissions)).filter(approvedPermission);
    const required = ["asset_view", "ticket_view_all", "cmdb_view", "finance_view", "audit_view"];
    for (const name of required) {
      if (!viewPermissions.some(permission => permission.name === name)) {
        throw new Error(`Required read permission is missing: ${name}`);
      }
    }
    await tx.insert(rolePermissions).values(viewPermissions.map(permission => ({
      roleId: role.id, permissionId: permission.id,
    })));
    const [user] = await tx.insert(users).values({
      username, email, password: hashedPassword, firstName: "Demo", lastName: "Viewer",
      isActive: true,
    }).returning();
    await tx.insert(userRoles).values({ userId: user.id, roleId: role.id });
  });
  console.log("Demo Viewer account provisioned with read-only permissions.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Demo provisioning failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
