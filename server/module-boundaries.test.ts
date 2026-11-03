// @vitest-environment node
import { describe, expect, it } from "vitest";
import { changeCiLinks, changes, incidents, projects, serviceRequests, tickets } from "@shared/schema";
import { MODULE_REGISTRY } from "@shared/modules";

describe("Optional commercial module boundaries", () => {
  it("keeps optional ITSM project and asset references nullable", () => {
    for (const column of [incidents.projectId, serviceRequests.projectId, serviceRequests.fulfilledAssetId,
      changes.projectId, changeCiLinks.applicationId, changeCiLinks.serverId, tickets.assetId]) {
      expect(column.notNull, column.name).toBe(false);
    }
    expect("assetId" in projects).toBe(false);
  });

  it("allows business modules to be disabled independently of core identity and settings", () => {
    for (const key of ["asset_management", "cmdb", "itsm", "risk_management", "project_management"]) {
      expect(MODULE_REGISTRY.find(module => module.key === key)?.core, key).toBe(false);
    }
  });
});
