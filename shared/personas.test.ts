import { describe, expect, it } from "vitest";
import { getPersonaRoleKeys, isPersonaApiAllowed, isPersonaPageAllowed } from "./personas";
import { canAuditPublishedPolicies, canReadKnowledge } from "./kb-governance";

describe("persona access policy", () => {
  it("recognizes the supported persona role names and legacy IT staff aliases", () => {
    expect(getPersonaRoleKeys(["end_user", "IT Staff", "CAB Member", "IT Manager", "auditor"])).toEqual([
      "end_user", "it_agent", "cab_member", "it_manager", "auditor",
    ]);
  });

  it("limits the end-user workspace to self-service routes", () => {
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/service-catalog")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/system/dropdowns")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/applications")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/incidents", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/catalog/items/item-1/request", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/incidents/events", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/changes/change-1", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/assets", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/dropdowns/options", "POST")).toBe(false);
  });

  it("keeps auditor pages read-only and focused on audit and inventory", () => {
    expect(isPersonaPageAllowed(["auditor"], [], "/access-governance")).toBe(true);
    expect(isPersonaPageAllowed(["auditor"], [], "/audit-logs")).toBe(true);
    expect(isPersonaPageAllowed(["auditor"], [], "/purchase-orders")).toBe(false);
    expect(isPersonaApiAllowed(["auditor"], [], "/assets", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["auditor"], [], "/assets", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["auditor"], [], "/audit-logs", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["auditor"], [], "/audit-logs", "DELETE")).toBe(false);
  });

  it("allows auditors to inspect infrastructure and backup evidence without mutation rights", () => {
    expect(isPersonaPageAllowed(["auditor"], [], "/network-topology")).toBe(true);
    expect(isPersonaPageAllowed(["auditor"], [], "/backup-schedules")).toBe(true);
    expect(isPersonaApiAllowed(["auditor"], [], "/network-topology/firewall-rules", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["auditor"], [], "/network-topology/firewall-rules", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["auditor"], [], "/backup-schedules/runs", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["auditor"], [], "/backup-schedules/id/runs", "POST")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/network-topology")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/backup-schedules")).toBe(false);
  });

  it("limits auditor knowledge access to published policies", () => {
    const auditor = { roles: [{ name: "auditor" }], permissions: [] };
    expect(canAuditPublishedPolicies(auditor)).toBe(true);
    expect(canReadKnowledge(auditor, { status: "published", isPublic: false, category: "Policy" })).toBe(true);
    expect(canReadKnowledge(auditor, { status: "draft", isPublic: true, category: "Policy" })).toBe(false);
    expect(canReadKnowledge(auditor, { status: "published", isPublic: true, category: "Technical SOP" })).toBe(false);
  });

  it("allows workbench actions to agents while keeping role-specific APIs scoped", () => {
    expect(isPersonaPageAllowed(["it_agent"], [], "/incidents/tracker")).toBe(true);
    expect(isPersonaPageAllowed(["it_agent"], [], "/changes")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/problems", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/purchase-orders", "GET")).toBe(false);
  });

  it("keeps custody workbench access for asset staff and scopes employee receipts to their own portal actions", () => {
    expect(isPersonaPageAllowed(["it_agent"], [], "/asset-handovers")).toBe(true);
    expect(isPersonaPageAllowed(["it_manager"], [], "/asset-handovers")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/asset-handovers")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/asset-handovers", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/asset-handovers", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id/acknowledge", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id/acknowledge", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/asset-handovers", "GET")).toBe(false);
  });

  it("grants CAB and manager access to change approvals, CMDB, and finance routes", () => {
    expect(isPersonaPageAllowed(["cab_member"], [], "/changes/tracker")).toBe(true);
    expect(isPersonaPageAllowed(["cab_member"], [], "/changes/new")).toBe(false);
    expect(isPersonaPageAllowed(["cab_member"], [], "/servers")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/cmdb/change-options", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/changes/change-1/approvals/approval-1", "PUT")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/budgets", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/incidents", "PATCH")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/dashboard/executive", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/dashboard/executive", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/dashboard/executive", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/dashboard/executive", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["auditor"], [], "/dashboard/executive", "GET")).toBe(false);
  });
});
