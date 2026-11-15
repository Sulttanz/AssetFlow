import { describe, expect, it } from "vitest";
import { getRoleDisplayName, getStandardRoleKey, STANDARD_ROLE_DEFINITIONS } from "@shared/role-catalog";

describe("standard role catalog", () => {
  it("defines the complete standard role set with unique lower-snake-case keys", () => {
    const keys = STANDARD_ROLE_DEFINITIONS.map(role => role.key);
    expect(keys).toEqual([
      "system_admin", "it_manager", "it_agent", "cab_member",
      "auditor", "asset_manager", "end_user", "read_only_user",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(key => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(key))).toBe(true);
  });

  it.each(STANDARD_ROLE_DEFINITIONS.flatMap(role =>
    [role.key, role.label, ...role.aliases].map(alias => [alias, role.key, role.label] as const),
  ))("normalizes %s to %s while displaying %s", (alias, key, label) => {
    expect(getStandardRoleKey(alias)).toBe(key);
    expect(getRoleDisplayName(alias)).toBe(label);
  });

  it("leaves custom role names unchanged", () => {
    expect(getStandardRoleKey("Finance Review Committee")).toBeNull();
    expect(getRoleDisplayName("Finance Review Committee")).toBe("Finance Review Committee");
  });
});
