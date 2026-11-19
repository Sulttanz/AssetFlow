import { describe, expect, it } from "vitest";
import { activeNavigationHref } from "./navigation-active";
import { getPersonaHomePath, isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { dashboardWorkspace } from "./dashboard-workspace";
import type { UserWithDetails } from "@shared/schema";

describe("Dashboard landing and navigation destinations", () => {
  it("routes End Users to Employee Self Service and other personas to Dashboard", () => {
    expect(getPersonaHomePath(["end_user"], [])).toBe("/portal");
    expect(isPersonaPageAllowed(["end_user"], [], "/dashboard")).toBe(false);
    for (const role of ["admin", "system_admin", "it_manager", "cab_member", "it_agent", "auditor", "asset_manager", "read_only_user", "custom"]) {
      expect(getPersonaHomePath([role], [])).toBe("/dashboard");
      expect(isPersonaPageAllowed([role], [], "/dashboard")).toBe(true);
    }
    for (const role of ["it_agent", "auditor", "end_user", "cab_member"]) {
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
    const user = (name: string, permissions: string[] = [], employeeId?: string) => ({ roles: [{ name }], permissions, employeeId } as UserWithDetails);
    expect(dashboardWorkspace(user("it_agent")).links.map(link => link.href)).toContain("/incidents/tracker");
    expect(dashboardWorkspace(user("end_user", ["my_assets_view"], "emp-1")).links.map(link => link.href)).toEqual(["/portal", "/service-catalog", "/my-assets", "/knowledge-base"]);
    const auditorLinks = dashboardWorkspace(user("auditor", ["audit_view", "access_governance_view"])).links.map(link => link.href);
    expect(auditorLinks).toContain("/access-governance");
    expect(auditorLinks).not.toContain("/incidents/tracker");
    expect(dashboardWorkspace(user("end_user")).links.some(link => link.href === "/my-assets")).toBe(false);
    expect(dashboardWorkspace(user("asset_manager", ["asset_view", "inventory_view", "assignment_create", "my_assets_view"], "emp-2")).links.map(link => link.href)).toContain("/assets");
    expect(dashboardWorkspace(user("cab_member", ["change_view_all", "change_approve"])).links.map(link => link.href)).toEqual(["/changes", "/changes/tracker", "/portal", "/service-catalog"]);
  });

  it("enforces the four End User project personas", () => {
    type Persona = { employeeId: string | null; assignedProjectIds: string[] };
    const linkedNoProjects: Persona = { employeeId: "emp-1", assignedProjectIds: [] };
    const linkedWithProject = { employeeId: "emp-2", assignedProjectIds: ["project-1"] };
    const externalWithProject = { employeeId: null, assignedProjectIds: ["project-2"] };
    const unlinkedNoProjects = { employeeId: null, assignedProjectIds: [] };
    const allowed = (persona: Persona, path: string) =>
      isPersonaPageAllowed(["end_user"], [], path, persona.employeeId, persona.assignedProjectIds);

    for (const path of ["/portal", "/incidents/new", "/service-requests/new", "/service-catalog", "/knowledge-base"]) {
      expect(allowed(linkedNoProjects, path)).toBe(true);
      expect(allowed(unlinkedNoProjects, path)).toBe(true);
    }
    expect(allowed(linkedNoProjects, "/my-assets")).toBe(true);
    expect(allowed(linkedNoProjects, "/changes/new")).toBe(false);
    expect(allowed(linkedWithProject, "/my-assets")).toBe(true);
    expect(allowed(linkedWithProject, "/changes/new")).toBe(true);
    expect(allowed(externalWithProject, "/my-assets")).toBe(false);
    expect(allowed(externalWithProject, "/changes/new")).toBe(true);
    expect(allowed(unlinkedNoProjects, "/my-assets")).toBe(false);
    expect(allowed(unlinkedNoProjects, "/changes/new")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/changes", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/changes/one", "PUT")).toBe(false);
  });
});
