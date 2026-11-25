import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncidentCatalogManager } from "./incident-catalog-manager";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "/api/incidents/options"
    ? { data: { projects: [], managedAssignmentGroups: [] }, isLoading: false, isError: false }
    : {
        data: [{
          id: "incident-template-1",
          name: "Email issue",
          description: "Email is unavailable",
          category: "Email",
          icon: null,
          projectId: null,
          projectName: null,
          defaultImpact: "medium",
          defaultUrgency: "medium",
          defaultPriority: "P3",
          defaultAssignmentGroup: null,
          isActive: true,
          scope: "Global",
        }],
        isLoading: false,
        isError: false,
      },
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { roles: [{ name: "it_manager" }], permissions: ["incident_catalog_manage"] } }),
}));

const originalInnerWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
});

describe("incident catalog add form", () => {
  it("renders incident templates as compact list rows", () => {
    render(<IncidentCatalogManager />);
    expect(screen.getByTestId("incident-catalog-list")).toBeTruthy();
    expect(screen.getByTestId("incident-catalog-row-incident-template-1").textContent).toContain("Email issue");
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it.each([
    ["desktop", 1280],
    ["mobile", 390],
  ])("keeps name input focused while typing at %s viewport width", async (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const user = userEvent.setup();
    const view = render(<IncidentCatalogManager />);

    await user.click(screen.getByRole("button", { name: "New incident template" }));
    const dialog = await screen.findByRole("dialog", { name: "New incident template" });
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    await user.click(name);
    await user.type(name, "Email issue");
    view.rerender(<IncidentCatalogManager />);

    expect(document.activeElement).toBe(name);
    expect(name.value).toBe("Email issue");
  });
});
