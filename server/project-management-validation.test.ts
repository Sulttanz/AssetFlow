import { describe, expect, it } from "vitest";
import {
  projectChangeInputSchema,
  projectDocumentMetadataSchema,
  projectMilestoneUpdateSchema,
  projectMutationSchema,
  projectRiskInputSchema,
  projectTaskInputSchema,
  projectTaskWorkUpdateSchema,
} from "@shared/project-management";

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

  it("requires completion dates when a milestone is marked complete", () => {
    expect(projectMilestoneUpdateSchema.safeParse({ status: "Completed", completionDate: null }).success).toBe(false);
    expect(projectMilestoneUpdateSchema.safeParse({ status: "Completed", completionDate: "2027-01-15" }).success).toBe(true);
    expect(projectMilestoneUpdateSchema.safeParse({ status: "In Progress", completionDate: null }).success).toBe(true);
  });

  it("validates task workload and restricts assignee self-updates to work fields", () => {
    expect(projectTaskInputSchema.safeParse({
      title: "Cut over service",
      status: "To Do",
      priority: "High",
      assigneeId: "user-1",
      estimatedHours: 4,
      loggedHours: 1,
      dueDate: "2027-02-01",
      sortOrder: 0,
    }).success).toBe(true);
    expect(projectTaskInputSchema.safeParse({ title: "Bad estimate", estimatedHours: -1 }).success).toBe(false);
    expect(projectTaskWorkUpdateSchema.safeParse({ status: "In Progress", loggedHours: 2 }).success).toBe(true);
    expect(projectTaskWorkUpdateSchema.safeParse({ assigneeId: "another-user" }).success).toBe(false);
  });

  it("calculates risk scores only from bounded probability and impact values", () => {
    expect(projectRiskInputSchema.safeParse({
      title: "Vendor delivery delay",
      category: "Schedule",
      probability: 4,
      impact: 5,
      status: "Identified",
      ownerId: "user-1",
    }).success).toBe(true);
    expect(projectRiskInputSchema.safeParse({ title: "Invalid risk", probability: 6, impact: 5 }).success).toBe(false);
    expect(projectRiskInputSchema.safeParse({ title: "Client score", probability: 2, impact: 2, riskScore: 100 }).success).toBe(false);
  });

  it("requires unique RFC identifiers and provides a default version for documents", () => {
    expect(projectChangeInputSchema.safeParse({ rfcNumber: "PRFC-2027-001", title: "Database change" }).success).toBe(true);
    expect(projectChangeInputSchema.safeParse({ rfcNumber: "", title: "Missing reference" }).success).toBe(false);
    expect(projectDocumentMetadataSchema.parse({ name: "Architecture diagram" })).toMatchObject({
      name: "Architecture diagram",
      category: "Charter",
      version: "1.0",
    });
  });
});
