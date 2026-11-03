import type {
  PROJECT_ASSET_ASSOCIATION_TYPES,
  PROJECT_CHANGE_STATUSES,
  PROJECT_DOCUMENT_CATEGORIES,
  PROJECT_HEALTH_STATUSES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_RISK_CATEGORIES,
  PROJECT_RISK_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TASK_PRIORITIES,
  PROJECT_TASK_STATUSES,
} from "@shared/project-management";

type ProjectStatus = typeof PROJECT_STATUSES[number];
type ProjectHealth = typeof PROJECT_HEALTH_STATUSES[number];
type MilestoneStatus = typeof PROJECT_MILESTONE_STATUSES[number];
type AssetAssociation = typeof PROJECT_ASSET_ASSOCIATION_TYPES[number];
export type ProjectTaskStatus = typeof PROJECT_TASK_STATUSES[number];
export type ProjectTaskPriority = typeof PROJECT_TASK_PRIORITIES[number];
export type ProjectRiskCategory = typeof PROJECT_RISK_CATEGORIES[number];
export type ProjectRiskStatus = typeof PROJECT_RISK_STATUSES[number];
export type ProjectChangeStatus = typeof PROJECT_CHANGE_STATUSES[number];
export type ProjectDocumentCategory = typeof PROJECT_DOCUMENT_CATEGORIES[number];

export interface ProjectManagerView {
  userId: string;
  name: string;
  isPrimary: boolean;
}

export interface ProjectTeamMemberView {
  userId: string;
  name: string;
  username?: string | null;
  roleTitle: string;
  assignedAt: string | Date;
}

export interface ProjectMilestoneView {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | Date;
  completionDate?: string | Date | null;
  status: MilestoneStatus;
}

export interface ProjectAssetView {
  assetId: string;
  assetTag: string;
  name: string;
  serialNumber?: string | null;
  status: string;
  associationType: AssetAssociation;
}

export interface ProjectRecord {
  id: string;
  title: string;
  description?: string | null;
  status: ProjectStatus;
  healthStatus: ProjectHealth;
  startDate: string | Date;
  targetEndDate: string | Date;
  actualEndDate?: string | Date | null;
  budget: string | number;
  actualSpend: string | number;
  createdBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  managers: ProjectManagerView[];
  teamCount?: number;
  teamMembers?: ProjectTeamMemberView[];
  milestones?: ProjectMilestoneView[];
  assets?: ProjectAssetView[];
}

export interface ProjectTaskRecord {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  estimatedHours: string | number;
  loggedHours: string | number;
  dueDate?: string | Date | null;
  sortOrder: number;
  createdAt: string | Date;
}

export interface ProjectRiskRecord {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  category: ProjectRiskCategory;
  probability: number;
  impact: number;
  riskScore: number;
  mitigationStrategy?: string | null;
  status: ProjectRiskStatus;
  ownerId?: string | null;
  ownerName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProjectChangeRecord {
  id: string;
  projectId: string;
  rfcNumber: string;
  title: string;
  reason?: string | null;
  impactAnalysis?: string | null;
  status: ProjectChangeStatus;
  requestedBy?: string | null;
  requestedByName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProjectDocumentRecord {
  id: string;
  projectId: string;
  name: string;
  version: string;
  fileUrl: string;
  category: ProjectDocumentCategory;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string | Date;
}

export interface ProjectAllocationRecord {
  userId: string;
  name: string;
  username: string;
  projectCount: number;
  taskCount: number;
  estimatedHours: number;
  loggedHours: number;
  projects: Array<{
    projectId: string;
    projectTitle: string;
    roleTitle: string;
    taskCount: number;
    estimatedHours: number;
    loggedHours: number;
  }>;
}

export interface ProjectOptions {
  users: Array<{ id: string; name: string; username: string }>;
  assets: Array<{
    id: string;
    name: string;
    assetTag: string;
    serialNumber?: string | null;
    status: string;
  }>;
}
