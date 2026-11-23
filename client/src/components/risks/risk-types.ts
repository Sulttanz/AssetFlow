import type { Risk, RiskMitigationAction, RiskReviewHistory } from "@shared/schema";

export type Person = { id: string; firstName?: string | null; lastName?: string | null; username?: string | null };
export type LinkType = "applications" | "servers" | "networkDevices" | "assets" | "vendors" | "complianceReviews" | "problems" | "changes";
export type RiskRecord = Omit<Risk, "createdAt" | "updatedAt" | "acceptedAt" | "lastReviewedAt"> & {
  createdAt: string | null; updatedAt: string | null; acceptedAt: string | null; lastReviewedAt: string | null;
  owner?: Person | null;
  mitigationActions: Array<Omit<RiskMitigationAction, "createdAt" | "updatedAt" | "completedAt"> & { completedAt: string | null }>;
  reviewHistory: Array<Omit<RiskReviewHistory, "createdAt"> & { createdAt: string }>;
  links: Record<LinkType, string[]>;
};
export type MatrixMode = "Inherent" | "Residual" | "Target";
export type LinkOptions = Record<LinkType, { id: string; name: string }[]> & { itsmEnabled?: boolean };
export const LINK_LABELS: Record<LinkType, string> = {
  applications: "Applications", servers: "Servers", networkDevices: "Network devices", assets: "Assets",
  vendors: "Vendors", complianceReviews: "Compliance reviews", problems: "Problems", changes: "Changes",
};
export const personName = (person?: Person | null) =>
  person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.username || "Unassigned" : "Unassigned";
export function scores(risk: Pick<RiskRecord, "likelihood" | "impact" | "residualLikelihood" | "residualImpact" | "targetLikelihood" | "targetImpact">, mode: MatrixMode) {
  if (mode === "Residual") return { likelihood: risk.residualLikelihood ?? risk.likelihood, impact: risk.residualImpact ?? risk.impact };
  if (mode === "Target") return { likelihood: risk.targetLikelihood, impact: risk.targetImpact };
  return { likelihood: risk.likelihood, impact: risk.impact };
}
export const scoreTone = (score: number) => score >= 15 ? "border-rose-200 bg-rose-50 text-rose-800" : score >= 8 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
export function filterRiskRows(rows: RiskRecord[], search: string, status: string, category: string, mode: MatrixMode, cell: { impact: number; likelihood: number } | null) {
  const query = search.trim().toLowerCase();
  return rows.filter(risk => {
    const pair = scores(risk, mode);
    return (status === "all" || risk.status === status) && (category === "all" || risk.category === category) &&
      (!cell || pair.impact === cell.impact && pair.likelihood === cell.likelihood) &&
      (!query || `${risk.riskNumber} ${risk.title} ${risk.description ?? ""} ${risk.category} ${personName(risk.owner)}`.toLowerCase().includes(query));
  });
}
