import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewIncidentPage from "./new-incident";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "external-user", employeeId: null, username: "external", roles: [{ name: "end_user" }], permissions: [] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderIntake(projects: { id: string; name: string }[], linkedEmployee = false) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    projects, selectedProjectId: projects.length === 1 ? projects[0].id : null,
    catalog: [{ id: "global", name: "VPN connection", description: "Report a VPN issue", category: "Network", projectId: null }],
    assignedAssets: [], linkedEmployee,
  }), { status: 200, headers: { "content-type": "application/json" } })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><NewIncidentPage /></QueryClientProvider>);
}

describe("simplified project incident intake", () => {
  it("locks the only assigned project and hides technical and employee-only controls", async () => {
    renderIntake([{ id: "project-1", name: "Customer Portal" }]);
    await screen.findByText("Customer Portal");
    await waitFor(() => {
      expect(screen.queryByLabelText(/^Project/)).toBeNull();
      expect(screen.getByText(/automatically selected/)).toBeTruthy();
    });
    expect(screen.getByLabelText("Subject")).toBeTruthy();
    expect(screen.getByLabelText(/Incident type/)).toBeTruthy();
    for (const field of ["Priority", "Urgency", "Impact", "Assignment group (optional)", "Assigned engineer (optional)", "SLA policy (optional)", "Affected device (optional)"]) {
      expect(screen.queryByLabelText(field)).toBeNull();
    }
    expect(screen.getByLabelText(/Attachments/).getAttribute("multiple")).not.toBeNull();
  });

  it("allows an internal employee without projects and hides the project picker", async () => {
    renderIntake([], true);
    expect(await screen.findByText(/Internal company incident/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Project/)).toBeNull();
    expect((screen.getByRole("button", { name: /Submit incident/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a project picker only when multiple projects are assigned", async () => {
    renderIntake([{ id: "one", name: "First" }, { id: "two", name: "Second" }]);
    const picker = await screen.findByLabelText("Project") as HTMLSelectElement;
    expect(Array.from(picker.options).map(option => option.value)).toEqual(["", "one", "two"]);
  });

  it("explains why a user with no project cannot submit", async () => {
    renderIntake([]);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("No projects are assigned"));
    const submit = screen.getByRole("button", { name: /Submit incident/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
