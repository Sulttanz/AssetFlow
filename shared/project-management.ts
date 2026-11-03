import { z } from "zod";

export const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled"] as const;
export const PROJECT_HEALTH_STATUSES = ["On Track", "At Risk", "Delayed"] as const;
export const PROJECT_MILESTONE_STATUSES = ["Pending", "In Progress", "Completed", "Delayed"] as const;
export const PROJECT_ASSET_ASSOCIATION_TYPES = ["Deployed", "Decommissioned", "Upgraded"] as const;

const projectDate = z.string().trim().min(1).refine(value => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}, "Enter a valid ISO calendar date or timestamp.");

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

const milestoneSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Milestone title is required.").max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: projectDate,
  completionDate: projectDate.nullable().optional(),
  status: z.enum(PROJECT_MILESTONE_STATUSES),
});

export const projectMutationSchema = z.object({
  title: z.string().trim().min(1, "Project title is required.").max(255),
  description: z.string().trim().max(10000).default(""),
  status: z.enum(PROJECT_STATUSES),
  healthStatus: z.enum(PROJECT_HEALTH_STATUSES),
  startDate: projectDate,
  targetEndDate: projectDate,
  actualEndDate: projectDate.nullable().optional(),
  budget: z.coerce.number().finite().min(0).max(9_999_999_999.99),
  managerIds: z.array(z.string().trim().min(1)).min(1).max(200),
  primaryManagerId: z.string().trim().min(1),
  teamMembers: z.array(z.object({
    userId: z.string().trim().min(1),
    roleTitle: z.string().trim().min(1).max(100).default("Team Member"),
  })).max(1000),
  milestones: z.array(milestoneSchema).max(1000),
  assets: z.array(z.object({
    assetId: z.string().trim().min(1),
    associationType: z.enum(PROJECT_ASSET_ASSOCIATION_TYPES),
  })).max(1000),
}).superRefine((project, context) => {
  if (!project.managerIds.includes(project.primaryManagerId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primaryManagerId"],
      message: "The primary manager must also be selected as a project manager.",
    });
  }
  for (const [field, ids] of [
    ["managerIds", project.managerIds],
    ["teamMembers", project.teamMembers.map(member => member.userId)],
    ["assets", project.assets.map(asset => asset.assetId)],
  ] as const) {
    if (!uniqueIds(ids)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "Duplicate assignments are not allowed.",
      });
    }
  }
  if (Date.parse(project.targetEndDate) < Date.parse(project.startDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetEndDate"],
      message: "Target end date must be on or after the start date.",
    });
  }
});

export const projectMilestoneUpdateSchema = z.object({
  status: z.enum(PROJECT_MILESTONE_STATUSES),
  completionDate: projectDate.nullable(),
}).superRefine((milestone, context) => {
  if (milestone.status === "Completed" && !milestone.completionDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completionDate"],
      message: "A completion date is required for completed milestones.",
    });
  }
});

export type ProjectMutation = z.infer<typeof projectMutationSchema>;
