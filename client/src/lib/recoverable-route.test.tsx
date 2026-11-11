import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecoverableRoute, loadRouteModule } from "./recoverable-route";
import { isHandledPurchaseOrderLoadError } from "@shared/route-load-errors";

// React's development build also dispatches caught errors to window in jsdom.
// Silence only the two deliberately injected failures, not unexpected errors.
const expectedError = (event: ErrorEvent) => {
  if (["Page initialization failed", "Bad purchase order data"].includes(event.error?.message)) event.preventDefault();
};
beforeEach(() => window.addEventListener("error", expectedError));
afterEach(() => {
  cleanup();
  window.removeEventListener("error", expectedError);
});

describe("recoverable workspace loading", () => {
  it("keeps the development overlay for real application errors and other routes", () => {
    expect(isHandledPurchaseOrderLoadError(new TypeError("Failed to fetch dynamically imported module: https://example.test/src/pages/purchase-orders.tsx"))).toBe(true);
    expect(isHandledPurchaseOrderLoadError(new TypeError("Failed to fetch dynamically imported module: https://example.test/src/pages/assets.tsx"))).toBe(false);
    expect(isHandledPurchaseOrderLoadError(new Error("Cannot render /src/pages/purchase-orders.tsx"))).toBe(false);
    expect(isHandledPurchaseOrderLoadError(new Error("Unknown runtime error"))).toBe(false);
  });
  it("retries transient module failures and returns the loaded page", async () => {
    const page = { default: () => <div>Purchase order register</div> };
    const loader = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
      .mockResolvedValue(page);
    expect(await loadRouteModule(loader, [0])).toBe(page);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("bounds retries instead of looping during an outage", async () => {
    const error = new TypeError("Failed to fetch dynamically imported module");
    const loader = vi.fn().mockRejectedValue(error);
    await expect(loadRouteModule(loader, [0, 0])).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("does not retry application errors", async () => {
    const error = new SyntaxError("Invalid module");
    const loader = vi.fn().mockRejectedValue(error);
    await expect(loadRouteModule(loader, [0, 0])).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("contains a failed import and creates a fresh lazy loader on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("Page initialization failed"))
      .mockResolvedValue({ default: () => <div>Purchase order register</div> });
    const Page = createRecoverableRoute("Purchase Orders", loader);
    render(<div><nav>Workspace navigation</nav><Page /></div>);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Workspace navigation")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Purchase order register")).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("contains render failures without retrying them automatically", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loader = vi.fn().mockResolvedValue({ default: () => { throw new Error("Bad purchase order data"); } });
    const Page = createRecoverableRoute("Purchase Orders", loader);
    render(<Page />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
