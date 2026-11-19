import { describe, expect, it } from "vitest";
import { getPersonaHomePath, getPersonaRoleKeys, isPersonaApiAllowed, isPersonaPageAllowed } from "./personas";
import { canAuditPublishedPolicies, canReadKnowledge } from "./kb-governance";

describe("persona access policy", () => {
  it("recognizes the supported persona role names and legacy IT staff aliases", () => {
    expect(getPersonaRoleKeys(["end_user", "IT Staff", "CAB Member", "IT Manager", "auditor"])).toEqual([
      "end_user", "it_agent", "cab_member", "it_manager", "auditor",
    ]);
  });

  it("routes end users to self-service and blocks workbenches and unlinked asset custody", () => {
    expect(getPersonaHomePath(["end_user"])).toBe("/portal");
    expect(isPersonaPageAllowed(["end_user"], [], "/dashboard")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/portal")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets", "employee-1")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/service-catalog")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/incidents/new")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/service-requests/new")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/incidents/tracker")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/changes")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/system/dropdowns")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/applications")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/incidents", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/catalog/items/item-1/request", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/incidents/events", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/changes/change-1", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/assets", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/assets", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/assets", "GET", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/dropdowns/options", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/dropdowns", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/system/version", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/system/clear-data", "POST")).toBe(false);
  });

  it("allows agents to read the incident catalog while limiting catalog edits to managers", () => {
    expect(isPersonaPageAllowed(["it_manager"], [], "/incident-catalog")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/incident-catalog", "GET")).toBe(true);
    expect(isPersonaPageAllowed(["it_agent"], [], "/incident-catalog")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/incident-catalog", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/incident-catalog", "POST")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/incident-catalog")).toBe(false);
    expect(isPersonaPageAllowed(["end_user"], [], "/my-assets")).toBe(false);
    expect(isPersonaPageAllowed(["auditor"], [], "/my-assets")).toBe(false);
  });

  it("keeps auditor pages read-only and focused on audit and inventory", () => {
    expect(isPersonaPageAllowed(["auditor"], [], "/access-governance")).toBe(true);
    expect(isPersonaPageAllowed(["auditor"], [], "/audit-logs")).toBe(true);
    expect(isPersonaPageAllowed(["auditor"], [], "/purchase-orders")).toBe(false);
    expect(isPersonaPageAllowed(["auditor"], [], "/assets/new")).toBe(false);
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

  it("allows IT agents operational workbenches but blocks finance and administrative writes", () => {
    expect(isPersonaPageAllowed(["it_agent"], [], "/incidents/tracker")).toBe(true);
    expect(isPersonaPageAllowed(["it_agent"], [], "/changes")).toBe(true);
    expect(isPersonaPageAllowed(["it_agent"], [], "/changes/new")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/problems", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/purchase-orders", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/contracts", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/contracts/contract-1", "PUT")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/assignment-groups/1/members", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/assignment-groups", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/users", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/users", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/changes", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/changes/1", "DELETE")).toBe(false);
  });

  it("scopes Asset Managers to ITAM, vendor contracts, and self-service", () => {
    expect(isPersonaPageAllowed(["asset_manager"], [], "/assets")).toBe(true);
    expect(isPersonaPageAllowed(["asset_manager"], [], "/vendors")).toBe(true);
    expect(isPersonaPageAllowed(["asset_manager"], [], "/service-contracts")).toBe(true);
    expect(isPersonaPageAllowed(["asset_manager"], [], "/finance/contracts")).toBe(false);
    expect(isPersonaPageAllowed(["asset_manager"], [], "/users")).toBe(false);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/vendors", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/purchase-orders", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/employees", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/employees", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/users", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["asset_manager"], [], "/users", "DELETE")).toBe(false);
  });

  it("keeps custody workbench access for asset staff and scopes employee receipts to their own portal actions", () => {
    expect(isPersonaPageAllowed(["it_agent"], [], "/asset-handovers")).toBe(true);
    expect(isPersonaPageAllowed(["it_manager"], [], "/asset-handovers")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/asset-handovers")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/asset-handovers", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/asset-handovers", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers", "GET", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id/acknowledge", "POST", "employee-1")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id/acknowledge", "GET", "employee-1")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/my/asset-handovers/receipt-id", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/asset-handovers", "GET")).toBe(false);
  });

  it("limits CAB Members to change review/approval and self-service", () => {
    expect(isPersonaPageAllowed(["cab_member"], [], "/changes/tracker")).toBe(true);
    expect(isPersonaPageAllowed(["cab_member"], [], "/changes/new")).toBe(false);
    expect(isPersonaPageAllowed(["cab_member"], [], "/changes/change-1")).toBe(true);
    expect(isPersonaPageAllowed(["cab_member"], [], "/servers")).toBe(false);
    expect(isPersonaApiAllowed(["cab_member"], [], "/cmdb/change-options", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/changes/change-1/approvals/approval-1", "PUT")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/changes", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["cab_member"], [], "/purchase-orders", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["it_manager"], [], "/budgets", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/incidents", "PATCH")).toBe(true);
    expect(isPersonaApiAllowed(["cab_member"], [], "/dashboard/executive", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["it_manager"], [], "/dashboard/executive", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_agent"], [], "/dashboard/executive", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/dashboard/executive", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["auditor"], [], "/dashboard/executive", "GET")).toBe(false);
  });

  it("grants project workspace access to IT managers while keeping end users out", () => {
    expect(getPersonaHomePath(["it_manager"])).toBe("/dashboard");
    expect(isPersonaPageAllowed(["it_manager"], [], "/projects")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/projects", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/projects", "POST")).toBe(true);
    expect(isPersonaPageAllowed(["end_user"], [], "/projects")).toBe(false);
    expect(isPersonaApiAllowed(["end_user"], [], "/projects", "GET")).toBe(false);
    expect(isPersonaPageAllowed(["Demo Viewer"], [], "/projects")).toBe(true);
    expect(isPersonaPageAllowed(["Demo Viewer"], [], "/projects/new")).toBe(false);
    expect(isPersonaApiAllowed(["Demo Viewer"], [], "/projects", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["Demo Viewer"], [], "/projects", "DELETE")).toBe(false);
  });

  it("keeps read-only personas read-only even on project and user APIs", () => {
    expect(isPersonaPageAllowed(["read_only_user"], [], "/audit-logs")).toBe(true);
    expect(isPersonaPageAllowed(["read_only_user"], [], "/finance/purchase-orders")).toBe(false);
    expect(isPersonaApiAllowed(["read_only_user"], [], "/projects", "GET")).toBe(false);
    expect(isPersonaApiAllowed(["read_only_user"], [], "/assets", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["read_only_user"], [], "/assets", "PUT")).toBe(false);
    expect(isPersonaApiAllowed(["read_only_user"], [], "/users", "POST")).toBe(false);
  });
});
