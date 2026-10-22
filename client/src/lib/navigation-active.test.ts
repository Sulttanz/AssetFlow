import { describe, expect, it } from "vitest";
import { activeNavigationHref } from "./navigation-active";
import { getPersonaHomePath, isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { dashboardWorkspace } from "./dashboard-workspace";
import type { UserWithDetails } from "@shared/schema";

describe("Dashboard landing and navigation destinations", () => {
  it("uses Dashboard as the landing for every persona without granting executive API access", () => {
    for (const role of ["admin", "it_manager", "cab_member", "it_agent", "auditor", "end_user", "custom"]) {
      expect(getPersonaHomePath([role], [])).toBe("/dashboard");
      expect(isPersonaPageAllowed([role], [], "/dashboard")).toBe(true);
    }
    for (const role of ["it_agent", "auditor", "end_user"]) {
      expect(isPersonaApiAllowed([role], [], "/dashboard/executive", "GET")).toBe(false);
    }
    expect(isPersonaPageAllowed(["it_manager"], [], "/kpis")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/kpis", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/kpis", "GET")).toBe(false);
  });
  it("matches nested pages, aliases and query-based queues accurately", () => {
    const hrefs = ["/dashboard", "/incidents", "/incidents/tracker", "/service-requests", "/service-requests/tracker", "/service-catalog", "/service-catalog?tab=approvals", "/system/dropdowns", "/consumables"];
    expect(activeNavigationHref("/", "", hrefs)).toBe("/dashboard");
    expect(activeNavigationHref("/incidents/new", "", hrefs)).toBe("/incidents");
    expect(activeNavigationHref("/incidents/tracker", "", hrefs)).toBe("/incidents/tracker");
    expect(activeNavigationHref("/service-request-tracker", "", hrefs)).toBe("/service-requests/tracker");
    expect(activeNavigationHref("/dropdowns", "", hrefs)).toBe("/system/dropdowns");
    expect(activeNavigationHref("/inventory", "", hrefs)).toBe("/consumables");
    expect(activeNavigationHref("/service-catalog", "?tab=approvals", hrefs)).toBe("/service-catalog?tab=approvals");
    expect(activeNavigationHref("/service-catalog", "?tab=catalog", hrefs)).toBe("/service-catalog");
  });
  it("builds role-appropriate dashboard links rather than redirecting agents to a lower-level page", () => {
    const user = (name: string, permissions: string[] = []) => ({ roles: [{ name }], permissions } as UserWithDetails);
    expect(dashboardWorkspace(user("it_agent")).links.map(link => link.href)).toContain("/incidents/tracker");
    expect(dashboardWorkspace(user("end_user", ["my_assets_view"])).links.map(link => link.href)).toEqual(["/portal", "/service-catalog", "/my-assets", "/knowledge-base"]);
    const auditorLinks = dashboardWorkspace(user("auditor", ["audit_view", "access_governance_view"])).links.map(link => link.href);
    expect(auditorLinks).toContain("/access-governance");
    expect(auditorLinks).not.toContain("/incidents/tracker");
    expect(dashboardWorkspace(user("end_user")).links.some(link => link.href === "/my-assets")).toBe(false);
  });
});
