import { respondWithApiError } from "./api-error-handler";
import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { and, count, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  projectChanges,
  projectDocuments,
  projectManagers,
  projectRisks,
  projectTasks,
  projectTeamMembers,
  projects,
  users,
} from "@shared/schema";
import {
  PROJECT_CHANGE_STATUSES,
  projectChangeInputSchema,
  projectChangeStatusSchema,
  projectChangeUpdateSchema,
  projectDocumentMetadataSchema,
  projectDocumentUpdateSchema,
  projectRiskInputSchema,
  projectRiskUpdateSchema,
  projectTaskInputSchema,
  projectTaskReorderSchema,
  projectTaskUpdateSchema,
  projectTaskWorkUpdateSchema,
} from "@shared/project-management";
import { isPersonaApiAllowed, isSystemAdministrator } from "@shared/personas";
import { db } from "./db";
import { storage } from "./storage";

type ProjectRequest = Request & { user?: { id?: string } };
type ProjectTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const uploadExtensions = new Set(["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "txt", "md", "csv", "conf", "ini"]);
const documentRoot = resolve(process.env.PROJECT_DOCUMENT_UPLOAD_DIR || "server/uploads/project-documents");
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    if (!uploadExtensions.has(extension)) {
      callback(new Error("Supported project documents: PDF, DOCX, XLSX, images, TXT, MD, CSV, CONF, and INI."));
      return;
    }
    callback(null, true);
  },
});

class WorkspaceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function text(value: unknown, maximum = 160) {
  return String(value ?? "").trim().slice(0, maximum);
}

function safeFileName(value: string) {
  return basename(value.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").slice(0, 255) || "project-document";
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
}

async function access(userId: string) {
  const [roles, permissions] = await Promise.all([
    storage.getUserRoles(userId),
    storage.getUserPermissions(userId),
  ]);
  return {
    roles,
    permissions,
    mutable: isPersonaApiAllowed(roles.map(role => role.name), permissions, "/projects", "POST"),
    admin: isSystemAdministrator({ roles, permissions }),
    globalManager: permissions.includes("project_manage") || isSystemAdministrator({ roles, permissions }),
    globalViewer: permissions.includes("project_view") || permissions.includes("project_manage") ||
      isSystemAdministrator({ roles, permissions }),
  };
}

async function canViewProject(userId: string, projectId: string) {
  const rights = await access(userId);
  if (rights.globalViewer) return true;
  const [membership] = await db.select({ projectId: projects.id }).from(projects)
    .leftJoin(projectManagers, eq(projectManagers.projectId, projects.id))
    .leftJoin(projectTeamMembers, eq(projectTeamMembers.projectId, projects.id))
    .leftJoin(projectTasks, and(
      eq(projectTasks.projectId, projects.id),
      eq(projectTasks.assigneeId, userId),
    ))
    .where(and(
      eq(projects.id, projectId),
      or(
        eq(projectManagers.userId, userId),
        eq(projectTeamMembers.userId, userId),
        eq(projectTasks.assigneeId, userId),
      ),
    ))
    .limit(1);
  return Boolean(membership);
}

async function canManageProject(userId: string, projectId: string) {
  const rights = await access(userId);
  if (!rights.mutable) return false;
  if (rights.globalManager) return true;
  const [manager] = await db.select({ projectId: projectManagers.projectId }).from(projectManagers)
    .where(and(eq(projectManagers.projectId, projectId), eq(projectManagers.userId, userId)))
    .limit(1);
  return Boolean(manager);
}

async function requireProjectView(userId: string | undefined, projectId: string, res: Response) {
  if (!userId) {
    res.status(401).json({ message: "Authentication required." });
    return false;
  }
  try {
    if (await canViewProject(userId, projectId)) return true;
    res.status(403).json({ message: "Project access is required." });
    return false;
  } catch (error) {
    sendError(error, res);
    return false;
  }
}

async function requireProjectManager(userId: string | undefined, projectId: string, res: Response) {
  if (!userId) {
    res.status(401).json({ message: "Authentication required." });
    return false;
  }
  try {
    if (await canManageProject(userId, projectId)) return true;
    res.status(403).json({ message: "Only an assigned project manager or administrator can make this change." });
    return false;
  } catch (error) {
    sendError(error, res);
    return false;
  }
}

async function writeAudit(
  tx: ProjectTx,
  req: Request,
  actorId: string,
  action: string,
  tableName: string,
  recordId: string,
  recordName: string,
  oldValues?: unknown,
  newValues?: unknown,
) {
  await tx.insert(auditLogs).values({
    userId: actorId,
    action,
    tableName,
    recordId,
    recordName,
    oldValues: oldValues === undefined ? null : JSON.stringify(oldValues),
    newValues: newValues === undefined ? null : JSON.stringify(newValues),
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}
function sendError(error: unknown, res: Response) {
  if (error instanceof WorkspaceError) return res.status(error.status).json({ message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid project data.", errors: error.issues });
  const code = (error as { code?: string })?.code;
  if (code === "23505") return res.status(409).json({ message: "A record with that reference already exists." });
  if (code === "23514") return res.status(400).json({ message: "The values do not meet the required project constraints." });
  console.error("Project workspace operation failed:", error);
  return respondWithApiError(res, error, "Project operation failed.");
}

async function validateActiveUser(id: string | null | undefined, message: string) {
  if (!id) return;
  const [active] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, id), eq(users.isActive, true))).limit(1);
  if (!active) throw new WorkspaceError(400, message);
}

function reportName(person: { firstName?: string | null; lastName?: string | null; username?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.username || "Unnamed user";
}

function projectDocumentView(row: typeof projectDocuments.$inferSelect, uploadedByName: string | null) {
  const { filePath: _filePath, ...safe } = row;
  return { ...safe, uploadedByName };
}

export function registerProjectWorkspaceRoutes(app: Express, requireAuth: RequestHandler, enabled: RequestHandler) {
  const requireDocumentFile: RequestHandler = (req, res, next) => {
    documentUpload.single("file")(req, res, error => {
      if (!error) return next();
      const tooLarge = (error as NodeJS.ErrnoException).code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        message: tooLarge ? "Project documents must be 20 MB or smaller." : error.message || "Choose a supported project document.",
      });
    });
  };

  app.get("/api/projects/:id/tasks", requireAuth, enabled, async (req: ProjectRequest, res) => {
    if (!await requireProjectView(req.user?.id, req.params.id, res)) return;
    try {
      const query = z.object({
        status: z.string().trim().max(50).optional(),
        assigneeId: z.string().trim().max(100).optional(),
        search: z.string().trim().max(160).optional(),
      }).parse(req.query);
      const search = query.search?.replace(/[\\%_]/g, "\\$&");
      const rows = await db.select({
        ...getTableColumns(projectTasks),
        assigneeName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      }).from(projectTasks).leftJoin(users, eq(projectTasks.assigneeId, users.id))
        .where(and(
          eq(projectTasks.projectId, req.params.id),
          query.status && query.status !== "all" ? eq(projectTasks.status, query.status) : undefined,
          query.assigneeId ? eq(projectTasks.assigneeId, query.assigneeId) : undefined,
          search ? or(ilike(projectTasks.title, `%${search}%`), ilike(projectTasks.description, `%${search}%`)) : undefined,
        )).orderBy(projectTasks.sortOrder, projectTasks.dueDate, projectTasks.createdAt);
      res.json(rows);
    } catch (error) { sendError(error, res); }
  });

  app.post("/api/projects/:id/tasks", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const input = projectTaskInputSchema.parse(req.body);
      await validateActiveUser(input.assigneeId, "Choose an active task assignee.");
      const [created] = await db.transaction(async tx => {
        const [row] = await tx.insert(projectTasks).values({
          projectId: req.params.id,
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId ?? null,
          estimatedHours: input.estimatedHours.toFixed(2),
          loggedHours: input.loggedHours.toFixed(2),
          dueDate: toTimestamp(input.dueDate),
          sortOrder: input.sortOrder,
        }).returning();
        await writeAudit(tx, req, actorId!, "CREATE", "project_tasks", row.id, row.title, undefined, row);
        return [row];
      });
      res.status(201).json(created);
    } catch (error) { sendError(error, res); }
  });

  app.patch("/api/projects/:id/tasks/reorder", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const { taskIds } = projectTaskReorderSchema.parse(req.body);
      const current = await db.select({ id: projectTasks.id }).from(projectTasks)
        .where(eq(projectTasks.projectId, req.params.id));
      if (current.length !== taskIds.length || current.some(task => !taskIds.includes(task.id))) {
        throw new WorkspaceError(400, "The new order must include every task in this project exactly once.");
      }
      await db.transaction(async tx => {
      for (let sortOrder = 0; sortOrder < taskIds.length; sortOrder += 1) {
        const taskId = taskIds[sortOrder];
          await tx.update(projectTasks).set({ sortOrder }).where(and(
            eq(projectTasks.projectId, req.params.id), eq(projectTasks.id, taskId),
          ));
        }
        await writeAudit(tx, req, actorId!, "REORDER", "project_tasks", req.params.id, "Project task order", undefined, { taskIds });
      });
      res.json({ success: true });
    } catch (error) { sendError(error, res); }
  });

  app.patch("/api/projects/:id/tasks/:taskId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ message: "Authentication required." });
    try {
      if (!(await access(actorId)).mutable) return res.status(403).json({ message: "Read-only accounts cannot update project tasks." });
      const [current] = await db.select().from(projectTasks).where(and(
        eq(projectTasks.id, req.params.taskId), eq(projectTasks.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project task not found." });
      const canManage = await canManageProject(actorId, req.params.id);
      let input: Partial<z.infer<typeof projectTaskUpdateSchema>>;
      if (canManage) input = projectTaskUpdateSchema.parse(req.body);
      else input = projectTaskWorkUpdateSchema.parse(req.body);
      if (!canManage && current.assigneeId !== actorId) {
        return res.status(403).json({ message: "Only a project manager or the assigned task owner can update this task." });
      }
      if (canManage && input.assigneeId !== undefined) await validateActiveUser(input.assigneeId, "Choose an active task assignee.");
      const values: Record<string, unknown> = {};
      if (input.title !== undefined) values.title = input.title;
      if (input.description !== undefined) values.description = input.description || null;
      if (input.status !== undefined) values.status = input.status;
      if (input.priority !== undefined) values.priority = input.priority;
      if (input.assigneeId !== undefined) values.assigneeId = input.assigneeId;
      if (input.estimatedHours !== undefined) values.estimatedHours = input.estimatedHours.toFixed(2);
      if (input.loggedHours !== undefined) values.loggedHours = input.loggedHours.toFixed(2);
      if (input.dueDate !== undefined) values.dueDate = toTimestamp(input.dueDate);
      if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
      const [updated] = await db.transaction(async tx => {
        const [row] = await tx.update(projectTasks).set(values).where(and(
          eq(projectTasks.id, current.id), eq(projectTasks.projectId, req.params.id),
        )).returning();
        await writeAudit(tx, req, actorId, "UPDATE", "project_tasks", current.id, current.title, current, row);
        return [row];
      });
      res.json(updated);
    } catch (error) { sendError(error, res); }
  });

  app.delete("/api/projects/:id/tasks/:taskId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const [current] = await db.select().from(projectTasks).where(and(
        eq(projectTasks.id, req.params.taskId), eq(projectTasks.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project task not found." });
      await db.transaction(async tx => {
        await tx.delete(projectTasks).where(eq(projectTasks.id, current.id));
        await writeAudit(tx, req, actorId!, "DELETE", "project_tasks", current.id, current.title, current);
      });
      res.json({ success: true });
    } catch (error) { sendError(error, res); }
  });

  app.get("/api/projects/:id/risks", requireAuth, enabled, async (req: ProjectRequest, res) => {
    if (!await requireProjectView(req.user?.id, req.params.id, res)) return;
    try {
      const query = z.object({
        status: z.string().trim().max(50).optional(),
        category: z.string().trim().max(50).optional(),
        search: z.string().trim().max(160).optional(),
      }).parse(req.query);
      const search = query.search?.replace(/[\\%_]/g, "\\$&");
      const rows = await db.select({
        ...getTableColumns(projectRisks),
        ownerName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      }).from(projectRisks).leftJoin(users, eq(projectRisks.ownerId, users.id))
        .where(and(
          eq(projectRisks.projectId, req.params.id),
          query.status && query.status !== "all" ? eq(projectRisks.status, query.status) : undefined,
          query.category && query.category !== "all" ? eq(projectRisks.category, query.category) : undefined,
          search ? or(ilike(projectRisks.title, `%${search}%`), ilike(projectRisks.description, `%${search}%`),
            ilike(projectRisks.mitigationStrategy, `%${search}%`)) : undefined,
        )).orderBy(desc(projectRisks.riskScore), desc(projectRisks.createdAt));
      res.json(rows);
    } catch (error) { sendError(error, res); }
  });

  app.post("/api/projects/:id/risks", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const input = projectRiskInputSchema.parse(req.body);
      await validateActiveUser(input.ownerId, "Choose an active risk owner.");
      const [created] = await db.transaction(async tx => {
        const [row] = await tx.insert(projectRisks).values({
          projectId: req.params.id,
          title: input.title,
          description: input.description || null,
          category: input.category,
          probability: input.probability,
          impact: input.impact,
          residualProbability: input.residualProbability ?? null,
          residualImpact: input.residualImpact ?? null,
          mitigationStrategy: input.mitigationStrategy || null,
          contingencyPlan: input.contingencyPlan || null,
          reviewDate: input.reviewDate || null,
          status: input.status,
          ownerId: input.ownerId ?? null,
        }).returning();
        await writeAudit(tx, req, actorId!, "CREATE", "project_risks", row.id, row.title, undefined, row);
        return [row];
      });
      res.status(201).json(created);
    } catch (error) { sendError(error, res); }
  });

  app.patch("/api/projects/:id/risks/:riskId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ message: "Authentication required." });
    try {
      if (!(await access(actorId)).mutable) return res.status(403).json({ message: "Read-only accounts cannot update project risks." });
      const [current] = await db.select().from(projectRisks).where(and(
        eq(projectRisks.id, req.params.riskId), eq(projectRisks.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project risk not found." });
      const canManage = await canManageProject(actorId, req.params.id);
      if (!canManage && current.ownerId !== actorId) {
        return res.status(403).json({ message: "Only a project manager or the risk owner can update this risk." });
      }
      const input = projectRiskUpdateSchema.parse(req.body);
      if (!canManage && Object.keys(input).some(key => ![
        "mitigationStrategy", "contingencyPlan", "residualProbability", "residualImpact", "reviewDate", "status",
      ].includes(key))) {
        return res.status(403).json({ message: "Risk owners may update response plans, residual exposure, review date, and status only." });
      }
      if (canManage) await validateActiveUser(input.ownerId, "Choose an active risk owner.");
      const values: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of [
        "title", "category", "probability", "impact", "residualProbability",
        "residualImpact", "status",
      ] as const) {
        if (input[key] !== undefined) values[key] = input[key];
      }
      if (input.description !== undefined) values.description = input.description || null;
      if (input.mitigationStrategy !== undefined) values.mitigationStrategy = input.mitigationStrategy || null;
      if (input.contingencyPlan !== undefined) values.contingencyPlan = input.contingencyPlan || null;
      if (input.reviewDate !== undefined) values.reviewDate = input.reviewDate || null;
      if (input.ownerId !== undefined) values.ownerId = input.ownerId;
      const [updated] = await db.transaction(async tx => {
        const [row] = await tx.update(projectRisks).set(values).where(and(
          eq(projectRisks.id, current.id), eq(projectRisks.projectId, req.params.id),
        )).returning();
        await writeAudit(tx, req, actorId, "UPDATE", "project_risks", current.id, current.title, current, row);
        return [row];
      });
      res.json(updated);
    } catch (error) { sendError(error, res); }
  });

  app.delete("/api/projects/:id/risks/:riskId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const [current] = await db.select().from(projectRisks).where(and(
        eq(projectRisks.id, req.params.riskId), eq(projectRisks.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project risk not found." });
      await db.transaction(async tx => {
        await tx.delete(projectRisks).where(eq(projectRisks.id, current.id));
        await writeAudit(tx, req, actorId!, "DELETE", "project_risks", current.id, current.title, current);
      });
      res.json({ success: true });
    } catch (error) { sendError(error, res); }
  });

  app.get("/api/projects/:id/changes", requireAuth, enabled, async (req: ProjectRequest, res) => {
    if (!await requireProjectView(req.user?.id, req.params.id, res)) return;
    try {
      const rows = await db.select({
        ...getTableColumns(projectChanges),
        requestedByName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      }).from(projectChanges).leftJoin(users, eq(projectChanges.requestedBy, users.id))
        .where(eq(projectChanges.projectId, req.params.id))
        .orderBy(desc(projectChanges.createdAt));
      res.json(rows);
    } catch (error) { sendError(error, res); }
  });

  app.post("/api/projects/:id/changes", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const input = projectChangeInputSchema.parse(req.body);
      const [created] = await db.transaction(async tx => {
        const [row] = await tx.insert(projectChanges).values({
          projectId: req.params.id,
          ...input,
          requestedBy: actorId!,
          status: "Draft",
        }).returning();
        await writeAudit(tx, req, actorId!, "CREATE", "project_changes", row.id, row.rfcNumber, undefined, row);
        return [row];
      });
      res.status(201).json(created);
    } catch (error) { sendError(error, res); }
  });

  app.patch("/api/projects/:id/changes/:changeId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const input = projectChangeUpdateSchema.parse(req.body);
      const [current] = await db.select().from(projectChanges).where(and(
        eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project RFC not found." });
      if (!["Draft", "Rejected"].includes(current.status)) {
        return res.status(409).json({ message: "Only draft or rejected RFC content may be edited." });
      }
      const values = {
        ...input,
        ...(input.reason !== undefined ? { reason: input.reason || null } : {}),
        ...(input.impactAnalysis !== undefined ? { impactAnalysis: input.impactAnalysis || null } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db.transaction(async tx => {
        const [row] = await tx.update(projectChanges).set(values).where(and(
          eq(projectChanges.id, current.id), eq(projectChanges.status, current.status),
        )).returning();
        if (!row) throw new WorkspaceError(409, "This RFC was updated by another user. Refresh before editing.");
        await writeAudit(tx, req, actorId!, "UPDATE", "project_changes", current.id, current.rfcNumber, current, row);
        return [row];
      });
      res.json(updated);
    } catch (error) { sendError(error, res); }
  });

  app.delete("/api/projects/:id/changes/:changeId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const [current] = await db.select().from(projectChanges).where(and(
        eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project RFC not found." });
      if (!["Draft", "Rejected"].includes(current.status)) {
        return res.status(409).json({ message: "Only draft or rejected project RFCs can be deleted." });
      }
      await db.transaction(async tx => {
        const deleted = await tx.delete(projectChanges).where(and(
          eq(projectChanges.id, current.id), eq(projectChanges.status, current.status),
        )).returning({ id: projectChanges.id });
        if (!deleted.length) throw new WorkspaceError(409, "This RFC changed while it was being deleted. Refresh the log.");
        await writeAudit(tx, req, actorId!, "DELETE", "project_changes", current.id, current.rfcNumber, current);
      });
      res.json({ success: true });
    } catch (error) { sendError(error, res); }
  });

  app.post("/api/projects/:id/changes/:changeId/status", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const { status } = projectChangeStatusSchema.parse(req.body);
      const [current] = await db.select().from(projectChanges).where(and(
        eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project RFC not found." });
      const transitions: Record<typeof PROJECT_CHANGE_STATUSES[number], readonly string[]> = {
        Draft: ["Submitted"],
        Submitted: ["Approved", "Rejected"],
        Approved: ["Implemented"],
        Rejected: ["Draft"],
        Implemented: [],
      };
      if (!transitions[current.status as keyof typeof transitions]?.includes(status)) {
        return res.status(409).json({ message: `The RFC cannot transition from ${current.status} to ${status}.` });
      }
      const [updated] = await db.transaction(async tx => {
        const [row] = await tx.update(projectChanges).set({ status, updatedAt: new Date() })
          .where(and(eq(projectChanges.id, current.id), eq(projectChanges.status, current.status))).returning();
        if (!row) throw new WorkspaceError(409, "This RFC status changed. Refresh before continuing.");
        await writeAudit(tx, req, actorId!, "STATUS_CHANGE", "project_changes", current.id, current.rfcNumber,
          { status: current.status }, { status: row.status });
        return [row];
      });
      res.json(updated);
    } catch (error) { sendError(error, res); }
  });

  app.get("/api/projects/:id/documents", requireAuth, enabled, async (req: ProjectRequest, res) => {
    if (!await requireProjectView(req.user?.id, req.params.id, res)) return;
    try {
      const rows = await db.select({
        document: projectDocuments,
        uploadedByName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      }).from(projectDocuments).leftJoin(users, eq(projectDocuments.uploadedBy, users.id))
        .where(eq(projectDocuments.projectId, req.params.id))
        .orderBy(desc(projectDocuments.createdAt));
      res.json(rows.map(row => projectDocumentView(row.document, row.uploadedByName)));
    } catch (error) { sendError(error, res); }
  });

  app.post("/api/projects/:id/documents", requireAuth, enabled, requireDocumentFile, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    const file = (req as ProjectRequest & { file?: Express.Multer.File }).file;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    if (!file) return res.status(400).json({ message: "Choose a document file to upload." });
    let input: z.infer<typeof projectDocumentMetadataSchema>;
    try {
      input = projectDocumentMetadataSchema.parse({
        name: req.body.name || safeFileName(file.originalname),
        version: req.body.version || "1.0",
        category: req.body.category || "Charter",
      });
    } catch (error) { return sendError(error, res); }
    const id = randomUUID();
    const originalName = safeFileName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const storedPath = resolve(documentRoot, `${id}${extension}`);
    const fileUrl = `/api/projects/${req.params.id}/documents/${id}/download`;
    try {
      await mkdir(documentRoot, { recursive: true });
      await writeFile(storedPath, file.buffer, { flag: "wx" });
      const document = await db.transaction(async tx => {
        const [row] = await tx.insert(projectDocuments).values({
          id,
          projectId: req.params.id,
          name: input.name,
          version: input.version,
          fileUrl,
          category: input.category,
          uploadedBy: actorId!,
          filePath: storedPath,
          originalName,
          mimeType: file.mimetype || "application/octet-stream",
          fileSize: file.size,
        }).returning();
        await writeAudit(tx, req, actorId!, "CREATE", "project_documents", row.id, row.name, undefined, {
          ...row,
          filePath: undefined,
        });
        return row;
      });
      res.status(201).json(projectDocumentView(document, null));
    } catch (error) {
      await unlink(storedPath).catch(() => {});
      sendError(error, res);
    }
  });

  app.patch("/api/projects/:id/documents/:documentId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const input = projectDocumentUpdateSchema.parse(req.body);
      const [updated] = await db.transaction(async tx => {
        const [current] = await tx.select().from(projectDocuments).where(and(
          eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id),
        )).limit(1).for("update");
        if (!current) throw new WorkspaceError(404, "Project document not found.");
        const [row] = await tx.update(projectDocuments).set(input).where(eq(projectDocuments.id, current.id)).returning();
        const { filePath: _oldPath, ...before } = current;
        const { filePath: _newPath, ...after } = row;
        await writeAudit(tx, req, actorId!, "UPDATE", "project_documents", row.id, row.name, before, after);
        return [row];
      });
      res.json(projectDocumentView(updated, null));
    } catch (error) { sendError(error, res); }
  });

  app.get("/api/projects/:id/documents/:documentId/download", requireAuth, enabled, async (req: ProjectRequest, res) => {
    if (!await requireProjectView(req.user?.id, req.params.id, res)) return;
    try {
      const [document] = await db.select().from(projectDocuments).where(and(
        eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id),
      )).limit(1);
      if (!document) return res.status(404).json({ message: "Project document not found." });
      res.download(document.filePath, document.originalName, error => {
        if (error && !res.headersSent) res.status(404).json({ message: "Project document file is unavailable." });
      });
    } catch (error) { sendError(error, res); }
  });

  app.delete("/api/projects/:id/documents/:documentId", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const actorId = req.user?.id;
    if (!await requireProjectManager(actorId, req.params.id, res)) return;
    try {
      const [current] = await db.select().from(projectDocuments).where(and(
        eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id),
      )).limit(1);
      if (!current) return res.status(404).json({ message: "Project document not found." });
      await db.transaction(async tx => {
        await tx.delete(projectDocuments).where(eq(projectDocuments.id, current.id));
        await writeAudit(tx, req, actorId!, "DELETE", "project_documents", current.id, current.name, {
          ...current,
          filePath: undefined,
        });
      });
      await unlink(current.filePath).catch(error => console.warn("Could not remove project document file:", error));
      res.json({ success: true });
    } catch (error) { sendError(error, res); }
  });

  app.get("/api/reports/project-allocations", requireAuth, enabled, async (req: ProjectRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Authentication required." });
    try {
      const rights = await access(userId);
      if (!rights.globalViewer) return res.status(403).json({ message: "Project reporting permission is required." });
      const [teamAssignments, managerAssignments, taskAssignments] = await Promise.all([
        db.select({
          projectId: projectTeamMembers.projectId,
          projectTitle: projects.title,
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          roleTitle: projectTeamMembers.roleTitle,
        }).from(projectTeamMembers)
          .innerJoin(projects, eq(projectTeamMembers.projectId, projects.id))
          .innerJoin(users, eq(projectTeamMembers.userId, users.id)),
        db.select({
          projectId: projectManagers.projectId,
          projectTitle: projects.title,
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
        }).from(projectManagers)
          .innerJoin(projects, eq(projectManagers.projectId, projects.id))
          .innerJoin(users, eq(projectManagers.userId, users.id)),
        db.select({
          projectId: projectTasks.projectId,
          projectTitle: projects.title,
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          taskCount: count(projectTasks.id),
          estimatedHours: sql<string>`coalesce(sum(${projectTasks.estimatedHours}), 0)`,
          loggedHours: sql<string>`coalesce(sum(${projectTasks.loggedHours}), 0)`,
        }).from(projectTasks)
          .innerJoin(projects, eq(projectTasks.projectId, projects.id))
          .innerJoin(users, eq(projectTasks.assigneeId, users.id))
          .groupBy(projectTasks.projectId, projects.title, users.id, users.firstName, users.lastName, users.username),
      ]);
      type ProjectAllocation = {
        projectId: string;
        projectTitle: string;
        roleTitle: string;
        taskCount: number;
        estimatedHours: number;
        loggedHours: number;
      };
      type UserAllocation = {
        userId: string;
        name: string;
        username: string;
        projects: Map<string, ProjectAllocation>;
      };
      const allocations = new Map<string, UserAllocation>();
      const ensure = (person: {
        userId: string;
        projectId: string;
        projectTitle: string;
        firstName: string | null;
        lastName: string | null;
        username: string | null;
      }) => {
        let user = allocations.get(person.userId);
        if (!user) {
          user = { userId: person.userId, name: reportName(person), username: person.username ?? "", projects: new Map() };
          allocations.set(person.userId, user);
        }
        let project = user.projects.get(person.projectId);
        if (!project) {
          project = { projectId: person.projectId, projectTitle: person.projectTitle, roleTitle: "", taskCount: 0, estimatedHours: 0, loggedHours: 0 };
          user.projects.set(person.projectId, project);
        }
        return { user, project };
      };
      for (const row of teamAssignments) {
        const { project } = ensure(row);
        project.roleTitle = row.roleTitle;
      }
      for (const row of managerAssignments) {
        const { project } = ensure(row);
        project.roleTitle = project.roleTitle ? `${project.roleTitle}, Project Manager` : "Project Manager";
      }
      for (const row of taskAssignments) {
        const { project } = ensure(row);
        project.taskCount = Number(row.taskCount);
        project.estimatedHours = Number(row.estimatedHours);
        project.loggedHours = Number(row.loggedHours);
        if (!project.roleTitle) project.roleTitle = "Task Assignee";
      }
      const search = text(req.query.search, 120).toLowerCase();
      const report = Array.from(allocations.values()).map(user => {
        const projects = Array.from(user.projects.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
        return {
          userId: user.userId,
          name: user.name,
          username: user.username,
          projectCount: projects.length,
          taskCount: projects.reduce((total, project) => total + project.taskCount, 0),
          estimatedHours: projects.reduce((total, project) => total + project.estimatedHours, 0),
          loggedHours: projects.reduce((total, project) => total + project.loggedHours, 0),
          projects,
        };
      }).filter(user => !search || `${user.name} ${user.username} ${user.projects.map(project => project.projectTitle).join(" ")}`.toLowerCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ rows: report, total: report.length, generatedAt: new Date().toISOString() });
    } catch (error) { sendError(error, res); }
  });
}
