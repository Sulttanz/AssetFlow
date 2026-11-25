/**
 * Reset viewport and application-owned scroll regions after route navigation.
 * Browsers may keep scroll on the inner workspace instead of window, so reset both.
 */
export function resetRouteScroll(root: ParentNode = document) {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  if (typeof document !== "undefined") {
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }

  root.querySelectorAll<HTMLElement>("main, .app-content, [data-scroll-container]").forEach((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
}
