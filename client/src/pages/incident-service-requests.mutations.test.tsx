import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSpy = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ permissions: ["ticket_manage"] }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "agent-1",
      permissions: authState.permissions,
      roles: [{ name: "it_agent" }],
    },
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

import { IncidentsPage } from "./incident-service-requests";

const originalIncident = {
  id: "incident-1",
  incidentNumber: "INC-2026-0001",
  title: "VPN access unavailable",
  description: "Remote employees cannot connect.",
  urgency: "medium",
  impact: "medium",
  priority: "P2",
  status: "In Progress",
  category: "Network",
  creatorId: "agent-1",
  requesterId: "agent-1",
  projectId: null,
  assignmentGroup: "Service Desk",
  assigneeId: null,
  assignedToId: null,
  assetId: null,
  changeRequestId: null,
  responseDueAt: null,
  resolveDueAt: null,
  createdAt: "2026-04-01T10:00:00.000Z",
  updatedAt: "2026-04-01T10:00:00.000Z",
} as any;

let incidentState: typeof originalIncident;
let requests: { url: string; method: string; body: unknown }[];

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IncidentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  toastSpy.mockClear();
  authState.permissions = ["ticket_manage"];
  incidentState = { ...originalIncident };
  requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });

    if (url === "/api/incidents" && method === "GET") return response([incidentState]);
    if (url === "/api/incidents/options") {
      return response({
        projects: [],
        users: [{ id: "agent-2", name: "Grace Hopper" }],
        assignmentGroups: ["Service Desk", "Network"],
        slaPolicies: [],
      });
    }
    if (url === `/api/incidents/${incidentState.id}/activity`) return response([]);
    if (url === `/api/incidents/${incidentState.id}/assignment` && method === "PATCH") {
      incidentState = { ...incidentState, ...body };
      return response(incidentState);
    }
    if (url === `/api/incidents/${incidentState.id}/status` && method === "PATCH") {
      incidentState = { ...incidentState, ...body };
      return response(incidentState);
    }
    if (url === `/api/incidents/${incidentState.id}` && method === "PATCH") {
      incidentState = { ...incidentState, ...body };
      return response(incidentState);
    }
    if (url === `/api/incidents/${incidentState.id}/to-change` && method === "POST") {
      return response({ id: "change-1" }, 201);
    }
    if (url === "/api/changes") return response([]);
    return response({ message: `Unexpected test request: ${method} ${url}` }, 404);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("incident operations mutation state", () => {
  it("submits assignment, independent workflow details, and resolution fields, then refreshes incident state", async () => {
    renderPage();
    const incidentRow = (await screen.findByText("INC-2026-0001")).closest("tr");
    expect(incidentRow).toBeTruthy();
    fireEvent.click(incidentRow!);

    fireEvent.change(screen.getByLabelText("Assignment group"), { target: { value: "Network" } });
    fireEvent.change(screen.getByLabelText("Assigned engineer"), { target: { value: "agent-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() => expect(requests.some(({ url, method, body }) =>
      url === "/api/incidents/incident-1/assignment" &&
      method === "PATCH" &&
      JSON.stringify(body) === JSON.stringify({ assignmentGroup: "Network", assigneeId: "agent-2" }),
    )).toBe(true));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save assignment" }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.change(screen.getByLabelText("Incident / resolution category"), { target: { value: "Connectivity" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "P1" } });
    fireEvent.change(screen.getByLabelText("Urgency"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Impact"), { target: { value: "high" } });
    fireEvent.click(screen.getByRole("button", { name: "Save triage & workflow details" }));
    await waitFor(() => expect(requests.some(({ url, method, body }) =>
      url === "/api/incidents/incident-1" && method === "PATCH" &&
      JSON.stringify(body) === JSON.stringify({ category: "Connectivity", resolutionCode: null, resolutionNotes: null, priority: "P1", urgency: "high", impact: "high", slaPolicyId: null }),
    )).toBe(true));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save triage & workflow details" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Resolution code"), { target: { value: "Solved (Permanent Fix)" } });
    fireEvent.change(screen.getByLabelText("Resolution / closure note"), { target: { value: "VPN service restored and verified." } });
    fireEvent.click(screen.getByRole("button", { name: "Resolved" }));
    await waitFor(() => expect(requests.some(({ url, method, body }) =>
      url === "/api/incidents/incident-1/status" &&
      method === "PATCH" &&
      JSON.stringify(body) === JSON.stringify({
        status: "Resolved",
        category: "Connectivity",
        resolutionCode: "Solved (Permanent Fix)",
        resolutionNotes: "VPN service restored and verified.",
      }),
    )).toBe(true));

    await waitFor(() => expect(incidentState.status).toBe("Resolved"));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Incident status updated" })));
    expect(requests.some(({ url }) => url === "/api/incidents/incident-1/activity")).toBe(true);
  });

  it("loads only members of the selected assignment group for incident assignment", async () => {
    incidentState = { ...originalIncident, assignmentGroup: null };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/incidents") return response([incidentState]);
      if (url === "/api/incidents/options") return response({
        projects: [],
        users: [{ id: "agent-2", name: "Grace Hopper" }, { id: "agent-3", name: "Katherine Johnson" }],
        assignmentGroups: ["Network"],
        managedAssignmentGroups: [{ id: 12, name: "Network" }],
        slaPolicies: [],
      });
      if (url === "/api/assignment-groups/12/members") return response([{ id: "agent-3", name: "Katherine Johnson" }]);
      if (url.endsWith("/activity")) return response([]);
      return response([]);
    });

    renderPage();
    fireEvent.click((await screen.findByText("INC-2026-0001")).closest("tr")!);
    fireEvent.change(screen.getByLabelText("Assignment group"), { target: { value: "Network" } });

    await waitFor(() => expect(requests.some(request => request.url === "/api/assignment-groups/12/members")).toBe(true));
    const engineerSelect = screen.getByLabelText("Assigned engineer") as HTMLSelectElement;
    await waitFor(() => expect(Array.from(engineerSelect.options).map(option => option.textContent)).toContain("Katherine Johnson"));
    expect(Array.from(engineerSelect.options).map(option => option.textContent)).not.toContain("Grace Hopper");
  });

  it("submits a resolution note when closing a resolved incident", async () => {
    incidentState = { ...originalIncident, status: "Resolved", resolvedAt: "2026-04-02T10:00:00.000Z" };
    renderPage();
    fireEvent.click((await screen.findByText("INC-2026-0001")).closest("tr")!);
    fireEvent.change(screen.getByLabelText("Incident / resolution category"), { target: { value: "Network" } });
    fireEvent.change(screen.getByLabelText("Resolution code"), { target: { value: "Solved (Permanent Fix)" } });
    fireEvent.change(screen.getByLabelText("Resolution / closure note"), { target: { value: "Requester confirmed VPN access is restored." } });
    fireEvent.click(screen.getByRole("button", { name: "Closed (False Alarm / Cancelled)" }));

    await waitFor(() => expect(requests.some(({ url, method, body }) =>
      url === "/api/incidents/incident-1/status" &&
      method === "PATCH" &&
      JSON.stringify(body) === JSON.stringify({
        status: "Closed",
        category: "Network",
        resolutionCode: "Solved (Permanent Fix)",
        resolutionNotes: "Requester confirmed VPN access is restored.",
      }),
    )).toBe(true));
  });

  it("shows server validation errors without clearing the agent's form state", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/incidents") return response([incidentState]);
      if (url === "/api/incidents/options") return response({ projects: [], users: [], assignmentGroups: ["Network"], slaPolicies: [] });
      if (url.endsWith("/activity")) return response([]);
      if (url.endsWith("/assignment") && init?.method === "PATCH") return response({ message: "Assignee is inactive." }, 400);
      return response([]);
    });

    renderPage();
    fireEvent.click((await screen.findByText("INC-2026-0001")).closest("tr")!);
    fireEvent.change(screen.getByLabelText("Assignment group"), { target: { value: "Network" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));

    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: "Assignment failed",
      description: expect.stringContaining("Assignee is inactive"),
      variant: "destructive",
    })));
    expect((screen.getByLabelText("Assignment group") as HTMLSelectElement).value).toBe("Network");
  });

  it("makes workflow controls available to a system administrator without an explicit ticket_manage grant", async () => {
    authState.permissions = ["system_admin"];
    renderPage();
    fireEvent.click((await screen.findByText("INC-2026-0001")).closest("tr")!);
    expect(screen.getByRole("button", { name: "Save assignment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save triage & workflow details" })).toBeTruthy();
  });
});
