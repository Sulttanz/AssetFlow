// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getModuleSetting = vi.hoisted(() => vi.fn());
vi.mock("./storage", () => ({
  storage: { getModuleSetting },
}));

import { checkModuleEnabled, getServiceContractStatus, isServiceContractApiRequest, moduleForApiPath, moduleForApiRequest } from "./routes";
import { insertServiceContractSchema, updateServiceContractSchema } from "@shared/schema";

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
    expect(moduleForApiPath("/reports/personnel")).toBeUndefined();
    expect(moduleForApiPath("/module-status")).toBeUndefined();
  });

  it("gates service-contract requests through Asset Management while preserving financial contracts", () => {
    expect(isServiceContractApiRequest("GET", "/contracts")).toBe(false);
    expect(isServiceContractApiRequest("GET", "/contracts", { kind: "service" })).toBe(true);
    expect(isServiceContractApiRequest("GET", "/contracts", { projectId: "project-uuid" })).toBe(true);
    expect(isServiceContractApiRequest("GET", "/contracts", { status: "active" })).toBe(true);
    expect(isServiceContractApiRequest("POST", "/contracts", {}, { contractName: "Support SLA" })).toBe(true);
    expect(isServiceContractApiRequest("POST", "/contracts", {}, { name: "Financial contract" })).toBe(false);
    expect(isServiceContractApiRequest("GET", "/contracts/42")).toBe(true);
    expect(isServiceContractApiRequest("GET", "/contracts/financial-uuid")).toBe(false);
    expect(moduleForApiRequest("GET", "/contracts", { kind: "service" })).toBe("asset_management");
    expect(moduleForApiRequest("POST", "/contracts", {}, { contractName: "Support SLA" })).toBe("asset_management");
    expect(moduleForApiRequest("GET", "/contracts")).toBe("asset_management");
  });

  it("validates service contract inputs and derives date-based lifecycle status", () => {
    const parsed = insertServiceContractSchema.safeParse({
      contractNumber: " CNT-2026-001 ",
      contractName: "Support Agreement",
      projectId: "project-uuid",
      clientId: "customer-42",
      slaPolicyId: "sla-uuid",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contractNumber).toBe("CNT-2026-001");
      expect(parsed.data.renewalNoticeDays).toBe(60);
      expect(parsed.data.status).toBe("active");
    }
    expect(updateServiceContractSchema.parse({ notes: "Reviewed" })).toEqual({ notes: "Reviewed" });
    expect(insertServiceContractSchema.safeParse({
      contractNumber: "CNT-INVALID",
      contractName: "Invalid",
      startDate: "2026-02-30",
      endDate: "2026-01-01",
    }).success).toBe(false);
    expect(getServiceContractStatus({
      status: "active", startDate: "2026-01-01", endDate: "2026-01-30", renewalNoticeDays: 30,
    }, new Date("2026-01-01T12:00:00.000Z"))).toBe("near_expiration");
    expect(getServiceContractStatus({
      status: "active", startDate: "2025-01-01", endDate: "2025-12-31", renewalNoticeDays: 60,
    }, new Date("2026-01-01T12:00:00.000Z"))).toBe("expired");
    expect(getServiceContractStatus({
      status: "active", startDate: "2026-01-01", endDate: "2026-01-01", renewalNoticeDays: 60,
    }, new Date("2026-01-01T12:00:00.000Z"))).toBe("expired");
    expect(getServiceContractStatus({
      status: "renewed", startDate: "2025-01-01", endDate: "2025-12-31", renewalNoticeDays: 60,
    }, new Date("2026-01-01T12:00:00.000Z"))).toBe("renewed");
  });
});
