// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { permissions, rolePermissions, roles, userRoles, users } from "@shared/schema";
import { db, pool } from "./db";

const databaseUrl = process.env.DATABASE_URL;
const parsedUrl = databaseUrl ? new URL(databaseUrl) : null;
const safeDatabase = parsedUrl &&
  ["localhost", "127.0.0.1"].includes(parsedUrl.hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(parsedUrl.searchParams.get("options") ?? "");
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && Boolean(safeDatabase);

describe.runIf(enabled)("built-in role alias migration", () => {
  const suffix = randomUUID();
  const userId = randomUUID();
  const duplicateRoleId = randomUUID();
  const customRoleId = randomUUID();
  const keepPermission = randomUUID();
  const mergedPermission = randomUUID();

  beforeAll(async () => {
    const [canonicalRole] = await db.select().from(roles).where(eq(roles.name, "it_manager"));
    expect(canonicalRole).toBeDefined();
    await db.insert(roles).values([
      { id: duplicateRoleId, name: "IT Operations Manager", description: "Legacy duplicate", isSystemRole: false },
      { id: customRoleId, name: `Custom Ops ${suffix}`, description: "Must be retained", isSystemRole: false },
    ]);
    await db.insert(permissions).values([
      { id: keepPermission, name: `role_keep_${suffix}`, description: "Canonical grant" },
      { id: mergedPermission, name: `role_merge_${suffix}`, description: "Legacy grant" },
    ]);
    await db.insert(users).values({
      id: userId, username: `role-merge-${suffix}`, email: `role-merge-${suffix}@example.test`,
      password: "fixture", firstName: "Role", lastName: "Migration", isActive: true,
    });
    await db.insert(rolePermissions).values([
      { roleId: canonicalRole.id, permissionId: keepPermission },
      { roleId: duplicateRoleId, permissionId: mergedPermission },
    ]);
    await db.insert(userRoles).values([
      { userId, roleId: canonicalRole.id },
      { userId, roleId: duplicateRoleId },
      { userId, roleId: customRoleId },
    ]);
  });

  afterAll(async () => {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.delete(rolePermissions).where(
      sql`${rolePermissions.permissionId} IN (${keepPermission}, ${mergedPermission})`,
    );
    await db.delete(roles).where(eq(roles.id, customRoleId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(permissions).where(sql`${permissions.id} IN (${keepPermission}, ${mergedPermission})`);
    await pool.end();
  });

  it("unifies a legacy alias while retaining its assignments and permission union", async () => {
    const migration = await readFile("migrations/onprem/20261207_standardize_standard_roles.sql", "utf8");
    await db.execute(sql.raw(migration));
    const [canonicalRole] = await db.select().from(roles).where(eq(roles.name, "it_manager"));
    const aliasRows = await db.select().from(roles).where(eq(roles.name, "IT Operations Manager"));
    expect(aliasRows).toHaveLength(0);
    expect(canonicalRole.isSystemRole).toBe(true);

    const assignments = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    expect(assignments.filter(row => row.roleId === canonicalRole.id)).toHaveLength(1);
    expect(assignments.some(row => row.roleId === customRoleId)).toBe(true);

    const grants = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, canonicalRole.id));
    expect(grants.map(grant => grant.permissionId)).toEqual(expect.arrayContaining([keepPermission, mergedPermission]));
    expect(await db.select().from(roles).where(eq(roles.id, customRoleId))).toHaveLength(1);
  });
});
