import { describe, expect, it } from "vitest";
import { projectRiskInputSchema, projectRiskUpdateSchema } from "@shared/project-management";

describe("project risk exposure validation", () => {
  const validRisk = {
    title: "Database capacity",
    category: "Technical",
    probability: 4,
    impact: 5,
    residualProbability: 2,
    residualImpact: 3,
    mitigationStrategy: "Add capacity monitoring.",
    contingencyPlan: "Move workload to the standby cluster.",
    reviewDate: "2026-12-01",
    status: "Identified",
  };

  it("accepts 1–5 inherent and residual ratings with response and review details", () => {
    const parsed = projectRiskInputSchema.parse(validRisk);
    expect(parsed.probability * parsed.impact).toBe(20);
    expect(parsed.residualProbability! * parsed.residualImpact!).toBe(6);
    expect(parsed.reviewDate).toBe("2026-12-01");
  });

  it("rejects invalid risk ratings and client-supplied calculated scores", () => {
    expect(projectRiskInputSchema.safeParse({ ...validRisk, probability: 0 }).success).toBe(false);
    expect(projectRiskInputSchema.safeParse({ ...validRisk, residualImpact: 6 }).success).toBe(false);
    expect(projectRiskInputSchema.safeParse({ ...validRisk, riskScore: 999 }).success).toBe(false);
  });

  it("allows owners to send a validated residual-exposure review update", () => {
    expect(projectRiskUpdateSchema.parse({
      residualProbability: 2,
      residualImpact: 1,
      contingencyPlan: "Invoke the fallback.",
      reviewDate: "2026-12-01",
    })).toMatchObject({ residualProbability: 2, residualImpact: 1, reviewDate: "2026-12-01" });
    expect(projectRiskUpdateSchema.safeParse({ reviewDate: "01-12-2026" }).success).toBe(false);
  });
});
