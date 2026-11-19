const OPEN_MODAL_SELECTOR = [
  '[data-state="open"][aria-modal="true"]',
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][data-vaul-drawer]',
].join(",");

/**
 * Radix and Vaul manage body pointer-events while modal layers are open. If a
 * route change or interrupted unmount skips their normal cleanup, the stale
 * body lock makes every page appear unresponsive. Only recover when no modal
 * layer is still open; active dialogs keep their normal outside-click lock.
 */
export function installOverlayInteractionRecovery(body: HTMLElement = document.body): () => void {
  let recoveryTimer: number | undefined;

  const recoverIfUnlocked = () => {
    if (body.style.pointerEvents !== "none" || document.querySelector(OPEN_MODAL_SELECTOR)) return;
    if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);

    // Let overlay libraries finish their close/unmount cleanup first, then
    // re-check so a newly opened dialog is never unlocked.
    recoveryTimer = window.setTimeout(() => {
      recoveryTimer = undefined;
      if (body.style.pointerEvents === "none" && !document.querySelector(OPEN_MODAL_SELECTOR)) {
        body.style.removeProperty("pointer-events");
      }
    }, 0);
  };

  const observer = new MutationObserver(recoverIfUnlocked);
  observer.observe(body, {
    attributes: true,
    attributeFilter: ["style", "data-state", "aria-modal", "role"],
    childList: true,
    subtree: true,
  });

  // Also repair a lock that was already left behind before this observer ran.
  recoverIfUnlocked();

  return () => {
    observer.disconnect();
    if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
  };
}
