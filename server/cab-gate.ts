import type { ChangeApproval } from "@shared/schema";

// An orphaned pending vote still blocks the change until an authorized user removes it.
export function cabApprovalsGranted(approvals: Pick<ChangeApproval, "decision">[]): boolean {
  return approvals.length > 0 && approvals.every(approval => approval.decision === "approved");
}