import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const data = vi.hoisted(() => ({
  options: { canCreateVendor: true, canUpdateVendor: true, canManageContracts: true,
    categories: [{ value: "Hardware Supplier", label: "Hardware Supplier" }],
    contractTypes: [{ value: "SLA Support", label: "SLA Support" }], assets: [], purchaseOrders: [], servers: [] },
  vendors: [{ id: "vendor-1", name: "Supplier One", code: "SUP-01", category: "Hardware Supplier", status: "active", activeContractCount: 1 }],
  contracts: [{ id: "contract-1", title: "Support agreement", contractNumber: "SLA-01", vendorId: "vendor-1", vendorName: "Supplier One",
    contractType: "SLA Support", startDate: "2026-01-01", endDate: "2026-12-31", renewalNoticeDays: 30,
    cost: "1234.56", currency: "EUR", slaTier: "24/7 4hr", status: "Active", lifecycleStatus: "Active",
    daysUntilExpiry: 70, renewalDue: false, assetIds: ["asset-1"], purchaseOrderIds: [], serverIds: [],
    assets: [{ id: "asset-1", name: "License pool", assetTag: "SW-001", type: "software" }], purchaseOrders: [], servers: [] }],
}));
vi.mock("@tanstack/react-query", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "vendor-contracts" ? data.contracts : queryKey[1] === "options" ? data.options : data.vendors,
    isLoading: false, isError: false, refetch: vi.fn(),
  }), useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
});
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "manager" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import VendorsPage from "./vendors";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });
describe("supplier and contract tab record isolation", () => {
  it("loads the default supplier tab when both vendor and contract collections contain records", () => {
    window.history.replaceState({}, "", "/vendors");
    expect(() => render(<VendorsPage />)).not.toThrow();
    expect(screen.getByRole("tab", { name: /Vendors/ }).getAttribute("data-state")).toBe("active");
    expect(screen.getByText(/SUP-01/)).toBeTruthy();
  });
  it("switches repeatedly without treating a supplier as a contract and preserves currency cents", () => {
    render(<VendorsPage />);
    const contracts = screen.getByRole("tab", { name: /Contracts & SLAs/ });
    const vendors = screen.getByRole("tab", { name: /Vendors/ });
    for (let iteration = 0; iteration < 2; iteration++) {
      fireEvent.mouseDown(contracts, { button: 0, ctrlKey: false });
      expect(screen.getByText("Support agreement")).toBeTruthy();
      expect(screen.getByText(/Software pool · License pool/)).toBeTruthy();
      expect(screen.getByText("€1,234.56", { selector: "td" })).toBeTruthy();
      fireEvent.mouseDown(vendors, { button: 0, ctrlKey: false });
      expect(screen.getByText(/SUP-01/)).toBeTruthy();
    }
  });
  it("opens the contracts deep link directly and renders calendar dates day first", () => {
    window.history.replaceState({}, "", "/vendors?tab=contracts");
    render(<VendorsPage />);
    expect(screen.getByRole("tab", { name: /Contracts & SLAs/ }).getAttribute("data-state")).toBe("active");
    expect(screen.getByText("01-01-2026")).toBeTruthy();
    expect(screen.getByText("to 31-12-2026")).toBeTruthy();
  });
});
