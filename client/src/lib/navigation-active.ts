const PATH_ALIASES: Record<string, string> = {
  "/inventory": "/consumables",
  "/dropdowns": "/system/dropdowns",
  "/service-request-tracker": "/service-requests/tracker",
};

/** Match the most specific destination, keeping tracker/intake links distinct
 * from their parent workbench and query-based queues distinct from the catalog. */
export function activeNavigationHref(pathname: string, search: string, hrefs: string[]): string | undefined {
  const path = PATH_ALIASES[pathname] ?? (pathname === "/" ? "/dashboard" : pathname);
  const query = new URLSearchParams(search);
  return hrefs.map(href => {
    const [target, targetSearch = ""] = href.split("?");
    const targetQuery = Array.from(new URLSearchParams(targetSearch).entries());
    const matches = (path === target || path.startsWith(`${target}/`)) &&
      targetQuery.every(([key, value]) => query.get(key) === value);
    return { href, matches, specificity: target.length * 100 + targetQuery.length };
  }).filter(item => item.matches).sort((a, b) => b.specificity - a.specificity)[0]?.href;
}
