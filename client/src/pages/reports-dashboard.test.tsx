import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsDashboard from "./reports-dashboard";

const mockState = vi.hoisted(() => ({
  disabledModules: [] as string[],
  permissions: ["system_admin"] as string[],
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { permissions: mockState.permissions } }),
}));

vi.mock("@/hooks/use-modules", () => ({
  useModules: () => ({
    isModuleEnabled: (key: string) => !mockState.disabledModules.includes(key),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      directory: [],
      summary: {
        activeEmployees: 0,
        recentStarts: 0,
        recentOffboardings: 0,
        activeAccessGrants: 0,
        expiringAccessGrants: 0,
        expiredAccessGrants: 0,
        recentOffboardingSignoffs: 0,
      },
      allocationModules: { assetManagement: false, projectManagement: false, itsm: false },
    },
    isLoading: false,
    isError: false,
  }),
}));

describe("Reports dashboard module visibility", () => {
  beforeEach(() => {
    mockState.disabledModules = [];
    mockState.permissions = ["system_admin"];
    window.history.replaceState({}, "", "/reports");
  });
  afterEach(() => cleanup());

  it("keeps employee reports available and expandable when every optional module is disabled", () => {
    mockState.disabledModules = ["asset_management", "cmdb", "itsm", "project_management", "risk_management"];
    render(<ReportsDashboard />);

    const employeeCategory = screen.getByRole("button", { name: /Employee & Personal/ });
    expect(employeeCategory.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /IT Asset Management/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /ITSM Service Desk/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Project Management & Governance/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /GRC & Compliance/ })).toBeNull();

    fireEvent.click(employeeCategory);
    expect(employeeCategory.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Employee Directory & Status Report")).toBeTruthy();
    expect(screen.getByText("Resource Workload Heatmap")).toBeTruthy();
    expect(screen.getAllByText("Account Access & Onboarding Activity").length).toBeGreaterThan(0);
    expect(screen.getByText("Active Personnel Directory")).toBeTruthy();
  });

  it("shows enabled domains as expandable categories", () => {
    render(<ReportsDashboard />);
    const assetCategory = screen.getByRole("button", { name: /^IT Asset Management/ });
    const projectCategory = screen.getByRole("button", { name: /Project Management & Governance/ });
    const itsmCategory = screen.getByRole("button", { name: /ITSM Service Desk/ });
    expect(assetCategory.getAttribute("aria-expanded")).toBe("false");
    expect(projectCategory.getAttribute("aria-expanded")).toBe("false");
    expect(itsmCategory.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /GRC & Compliance/ })).toBeNull();

    fireEvent.click(projectCategory);
    expect(screen.getByText("Schedule & Budget Variance (SV/BV)")).toBeTruthy();
    expect(screen.getByText("Task & Milestone Velocity")).toBeTruthy();
    expect(screen.getByText("PMI RMP Risk Heatmap")).toBeTruthy();
    expect(screen.getAllByText("Planned").length).toBe(3);
  });

  it("expands the employee category for its direct report route", () => {
    window.history.replaceState({}, "", "/reports/personnel");
    render(<ReportsDashboard />);
    expect(screen.getByRole("button", { name: /Employee & Personal/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Employee Directory & Status Report")).toBeTruthy();
  });

  it("hides module categories when the user has no matching permissions", () => {
    mockState.permissions = [];
    render(<ReportsDashboard />);

    expect(screen.getByRole("button", { name: /Employee & Personal/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /IT Asset Management/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Project Management & Governance/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /ITSM Service Desk/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /GRC & Compliance/ })).toBeNull();
  });
});
