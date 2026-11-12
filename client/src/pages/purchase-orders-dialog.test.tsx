import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PurchaseOrders from "./purchase-orders";

const state = vi.hoisted(() => ({
  sequenceError: false,
  mutate: vi.fn(),
  empty: [],
  taxSettings: { currencyCode: "SAR", defaultTaxRate: "15", defaultTaxMode: "exclusive" },
  sequences: [{
    id: "po-sequence", documentType: "purchase_order", numberingMode: "automatic",
    prefix: "PO-", nextNumber: 1, padding: 4, resetYearly: false, sequenceYear: 2026,
  }],
}));

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "/api/finance/document-sequences" ? state.sequences
      : queryKey[0] === "/api/finance/tax-settings"
        ? state.taxSettings : state.empty,
    isLoading: false,
    isError: queryKey[0] === "/api/finance/document-sequences" && state.sequenceError,
  }),
  useMutation: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("@/hooks/use-auth", () => ({ useHasPermission: () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => {
  state.sequenceError = false;
  state.mutate.mockReset();
});
afterEach(cleanup);

async function openNewOrder() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("button-add-purchase-order"));
  expect(await screen.findByRole("dialog", { name: "Create Purchase Order" })).toBeTruthy();
  return user;
}

describe("New Order dismissal", () => {
  it.each(["Close", "Cancel", "Escape"])("dismisses an unsaved order using %s without submitting", async action => {
    render(<PurchaseOrders />);
    const user = await openNewOrder();
    if (action === "Escape") await user.keyboard("{Escape}");
    else {
      const button = screen.getByRole("button", { name: action });
      expect(button.getAttribute("type")).toBe("button");
      await user.click(button);
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    expect(document.activeElement).toBe(screen.getByTestId("button-add-purchase-order"));
    expect(screen.getByTestId("purchase-orders-page")).toBeTruthy();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("discards cancelled draft fields before starting the next new order", async () => {
    render(<PurchaseOrders />);
    const user = await openNewOrder();
    fireEvent.change(screen.getByTestId("input-reference"), { target: { value: "Discard this draft" } });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await openNewOrder();
    expect((screen.getByTestId("input-reference") as HTMLInputElement).value).toBe("");
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("preserves decimal typing in controlled unit-price fields", async () => {
    render(<PurchaseOrders />);
    const user = await openNewOrder();
    const price = screen.getByTestId("input-item-price-0") as HTMLInputElement;
    await user.clear(price);
    await user.type(price, "12.50");
    expect(price.value).toBe("12.50");
    await user.tab();
    expect(price.value).toBe("12.5");
  });

  it("still closes and unlocks the page if numbering settings fail while open", async () => {
    const view = render(<PurchaseOrders />);
    const user = await openNewOrder();
    state.sequenceError = true;
    view.rerender(<PurchaseOrders />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    expect(screen.getByTestId("button-add-purchase-order").hasAttribute("disabled")).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
