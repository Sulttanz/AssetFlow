import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY, getModuleDefinition, isValidModuleKey } from "./modules";

describe("module registry", () => {
  it("defines the core, independently toggleable, and upcoming modules", () => {
    expect(MODULE_REGISTRY.map(({ key }) => key)).toEqual([
      "asset_management",
      "itsm",
      "risk_management",
      "project_management",
    ]);
    expect(getModuleDefinition("asset_management")).toMatchObject({
      core: true,
      defaultEnabled: true,
    });
    expect(getModuleDefinition("itsm")).toMatchObject({
      core: false,
      defaultEnabled: true,
    });
    expect(getModuleDefinition("risk_management")).toMatchObject({
      core: false,
      defaultEnabled: true,
    });
    expect(getModuleDefinition("project_management")).toMatchObject({
      core: false,
      defaultEnabled: false,
    });
  });

  it("recognizes only registered module keys", () => {
    expect(isValidModuleKey("project_management")).toBe(true);
    expect(isValidModuleKey("unknown_module")).toBe(false);
  });
});
