import { respondWithApiError } from "./api-error-handler";
import type { Express, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs, catalogItems, consumables, dropdownOptions, projects, projectManagers, projectTeamMembers, projectTasks,
  serviceCatalogItems, serviceRequestActivities, serviceRequests, serviceRequestsApprovals, users,
} from "@shared/schema";
import {
  canManageServiceCatalog, catalogDecisionInput, catalogRequestInput, serviceApprovalRoles,
  structuredCatalogInput, validateCatalogValues,
} from "@shared/service-catalog";
import { db } from "./db";
import { storage } from "./storage";
import { personaRolesForUser } from "@shared/personas";
export { catalogMutationError } from "@shared/service-catalog";

type Viewer = { id: string; employeeId: string | null; roles: { name: string }[]; permissions: string[] };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
class CatalogError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function loadCatalogViewer(req: Request): Promise<Viewer> {
  if (!req.user?.id) throw new CatalogError(401, "Authentication required");
  const [roles, permissions, account] = await Promise.all([
    storage.getUserRoles(req.user.id),
    storage.getUserPermissions(req.user.id),
    storage.getUser(req.user.id),
  ]);
  return { id: req.user.id, employeeId: account?.employeeId ?? null, roles, permissions };
}
function isEmployeeOnlyService(item: { category: string; consumableId?: string | null }) {
  return Boolean(item.consumableId) || /^(hardware|equipment|asset)$/i.test(item.category.trim());
}
async function assignedProjectsForUser(userId: string) {
  const projectsForUser = await db.select({ id: projects.id, name: projects.name }).from(projects)
    .leftJoin(projectManagers, eq(projectManagers.projectId, projects.id))
    .leftJoin(projectTeamMembers, eq(projectTeamMembers.projectId, projects.id))
    .leftJoin(projectTasks, and(eq(projectTasks.projectId, projects.id), eq(projectTasks.assigneeId, userId)))
    .where(and(eq(projects.isActive, true), or(
      eq(projectManagers.userId, userId),
      eq(projectTeamMembers.userId, userId),
      eq(projectTasks.assigneeId, userId),
    )))
    .orderBy(asc(projects.name));
  return [...new Map(projectsForUser.map(project => [project.id, project])).values()];
}
function handle(handler: (req: Request, res: Response, user: Viewer) => Promise<void>): RequestHandler {
  return async (req, res) => {
    try { await handler(req, res, await loadCatalogViewer(req)); }
    catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ message: "Invalid catalog data", errors: error.issues }); return; }
      if (error instanceof CatalogError) { res.status(error.status).json({ message: error.message }); return; }
      console.error("Service catalog operation failed:", error instanceof Error ? error.message : "Unknown error");
      respondWithApiError(res, error, "Service catalog operation failed");
    }
  };
}
async function audit(tx: Transaction, req: Request, user: Viewer, tableName: string, recordId: string, values: unknown, action = "CREATE") {
  await tx.insert(auditLogs).values({
    userId: user.id, action, tableName, recordId, newValues: JSON.stringify(values),
    ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null,
  });
}
export async function isStructuredCatalogItem(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  return (await db.select({ id: serviceCatalogItems.id }).from(serviceCatalogItems).where(eq(serviceCatalogItems.id, id))).length > 0;
}

// Compatibility adapter for legacy catalog management. Both records share their ID.
export async function syncLegacyCatalogItem(id: string) {
  const [legacy] = await db.select().from(catalogItems).where(eq(catalogItems.id, id));
  if (!legacy) return;
  const categories: Record<string, string> = { hardware: "Hardware", software: "Software", access: "Access", network: "Infrastructure", facilities: "Infrastructure" };
  const values = {
    id, title: legacy.name, category: categories[legacy.category.toLowerCase()] ?? legacy.category,
    description: legacy.description, icon: legacy.icon, slaHours: Math.max(1, legacy.slaHours || 24),
    requiresApproval: legacy.approvalRequired ?? false,
    approverRole: legacy.approvalRequired ? "Manager" : null,
    status: legacy.isActive ? "Active" : "Inactive",
  };
  // Never overwrite a configured schema or director-level approval with the old editor.
  await db.insert(serviceCatalogItems).values(values).onConflictDoNothing();
}

export const catalogRequestHandler = handle(async (req, res, user) => {
  const input = catalogRequestInput.parse(req.body);
  const result = await db.transaction(async tx => {
    const [item] = await tx.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.id, req.params.id)).for("share");
    if (!item || item.status !== "Active") throw new CatalogError(404, "Active catalog service not found");
    const [legacy] = await tx.select({ fulfillmentTeam: catalogItems.fulfillmentTeam, consumableId: catalogItems.consumableId }).from(catalogItems).where(eq(catalogItems.id, item.id));
    if (!user.employeeId && !canManageServiceCatalog(user) && isEmployeeOnlyService({ category: item.category, consumableId: legacy?.consumableId }))
      throw new CatalogError(404, "This service is available only to linked employees");
    const isEndUser = personaRolesForUser(user).includes("end_user");
    const projectChoice = input.projectId ?? item.projectId;
    const assignedProjects = isEndUser && (!user.employeeId || projectChoice)
      ? await assignedProjectsForUser(user.id)
      : [];
    const assignedProjectIds = new Set(assignedProjects.map(project => project.id));
    if (isEndUser && item.projectId && !assignedProjectIds.has(item.projectId))
      throw new CatalogError(404, "This service is not available to your assigned projects");
    const selectedProjectId = input.projectId ?? item.projectId ??
      (!user.employeeId && assignedProjects.length === 1 ? assignedProjects[0].id : null);
    if (isEndUser && selectedProjectId && !assignedProjectIds.has(selectedProjectId))
      throw new CatalogError(403, "Choose a project assigned to your account");
    if (isEndUser && !user.employeeId && assignedProjects.length > 0 && !selectedProjectId)
      throw new CatalogError(400, "Select one of your assigned projects for this request");
    if (item.projectId && selectedProjectId !== item.projectId)
      throw new CatalogError(400, "This catalog service is scoped to a different project");
    const values = validateCatalogValues(item.customFieldsSchema, input.fieldValues);
    const requesterId = input.requesterId ?? user.id;
    if (requesterId !== user.id) {
      if (!canManageServiceCatalog(user) && !personaRolesForUser(user).includes("it_agent") && !user.permissions.includes("ticket_manage"))
        throw new CatalogError(403, "Only IT staff may submit on behalf of another employee");
      const [employee] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, requesterId), eq(users.isActive, true)));
      if (!employee) throw new CatalogError(400, "Requested-for user must be active");
    }
    if (selectedProjectId && !(await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, selectedProjectId))).length)
      throw new CatalogError(400, "Project not found");
    const dueAt = new Date(Date.now() + item.slaHours * 3600000);
    const [request] = await tx.insert(serviceRequests).values({
      requestNumber: `SR-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: input.title ?? item.title, description: input.description || item.description || `Requested service: ${item.title}`,
      requesterId, creatorId: user.id, catalogItemId: item.id, serviceCatalogItemId: item.id,
      projectId: selectedProjectId, cost: input.cost ?? 0, requestedQuantity: input.requestedQuantity ?? 1,
      targetFulfillmentDate: input.targetFulfillmentDate ?? null,
      customFieldValues: values, catalogSchemaSnapshot: item.customFieldsSchema,
      approvalStatus: item.requiresApproval ? "pending" : "approved",
      fulfillmentStage: item.requiresApproval ? "Pending Approval" : "Submitted",
      fulfillmentStatus: "Submitted", category: item.category, fulfillmentDueAt: dueAt,
      assignmentGroup: item.requiresApproval ? null : legacy?.fulfillmentTeam ?? null,
    }).returning();
    let approval: typeof serviceRequestsApprovals.$inferSelect | null = null;
    if (item.requiresApproval) {
      [approval] = await tx.insert(serviceRequestsApprovals).values({
        ticketId: request.id, approverRole: item.approverRole!, status: "Pending",
      }).returning();
    }
    await tx.insert(serviceRequestActivities).values({
      serviceRequestId: request.id, actorId: user.id, action: "Catalog request submitted",
      details: item.requiresApproval ? `Awaiting ${item.approverRole} approval` : "No approval required; ready for fulfillment",
    });
    await audit(tx, req, user, "service_requests", request.id, { request, approval });
    return { request, approval };
  });
  res.status(201).json(result);
});

export function registerServiceCatalogRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/service-catalog/options", requireAuth, handle(async (_req, res, user) => {
    const categories = await db.select({ value: dropdownOptions.value, label: dropdownOptions.label })
      .from(dropdownOptions).where(and(eq(dropdownOptions.category, "service_category"), eq(dropdownOptions.isActive, true)))
      .orderBy(dropdownOptions.displayOrder, dropdownOptions.label);
    const canManage = canManageServiceCatalog(user);
    const availableProjects = canManage
      ? await db.select({ id: projects.id, name: projects.name }).from(projects)
        .where(eq(projects.isActive, true)).orderBy(asc(projects.name))
      : [];
    res.json({ canManage, canApprove: serviceApprovalRoles(user).length > 0, categories, projects: availableProjects });
  }));
  app.get("/api/service-catalog/items", requireAuth, handle(async (req, res, user) => {
    const includeInactive = req.query.includeInactive === "true" && canManageServiceCatalog(user);
    const rows = await db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam })
      .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.id))
      .where(includeInactive ? undefined : eq(serviceCatalogItems.status, "Active")).orderBy(serviceCatalogItems.category, serviceCatalogItems.title);
    let visibleRows = user.employeeId || canManageServiceCatalog(user)
      ? rows
      : rows.filter(item => !isEmployeeOnlyService(item));
    if (personaRolesForUser(user).includes("end_user")) {
      const assigned = new Set((await assignedProjectsForUser(user.id)).map(project => project.id));
      visibleRows = visibleRows.filter(item => !item.projectId || assigned.has(item.projectId));
    }
    const projectRows = visibleRows.some(item => item.projectId)
      ? await db.select({ id: projects.id, name: projects.name }).from(projects)
        .where(inArray(projects.id, Array.from(new Set(visibleRows.flatMap(item => item.projectId ? [item.projectId] : [])))))
      : [];
    const projectNames = new Map(projectRows.map(project => [project.id, project.name]));
    res.json(visibleRows.map(item => ({ ...item, projectName: item.projectId ? projectNames.get(item.projectId) ?? null : null })));
  }));
  app.get("/api/service-catalog/items/:id", requireAuth, handle(async (req, res, user) => {
    const [item] = await db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam })
      .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.id)).where(eq(serviceCatalogItems.id, req.params.id));
    const [legacy] = item ? await db.select({ consumableId: catalogItems.consumableId }).from(catalogItems).where(eq(catalogItems.id, item.id)) : [];
    if (!item || (item.status !== "Active" && !canManageServiceCatalog(user)) ||
        (!user.employeeId && !canManageServiceCatalog(user) && isEmployeeOnlyService({ category: item.category, consumableId: legacy?.consumableId })))
      throw new CatalogError(404, "Service not found");
    if (personaRolesForUser(user).includes("end_user") && item.projectId &&
        !(await assignedProjectsForUser(user.id)).some(project => project.id === item.projectId))
      throw new CatalogError(404, "Service not found");
    res.json(item);
  }));
  for (const method of ["post", "put"] as const) {
    app[method](`/api/service-catalog/items${method === "put" ? "/:id" : ""}`, requireAuth, handle(async (req, res, user) => {
      if (!canManageServiceCatalog(user)) throw new CatalogError(403, "Catalog manager access required");
      const input = structuredCatalogInput.parse(req.body);
      const item = await db.transaction(async tx => {
        const previous = method === "put" ? (await tx.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.id, req.params.id)).for("update"))[0] : undefined;
        if (method === "put" && !previous) throw new CatalogError(404, "Service not found");
        if (input.category !== previous?.category) {
          const [category] = await tx.select({ id: dropdownOptions.id }).from(dropdownOptions).where(and(
            eq(dropdownOptions.category, "service_category"), eq(dropdownOptions.value, input.category), eq(dropdownOptions.isActive, true),
          ));
          if (!category) throw new CatalogError(400, "Choose an active service category from Dropdown Management");
        }
        if (input.consumableId && !(await tx.select({ id: consumables.id }).from(consumables).where(eq(consumables.id, input.consumableId))).length)
          throw new CatalogError(400, "Consumable not found");
        const legacyInput = {
          name: input.title, category: input.category.toLowerCase(), description: input.description ?? null,
          icon: input.icon ?? null, slaHours: input.slaHours, approvalRequired: input.requiresApproval,
          isActive: input.status === "Active", updatedAt: new Date(),
          ...(input.consumableId !== undefined ? { consumableId: input.consumableId } : {}),
          ...(input.fulfillmentTeam !== undefined ? { fulfillmentTeam: input.fulfillmentTeam } : {}),
        };
        let id = req.params.id;
        if (method === "post") {
          const [legacy] = await tx.insert(catalogItems).values(legacyInput).returning();
          id = legacy.id;
        } else await tx.update(catalogItems).set(legacyInput).where(eq(catalogItems.id, id));
        const { consumableId: _stock, fulfillmentTeam: _team, ...structured } = input;
        const values = { ...structured, approverRole: input.requiresApproval ? input.approverRole : null, updatedAt: new Date() };
        const [saved] = method === "post"
          ? await tx.insert(serviceCatalogItems).values({ id, ...values }).returning()
          : await tx.update(serviceCatalogItems).set(values).where(eq(serviceCatalogItems.id, id)).returning();
        await audit(tx, req, user, "service_catalog_items", saved.id, { previous, item: saved }, method === "post" ? "CREATE" : "UPDATE");
        return saved;
      });
      res.status(method === "post" ? 201 : 200).json(item);
    }));
  }
  app.post("/api/service-catalog/items/:id/request", requireAuth, catalogRequestHandler);
  app.get("/api/service-catalog/approvals", requireAuth, handle(async (_req, res, user) => {
    const roles = serviceApprovalRoles(user);
    if (!roles.length) throw new CatalogError(403, "Approver access required");
    const rows = await db.select({
      ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber,
      title: serviceRequests.title, requesterName: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
      catalogTitle: serviceCatalogItems.title, description: serviceRequests.description,
      customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot,
    }).from(serviceRequestsApprovals)
      .innerJoin(serviceRequests, eq(serviceRequests.id, serviceRequestsApprovals.ticketId))
      .innerJoin(users, eq(users.id, serviceRequests.requesterId))
      .innerJoin(serviceCatalogItems, eq(serviceCatalogItems.id, serviceRequests.serviceCatalogItemId))
      .where(and(eq(serviceRequestsApprovals.status, "Pending"), inArray(serviceRequestsApprovals.approverRole, roles),
        eq(serviceRequests.fulfillmentStage, "Pending Approval"), ne(serviceRequests.requesterId, user.id)))
      .orderBy(asc(serviceRequestsApprovals.createdAt));
    res.json(rows);
  }));
  app.post("/api/service-catalog/approvals/:id/decision", requireAuth, handle(async (req, res, user) => {
    if (!serviceApprovalRoles(user).length) throw new CatalogError(403, "Approver access required");
    const input = catalogDecisionInput.parse(req.body);
    const result = await db.transaction(async tx => {
      const [reference] = await tx.select({ ticketId: serviceRequestsApprovals.ticketId })
        .from(serviceRequestsApprovals).where(eq(serviceRequestsApprovals.id, req.params.id));
      if (!reference) throw new CatalogError(404, "Approval not found");
      // Parent first, then decision: concurrent reviewers serialize on the same ticket.
      const [request] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, reference.ticketId)).for("update");
      const [approval] = await tx.select().from(serviceRequestsApprovals).where(eq(serviceRequestsApprovals.id, req.params.id)).for("update");
      if (!serviceApprovalRoles(user).includes(approval.approverRole)) throw new CatalogError(403, "This approval requires a different role");
      if (request.requesterId === user.id) throw new CatalogError(403, "You cannot approve your own request");
      if (approval.status !== "Pending" || request.approvalStatus !== "pending" || request.fulfillmentStage !== "Pending Approval")
        throw new CatalogError(409, "This request is no longer awaiting approval");
      const [saved] = await tx.update(serviceRequestsApprovals).set({
        status: input.decision, comments: input.comments, approverId: user.id, decidedAt: new Date(),
      }).where(eq(serviceRequestsApprovals.id, approval.id)).returning();
      const [legacy] = await tx.select({ fulfillmentTeam: catalogItems.fulfillmentTeam }).from(catalogItems).where(eq(catalogItems.id, request.catalogItemId!));
      await tx.update(serviceRequests).set({
        approvalStatus: input.decision.toLowerCase(), fulfillmentStage: input.decision, fulfillmentStatus: input.decision,
        assignmentGroup: input.decision === "Approved" ? legacy?.fulfillmentTeam ?? null : null, updatedAt: new Date(),
      }).where(eq(serviceRequests.id, request.id));
      await tx.insert(serviceRequestActivities).values({
        serviceRequestId: request.id, actorId: user.id, action: `Request ${input.decision.toLowerCase()}`, details: input.comments,
      });
      await audit(tx, req, user, "service_requests_approvals", saved.id, { previous: approval, decision: saved }, "UPDATE");
      return saved;
    });
    res.json(result);
  }));
  app.get("/api/service-requests/:id/catalog-approval", requireAuth, handle(async (req, res, user) => {
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, req.params.id));
    if (!request) throw new CatalogError(404, "Service request not found");
    if (request.requesterId !== user.id && !user.permissions.includes("ticket_manage") && !canManageServiceCatalog(user))
      throw new CatalogError(403, "Insufficient permissions");
    const [approval] = await db.select({
      ...getTableColumns(serviceRequestsApprovals), approverName: users.username,
    }).from(serviceRequestsApprovals).leftJoin(users, eq(users.id, serviceRequestsApprovals.approverId))
      .where(eq(serviceRequestsApprovals.ticketId, request.id));
    res.json(approval ? { ...approval, customFieldValues: request.customFieldValues, catalogSchemaSnapshot: request.catalogSchemaSnapshot } : null);
  }));
}
