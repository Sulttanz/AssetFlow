import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SlaPolicies from "./sla-policies";

const requests: { url: string; method: string; body: Record<string, unknown> | undefined }[] = [];

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

beforeEach(() => {
  requests.length = 0;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    if (url === "/api/sla-policies") {
      return method === "POST" ? response(body, 201) : response([]);
    }
    if (url === "/api/sla-policies/options") {
      return response({
        assignmentGroups: [{ id: 1, name: "Network" }],
        staff: [{ id: "agent-1", name: "Grace Hopper" }],
      });
    }
    return response({ message: `Unexpected request: ${method} ${url}` }, 404);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SLA policy escalation configuration", () => {
  it("saves different response and resolution breach recipients", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          queryFn: async ({ queryKey }) => {
            const result = await fetch(queryKey.join("/") as string);
            return result.json();
          },
        },
        mutations: { retry: false },
      },
    });
    render(<QueryClientProvider client={client}><SlaPolicies /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "Add Policy" }));
    fireEvent.change(screen.getByLabelText("Policy Name"), { target: { value: "Critical network SLA" } });
    await user.click(screen.getByRole("combobox", { name: "Response escalation group" }));
    await user.click(await screen.findByRole("option", { name: "Network" }));
    expect(screen.getByRole("combobox", { name: "Response escalation group" }).textContent).toContain("Network");
    await user.click(screen.getByRole("combobox", { name: "Response escalation staff member" }));
    await user.click(await screen.findByRole("option", { name: "Grace Hopper" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Response escalation staff member" }).textContent).toContain("Grace Hopper"));
    fireEvent.click(screen.getByRole("button", { name: "Create Policy" }));

    await waitFor(() => expect(requests.some(({ url, method }) => url === "/api/sla-policies" && method === "POST")).toBe(true));
    const saved = requests.find(({ url, method }) => url === "/api/sla-policies" && method === "POST")?.body;
    expect(saved).toMatchObject({
      name: "Critical network SLA",
      responseEscalationGroup: "Network",
      responseEscalationUserId: "agent-1",
      resolutionEscalationGroup: null,
      resolutionEscalationUserId: null,
    });
  });
});
