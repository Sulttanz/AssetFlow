import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsDashboard from "./reports-dashboard";

const mockState = vi.hoisted(() => ({ disabledModules: [] as string[] }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { permissions: ["system_admin"] } }),
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
  beforeEach(() => { mockState.disabledModules = []; });
  afterEach(() => cleanup());

  it("keeps employee reports available when every optional module is disabled", () => {
    mockState.disabledModules = ["asset_management", "cmdb", "itsm", "project_management", "risk_management"];
    render(<ReportsDashboard />);

    expect(screen.getByRole("tab", { name: "Employee & Personnel" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "ITAM & CMDB" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "ITSM Service Desk" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Project Management & Governance" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "GRC & Compliance" })).toBeNull();
    expect(screen.getByText("Active Personnel Directory")).toBeTruthy();
    expect(screen.getByText("Account Access & Onboarding Activity")).toBeTruthy();
  });

  it("shows each enabled domain as its own reporting category", () => {
    render(<ReportsDashboard />);
    expect(screen.getByRole("tab", { name: "ITAM & CMDB" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Project Management & Governance" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "ITSM Service Desk" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "GRC & Compliance" })).toBeTruthy();
  });
});
