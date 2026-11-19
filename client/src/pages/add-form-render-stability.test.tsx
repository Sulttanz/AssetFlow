import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Departments from "./departments";
import Locations from "./locations";
import ContractsPage from "./contracts";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: [], isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const originalInnerWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
});

const pages = [
  {
    name: "department",
    Component: Departments,
    openButton: "button-add-department",
    dialogName: "Create New Department",
    inputTestId: "input-department-name",
  },
  {
    name: "location",
    Component: Locations,
    openButton: "button-add-location",
    dialogName: "Create New Location",
    inputTestId: "input-location-name",
  },
  {
    name: "contract",
    Component: ContractsPage,
    openButton: null,
    dialogName: "Create New Contract",
    inputTestId: null,
  },
];

describe("Add form stability during parent renders", () => {
  for (const page of pages) {
    it.each([["desktop", 1280], ["mobile", 390]])(
      `preserves the active ${page.name} field after a parent render at %s width`,
      async (_viewport, width) => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
        const user = userEvent.setup();
        const view = render(<page.Component />);

        if (page.openButton) await user.click(screen.getByTestId(page.openButton));
        else await user.click(screen.getByRole("button", { name: "New Contract" }));

        const dialog = await screen.findByRole("dialog", { name: page.dialogName });
        const input = (page.inputTestId
          ? within(dialog).getByTestId(page.inputTestId)
          : within(dialog).getByLabelText("Contract Name")) as HTMLInputElement;
        await user.click(input);
        await user.type(input, "A");
        view.rerender(<page.Component />);
        expect(document.activeElement).toBe(input);
        await user.type(input, "bc");
        expect(input.value).toBe("Abc");
      },
    );
  }
});
