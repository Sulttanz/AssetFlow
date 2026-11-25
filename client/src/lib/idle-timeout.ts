const USER_ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function installIdleLogout(onIdle: () => void, timeoutMs = 10 * 60_000) {
  let timer: ReturnType<typeof setTimeout>;
  let expired = false;
  const reset = () => {
    if (expired) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      expired = true;
      onIdle();
    }, timeoutMs);
  };
  USER_ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, reset, { passive: true }));
  window.addEventListener("assetflow:api-activity", reset);
  reset();
  return () => {
    clearTimeout(timer);
    USER_ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, reset));
    window.removeEventListener("assetflow:api-activity", reset);
  };
}
