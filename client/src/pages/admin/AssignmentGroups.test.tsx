import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "manager-1", roles: [{ name: "it_manager" }], permissions: ["ticket_manage"] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));

import AssignmentGroupsPage from "./AssignmentGroups";

const groupMembers: { id: string; username: string; firstName: string; lastName: string; email: string; isActive: boolean }[] = [];
const requests: { url: string; method: string; body: unknown }[] = [];

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => status === 204 ? "" : JSON.stringify(data),
  } as Response;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}><AssignmentGroupsPage /></QueryClientProvider>);
}

beforeEach(() => {
  groupMembers.length = 0;
  requests.length = 0;
  toastSpy.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    if (url === "/api/assignment-groups?includeInactive=true" && method === "GET") {
      return response([{
        id: 12, name: "Network Operations", description: "Connectivity and network support.",
        active: true, members: [...groupMembers],
      }]);
    }
    if (url === "/api/assignment-groups/eligible-users" && method === "GET") {
      return response([{ id: "engineer-1", name: "Grace Hopper", email: "grace@example.test" }]);
    }
    if (url === "/api/assignment-groups/12/members" && method === "POST") {
      groupMembers.push({ id: body.userId, username: "grace", firstName: "Grace", lastName: "Hopper", email: "grace@example.test", isActive: true });
      return response({ id: 1 });
    }
    if (url === "/api/assignment-groups/12/members/engineer-1" && method === "DELETE") {
      groupMembers.splice(0, groupMembers.length);
      return response(null, 204);
    }
    if (url === "/api/assignment-groups" && method === "POST") return response({ id: 13, ...body, members: [] }, 201);
    return response({ message: `Unexpected ${method} ${url}` }, 404);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("assignment groups management", () => {
  it("creates a group and manages member additions and removals", async () => {
    renderPage();
    expect(await screen.findByText("Network Operations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage members" }));
    expect(await screen.findByText("Grace Hopper")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(requests.some(request =>
      request.url === "/api/assignment-groups/12/members" &&
      request.method === "POST" &&
      JSON.stringify(request.body) === JSON.stringify({ userId: "engineer-1" }),
    )).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(requests.some(request =>
      request.url === "/api/assignment-groups/12/members/engineer-1" && request.method === "DELETE",
    )).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Engineer removed from group" }));
  });

  it("creates a new active group through the dialog", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "New Assignment Group" }));
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Cybersecurity" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Security incident response." } });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    await waitFor(() => expect(requests.some(request =>
      request.url === "/api/assignment-groups" && request.method === "POST" &&
      JSON.stringify(request.body) === JSON.stringify({ name: "Cybersecurity", description: "Security incident response.", active: true }),
    )).toBe(true));
  });
});
