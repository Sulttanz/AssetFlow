import { describe, expect, it } from "vitest";
import { __backupGovernanceTestUtils } from "./backup-governance";

describe("backup schedule due-date advancement", () => {
  const advance = __backupGovernanceTestUtils.advanceDueDate;

  it("advances fixed intervals from the logged completion time", () => {
    const start = new Date("2026-03-15T08:30:00.000Z");
    expect(advance(start, "hourly")?.toISOString()).toBe("2026-03-15T09:30:00.000Z");
    expect(advance(start, "daily")?.toISOString()).toBe("2026-03-16T08:30:00.000Z");
    expect(advance(start, "weekly")?.toISOString()).toBe("2026-03-22T08:30:00.000Z");
    expect(advance(start, "monthly")?.toISOString()).toBe("2026-04-15T08:30:00.000Z");
  });

  it("clamps month-end dates and leaves custom schedules for manual review", () => {
    expect(advance(new Date("2026-01-31T10:00:00.000Z"), "monthly")?.toISOString())
      .toBe("2026-02-28T10:00:00.000Z");
    expect(advance(new Date("2026-03-15T10:00:00.000Z"), "custom")).toBeNull();
  });
});
