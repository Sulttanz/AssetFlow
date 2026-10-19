// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getModuleSetting = vi.hoisted(() => vi.fn());
vi.mock("./storage", () => ({
  storage: { getModuleSetting },
}));

import { checkModuleEnabled, moduleForApiPath } from "./routes";

describe("module API guard", () => {
  it("returns the specified forbidden response for a disabled module", async () => {
    getModuleSetting.mockResolvedValue({ moduleKey: "risk_management", enabled: false });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    await checkModuleEnabled("risk_management")(
      {} as any,
      { status } as any,
      next,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: "Module risk_management is currently disabled.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the registry default when no database setting exists", async () => {
    getModuleSetting.mockResolvedValue(undefined);
    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn();

    await checkModuleEnabled("project_management")(
      {} as any,
      { status: vi.fn(() => ({ json })) } as any,
      next,
    );

    expect(json).toHaveBeenCalledWith({
      error: "Module project_management is currently disabled.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("maps module API namespaces including older endpoint families", () => {
    expect(moduleForApiPath("/assets/asset-1/relationships")).toBe("asset_management");
    expect(moduleForApiPath("/maintenance-schedules")).toBe("asset_management");
    expect(moduleForApiPath("/reports/changes")).toBe("itsm");
    expect(moduleForApiPath("/risks")).toBe("risk_management");
    expect(moduleForApiPath("/module-status")).toBeUndefined();
  });
});
