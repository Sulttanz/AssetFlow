// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  advanceMaintenanceDueDate,
  calculateMaintenanceAnalytics,
  maintenanceCsv,
  maintenanceItemMatches,
} from "@shared/maintenance-utils";

describe("maintenance schedule and report utilities", () => {
  it.each([
    ["monthly", "2026-03-15", "2026-03-15", "2026-04-15"],
    ["quarterly", "2026-03-15", "2026-03-15", "2026-06-15"],
    ["annually", "2026-03-15", "2026-03-15", "2027-03-15"],
    ["monthly", "2026-01-31", "2026-01-31", "2026-02-28"],
    ["monthly", "2026-01-15", "2026-03-17", "2026-04-15"],
    ["annually", "2024-02-29", "2024-02-29", "2025-02-28"],
  ])("advances %s schedules by calendar dates without timezone shifts", (frequency, due, completed, expected) => {
    expect(advanceMaintenanceDueDate(due, frequency, completed)).toBe(expected);
  });

  it("closes one-time schedules and rejects unknown frequencies", () => {
    expect(advanceMaintenanceDueDate("2026-03-15", "one-time", "2026-03-15")).toBeNull();
    expect(() => advanceMaintenanceDueDate("2026-03-15", "fortnightly", "2026-03-15")).toThrow(/Unsupported/);
  });

  it("matches maintenance searches and combines type, status, priority, and overdue filters", () => {
    const item = {
      searchableValues: ["AST-1", "Executive Laptop", "ACME support", "Fan replacement"],
      maintenanceType: "preventive", status: "overdue", priority: "high", overdue: true,
    };
    expect(maintenanceItemMatches(
      { search: "acme", type: "preventive", status: "overdue", priority: "high", overdueOnly: true },
      item,
    )).toBe(true);
    expect(maintenanceItemMatches(
      { search: "router", type: "preventive", status: "overdue", priority: "high", overdueOnly: true },
      item,
    )).toBe(false);
    expect(maintenanceItemMatches(
      { search: "", type: "preventive", status: "active", priority: "high", overdueOnly: false },
      item,
    )).toBe(false);
  });

  it("compares actual and estimated costs and reports on-time versus late completions", () => {
    const analytics = calculateMaintenanceAnalytics([
      { cost: "120.50", estimatedCost: "100", maintenanceDate: "2026-03-15", scheduledDate: "2026-03-15" },
      { cost: "80", estimatedCost: "100", maintenanceDate: "2026-03-17", scheduledDate: "2026-03-15" },
      { cost: "10", estimatedCost: "15", maintenanceDate: "2026-03-01", scheduledDate: null },
    ]);
    expect(analytics).toMatchObject({
      totalSpend: 210.5, estimatedBudget: 215, completedCount: 3,
      onTimeCount: 1, overdueCount: 1, evaluatedCount: 2, onTimeRate: 50, overdueRate: 50,
    });
  });

  it("exports audited dates in DD-MM-YYYY and quotes comma/quote-containing values", () => {
    const csv = maintenanceCsv([{
      assetTag: "IT-1", assetName: "Laptop, \"A\"", maintenanceType: "repair",
      scheduledDate: "2026-03-15", maintenanceDate: "2026-03-16",
      performedBy: "Vendor", estimatedCost: "25", cost: "30",
      workPerformed: null, description: "=1+1", nextMaintenanceDate: "2026-04-15",
    }]);
    expect(csv).toContain('"Laptop, ""A"""');
    expect(csv).toContain('"15-03-2026","16-03-2026"');
    expect(csv).toContain('"15-04-2026"');
    expect(csv).toContain("\"'=1+1\"");
  });
});
