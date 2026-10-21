// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MemStorage } from "./storage";
import { maintenanceRecordSubmissionSchema } from "@shared/schema";

vi.mock("./db", () => ({ db: {} }));

describe("maintenance record submission and recurrence", () => {
  it("requires a named technician/vendor, estimated cost, and non-negative actual cost", () => {
    const valid = {
      assetId: "asset-1", maintenanceDate: "2026-03-01", maintenanceType: "preventive",
      performedBy: "Field Technician", cost: "120.50", estimatedCost: "100.00",
    };
    expect(maintenanceRecordSubmissionSchema.safeParse(valid).success).toBe(true);
    expect(maintenanceRecordSubmissionSchema.safeParse({ ...valid, performedBy: "   " }).success).toBe(false);
    expect(maintenanceRecordSubmissionSchema.safeParse({ ...valid, cost: "-1" }).success).toBe(false);
    expect(maintenanceRecordSubmissionSchema.safeParse({ ...valid, estimatedCost: "" }).success).toBe(false);
  });

  it("snapshots schedule due date and estimate, catches up, then rejects stale duplicate submissions", async () => {
    const storage = new MemStorage();
    const createdSchedule = await storage.createMaintenanceSchedule({
      assetId: "asset-1", maintenanceType: "preventive", frequency: "monthly",
      nextDue: "2026-01-31", estimatedCost: "90.00", priority: "high",
      description: "Filter change", isActive: "true",
    });
    const submission = {
      assetId: "asset-1", scheduleId: createdSchedule.id, scheduledDate: "2026-01-31",
      maintenanceDate: "2026-03-03", maintenanceType: "preventive",
      performedBy: "Field Technician", cost: "105.00", estimatedCost: "999.00",
    };
    const result = await storage.createMaintenanceRecordWithScheduleAdvance(submission, true);
    expect(result.record).toMatchObject({
      scheduledDate: "2026-01-31", estimatedCost: "90.00", cost: "105.00",
    });
    expect(result.schedule?.nextDue).toBe("2026-03-28");
    await expect(storage.createMaintenanceRecordWithScheduleAdvance(submission, true))
      .rejects.toThrow(/schedule has advanced/i);
    expect(await storage.getMaintenanceRecords()).toHaveLength(1);
  });

  it("completes a one-time schedule only when schedule advancement is selected", async () => {
    const storage = new MemStorage();
    const schedule = await storage.createMaintenanceSchedule({
      assetId: "asset-2", maintenanceType: "inspection", frequency: "one-time",
      nextDue: "2026-04-01", estimatedCost: "25.00", priority: "medium",
      description: null, isActive: "true",
    });
    const record = {
      assetId: "asset-2", scheduleId: schedule.id, scheduledDate: schedule.nextDue,
      maintenanceDate: "2026-04-01", maintenanceType: "inspection",
      performedBy: "Safety Vendor", cost: "25.00", estimatedCost: "25.00",
    };
    const logged = await storage.createMaintenanceRecordWithScheduleAdvance(record, true);
    expect(logged.schedule?.isActive).toBe("false");
  });
});
