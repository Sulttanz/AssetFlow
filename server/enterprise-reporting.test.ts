import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));
vi.mock("./auth", () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("./module-access", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("./storage", () => ({ storage: { getUserPermissions: vi.fn() } }));

import {
  csvSafeAuditSummary,
  enterpriseAuditFiltersSchema,
  enterpriseReportFiltersSchema,
  getReportAccess,
} from "./enterprise-reporting";

describe("enterprise reporting controls", () => {
  it("validates date windows and rejects reversed or malformed dates", () => {
    expect(enterpriseReportFiltersSchema.safeParse({ from: "2026-03-01", to: "2026-03-31" }).success).toBe(true);
    expect(enterpriseReportFiltersSchema.safeParse({ from: "2026-04-01", to: "2026-03-31" }).success).toBe(false);
    expect(enterpriseReportFiltersSchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(enterpriseReportFiltersSchema.safeParse({ unknown: "unexpected" }).success).toBe(false);
  });

  it("validates audit area and action filters", () => {
    expect(enterpriseAuditFiltersSchema.safeParse({ category: "itam", action: "UPDATE" }).success).toBe(true);
    expect(enterpriseAuditFiltersSchema.safeParse({ category: "credentials" }).success).toBe(false);
  });

  it("requires broad reporting permissions rather than exposing aggregate data to personal ticket viewers", () => {
    expect(getReportAccess(["ticket_view_own"])).toEqual({ itsm: false, itam: false, audit: false });
    expect(getReportAccess(["ticket_view_all"])).toEqual({ itsm: true, itam: false, audit: false });
    expect(getReportAccess(["asset_view", "audit_view"])).toEqual({ itsm: false, itam: true, audit: true });
    expect(getReportAccess(["system_admin"])).toEqual({ itsm: true, itam: true, audit: true });
  });

  it("summarizes only approved audit fields and never exposes arbitrary stored values", () => {
    const summary = csvSafeAuditSummary(
      JSON.stringify({ status: "New", password: "do-not-export", resolutionNotes: "private note" }),
      JSON.stringify({ status: "Resolved", password: "secret", assigneeId: "user-1" }),
    );
    expect(summary).toContain("status: New → Resolved");
    expect(summary).toContain("assigneeId: — → user-1");
    expect(summary).not.toContain("password");
    expect(summary).not.toContain("private note");
  });
});
