import { describe, expect, it } from "vitest";
import { ACCESS_DROPDOWN_CATEGORIES, classifyAccessAsset } from "@shared/access-governance";

describe("access governance catalog classification", () => {
  it.each([
    ["software", null, "application"],
    ["server", "Infrastructure", "server_remote_access"],
    ["hardware", "Servers", "server_remote_access"],
    ["cloud_service", null, "cloud_tenant"],
    ["network_vpn", null, "network_vpn"],
  ] as const)("classifies type %s and category %s as %s", (type, category, expected) => {
    expect(classifyAccessAsset(type, category)).toBe(expected);
  });

  it("maps curated dropdown categories to access types", () => {
    expect(ACCESS_DROPDOWN_CATEGORIES.access_network_vpn).toBe("network_vpn");
    expect(ACCESS_DROPDOWN_CATEGORIES.access_server_remote_access).toBe("server_remote_access");
  });

  it("does not include unrelated physical assets in the access catalog", () => {
    expect(classifyAccessAsset("laptop", "Hardware")).toBeNull();
  });
});
