/** Reserved, deny-first role: adding another role must not unlock demo writes. */
export const DEMO_VIEWER_ROLE = "Demo Viewer";

export function isDemoViewer(roleNames: readonly string[]): boolean {
  return roleNames.some(name => name.trim().toLowerCase().replace(/[\s-]+/g, "_") === "demo_viewer");
}

const restrictedPages = [
  "/users", "/roles", "/permissions", "/settings", "/system-settings",
  "/system", "/dropdowns", "/sla-policies", "/import", "/migration",
];
const restrictedApis = [
  "/users", "/roles", "/permissions", "/settings", "/system-settings",
  "/data-migrations", "/register", "/dropdowns", "/sla-policies",
];
const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const normalizePath = (path: string) => (path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/").toLowerCase();

export function isDemoPageAllowed(path: string): boolean {
  return !restrictedPages.some(prefix => matches(normalizePath(path), prefix));
}

export function isDemoApiAllowed(path: string, method: string): boolean {
  const apiPath = normalizePath(path).replace(/^\/api(?=\/|$)/, "");
  const verb = method.toUpperCase();
  // These POSTs end a session or format already-supplied report data only.
  if (verb === "POST" && ["/logout", "/report-exports/xlsx"].includes(apiPath)) return true;
  // Personal appearance does not change operational records or permissions.
  if (verb === "PATCH" && apiPath === "/profile/preferences") return true;
  if (!["GET", "HEAD", "OPTIONS"].includes(verb)) return false;
  if (matches(apiPath, "/dropdowns/options")) return true;
  if (matches(apiPath, "/system")) return ["/system/status", "/system/modules", "/system/version"].includes(apiPath);
  return !restrictedApis.some(prefix => matches(apiPath, prefix));
}
