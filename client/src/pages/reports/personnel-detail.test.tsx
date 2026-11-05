import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonnelDetailReport from "./personnel-detail";

const report = {
  directory: [{
    id: "emp-1",
    employeeId: "EMP-0001",
    name: "Amina Noor",
    department: "IT",
    position: "Support Engineer",
    location: "Riyadh",
    status: "active",
    startDate: "2026-02-03",
    allocation: { assets: 1, projectTasks: 2, tickets: 3 },
  }],
  summary: {
    activeEmployees: 8,
    recentStarts: 2,
    recentOffboardings: 1,
    activeAccessGrants: 12,
    expiringAccessGrants: 3,
    expiredAccessGrants: 1,
    recentOffboardingSignoffs: 1,
  },
  allocationModules: { assetManagement: true, projectManagement: true, itsm: true },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: report, isLoading: false, isError: false }),
}));

describe("dedicated personnel reports", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders directory details on its dedicated report route", () => {
    window.history.replaceState({}, "", "/reports/employee-directory");
    render(<PersonnelDetailReport />);
    expect(screen.getByRole("heading", { name: "Employee Directory & Status Report" })).toBeTruthy();
    expect(screen.getAllByText("Amina Noor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("03-02-2026").length).toBeGreaterThan(0);
  });

  it("renders access and onboarding metrics without embedding them in the report index", () => {
    window.history.replaceState({}, "", "/reports/account-activity");
    render(<PersonnelDetailReport />);
    expect(screen.getByRole("heading", { name: "Account Access & Onboarding Activity" })).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Access Expiring")).toBeTruthy();
    expect(screen.queryByText("Active Personnel Directory")).toBeNull();
  });
});
