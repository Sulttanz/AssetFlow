import { describe, expect, it } from "vitest";
import { calculateProjectBaselineVariance, nextProjectBaselineVersion } from "./project-management";

describe("project baseline versioning and variance", () => {
  it("starts at v1.0 and advances every immutable revision", () => {
    expect(nextProjectBaselineVersion()).toBe("v1.0");
    expect(nextProjectBaselineVersion("v1.0")).toBe("v1.1");
    expect(nextProjectBaselineVersion("v1.9")).toBe("v1.10");
    expect(() => nextProjectBaselineVersion("baseline-A")).toThrow(/version/i);
  });

  it("calculates budget and schedule variance using calendar days", () => {
    const variance = calculateProjectBaselineVariance({
      budget: "1200.00",
      actualSpend: "850.00",
      targetEndDate: new Date("2026-06-20T12:00:00.000Z"),
      actualEndDate: null,
    }, {
      baselineBudget: "1000.00",
      baselineStartDate: "2026-01-01",
      baselineTargetEndDate: "2026-06-30",
    });

    expect(variance.budgetVariance).toBe(150);
    expect(variance.budgetChange).toBe(200);
    expect(variance.scheduleVarianceDays).toBe(10);
    expect(variance.forecastEndDate).toBe("2026-06-20");
  });

  it("uses actual completion date after a project has finished", () => {
    const variance = calculateProjectBaselineVariance({
      budget: "1000.00",
      actualSpend: "1100.00",
      targetEndDate: new Date("2026-06-30T12:00:00.000Z"),
      actualEndDate: new Date("2026-07-05T12:00:00.000Z"),
    }, {
      baselineBudget: "1000.00",
      baselineStartDate: "2026-01-01",
      baselineTargetEndDate: "2026-06-30",
    });
    expect(variance.budgetVariance).toBe(-100);
    expect(variance.scheduleVarianceDays).toBe(-5);
  });
});
