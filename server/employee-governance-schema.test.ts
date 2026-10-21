import { describe, expect, it } from "vitest";
import {
  employeeOffboardingSubmissionSchema,
  insertEmployeeAccessRightSchema,
} from "@shared/schema";

describe("employee access governance input", () => {
  it("requires a business justification and accepts an optional expiry date", () => {
    expect(insertEmployeeAccessRightSchema.safeParse({
      employeeId: "employee-1",
      applicationName: "Email",
      accessType: "application",
      catalogSource: "application",
      catalogItemId: "app-1",
      privilegeLevel: "viewer",
      businessJustification: "Required to review customer cases",
      grantDate: "2026-10-21",
      expiresAt: "2027-10-21",
    }).success).toBe(true);

    expect(insertEmployeeAccessRightSchema.safeParse({
      employeeId: "employee-1",
      applicationName: "Email",
      privilegeLevel: "viewer",
      businessJustification: "   ",
    }).success).toBe(false);
  });

  it("requires one verified or waived sign-off for every offboarding clearance", () => {
    const base = {
      offboardedDate: "2026-10-21",
      offboardedReason: "Employee departure",
      clearances: [
        { clearanceType: "physical_asset_return", status: "verified" },
        { clearanceType: "credential_vpn_revocation", status: "waived", note: "Emergency access is retained by security." },
        { clearanceType: "license_reallocation", status: "verified" },
      ],
    };
    expect(employeeOffboardingSubmissionSchema.safeParse(base).success).toBe(true);
    expect(employeeOffboardingSubmissionSchema.safeParse({
      ...base,
      clearances: base.clearances.map(clearance => clearance.clearanceType === "credential_vpn_revocation"
        ? { ...clearance, note: " " }
        : clearance),
    }).success).toBe(false);
    expect(employeeOffboardingSubmissionSchema.safeParse({
      ...base,
      clearances: [
        base.clearances[0],
        base.clearances[0],
        base.clearances[2],
      ],
    }).success).toBe(false);
  });
});
