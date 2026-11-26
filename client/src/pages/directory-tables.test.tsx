import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Departments from "./departments";
import Locations from "./locations";
import { applyMobileTableLayout } from "@/lib/mobile-table-layout";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@tanstack/react-query", async original => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isLoading: false,
    data: queryKey[0] === "/api/departments"
      ? [{ id: "dept-1", name: "IT Operations", locationId: "loc-1", employeeCount: 3, assetCount: 5 }]
      : queryKey[0] === "/api/locations"
        ? Array.from({ length: 40 }, (_, index) => ({ id: `loc-${index + 1}`, name: index ? `Office ${index + 1}` : "Riyadh HQ", code: `LOC-${index + 1}`, city: "Riyadh", departmentCount: 2, assetCount: 4 }))
        : [{ id: "emp-1", firstName: "Avery", lastName: "Morgan", employeeId: "EMP-001", position: "Manager" }],
  }),
}));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); mocks.mutate.mockReset(); document.documentElement.dir = "ltr"; });

describe("directory row views", () => {
  it.each(["ltr", "rtl"])("keeps Departments as semantic scrollable rows and searches locations in %s", async direction => {
    document.documentElement.dir = direction;
    render(<Departments />);
    const table = screen.getByRole("table", { name: "Departments" }) as HTMLTableElement;
    applyMobileTableLayout(table);
    expect(table.dataset.mobileCards).toBe("false");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    expect(within(table).getByText("IT Operations")).not.toBeNull();
    expect(within(table).getByText("Riyadh HQ")).not.toBeNull();
    expect(within(table).getByRole("button", { name: /edit/i })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add Department" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Select department location" }));
    fireEvent.change(await screen.findByPlaceholderText("Search locations..."), { target: { value: "LOC-35" } });
    fireEvent.click(await screen.findByRole("option", { name: /Office 35/ }));
    expect(screen.getByRole("combobox", { name: "Select department location" }).textContent).toContain("Office 35");
    fireEvent.change(screen.getByLabelText("Department Name"), { target: { value: "New department" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Department" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: "New department", locationId: "loc-35" })));
  });

  it("renders Locations as rows with accessible actions and the manager combobox", () => {
    render(<Locations />);
    const table = screen.getByRole("table", { name: "Locations" }) as HTMLTableElement;
    applyMobileTableLayout(table);
    expect(table.dataset.mobileCards).toBe("false");
    expect(within(table).getByText("Riyadh HQ")).not.toBeNull();
    const firstRow = screen.getByTestId("row-location-loc-1");
    fireEvent.click(within(firstRow).getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("heading", { name: "Edit Location" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Select location manager" })).not.toBeNull();
  });
});
