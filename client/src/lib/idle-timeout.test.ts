import { afterEach, describe, expect, it, vi } from "vitest";
import { installIdleLogout } from "./idle-timeout";

describe("10-minute idle logout", () => {
  afterEach(() => {
    vi.useRealTimers();
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
