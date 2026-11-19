import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { UserWithDetails } from "@shared/schema";
import { isPersonaPageAllowed } from "@shared/personas";
import Sidebar from "./sidebar";

const state = vi.hoisted(() => ({ user: null as UserWithDetails | null, disabled: [] as string[] }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: state.user, logoutMutation: { mutate: vi.fn() } }) }));
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ isModuleEnabled: (key: string) => !state.disabled.includes(key) }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { canManage: true, canApprove: true } }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

const user = (role: string, permissions: string[] = []) => ({
  id: "nav-user", username: "nav-user", firstName: "Navigation", lastName: "User",
  roles: [{ id: role, name: role }], permissions,
} as UserWithDetails);
const path = (value: string) => window.history.replaceState({}, "", value);
const button = (name: string) => screen.getByRole("button", { name });

describe("Enterprise sidebar navigation", () => {
  beforeEach(() => {
    path("/dashboard");
    state.user = user("admin", ["system_admin"]);
    state.disabled = [];
  });
  afterEach(() => { cleanup(); path("/"); });

  it("keeps a project-only customer workspace free of disabled-module navigation", () => {
    state.disabled = ["asset_management", "itsm", "cmdb", "risk_management"];
    render(<Sidebar />);
    expect(button("Project Management")).toBeTruthy();
    fireEvent.click(button("Project Management"));
    expect(screen.getByRole("link", { name: "Projects" })).toBeTruthy();
    for (const title of ["Employee Support", "My Assets", "Asset Management", "CMDB & Infrastructure",
      "Organization", "Vendors Management", "Financial", "Operations", "IT Service Management", "Risk Management & Compliance"]) {
      expect(screen.queryByRole("button", { name: title })).toBeNull();
    }
    fireEvent.click(button("Analytics & Reports"));
    expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "KPI Dashboard" })).toBeNull();
  });

  it("renders the exact section order, expands Overview and keeps collapse levels independent", () => {
    state.user = { ...state.user!, employeeId: "employee-1" };
    render(<Sidebar />);
    expect(screen.getAllByTestId(/^section-toggle-/).map(element => element.textContent)).toEqual([
      "Overview", "Employee Support", "My Assets", "Asset Management", "CMDB & Infrastructure",
      "Organization", "Vendors Management", "Financial", "Project Management", "Operations", "IT Service Management", "Risk Management & Compliance",
      "Analytics & Reports", "Tools", "Administration", "System",
    ]);
    expect(button("Overview").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(button("Analytics & Reports"));
    expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
    fireEvent.click(button("Toggle report categories"));
    expect(button("Toggle report categories").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button("Analytics & Reports"));
    fireEvent.click(button("Analytics & Reports"));
    expect(button("Toggle report categories").getAttribute("aria-expanded")).toBe("true");
  });

  it("points every visible item and report submenu at an existing application route", () => {
    render(<Sidebar />);
    screen.getAllByTestId(/^section-toggle-/).forEach(element => {
      if (element.getAttribute("aria-expanded") !== "true") fireEvent.click(element);
    });
    fireEvent.click(button("Toggle report categories"));
    for (const key of ["employee", "itam", "projects", "itsm"]) {
      const categoryToggle = screen.queryByTestId(`report-category-toggle-${key}`);
      if (categoryToggle) fireEvent.click(categoryToggle);
    }
    const source = readFileSync(`${process.cwd()}/client/src/App.tsx`, "utf8");
    const registered = new Set(Array.from(source.matchAll(/<(?:ProtectedRoute|Route)\s+path="([^"]+)"/g), match => match[1]));
    const links = Array.from(document.querySelectorAll("nav a"));
    expect(links.length).toBeGreaterThan(45);
    for (const link of links) {
      const pathname = new URL(link.getAttribute("href")!, "https://navigation.test").pathname;
      expect(registered.has(pathname), `${link.textContent}: ${pathname}`).toBe(true);
    }
    for (const href of [
      "/reports/employee-directory", "/reports/workload-heatmap", "/reports/account-activity",
      "/reports/hardware-lifecycle", "/reports/consumables-stock", "/reports/project-variance",
      "/reports/project-velocity", "/reports/risk-heatmap", "/reports/itsm-mttr",
      "/reports/itsm-sla", "/reports/itsm-cab",
    ]) {
      expect(links.some(link => link.getAttribute("href") === href), `missing navigation link: ${href}`).toBe(true);
    }
    const tools = button("Tools").parentElement!;
    expect(Array.from(tools.querySelectorAll("a")).map(link => link.textContent)).toEqual(["Data Migration Center", "Settings"]);
  });

  it("keeps operational navigation while hiding administration from the Demo Viewer", () => {
    state.user = user("Demo Viewer", ["asset_view", "cmdb_view", "ticket_view_all", "audit_view", "finance_view"]);
    render(<Sidebar />);
    for (const section of ["Asset Management", "CMDB & Infrastructure", "IT Service Management", "System"]) {
      fireEvent.click(button(section));
    }
    expect(screen.getByRole("link", { name: "Assets" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Applications" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Incident Tracker" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Request Tracker" })).toBeTruthy();
    for (const name of ["User Management", "Roles", "Permissions", "System Settings", "Settings", "Import Data", "Data Migration Center"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
  });

  it("highlights query queues and tracker aliases without also selecting the parent workbench", () => {
    path("/service-catalog?tab=approvals");
    const { unmount } = render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Approval Queue" }).getAttribute("aria-current")).toBe("page");
    expect(Array.from(document.querySelectorAll('a[href="/service-catalog"]')).every(link => !link.hasAttribute("aria-current"))).toBe(true);
    unmount();
    path("/service-request-tracker");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Request Tracker" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Service Requests" }).hasAttribute("aria-current")).toBe(false);
  });

  it("shows Incident Catalog to managers and My Assets to linked employees", () => {
    expect(isPersonaPageAllowed(["it_manager"], [], "/incident-catalog")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/incident-catalog")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets", "employee-linked")).toBe(true);
    state.user = user("it_manager");
    render(<Sidebar />);
    fireEvent.click(button("IT Service Management"));
    expect(screen.getByRole("link", { name: "Incident Catalog" })).toBeTruthy();
    cleanup();

    state.user = { ...user("end_user"), employeeId: "employee-linked" } as UserWithDetails;
    render(<Sidebar />);
    fireEvent.click(button("My Assets"));
    expect(screen.getByRole("link", { name: "My Assigned Assets" })).toBeTruthy();
  });

  it("shows persona-specific sidebar workspaces and keeps unlinked End Users out of internal assets", () => {
    state.user = user("end_user", ["my_assets_view"]);
    render(<Sidebar />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("button", { name: "My Assets" })).toBeNull();
    fireEvent.click(button("Employee Support"));
    expect(screen.getByRole("link", { name: "Employee Self Service" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Incident Tracker" })).toBeNull();
    cleanup();

    state.user = { ...user("end_user", ["my_assets_view"]), employeeId: "employee-linked" } as UserWithDetails;
    render(<Sidebar />);
    fireEvent.click(button("My Assets"));
    expect(screen.getByRole("link", { name: "My Assigned Assets" })).toBeTruthy();
    cleanup();

    state.user = user("asset_manager", ["asset_view", "vendor_create"]);
    render(<Sidebar />);
    fireEvent.click(button("Asset Management"));
    expect(screen.getByRole("link", { name: "Assets" })).toBeTruthy();
    fireEvent.click(button("Vendors Management"));
    expect(screen.getByRole("link", { name: "Vendors Management" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Purchase Orders" })).toBeNull();
    cleanup();

    state.user = user("cab_member", ["change_view_all", "change_approve"]);
    render(<Sidebar />);
    fireEvent.click(button("IT Service Management"));
    expect(screen.getByRole("link", { name: "Changes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Change Tracker" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Servers" })).toBeNull();
  });

  it("nests the exact four report categories and opens the active report category", () => {
    path("/reports/project-variance");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Reports" })).toBeTruthy();
    expect(button("Toggle report categories").getAttribute("aria-expanded")).toBe("true");
    expect(button("Project Management & Governance").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Schedule & Budget Variance" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Employee & Personal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "IT Asset Management" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ITSM Service Desk" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "GRC & Compliance" })).toBeNull();
  });

  it("auto-opens destination sections after navigation while keeping Overview available", () => {
    render(<Sidebar />);
    fireEvent.click(button("Asset Management"));
    fireEvent.click(screen.getByRole("link", { name: "Assets" }));
    expect(screen.getByRole("link", { name: "Assets" }).getAttribute("aria-current")).toBe("page");
    expect(button("Overview").getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the mobile drawer and closes it after selecting a destination", () => {
    render(<Sidebar />);
    const menuButton = button("Open menu");
    fireEvent.click(menuButton);
    expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    const mobileNavigation = document.getElementById("mobile-navigation");
    expect(mobileNavigation?.getAttribute("data-state")).toBe("open");
    const dashboardLink = mobileNavigation?.querySelector('a[href="/dashboard"]');
    expect(dashboardLink).toBeTruthy();
    fireEvent.click(dashboardLink!);
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps compliance visible when Risk Management is disabled and Asset Management is enabled", () => {
    state.disabled = ["risk_management"];
    path("/reports/hardware-inventory");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "IT Components & Compliance" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Risk Register" })).toBeNull();
  });

  it("starts managers on an expanded Overview and preserves end-user restrictions", () => {
    state.user = user("it_manager");
    const { unmount } = render(<Sidebar />);
    expect(button("Overview").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "KPI Dashboard" })).toBeTruthy();
    unmount();
    state.user = user("end_user", ["my_assets_view"]);
    render(<Sidebar />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("button", { name: "System" })).toBeNull();
    expect(screen.queryByRole("button", { name: "CMDB & Infrastructure" })).toBeNull();
    expect(screen.queryByRole("link", { name: "KPI Dashboard" })).toBeNull();
  });

  it("gives the mobile menu an accessible name, description and expanded state", () => {
    render(<Sidebar />);
    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(menu);
    const drawer = screen.getByRole("dialog", { name: "Main navigation" });
    expect(drawer.id).toBe(menu.getAttribute("aria-controls"));
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    const description = document.getElementById(drawer.getAttribute("aria-describedby")!);
    expect(description?.textContent).toContain("Browse your authorized workspaces");
  });
});
