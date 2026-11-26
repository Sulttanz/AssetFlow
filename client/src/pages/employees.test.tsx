import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Employees from "./employees";
import { applyMobileTableLayout } from "@/lib/mobile-table-layout";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  employees: [] as Record<string, unknown>[],
  mutations: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("wouter", () => ({ useLocation: () => ["/employees", mocks.navigate] }));
vi.mock("@tanstack/react-query", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: mocks.employees, isLoading: false }),
    useMutation: () => {
      const mutate = vi.fn();
      mocks.mutations.push(mutate);
      return { mutate, isPending: false };
    },
  };
});
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { permissions: ["employee_update", "employee_delete"] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/header", () => ({
  default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <header><h1>{title}</h1>{children}</header>
  ),
}));
vi.mock("@/components/employees/employee-form", () => ({ default: () => null }));
vi.mock("@/components/employees/employee-offboarding-dialog", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  mocks.navigate.mockReset();
  mocks.employees = [];
  mocks.mutations = [];
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});

describe("Employees page import action", () => {
  it("opens the employee-only validated import flow", () => {
    render(<Employees />);
    fireEvent.click(screen.getByRole("button", { name: "Import Employees" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/import?module=employees");
  });

  it.each([375, 1024])("keeps employee row details available at %ipx viewport width", width => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const longEmployeeId = "SAMPLE-COMPREHENSIVE-EMPLOYEE-0000000001";
    mocks.employees = [{
      id: "employee-1",
      employeeId: longEmployeeId,
      firstName: "Avery",
      lastName: "Morgan",
      email: null,
      mobile: "+1 555 0101",
      phone: null,
      department: "Operations",
      departmentDetails: { name: "Operations" },
      position: "Service Analyst",
      locationDetails: { name: "Main Office" },
      startDate: "2025-02-15",
      status: "active",
      offboardedDate: null,
      offboardedReason: null,
    }];

    render(<Employees />);
    const row = screen.getByTestId("employee-row-employee-1");
    const table = row.closest("table");
    expect(table).not.toBeNull();
    applyMobileTableLayout(table!);
    expect(table?.dataset.mobileCards).toBe("true");
    expect(screen.getByTestId("employee-id-employee-1").getAttribute("data-mobile-label")).toBe("Employee ID");
    expect(screen.getByTestId("employee-id-employee-1").textContent).toContain(longEmployeeId);
    expect(row.textContent).toContain("Service Analyst");
    expect(row.className).not.toMatch(/(?:^|\s)(?:[a-z]+:)?h-(?:8|9|10|11|12)(?:\s|$)/);

    fireEvent.click(row);
    expect(screen.getByTestId("employee-details-dialog")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Avery Morgan" })).not.toBeNull();
    expect(screen.getByTestId("employee-details-dialog").textContent).toContain("Service Analyst");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
  });

  it("selects all filtered employees and asks for confirmation before bulk delete", () => {
    mocks.employees = [
      { id: "employee-1", employeeId: "EMP-1", firstName: "Avery", lastName: "Morgan", email: null, department: "IT", position: "Analyst", status: "active" },
      { id: "employee-2", employeeId: "EMP-2", firstName: "Sam", lastName: "Lee", email: null, department: "IT", position: "Engineer", status: "active" },
    ];

    render(<Employees />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all filtered employees" }));
    expect(screen.getByText("2 employees selected")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete Selected" }));
    expect(screen.getByRole("heading", { name: "Delete selected employees?" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    expect(mocks.mutations.some(mutation =>
      mutation.mock.calls.some(([ids]) => JSON.stringify(ids) === JSON.stringify(["employee-1", "employee-2"])),
    )).toBe(true);
  });
});
