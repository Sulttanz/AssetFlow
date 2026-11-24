export type CookieSecureMode = boolean | "auto";

export function cookieSecureMode(value = process.env.COOKIE_SECURE): CookieSecureMode {
  const configured = value?.trim().toLowerCase() || "auto";
  if (configured === "auto") return "auto";
  if (configured === "true") return true;
  if (configured === "false") return false;
  throw new Error("COOKIE_SECURE must be true, false, or auto.");
}

export function trustProxySetting(value = process.env.TRUST_PROXY): boolean | number | string[] {
  const configured = value?.trim() || "1";
  if (configured.toLowerCase() === "false") return false;
  if (configured.toLowerCase() === "true") return true;
  if (/^\d+$/.test(configured)) {
    const hops = Number(configured);
    if (Number.isSafeInteger(hops) && hops <= 32) return hops;
    throw new Error("TRUST_PROXY hop count must be between 0 and 32.");
  }
  // Express validates address/CIDR entries when app.set compiles this list.
  return configured.split(",").map(entry => entry.trim());
}
