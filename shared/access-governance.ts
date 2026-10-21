export const ACCESS_TYPES = [
  "application",
  "network_vpn",
  "server_remote_access",
  "cloud_tenant",
] as const;

export type AccessType = typeof ACCESS_TYPES[number];

export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  application: "Application",
  network_vpn: "Network / VPN",
  server_remote_access: "Server / Remote Access",
  cloud_tenant: "Cloud Tenant",
};

export const ACCESS_DROPDOWN_CATEGORIES: Record<string, AccessType> = {
  access_application: "application",
  access_network_vpn: "network_vpn",
  access_server_remote_access: "server_remote_access",
  access_cloud_tenant: "cloud_tenant",
};

export function classifyAccessAsset(type?: string | null, category?: string | null): AccessType | null {
  const description = `${type ?? ""} ${category ?? ""}`
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ");

  if (/\b(cloud|tenant|saas)\b/.test(description)) return "cloud_tenant";
  if (/\b(vpn)\b/.test(description)) return "network_vpn";
  if (/\b(servers?|remote access)\b/.test(description)) return "server_remote_access";
  if (/\b(software|application|applications|app)\b/.test(description)) return "application";
  return null;
}
