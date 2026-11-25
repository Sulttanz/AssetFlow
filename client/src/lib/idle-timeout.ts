const USER_ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function installIdleLogout(
  onIdle: () => void,
  timeoutMs = 10 * 60_000,
  onActivity?: () => void,
  activityStorageKey?: string,
) {
  let timer: ReturnType<typeof setTimeout>;
  let expired = false;
  let lastActivityAt = Date.now();
  let lastBroadcastAt = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(check, Math.max(0, timeoutMs - (Date.now() - lastActivityAt)));
  };
  function check() {
    if (activityStorageKey) {
      try {
        const sharedActivity = Number(localStorage.getItem(activityStorageKey));
        if (sharedActivity > lastActivityAt && sharedActivity <= Date.now()) lastActivityAt = sharedActivity;
      } catch {
        // Keep the local timer functional when browser storage is unavailable.
      }
    }
    if (Date.now() - lastActivityAt < timeoutMs) {
      schedule();
      return;
    }
    expired = true;
    onIdle();
  }
  const reset = () => {
    if (expired) return;
    lastActivityAt = Date.now();
    if (activityStorageKey && lastActivityAt - lastBroadcastAt >= 1000) {
      try {
        localStorage.setItem(activityStorageKey, String(lastActivityAt));
        lastBroadcastAt = lastActivityAt;
      } catch {
        // Activity in this tab still resets the timeout.
      }
    }
    schedule();
  };
  const activity = () => {
    if (expired) return;
    reset();
    onActivity?.();
  };
  USER_ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, activity, { passive: true, capture: true }));
  window.addEventListener("assetflow:api-activity", reset);
  const syncOtherTab = (event: StorageEvent) => {
    if (event.key !== activityStorageKey || !event.newValue || expired) return;
    const timestamp = Number(event.newValue);
    if (timestamp > lastActivityAt && timestamp <= Date.now()) {
      lastActivityAt = timestamp;
      schedule();
    }
  };
  window.addEventListener("storage", syncOtherTab);
  reset();
  return () => {
    clearTimeout(timer);
    USER_ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, activity, true));
    window.removeEventListener("assetflow:api-activity", reset);
    window.removeEventListener("storage", syncOtherTab);
  };
}
