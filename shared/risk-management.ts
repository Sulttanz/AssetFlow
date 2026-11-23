import { z } from "zod";

export const IT_RISK_CATEGORIES = [
  "Infrastructure & High Availability",
  "Cybersecurity & Vulnerability",
  "Backup, DR & Continuity",
  "Identity, Access & Patching",
  "Third-Party & Vendor",
  "Service Delivery & ITSM",
  "Regulatory & Compliance",
] as const;

export const IT_RISK_TREATMENTS = ["Mitigate", "Accept", "Transfer", "Avoid"] as const;
export const IT_RISK_REVIEW_FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"] as const;
export const IT_RISK_CONTROL_EFFECTIVENESS = ["Effective", "Partially Effective", "Ineffective"] as const;
export const IT_RISK_STATUSES = ["identified", "mitigating", "accepted", "closed"] as const;
export const DEFAULT_IT_RISK_APPETITE = 12;

/** Accept legacy import labels while persisting only the internal IT taxonomy. */
export function normalizeItRiskCategory(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const legacy: Record<string, typeof IT_RISK_CATEGORIES[number]> = {
    security: "Cybersecurity & Vulnerability", data: "Cybersecurity & Vulnerability",
    availability: "Infrastructure & High Availability", compliance: "Regulatory & Compliance",
    vendor: "Third-Party & Vendor", backup: "Backup, DR & Continuity",
    identity: "Identity, Access & Patching", schedule: "Service Delivery & ITSM",
    operational: "Service Delivery & ITSM", other: "Service Delivery & ITSM",
  };
  return legacy[value.trim().toLowerCase()] ?? value;
}

export const ciaImpactSchema = z.object({
  confidentiality: z.boolean(),
  integrity: z.boolean(),
  availability: z.boolean(),
}).strict();

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date").nullable().optional();

export const riskAssessmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  changeId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.enum(IT_RISK_CATEGORIES),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigation: z.string().max(5000).nullable().optional(),
  contingency: z.string().max(5000).nullable().optional(),
  contingencyPlan: z.string().max(5000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: optionalDate,
  residualLikelihood: z.number().int().min(1).max(5).nullable().optional(),
  residualImpact: z.number().int().min(1).max(5).nullable().optional(),
  targetLikelihood: z.number().int().min(1).max(5).nullable().optional(),
  targetImpact: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(IT_RISK_STATUSES).optional(),
  acceptanceReason: z.string().max(2000).nullable().optional(),
  threatSource: z.string().max(2000).nullable().optional(),
  vulnerability: z.string().max(5000).nullable().optional(),
  ciaImpact: ciaImpactSchema.optional(),
  existingControls: z.string().max(5000).nullable().optional(),
  controlEffectiveness: z.enum(IT_RISK_CONTROL_EFFECTIVENESS).nullable().optional(),
  treatmentStrategy: z.enum(IT_RISK_TREATMENTS).optional(),
  reviewFrequency: z.enum(IT_RISK_REVIEW_FREQUENCIES).optional(),
  nextReviewDate: optionalDate,
  acceptanceJustification: z.string().max(4000).nullable().optional(),
  acceptanceExpiresAt: optionalDate,
}).strict();

export const riskMitigationActionInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  ownerUserId: z.string().uuid().nullable().optional(),
  dueDate: optionalDate,
  status: z.enum(["Open", "In Progress", "Completed", "Overdue"]).optional(),
  evidenceNotes: z.string().max(5000).nullable().optional(),
}).strict();

export const riskReviewInputSchema = z.object({
  notes: z.string().trim().min(3).max(4000).nullable().optional(),
}).strict();

export const riskLinkTypeSchema = z.enum([
  "applications", "servers", "networkDevices", "assets", "vendors",
  "complianceReviews", "problems", "changes",
]);

export function riskScore(likelihood: number | null | undefined, impact: number | null | undefined): number | null {
  return likelihood != null && impact != null ? likelihood * impact : null;
}

export function residualRiskScore(risk: {
  residualLikelihood?: number | null; residualImpact?: number | null; likelihood?: number; impact?: number;
}): number {
  return (risk.residualLikelihood ?? risk.likelihood ?? 0) * (risk.residualImpact ?? risk.impact ?? 0);
}

export function addReviewFrequency(date: Date, frequency: typeof IT_RISK_REVIEW_FREQUENCIES[number]): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDate();
  next.setUTCDate(1);
  const months = { Monthly: 1, Quarterly: 3, "Semi-Annual": 6, Annual: 12 }[frequency] ?? 3;
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}
