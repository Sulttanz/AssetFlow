import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import Dashboard from "./dashboard";

const state = vi.hoisted(() => ({
  data: undefined as any,
  options: undefined as any,
  disabled: new Set<string>(),
  request: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  user: { id: "dashboard-manager", roles: [{ name: "system_admin" }], permissions: ["system_admin"] },
  isLoading: false,
}) }));
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({
  isModuleEnabled: (key: string) => !state.disabled.has(key), isLoading: false,
}) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: unknown) => {
  state.options = options;
  return { data: state.data, isLoading: false, isError: false, refetch: vi.fn() };
} }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => state.request(...args) }));
vi.mock("@/components/layout/header", () => ({ default: () => <h1>Executive dashboard</h1> }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => children,
  BarChart: ({ children, data }: any) => <div data-testid="priority-chart" data-values={JSON.stringify(data)}>{children}</div>,
  PieChart: ({ children }: any) => children,
  Pie: ({ children, data }: any) => <div data-testid="access-chart" data-values={JSON.stringify(data)}>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, Cell: () => null,
  Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const fixture = () => ({
  projects: { totalProjects: 17 },
  identity: { activeEmployees: 8, pendingOffboardingClearances: 0, expiringAccessGrants: 0, expiredAccessGrants: 0 },
  infrastructure: { totalServers: 1, serversOnline: 1, serversMaintenance: 0, serversOffline: 0, activeApplications: 1, configurationFiles: 2 },
  serviceDesk: { openIncidentsByPriority: { P1: 2, P2: 0, P3: 0, P4: 0 }, pendingCabApprovals: 0, slaBreachRiskCount: 2, resolutionSla: { withinSla: 4, breached: 0 } },
  itam: { hardwareAssetValuation: 1000, softwareSeatUtilization: 50, contractsExpiring30Days: 0 },
  accessExpiry: { valid: 1, expiring: 0, expired: 0 },
  applicationCriticality: { P1: 1, P2: 0, P3: 0, P4: 0 },
  attentionQueue: [],
});
beforeEach(() => {
  state.data = fixture();
  state.disabled.clear();
  state.request.mockReset().mockResolvedValue({ json: async () => state.data });
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("compact executive dashboard controls", () => {
  it("preserves every existing analytical section and adds a linked Total Projects card", () => {
    render(<Dashboard />);
    for (const title of ["Identity exposure", "Infrastructure health", "Service desk pressure",
      "Access expiry posture", "Criticality mix", "Spend and commitments", "Attention queue"]) {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    }
    const snapshot = screen.getByRole("region", { name: "Operational snapshot" });
    expect(within(snapshot).getByText("Active employees")).toBeTruthy();
    expect(within(snapshot).getByText("Open incidents")).toBeTruthy();
    expect(within(snapshot).getAllByText("Live database count · outside SLA timeframe")).toHaveLength(3);
    expect(snapshot.className).toContain("grid-cols-1");
    expect(snapshot.className).toContain("sm:grid-cols-2");
    expect(snapshot.className).toContain("lg:grid-cols-3");
    const project = within(snapshot).getByRole("link", { name: "Total Projects 17" });
    expect(project.getAttribute("href")).toBe("/projects");
    expect(screen.getByRole("link", { name: /Hardware valuation/ }).getAttribute("href")).toBe("/assets");
    expect(screen.getByRole("link", { name: /Software seats/ }).getAttribute("href")).toBe("/assets");
  });
  it("uses a separate query cache and a real API parameter for each timeframe", async () => {
    render(<Dashboard />);
    expect(state.options.queryKey).toEqual(["/api/dashboard/executive", { days: 30 }]);
    expect(state.options.refetchOnMount).toBe("always");
    expect(state.options.refetchOnWindowFocus).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(state.options.queryKey).toEqual(["/api/dashboard/executive", { days: 7 }]);
    expect(screen.getByRole("button", { name: "7d" }).getAttribute("aria-pressed")).toBe("true");
    await state.options.queryFn();
    expect(state.request).toHaveBeenLastCalledWith("GET", "/api/dashboard/executive?days=7");
    fireEvent.click(screen.getByRole("button", { name: "90d" }));
    await state.options.queryFn();
    expect(state.request).toHaveBeenLastCalledWith("GET", "/api/dashboard/executive?days=90");
    expect(screen.getByText("Timeframe applies to SLA resolutions; inventory and open queues show current totals.")).toBeTruthy();
  });
  it("hides zero breakdown rows and restores them without hiding KPI cards", () => {
    render(<Dashboard />);
    expect(JSON.parse(screen.getByTestId("priority-chart").dataset.values!)).toHaveLength(4);
    expect(screen.getByText("Expired")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide zero rows" }));
    expect(JSON.parse(screen.getByTestId("priority-chart").dataset.values!)).toHaveLength(1);
    expect(JSON.parse(screen.getByTestId("access-chart").dataset.values!)).toHaveLength(1);
    expect(screen.queryByText("Expired")).toBeNull();
    expect(screen.queryByText("P2 · high")).toBeNull();
    expect(screen.getByText("Expired grants")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide zero rows" }));
    expect(screen.getByText("Expired")).toBeTruthy();
  });
  it("keeps a safe project zero fallback and hides the card for disabled Project Management", () => {
    delete state.data.projects;
    const view = render(<Dashboard />);
    expect(screen.getByRole("link", { name: "Total Projects 0" })).toBeTruthy();
    state.disabled.add("project_management");
    view.rerender(<Dashboard />);
    expect(screen.queryByText("Total Projects")).toBeNull();
  });
  it("renders safe zero values when live database counts are missing or invalid", () => {
    state.data.identity.activeEmployees = undefined;
    state.data.serviceDesk.openIncidentsByPriority.P1 = Number.NaN;
    state.data.projects.totalProjects = Number.POSITIVE_INFINITY;
    render(<Dashboard />);
    const snapshot = screen.getByRole("region", { name: "Operational snapshot" });
    expect(within(snapshot).getByRole("link", { name: "Active employees 0" })).toBeTruthy();
    expect(within(snapshot).getByRole("link", { name: "Open incidents 0" })).toBeTruthy();
    expect(within(snapshot).getByRole("link", { name: "Total Projects 0" })).toBeTruthy();
  });
  it("shows explicit empty breakdown messages rather than removing sections", () => {
    state.data.serviceDesk.openIncidentsByPriority = { P1: 0, P2: 0, P3: 0, P4: 0 };
    state.data.serviceDesk.resolutionSla = { withinSla: 0, breached: 0 };
    state.data.accessExpiry = { valid: 0, expiring: 0, expired: 0 };
    state.data.applicationCriticality = { P1: 0, P2: 0, P3: 0, P4: 0 };
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide zero rows" }));
    for (const message of ["No non-zero priority rows to show.", "No non-zero access rows to show.",
      "No non-zero criticality rows to show.", "No resolutions in the selected timeframe."]) {
      expect(screen.getByText(message)).toBeTruthy();
    }
    expect(screen.getByRole("heading", { name: "Attention queue" })).toBeTruthy();
  });
});
