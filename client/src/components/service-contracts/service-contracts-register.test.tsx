import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceContract } from "@shared/schema";
import ServiceContractsRegister from "./service-contracts-register";
import { SupportSlaWarranty } from "./support-sla-warranty";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "asset-manager", permissions: ["asset_view", "asset_update"], roles: [{ name: "it_manager" }] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const serviceContracts: ServiceContract[] = [
  {
    id: 1,
    contractNumber: "SC-2026-014",
    contractName: "Atlas platform support",
    projectId: "project-1",
    clientId: null,
    slaPolicyId: "sla-1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalNoticeDays: 60,
    status: "near_expiration",
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const projects = [{ id: "project-1", title: "Atlas Upgrade" }];
const policies = [{
  id: "sla-1",
  name: "Gold Support",
  priority: "P1",
  responseHours: 1,
  resolutionHours: 4,
  isActive: true,
}];

let recordedCreatePayload: Record<string, unknown> | null = null;

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) } as Response;
}

function renderWithQueryClient(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  recordedCreatePayload = null;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/contracts" && init?.method === "POST") {
      recordedCreatePayload = JSON.parse(String(init.body)) as Record<string, unknown>;
      return jsonResponse({ ...serviceContracts[0], id: 2, contractNumber: recordedCreatePayload.contractNumber });
    }
    if (url.includes("/api/contracts?kind=service")) return jsonResponse(serviceContracts);
    if (url === "/api/projects") return jsonResponse(projects);
    if (url === "/api/sla-policies") return jsonResponse(policies);
    return jsonResponse([]);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("service contracts UI", () => {
  it("renders contract columns, linked project, SLA tier, and lifecycle badge", async () => {
    renderWithQueryClient(<ServiceContractsRegister />);

    expect((await screen.findAllByText("SC-2026-014")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Atlas platform support").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Atlas Upgrade").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gold Support").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Near Expiry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01-01-2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31-12-2026").length).toBeGreaterThan(0);
    for (const heading of ["Contract #", "Name", "Linked project", "SLA tier", "Start date", "End date", "Days remaining", "Status"]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    }
  });

  it("shows project-linked current and historical coverage in the project view", async () => {
    const historical: ServiceContract = { ...serviceContracts[0], id: 2, contractNumber: "SC-2025-003", contractName: "Previous support", status: "expired" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/contracts?kind=service&projectId=project-1")) return jsonResponse([serviceContracts[0], historical]);
      if (url === "/api/sla-policies") return jsonResponse(policies);
      return jsonResponse([]);
    });

    renderWithQueryClient(<SupportSlaWarranty projectId="project-1" />);

    expect(await screen.findByText("Support & SLA warranty")).toBeTruthy();
    expect(screen.getAllByText("Atlas platform support").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Previous support").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
  });

  it("submits the Add Contract form using ISO dates and the service-contract API", async () => {
    renderWithQueryClient(<ServiceContractsRegister />);
    fireEvent.click(await screen.findByRole("button", { name: "Add contract" }));
    fireEvent.change(screen.getByLabelText("Contract number"), { target: { value: "SC-2026-015" } });
    fireEvent.change(screen.getByLabelText("Contract name"), { target: { value: "Database support" } });
    fireEvent.change(screen.getByLabelText("Coverage ends"), { target: { value: "2028-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save contract" }));

    await waitFor(() => expect(recordedCreatePayload).toMatchObject({
      contractNumber: "SC-2026-015",
      contractName: "Database support",
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      endDate: "2028-12-31",
      renewalNoticeDays: 60,
      projectId: null,
      slaPolicyId: null,
    }));
  });
});
