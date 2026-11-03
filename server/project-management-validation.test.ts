import { describe, expect, it } from "vitest";
import { projectMutationSchema } from "@shared/project-management";

const validProject = {
  title: "Identity platform rollout",
  description: "Replace the legacy identity provider.",
  status: "Planning",
  healthStatus: "On Track",
  startDate: "2026-12-01",
  targetEndDate: "2027-04-30",
  actualEndDate: null,
  budget: "125000.00",
  managerIds: ["manager-1", "manager-2"],
  primaryManagerId: "manager-1",
  teamMembers: [{ userId: "user-1", roleTitle: "Technical Lead" }],
  milestones: [{
    title: "Design approved",
    description: "",
    dueDate: "2027-01-15",
    completionDate: null,
    status: "Pending",
  }],
  assets: [{ assetId: "asset-1", associationType: "Deployed" }],
};

describe("project mutation validation", () => {
  it("accepts a valid project with multiple managers and integrations", () => {
    expect(projectMutationSchema.parse(validProject)).toMatchObject({
      title: "Identity platform rollout",
      managerIds: ["manager-1", "manager-2"],
      budget: 125000,
    });
  });

  it("requires the primary manager to be selected and rejects duplicate assignments", () => {
    expect(projectMutationSchema.safeParse({ ...validProject, primaryManagerId: "missing" }).success).toBe(false);
    expect(projectMutationSchema.safeParse({ ...validProject, managerIds: ["manager-1", "manager-1"] }).success).toBe(false);
  });

  it("rejects invalid dates, reversed schedules, status values, and negative budgets", () => {
    expect(projectMutationSchema.safeParse({ ...validProject, startDate: "31-12-2026" }).success).toBe(false);
    expect(projectMutationSchema.safeParse({ ...validProject, startDate: "2027-05-01" }).success).toBe(false);
    expect(projectMutationSchema.safeParse({ ...validProject, status: "Blocked" }).success).toBe(false);
    expect(projectMutationSchema.safeParse({ ...validProject, budget: -1 }).success).toBe(false);
  });
});
