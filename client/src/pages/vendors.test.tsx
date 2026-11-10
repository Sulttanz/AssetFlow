import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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
  profile: { vendor: { id: "vendor-1", name: "Supplier One", code: "SUP-01", category: "Hardware Supplier",
    tier: "Tier 1 - Strategic", status: "active", accountManager: "Taylor", primaryContactEmail: "support@example.com",
    supportUrl: "https://support.example.com", slaTerms: "24/7 response" },
    assets: [{ id: "asset-1", name: "Laptop", type: "laptop", assetTag: "AST-1", serialNumber: "SER-1",
      status: "assigned", warrantyExpiry: "2027-01-01", manufacturer: "OEM", model: "X1" }],
     contracts: [], warranties: [], purchaseOrders: [],
    certifications: [{ id: "cert-1", vendorId: "vendor-1", certificationName: "SOC 2 Type II", certificateNumber: "SOC-77",
      issueDate: "2025-01-01", expiryDate: "2026-11-25", documentUrl: "https://example.com/cert.pdf", notes: null,
      daysUntilExpiry: 15, status: "Expiring Soon", needsAttention: true, isExpiringWithin30Days: true }],
    expiringCertificationCount: 1,
    performance: { linkedIncidentCount: 4, resolvedIncidentCount: 3, averageResolutionHours: 6.5, slaBreachCount: 1,
      annualScore: 4.4, annualStatus: "Green", lastReviewDate: "2026-08-10" },
   },
}));
vi.mock("@tanstack/react-query", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "vendor-contracts" ? data.contracts : queryKey[0] === "vendor-profile" ? data.profile : queryKey[1] === "options" ? data.options : data.vendors,
    isLoading: false, isError: false, refetch: vi.fn(),
  }), useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
});
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "manager" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import VendorsPage from "./vendors";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });
describe("vendor directory and 360 profile", () => {
  it("loads the default directory when vendor and contract collections contain records", () => {
    window.history.replaceState({}, "", "/vendors");
    expect(() => render(<VendorsPage />)).not.toThrow();
    expect(screen.getByRole("heading", { name: "Vendors Management" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Vendor Directory/ }).getAttribute("data-state")).toBe("active");
    expect(screen.getAllByText(/SUP-01/).length).toBeGreaterThan(0);
  });
  it("switches repeatedly without treating a supplier as a contract and preserves currency cents", () => {
    render(<VendorsPage />);
    const contracts = screen.getByRole("tab", { name: /Contracts & SLAs/ });
    const vendors = screen.getByRole("tab", { name: /Vendor Directory/ });
    for (let iteration = 0; iteration < 2; iteration++) {
      fireEvent.mouseDown(contracts, { button: 0, ctrlKey: false });
      expect(screen.getByText("Support agreement")).toBeTruthy();
      expect(screen.getByText(/Software pool · License pool/)).toBeTruthy();
      expect(screen.getByText("€1,234.56", { selector: "td" })).toBeTruthy();
      fireEvent.mouseDown(vendors, { button: 0, ctrlKey: false });
      expect(screen.getAllByText(/SUP-01/).length).toBeGreaterThan(0);
    }
  });
  it("opens the contracts deep link directly and renders calendar dates day first", () => {
    window.history.replaceState({}, "", "/vendors?tab=contracts");
    render(<VendorsPage />);
    expect(screen.getByRole("tab", { name: /Contracts & SLAs/ }).getAttribute("data-state")).toBe("active");
    expect(screen.getByText("01-01-2026")).toBeTruthy();
    expect(screen.getByText("to 31-12-2026")).toBeTruthy();
  });
  it("opens a vendor 360 profile with support, linked asset and warranty details", () => {
    render(<VendorsPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "View profile" })[0]);
    expect(screen.getByRole("dialog", { name: "Supplier One" })).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: "Supplier One" });
    expect(within(dialog).getByText("Tier 1 - Strategic", { selector: "p" })).toBeTruthy();
    expect(within(dialog).getByText(/1 certification expired or expiring within 30 days/)).toBeTruthy();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /Compliance/ }), { button: 0, ctrlKey: false });
    expect(within(dialog).getByText("SOC 2 Type II")).toBeTruthy();
    expect(within(dialog).getByText("15 days remaining")).toBeTruthy();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /Performance & Metrics/ }), { button: 0, ctrlKey: false });
    expect(within(dialog).getByText("6.5h")).toBeTruthy();
    expect(within(dialog).getByText("4.4 / 5")).toBeTruthy();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: /Linked Assets/ }), { button: 0, ctrlKey: false });
    expect(within(dialog).getByText("Laptop")).toBeTruthy();
    expect(within(dialog).getByText("01-01-2027")).toBeTruthy();
  });
});
