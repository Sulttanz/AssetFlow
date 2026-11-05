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
      error: "Feature Not Enabled",
      code: "FEATURE_NOT_ENABLED",
      moduleKey: "risk_management",
      message: "The risk_management feature is not enabled for this customer.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("enables project management by default when no database setting exists", async () => {
    getModuleSetting.mockResolvedValue(undefined);
    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn();

    await checkModuleEnabled("project_management")(
      {} as any,
      { status: vi.fn(() => ({ json })) } as any,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(json).not.toHaveBeenCalled();
  });

  it("maps module API namespaces including older endpoint families", () => {
    expect(moduleForApiPath("/assets/asset-1/relationships")).toBe("asset_management");
    expect(moduleForApiPath("/maintenance-schedules")).toBe("asset_management");
    expect(moduleForApiPath("/reports/changes")).toBe("itsm");
    expect(moduleForApiPath("/risks")).toBe("risk_management");
    expect(moduleForApiPath("/projects/project-1/tasks")).toBe("project_management");
    expect(moduleForApiPath("/applications/app-1")).toBe("cmdb");
    expect(moduleForApiPath("/servers/server-1/documents")).toBe("cmdb");
    expect(moduleForApiPath("/cmdb/change-options")).toBe("cmdb");
    expect(moduleForApiPath("/network-topology/zones")).toBe("cmdb");
    expect(moduleForApiPath("/backup-schedules")).toBe("cmdb");
    expect(moduleForApiPath("/kb/articles")).toBeUndefined();
    expect(moduleForApiPath("/kb/search")).toBeUndefined();
    expect(moduleForApiPath("/reports/kb-articles")).toBeUndefined();
    expect(moduleForApiPath("/module-status")).toBeUndefined();
  });
});
