import { describe, expect, it, vi } from "vitest";
import { isDemoApiAllowed, isDemoPageAllowed, isDemoViewer } from "../shared/demo-viewer";
import { isPersonaPageAllowed, isSystemAdministrator } from "../shared/personas";
import { createDemoViewerGuard } from "./demo-viewer";

describe("Demo Viewer restrictions", () => {
  it("denies admin pages before a second role can override them", () => {
    expect(isDemoViewer(["admin", "Demo Viewer"])).toBe(true);
    expect(isPersonaPageAllowed(["admin", "Demo Viewer"], ["system_admin"], "/users")).toBe(false);
    expect(isSystemAdministrator({ roles: [{ name: "admin" }, { name: "Demo Viewer" }], permissions: ["system_admin"] })).toBe(false);
    for (const path of ["/users", "/roles", "/permissions", "/system-settings", "/settings", "/migration", "/import", "/system/dropdowns"]) {
      expect(isDemoPageAllowed(path)).toBe(false);
    }
    for (const path of ["/dashboard", "/assets", "/incidents/tracker", "/service-requests/tracker", "/reports/hardware-inventory", "/knowledge-base", "/network-topology"]) {
      expect(isDemoPageAllowed(path)).toBe(true);
    }
  });

  it("permits reads and safe report formatting, not writes or system settings", () => {
    for (const path of ["/api/assets", "/api/incidents/abc", "/api/applications", "/api/dashboard/executive", "/api/network-topology/zones"]) {
      expect(isDemoApiAllowed(path, "GET")).toBe(true);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const path of ["/api/assets/1", "/api/users/1", "/api/incidents/1", "/api/network-topology/rules/1", "/api/projects/1", "/api/system/clear-data"]) {
        expect(isDemoApiAllowed(path, method)).toBe(false);
      }
    }
    expect(isDemoApiAllowed("/api/users", "GET")).toBe(false);
    expect(isDemoApiAllowed("/api/roles", "GET")).toBe(false);
    expect(isDemoApiAllowed("/api/system-settings", "GET")).toBe(false);
    expect(isDemoApiAllowed("/api/data-migrations", "GET")).toBe(false);
    expect(isDemoApiAllowed("/api/system/clear-data", "GET")).toBe(false);
    expect(isDemoApiAllowed("/api/dropdowns/options", "GET")).toBe(true);
    expect(isDemoApiAllowed("/api/dropdowns/options/application_category", "GET")).toBe(true);
    expect(isDemoApiAllowed("/api/report-exports/xlsx", "POST")).toBe(true);
    expect(isDemoApiAllowed("/api/logout", "POST")).toBe(true);
  });

  it("enforces the deny before a route handler, regardless of other assigned roles", async () => {
    const lookupRoles = vi.fn(async () => [{ name: "Demo Viewer" }, { name: "admin" }]);
    const guard = createDemoViewerGuard(lookupRoles);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await guard({
      isAuthenticated: () => true, user: { id: "demo-id" },
      path: "/ASSETS/123", method: "DELETE",
    } as any, response as any, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("read-only") }));
    expect(next).not.toHaveBeenCalled();
    expect(lookupRoles).toHaveBeenCalledWith("demo-id");
  });
});
