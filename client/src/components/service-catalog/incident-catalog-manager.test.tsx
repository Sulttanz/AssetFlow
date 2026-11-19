import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncidentCatalogManager } from "./incident-catalog-manager";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "/api/incidents/options"
      ? { projects: [], managedAssignmentGroups: [] }
      : [],
    isLoading: false,
    isError: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const originalInnerWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
});

describe("incident catalog add form", () => {
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
