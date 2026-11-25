import { afterEach, describe, expect, it, vi } from "vitest";
import { installIdleLogout } from "./idle-timeout";
import { apiRequest } from "./queryClient";

describe("10-minute idle logout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("logs out after ten minutes without activity", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const cleanup = installIdleLogout(onIdle);
    vi.advanceTimersByTime(10 * 60_000 - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("resets its timeout on interaction and API activity and fires only once", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const cleanup = installIdleLogout(onIdle);
    vi.advanceTimersByTime(9 * 60_000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(9 * 60_000);
    window.dispatchEvent(new Event("assetflow:api-activity"));
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("mousemove"));
    vi.advanceTimersByTime(10 * 60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("keeps timing out despite repeated executive dashboard GET polling", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    }));
    const onIdle = vi.fn();
    const cleanup = installIdleLogout(onIdle);
    for (let minute = 0; minute < 9; minute++) {
      vi.advanceTimersByTime(60_000);
      await apiRequest("GET", "/api/dashboard/executive?days=30");
    }
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("does not sign out an account that is active in another tab", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    const key = "assetflow_activity_test-account";
    const cleanup = installIdleLogout(onIdle, 10 * 60_000, undefined, key);
    vi.advanceTimersByTime(9 * 60_000);
    const timestamp = String(Date.now());
    localStorage.setItem(key, timestamp);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: timestamp }));
    vi.advanceTimersByTime(9 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
