import type { PROJECT_ASSET_ASSOCIATION_TYPES, PROJECT_HEALTH_STATUSES, PROJECT_MILESTONE_STATUSES, PROJECT_STATUSES } from "@shared/project-management";

type ProjectStatus = typeof PROJECT_STATUSES[number];
type ProjectHealth = typeof PROJECT_HEALTH_STATUSES[number];
type MilestoneStatus = typeof PROJECT_MILESTONE_STATUSES[number];
type AssetAssociation = typeof PROJECT_ASSET_ASSOCIATION_TYPES[number];

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
  createdBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  managers: ProjectManagerView[];
  teamCount?: number;
  teamMembers?: ProjectTeamMemberView[];
  milestones?: ProjectMilestoneView[];
  assets?: ProjectAssetView[];
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
