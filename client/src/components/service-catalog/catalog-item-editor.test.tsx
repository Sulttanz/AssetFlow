import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogItemEditor } from "./catalog-item-editor";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "admin" } }) }));

const originalInnerWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
});

describe("service catalog dynamic field inputs", () => {
  it.each([
    ["desktop", 1280],
    ["mobile", 390],
  ])("keeps focus while typing a field key at %s viewport width", async (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const user = userEvent.setup();
    render(
      <CatalogItemEditor
        open
        item={null}
        options={{ canManage: true, canApprove: true, categories: [{ value: "software", label: "Software" }] }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add field" }));
    const fieldKey = screen.getByPlaceholderText("device_model") as HTMLInputElement;
    await user.click(fieldKey);
    await user.type(fieldKey, "device_model");

    expect(document.activeElement).toBe(fieldKey);
    expect(fieldKey.value).toBe("device_model");
  });
});
