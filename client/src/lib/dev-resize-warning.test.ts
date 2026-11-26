// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { installDevResizeWarningHandler } from "./dev-resize-warning";

describe("development ResizeObserver diagnostic", () => {
  it("keeps only the browser delivery warning out of the blocking overlay", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const remove = installDevResizeWarningHandler(window);
    const overlay = vi.fn();
    window.addEventListener("error", overlay);
    try {
      window.dispatchEvent(new ErrorEvent("error", {
        message: "ResizeObserver loop completed with undelivered notifications.",
      }));
      window.dispatchEvent(new ErrorEvent("error", {
        message: "ResizeObserver loop limit exceeded",
      }));
      expect(warn).toHaveBeenCalledTimes(2);
      expect(overlay).not.toHaveBeenCalled();

      const genuine = new ErrorEvent("error", {
        cancelable: true,
        message: "ResizeObserver loop limit exceeded",
        error: new Error("Genuine application error"),
      });
      genuine.preventDefault();
      window.dispatchEvent(genuine);
      const unknown = new ErrorEvent("error", { cancelable: true, message: "Another error without an Error object" });
      unknown.preventDefault();
      window.dispatchEvent(unknown);
      expect(overlay).toHaveBeenCalledTimes(2);

      remove();
      window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop limit exceeded" }));
      expect(overlay).toHaveBeenCalledTimes(3);
    } finally {
      remove();
      window.removeEventListener("error", overlay);
      warn.mockRestore();
    }
  });
});
