import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./users";

const state = vi.hoisted(() => ({
  users: [] as unknown[],
  roles: [] as unknown[],
  employees: [] as unknown[],
}));

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "/api/users" ? state.users
      : queryKey[0] === "/api/roles" ? state.roles
        : state.employees,
    isLoading: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/layout/header", () => ({ default: () => <div /> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const originalInnerWidth = window.innerWidth;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
});

describe("Add New User input interaction", () => {
  it.each([
    ["desktop", 1280],
    ["mobile", 390],
  ])("allows first-try focus and typing at %s viewport width", async (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByTestId("button-addUser"));
    const dialog = await screen.findByRole("dialog", { name: "Add New User" });
    const firstName = within(dialog).getByTestId("input-firstName") as HTMLInputElement;
    await user.click(firstName);
    expect(document.activeElement).toBe(firstName);
    await user.type(firstName, "Amina");
    expect(firstName.value).toBe("Amina");
  });

  it("releases page input interaction and discards the unsubmitted draft after close", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await user.click(screen.getByTestId("button-addUser"));
    const firstDialog = await screen.findByRole("dialog", { name: "Add New User" });
    const firstName = within(firstDialog).getByTestId("input-firstName") as HTMLInputElement;
    await user.type(firstName, "Draft");

    await user.click(within(firstDialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));

    const search = screen.getByTestId("input-search") as HTMLInputElement;
    await user.click(search);
    expect(document.activeElement).toBe(search);
    await user.type(search, "query");
    expect(search.value).toBe("query");

    await user.click(screen.getByTestId("button-addUser"));
    const nextDialog = await screen.findByRole("dialog", { name: "Add New User" });
    expect((within(nextDialog).getByTestId("input-firstName") as HTMLInputElement).value).toBe("");
  });
});
