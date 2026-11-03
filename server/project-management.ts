import type { Express, Request, RequestHandler, Response } from "express";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import {
  assets,
  projectAssets,
  projectManagers,
  projectMilestones,
  projects,
  projectTeamMembers,
  users,
} from "@shared/schema";
import {
  PROJECT_HEALTH_STATUSES,
  PROJECT_STATUSES,
  projectMilestoneUpdateSchema,
  projectMutationSchema,
  type ProjectMutation,
} from "@shared/project-management";
import { isPersonaApiAllowed, isSystemAdministrator } from "@shared/personas";
import { db } from "./db";
import { storage } from "./storage";
import { registerProjectWorkspaceRoutes } from "./project-workspace";
import { isFeatureEnabled, sendFeatureNotEnabled } from "./module-access";

type AuthRequest = Request & { user?: { id?: string } };
type ProjectExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

class ProjectInputError extends Error {}
class ProjectNotFoundError extends Error {}

function projectDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
}

function displayName(person: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.username || "Unnamed user";
}

async function userCanManageProjects(userId: string) {
  const [roles, permissions] = await Promise.all([
    storage.getUserRoles(userId),
    storage.getUserPermissions(userId),
  ]);
  return isPersonaApiAllowed(roles.map(role => role.name), permissions, "/projects", "POST") &&
    (permissions.includes("project_manage") || isSystemAdministrator({ roles, permissions }));
}

async function userCanManageProject(userId: string, projectId: string) {
  const [roles, permissions] = await Promise.all([storage.getUserRoles(userId), storage.getUserPermissions(userId)]);
  if (!isPersonaApiAllowed(roles.map(role => role.name), permissions, "/projects", "POST")) return false;
  if (await userCanManageProjects(userId)) return true;
  const [manager] = await db.select({ userId: projectManagers.userId }).from(projectManagers)
    .where(and(eq(projectManagers.projectId, projectId), eq(projectManagers.userId, userId)))
    .limit(1);
  return Boolean(manager);
}

async function validateReferences(executor: ProjectExecutor, input: ProjectMutation, includeAssets: boolean) {
  const assignedUserIds = Array.from(new Set([
    ...input.managerIds,
    ...input.teamMembers.map(member => member.userId),
  ]));
  if (assignedUserIds.length) {
    const activeUsers = await executor.select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, assignedUserIds), eq(users.isActive, true)));
    if (activeUsers.length !== assignedUserIds.length) {
      throw new ProjectInputError("All project managers and team members must be active users.");
    }
  }
  const assetIds = Array.from(new Set(input.assets.map(asset => asset.assetId)));
  if (includeAssets && assetIds.length) {
    const existingAssets = await executor.select({ id: assets.id }).from(assets).where(inArray(assets.id, assetIds));
    if (existingAssets.length !== assetIds.length) {
      throw new ProjectInputError("One or more linked assets could not be found.");
    }
  }
}

async function replaceAssignments(executor: ProjectExecutor, projectId: string, input: ProjectMutation, includeAssets: boolean) {
  await executor.delete(projectManagers).where(eq(projectManagers.projectId, projectId));
  await executor.insert(projectManagers).values(input.managerIds.map(userId => ({
    projectId,
    userId,
    isPrimary: userId === input.primaryManagerId,
  })));

  await executor.delete(projectTeamMembers).where(eq(projectTeamMembers.projectId, projectId));
  if (input.teamMembers.length) {
    await executor.insert(projectTeamMembers).values(input.teamMembers.map(member => ({
      projectId,
      userId: member.userId,
      roleTitle: member.roleTitle,
    })));
  }

  if (includeAssets) {
    await executor.delete(projectAssets).where(eq(projectAssets.projectId, projectId));
    if (input.assets.length) {
      await executor.insert(projectAssets).values(input.assets.map(asset => ({
        projectId,
        assetId: asset.assetId,
        associationType: asset.associationType,
      })));
    }
  }
}

async function replaceMilestones(executor: ProjectExecutor, projectId: string, milestones: ProjectMutation["milestones"]) {
  const current = await executor.select({ id: projectMilestones.id })
    .from(projectMilestones).where(eq(projectMilestones.projectId, projectId));
  const currentIds = new Set(current.map(row => row.id));
  const keepIds: string[] = [];

  for (const milestone of milestones) {
    const values = {
      title: milestone.title,
      description: milestone.description || null,
      dueDate: projectDate(milestone.dueDate)!,
      completionDate: projectDate(milestone.completionDate),
      status: milestone.status,
    };
    if (milestone.id) {
      if (!currentIds.has(milestone.id)) {
        throw new ProjectInputError("A milestone does not belong to this project.");
      }
      await executor.update(projectMilestones).set(values)
        .where(and(eq(projectMilestones.id, milestone.id), eq(projectMilestones.projectId, projectId)));
      keepIds.push(milestone.id);
    } else {
      const [created] = await executor.insert(projectMilestones)
        .values({ projectId, ...values })
        .returning({ id: projectMilestones.id });
      keepIds.push(created.id);
    }
  }

  const removedIds = Array.from(currentIds).filter(id => !keepIds.includes(id));
  if (removedIds.length) {
    await executor.delete(projectMilestones).where(inArray(projectMilestones.id, removedIds));
  }
}

function coreValues(input: ProjectMutation, userId?: string) {
  const isActive = input.status !== "Completed" && input.status !== "Cancelled";
  return {
    name: input.title,
    title: input.title,
    description: input.description || null,
    status: input.status,
    healthStatus: input.healthStatus,
    startDate: projectDate(input.startDate)!,
    targetEndDate: projectDate(input.targetEndDate)!,
    actualEndDate: projectDate(input.actualEndDate),
    budget: input.budget.toFixed(2),
    actualSpend: input.actualSpend.toFixed(2),
    ...(userId ? { createdBy: userId } : {}),
    isActive,
    updatedAt: new Date(),
  };
}

async function writeProjectAudit(
  userId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  projectId: string,
  title: string,
  req: Request,
  oldValues?: unknown,
  newValues?: unknown,
) {
  try {
    await storage.createAuditLog({
      userId,
      action,
      tableName: "projects",
      recordId: projectId,
      recordName: title,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  } catch (error) {
    console.error("Failed to audit project management change:", error);
  }
}

function sendMutationError(error: unknown, res: Response) {
  if (error instanceof ProjectInputError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof ProjectNotFoundError) {
    return res.status(404).json({ message: "Project not found." });
  }
  if ((error as { code?: string })?.code === "23505") {
    return res.status(409).json({ message: "A project with this title already exists." });
  }
  if ((error as { code?: string })?.code === "23514") {
    return res.status(400).json({ message: "Project values do not meet the required constraints." });
  }
  console.error("Project management request failed:", error);
  return res.status(500).json({ message: "Project operation failed." });
}

async function getProjectDetail(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return undefined;
  const assetsEnabled = await isFeatureEnabled("asset_management");
  const [managerRows, memberRows, milestones, assetRows] = await Promise.all([
    db.select({
      userId: projectManagers.userId,
      isPrimary: projectManagers.isPrimary,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
    }).from(projectManagers).innerJoin(users, eq(projectManagers.userId, users.id))
      .where(eq(projectManagers.projectId, projectId)),
    db.select({
      userId: projectTeamMembers.userId,
      roleTitle: projectTeamMembers.roleTitle,
      assignedAt: projectTeamMembers.assignedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
    }).from(projectTeamMembers).innerJoin(users, eq(projectTeamMembers.userId, users.id))
      .where(eq(projectTeamMembers.projectId, projectId)),
    db.select().from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(projectMilestones.dueDate),
    assetsEnabled ? db.select({
      assetId: projectAssets.assetId,
      associationType: projectAssets.associationType,
      assetTag: assets.assetTag,
      name: assets.name,
      status: assets.status,
      serialNumber: assets.serialNumber,
    }).from(projectAssets).innerJoin(assets, eq(projectAssets.assetId, assets.id))
      .where(eq(projectAssets.projectId, projectId))
      : Promise.resolve([]),
  ]);

  return {
    ...project,
    title: project.title || project.name,
    managers: managerRows.map(row => ({
      userId: row.userId,
      name: displayName(row),
      username: row.username,
      isPrimary: row.isPrimary,
    })),
    teamMembers: memberRows.map(row => ({
      userId: row.userId,
      roleTitle: row.roleTitle,
      assignedAt: row.assignedAt,
      name: displayName(row),
      username: row.username,
    })),
    teamCount: memberRows.length,
    milestones,
    assets: assetRows,
  };
}

export function registerProjectManagementRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireModule: (moduleKey: string) => RequestHandler,
) {
  const enabled = requireModule("project_management");

  app.get("/api/projects/options", requireAuth, enabled, async (_req, res) => {
    try {
      const assetsEnabled = await isFeatureEnabled("asset_management");
      const [people, availableAssets] = await Promise.all([
        db.select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        }).from(users).where(eq(users.isActive, true)).orderBy(users.lastName, users.firstName, users.username),
        assetsEnabled ? db.select({
          id: assets.id,
          name: assets.name,
          assetTag: assets.assetTag,
          serialNumber: assets.serialNumber,
          status: assets.status,
        }).from(assets).orderBy(assets.assetTag, assets.name)
          : Promise.resolve([]),
      ]);
      res.json({
        users: people.map(person => ({ ...person, name: displayName(person) })),
        assets: availableAssets,
        assetsAvailable: assetsEnabled,
      });
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.get("/api/projects", requireAuth, enabled, async (req, res) => {
    try {
      const conditions: SQL[] = [];
      const requestedStatus = String(req.query.status ?? "").trim();
      const requestedHealth = String(req.query.healthStatus ?? "").trim();
      if (PROJECT_STATUSES.includes(requestedStatus as typeof PROJECT_STATUSES[number])) {
        conditions.push(eq(projects.status, requestedStatus));
      }
      if (PROJECT_HEALTH_STATUSES.includes(requestedHealth as typeof PROJECT_HEALTH_STATUSES[number])) {
        conditions.push(eq(projects.healthStatus, requestedHealth));
      }

      const managerId = String(req.query.managerId ?? "").trim();
      if (managerId) {
        const matches = await db.select({ projectId: projectManagers.projectId })
          .from(projectManagers).where(eq(projectManagers.userId, managerId));
        if (!matches.length) return res.json([]);
        conditions.push(inArray(projects.id, matches.map(row => row.projectId)));
      }
      const teamMemberId = String(req.query.teamMemberId ?? "").trim();
      if (teamMemberId) {
        const matches = await db.select({ projectId: projectTeamMembers.projectId })
          .from(projectTeamMembers).where(eq(projectTeamMembers.userId, teamMemberId));
        if (!matches.length) return res.json([]);
        conditions.push(inArray(projects.id, matches.map(row => row.projectId)));
      }
      const search = String(req.query.search ?? "").trim();
      if (search) {
        const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
        conditions.push(or(
          ilike(projects.title, pattern),
          ilike(projects.name, pattern),
          ilike(projects.description, pattern),
        )!);
      }

      const rows = await db.select().from(projects)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(projects.updatedAt), desc(projects.createdAt));
      const ids = rows.map(row => row.id);
  const [managerRows, teamCountRows] = ids.length ? await Promise.all([
    db.select({
      projectId: projectManagers.projectId,
      userId: projectManagers.userId,
      isPrimary: projectManagers.isPrimary,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
    }).from(projectManagers).innerJoin(users, eq(projectManagers.userId, users.id))
      .where(inArray(projectManagers.projectId, ids)),
    db.select({
      projectId: projectTeamMembers.projectId,
      teamCount: count(),
    }).from(projectTeamMembers)
      .where(inArray(projectTeamMembers.projectId, ids))
      .groupBy(projectTeamMembers.projectId),
  ]) : [[], []];
      const managersByProject = new Map<string, typeof managerRows>();
      for (const row of managerRows) {
        managersByProject.set(row.projectId, [...(managersByProject.get(row.projectId) ?? []), row]);
      }
  const teamCountsByProject = new Map(teamCountRows.map(row => [row.projectId, Number(row.teamCount)]));
      res.json(rows.map(project => ({
        ...project,
        title: project.title || project.name,
    teamCount: teamCountsByProject.get(project.id) ?? 0,
        managers: (managersByProject.get(project.id) ?? []).map(manager => ({
          userId: manager.userId,
          name: displayName(manager),
          isPrimary: manager.isPrimary,
        })),
      })));
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.get("/api/projects/:id", requireAuth, enabled, async (req, res) => {
    try {
      const project = await getProjectDetail(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found." });
      res.json(project);
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.post("/api/projects", requireAuth, enabled, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "User not authenticated." });
    if (!await userCanManageProjects(userId)) {
      return res.status(403).json({ message: "Project management permission is required." });
    }
    const parsed = projectMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid project details.", errors: parsed.error.issues });
    }
    try {
      const assetsEnabled = await isFeatureEnabled("asset_management");
      if (!assetsEnabled && parsed.data.assets.length) return sendFeatureNotEnabled(res, "asset_management");
      const project = await db.transaction(async tx => {
        await validateReferences(tx, parsed.data, assetsEnabled);
        const [created] = await tx.insert(projects)
          .values({ ...coreValues(parsed.data, userId), createdBy: userId })
          .returning();
        await replaceAssignments(tx, created.id, parsed.data, assetsEnabled);
        await replaceMilestones(tx, created.id, parsed.data.milestones);
        return created;
      });
      const detail = await getProjectDetail(project.id);
      await writeProjectAudit(userId, "CREATE", project.id, project.title, req, undefined, detail);
      res.status(201).json(detail);
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.put("/api/projects/:id", requireAuth, enabled, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "User not authenticated." });
    const parsed = projectMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid project details.", errors: parsed.error.issues });
    }
    try {
      const assetsEnabled = await isFeatureEnabled("asset_management");
      if (!assetsEnabled && parsed.data.assets.length) return sendFeatureNotEnabled(res, "asset_management");
      const current = await getProjectDetail(req.params.id);
      if (!current) return res.status(404).json({ message: "Project not found." });
      if (!await userCanManageProject(userId, req.params.id)) {
        return res.status(403).json({ message: "Only an assigned project manager or an administrator can update this project." });
      }

      await db.transaction(async tx => {
        await validateReferences(tx, parsed.data, assetsEnabled);
        const [updated] = await tx.update(projects).set(coreValues(parsed.data))
          .where(eq(projects.id, req.params.id)).returning({ id: projects.id });
        if (!updated) throw new ProjectNotFoundError();
        await replaceAssignments(tx, req.params.id, parsed.data, assetsEnabled);
        await replaceMilestones(tx, req.params.id, parsed.data.milestones);
      });
      const detail = await getProjectDetail(req.params.id);
      await writeProjectAudit(userId, "UPDATE", req.params.id, parsed.data.title, req, current, detail);
      res.json(detail);
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.patch("/api/projects/:id/milestones/:milestoneId", requireAuth, enabled, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "User not authenticated." });
    const parsed = projectMilestoneUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid milestone update.", errors: parsed.error.issues });
    }
    try {
      if (!await userCanManageProject(userId, req.params.id)) {
        return res.status(403).json({ message: "Only an assigned project manager or an administrator can update milestones." });
      }

      const current = await getProjectDetail(req.params.id);
      if (!current) return res.status(404).json({ message: "Project not found." });
      const milestone = current.milestones.find(item => item.id === req.params.milestoneId);
      if (!milestone) return res.status(404).json({ message: "Milestone not found." });

      const [updated] = await db.update(projectMilestones).set({
        status: parsed.data.status,
        completionDate: projectDate(parsed.data.completionDate),
      }).where(and(
        eq(projectMilestones.id, req.params.milestoneId),
        eq(projectMilestones.projectId, req.params.id),
      )).returning({ id: projectMilestones.id });
      if (!updated) return res.status(404).json({ message: "Milestone not found." });

      await writeProjectAudit(
        userId,
        "UPDATE",
        req.params.id,
        current.title,
        req,
        { milestone },
        { milestone: { ...milestone, ...parsed.data } },
      );
      res.json(await getProjectDetail(req.params.id));
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  app.delete("/api/projects/:id", requireAuth, enabled, async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "User not authenticated." });
    try {
      if (!await userCanManageProject(userId, req.params.id)) {
        return res.status(403).json({ message: "A project-management role is required to delete this project." });
      }
      const current = await getProjectDetail(req.params.id);
      if (!current) return res.status(404).json({ message: "Project not found." });
      const [admin, primaryManager] = await Promise.all([
        userCanManageProjects(userId).then(async allowed => {
          if (!allowed) return false;
          const roles = await storage.getUserRoles(userId);
          const permissions = await storage.getUserPermissions(userId);
          return isSystemAdministrator({ roles, permissions });
        }),
        db.select({ userId: projectManagers.userId }).from(projectManagers)
          .where(and(
            eq(projectManagers.projectId, req.params.id),
            eq(projectManagers.userId, userId),
            eq(projectManagers.isPrimary, true),
          )).limit(1),
      ]);
      if (!admin && !primaryManager.length) {
        return res.status(403).json({ message: "Only the primary project manager or an administrator can delete this project." });
      }
      await db.delete(projects).where(eq(projects.id, req.params.id));
      await writeProjectAudit(userId, "DELETE", req.params.id, current.title, req, current);
      res.json({ message: "Project deleted." });
    } catch (error) {
      sendMutationError(error, res);
    }
  });

  registerProjectWorkspaceRoutes(app, requireAuth, enabled);
}
