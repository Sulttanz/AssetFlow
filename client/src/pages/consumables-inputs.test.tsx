import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConsumablesPage from "./consumables";

const location = {
  id: "wh-1", name: "Main Store", code: "MAIN", site: null, storageRoom: null,
  description: null, isActive: true,
};
const item = {
  id: "cons-1", name: "Patch cable", category: "Cables", modelPartNumber: "CAT6-1M",
  quantityInStock: 40, minReorderLevel: 5, warehouseLocationId: location.id, storageRoom: null,
  unitCost: "4.25", vendorId: null, createdAt: "2026-01-01T00:00:00.000Z",
  warehouseName: location.name, warehouseCode: location.code, warehouseIsActive: true, vendorName: null,
};

function jsonResponse(value: unknown) {
  return { ok: true, status: 200, json: async () => value, text: async () => JSON.stringify(value) } as Response;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ConsumablesPage /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("consumables quantity editing", () => {
  it("keeps issue and adjustment quantities string-backed while clearing and typing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/consumables/options")) return jsonResponse({ locations: [location], vendors: [], users: [{ id: "u-1", name: "A User", email: "a@example.com" }] });
      if (path.includes("/api/warehouse-locations")) return jsonResponse([location]);
      if (path.includes("/api/dropdowns/options/consumable_category")) return jsonResponse([{ id: "cat-1", value: "Cables", label: "Cables", isActive: true, displayOrder: 1 }]);
      if (path.includes("/api/finance/document-sequences")) return jsonResponse([]);
      return jsonResponse([item]);
    }));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /issue \/ transfer/i }));
    const issueQuantity = await screen.findByRole("textbox", { name: /^Quantity/ });
    await user.clear(issueQuantity);
    expect((issueQuantity as HTMLInputElement).value).toBe("");
    await user.type(issueQuantity, "12");
    expect((issueQuantity as HTMLInputElement).value).toBe("12");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: /adjust stock/i }));
    const adjustmentQuantity = await screen.findByRole("textbox", { name: /^Quantity to add \/ remove/ });
    await user.clear(adjustmentQuantity);
    await user.type(adjustmentQuantity, "25");
    expect((adjustmentQuantity as HTMLInputElement).value).toBe("25");
    expect((screen.getByRole("button", { name: /save adjustment/i }) as HTMLButtonElement).disabled).toBe(false);

    await user.clear(adjustmentQuantity);
    await user.type(adjustmentQuantity, "0.5");
    expect((adjustmentQuantity as HTMLInputElement).value).toBe("0.5");
    expect((screen.getByRole("button", { name: /save adjustment/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
