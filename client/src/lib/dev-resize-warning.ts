/** Browser delivery warnings are not thrown application errors. */
export function isResizeDeliveryWarning(event: ErrorEvent): boolean {
  return event.error == null && (
    event.message === "ResizeObserver loop completed with undelivered notifications." ||
    event.message === "ResizeObserver loop limit exceeded"
  );
}

export function installDevResizeWarningHandler(target: Window): () => void {
  const handle = (event: ErrorEvent) => {
    if (!isResizeDeliveryWarning(event)) return;
    // The development overlay discards event.message when error is null and
    // displays a blocking "(unknown runtime error)" instead. Keep the actual
    // diagnostic, without obscuring the application with that misleading modal.
    console.warn(event.message);
    event.stopImmediatePropagation();
  };
  target.addEventListener("error", handle, true);
  return () => target.removeEventListener("error", handle, true);
}
