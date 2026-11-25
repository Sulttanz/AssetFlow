/** Only module transport failures are safe to retry automatically. */
export function isModuleTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .* failed|failed to load module script|networkerror/i.test(message);
}

/** This route has its own recovery UI; do not obscure it with a second overlay. */
export function isHandledPurchaseOrderLoadError(error: Error): boolean {
  return isModuleTransportError(error) && /\/(?:src\/pages\/purchase-orders\.tsx|assets\/purchase-orders-[^/\s]+\.js)(?:[?\s:]|$)/i.test(error.message);
}

/** All lazy pages now own recovery UI; preserve overlays for actual code errors. */
export function isHandledRouteLoadError(error: Error): boolean {
  return isModuleTransportError(error) &&
    /\/(?:src\/(?:pages|components)\/[^\s]+|assets\/[^/\s]+\.js)(?:[?\s:]|$)/i.test(error.message);
}
