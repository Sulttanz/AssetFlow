import type { Express, RequestHandler } from "express";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  assets, auditLogs, changes, cmdbApplications, itComponentComplianceReviews,
  networkDevices, problems, riskApplicationLinks, riskAssetLinks,
  riskChangeLinks, riskComplianceReviewLinks, riskMitigationActions,
  riskNetworkDeviceLinks, riskProblemLinks, riskReviewHistory, risks,
  riskServerLinks, riskVendorLinks, servers, systemSettings, users, vendors,
} from "@shared/schema";
import {
  DEFAULT_IT_RISK_APPETITE, IT_RISK_REVIEW_FREQUENCIES,
  addReviewFrequency, residualRiskScore, riskAssessmentInputSchema,
  riskLinkTypeSchema, riskMitigationActionInputSchema, riskReviewInputSchema,
} from "@shared/risk-management";
import { db } from "./db";
import { storage } from "./storage";
import { isFeatureEnabled, sendFeatureNotEnabled } from "./module-access";
import { respondWithApiError } from "./api-error-handler";

type MiddlewareFactory = (...args: string[]) => RequestHandler;

const linkTypes = {
  applications: { table: riskApplicationLinks, field: "applicationId", target: cmdbApplications, module: "cmdb" },
  servers: { table: riskServerLinks, field: "serverId", target: servers, module: "cmdb" },
  networkDevices: { table: riskNetworkDeviceLinks, field: "networkDeviceId", target: networkDevices, module: "cmdb" },
  assets: { table: riskAssetLinks, field: "assetId", target: assets, module: "asset_management" },
  vendors: { table: riskVendorLinks, field: "vendorId", target: vendors, module: "asset_management" },
  complianceReviews: { table: riskComplianceReviewLinks, field: "complianceReviewId", target: itComponentComplianceReviews, module: "cmdb" },
  problems: { table: riskProblemLinks, field: "problemId", target: problems, module: "itsm" },
  changes: { table: riskChangeLinks, field: "changeId", target: changes, module: "itsm" },
} as const;

const today = () => new Date().toISOString().slice(0, 10);
const isoDate = (value?: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.slice(0, 10) ?? null;

async function readAppetiteThreshold(): Promise<number> {
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings)
    .where(eq(systemSettings.key, "it_risk_appetite_threshold")).limit(1);
  const parsed = Number(setting?.value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 25 ? parsed : DEFAULT_IT_RISK_APPETITE;
}

async function reserveRiskNumber(): Promise<string> {
  const result = await db.execute(sql`SELECT nextval('risk_register_number_seq')::text AS sequence`);
  const sequence = Number(result.rows[0]?.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Could not allocate the next IT risk number");
  return `IT-RSK-${String(sequence).padStart(3, "0")}`;
}

async function writeRiskAudit(req: any, action: string, risk: any, previous?: unknown, next?: unknown) {
  const actorId = req.user?.id ?? null;
  await db.insert(auditLogs).values({
    userId: actorId,
    action,
    tableName: "risk_register",
    recordId: risk.id,
    recordName: risk.riskNumber ? `${risk.riskNumber} · ${risk.title}` : risk.title,
    oldValues: previous ? JSON.stringify(previous) : null,
    newValues: next ? JSON.stringify(next) : null,
    ipAddress: req.ip ?? null,
    userAgent: req.get?.("user-agent") ?? null,
  });
}

async function getRiskRows(riskId?: string) {
  const query = db.select({
    risk: risks,
    ownerId: users.id,
    ownerUsername: users.username,
    ownerFirstName: users.firstName,
    ownerLastName: users.lastName,
    linkedChangeId: changes.id,
    linkedChangeNumber: changes.changeNumber,
    linkedChangeTitle: changes.title,
  }).from(risks)
    .leftJoin(users, eq(risks.ownerId, users.id))
    .leftJoin(changes, eq(risks.changeId, changes.id));
  const baseRows = riskId
    ? await query.where(eq(risks.id, riskId)).limit(1)
    : await query.orderBy(desc(risks.updatedAt), desc(risks.createdAt));
  if (!baseRows.length) return [];
  const ids = baseRows.map(row => row.risk.id);
  const [actions, reviews, applicationLinks, serverLinks, networkLinks, assetLinks, vendorLinks, complianceLinks, problemLinks, changeLinks] =
    await Promise.all([
      db.select().from(riskMitigationActions).where(inArray(riskMitigationActions.riskId, ids)).orderBy(desc(riskMitigationActions.createdAt)),
      db.select().from(riskReviewHistory).where(inArray(riskReviewHistory.riskId, ids)).orderBy(desc(riskReviewHistory.createdAt)),
      db.select().from(riskApplicationLinks).where(inArray(riskApplicationLinks.riskId, ids)),
      db.select().from(riskServerLinks).where(inArray(riskServerLinks.riskId, ids)),
      db.select().from(riskNetworkDeviceLinks).where(inArray(riskNetworkDeviceLinks.riskId, ids)),
      db.select().from(riskAssetLinks).where(inArray(riskAssetLinks.riskId, ids)),
      db.select().from(riskVendorLinks).where(inArray(riskVendorLinks.riskId, ids)),
      db.select().from(riskComplianceReviewLinks).where(inArray(riskComplianceReviewLinks.riskId, ids)),
      db.select().from(riskProblemLinks).where(inArray(riskProblemLinks.riskId, ids)),
      db.select().from(riskChangeLinks).where(inArray(riskChangeLinks.riskId, ids)),
    ]);
  const listFor = <T extends { riskId: string }>(rows: T[], id: string) => rows.filter(row => row.riskId === id);
  const nowDate = today();
  return baseRows.map(row => ({
    ...row.risk,
    residualScore: residualRiskScore(row.risk),
    owner: row.ownerId ? {
      id: row.ownerId, username: row.ownerUsername,
      firstName: row.ownerFirstName, lastName: row.ownerLastName,
    } : null,
    change: row.linkedChangeId ? {
      id: row.linkedChangeId, changeNumber: row.linkedChangeNumber, title: row.linkedChangeTitle,
    } : null,
    mitigationActions: listFor(actions, row.risk.id).map(action => ({
      ...action,
      status: action.status !== "Completed" && action.dueDate && isoDate(action.dueDate)! < nowDate ? "Overdue" : action.status,
    })),
    reviewHistory: listFor(reviews, row.risk.id),
    links: {
      applications: listFor(applicationLinks, row.risk.id).map(link => link.applicationId),
      servers: listFor(serverLinks, row.risk.id).map(link => link.serverId),
      networkDevices: listFor(networkLinks, row.risk.id).map(link => link.networkDeviceId),
      assets: listFor(assetLinks, row.risk.id).map(link => link.assetId),
      vendors: listFor(vendorLinks, row.risk.id).map(link => link.vendorId),
      complianceReviews: listFor(complianceLinks, row.risk.id).map(link => link.complianceReviewId),
      problems: listFor(problemLinks, row.risk.id).map(link => link.problemId),
      changes: listFor(changeLinks, row.risk.id).map(link => link.changeId),
    },
  }));
}

export function registerRiskManagementRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requirePermission: MiddlewareFactory,
  requireModule: MiddlewareFactory,
) {
  const manage = [requireAuth, requirePermission("change_manage"), requireModule("risk_management")];
  const read = [requireAuth, requireModule("risk_management")];

  app.get("/api/risk-users", ...manage, async (_req, res) => {
    try {
      res.json(await db.select({
        id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName,
      }).from(users).where(eq(users.isActive, true)));
    } catch (error) { respondWithApiError(res, error, "Failed to fetch risk owners"); }
  });

  app.get("/api/risk-management/settings", ...manage, async (_req, res) => {
    try { res.json({ appetiteThreshold: await readAppetiteThreshold() }); }
    catch (error) { respondWithApiError(res, error, "Failed to load IT risk settings"); }
  });

  app.put("/api/risk-management/settings", ...manage, async (req, res) => {
    const parsed = z.object({ appetiteThreshold: z.number().int().min(1).max(25) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Risk appetite threshold must be between 1 and 25", errors: parsed.error.flatten() });
    try {
      const [setting] = await db.insert(systemSettings).values({
        key: "it_risk_appetite_threshold",
        value: String(parsed.data.appetiteThreshold),
        description: "Maximum residual risk score accepted without elevated sign-off",
        category: "risk_management",
        updatedAt: new Date(),
        updatedBy: (req.user as any).id,
      }).onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: String(parsed.data.appetiteThreshold), updatedAt: new Date(), updatedBy: (req.user as any).id },
      }).returning();
      res.json({ appetiteThreshold: Number(setting.value) });
    } catch (error) { respondWithApiError(res, error, "Failed to update IT risk settings"); }
  });

  app.get("/api/risks/options", ...manage, async (_req, res) => {
    try {
      const [cmdbEnabled, assetsEnabled, itsmEnabled] = await Promise.all([
        isFeatureEnabled("cmdb"), isFeatureEnabled("asset_management"), isFeatureEnabled("itsm"),
      ]);
      const [applications, serverRows, networkRows, assetRows, vendorRows, reviewRows, problemRows, changeRows] = await Promise.all([
        cmdbEnabled ? db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications).orderBy(cmdbApplications.name) : [],
        cmdbEnabled ? db.select({ id: servers.id, name: servers.hostname }).from(servers).orderBy(servers.hostname) : [],
        cmdbEnabled ? db.select({ id: networkDevices.id, name: networkDevices.name, hostname: networkDevices.hostname }).from(networkDevices) : [],
        assetsEnabled ? db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag }).from(assets).orderBy(assets.name) : [],
        assetsEnabled ? db.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(vendors.name) : [],
        cmdbEnabled ? db.select({
          id: itComponentComplianceReviews.id,
          name: sql<string>`concat_ws(' · ', ${itComponentComplianceReviews.baselineStandard}, ${itComponentComplianceReviews.componentType})`,
        }).from(itComponentComplianceReviews) : [],
        itsmEnabled ? db.select({ id: problems.id, name: problems.problemNumber, title: problems.title }).from(problems) : [],
        itsmEnabled ? db.select({ id: changes.id, name: changes.changeNumber, title: changes.title }).from(changes) : [],
      ]);
      res.json({
        applications,
        servers: serverRows,
        networkDevices: networkRows.map(row => ({ id: row.id, name: row.name || row.hostname })),
        assets: assetRows.map(row => ({ id: row.id, name: `${row.name} · ${row.assetTag}` })),
        vendors: vendorRows,
        complianceReviews: reviewRows,
        problems: problemRows.map(row => ({ id: row.id, name: `${row.name} · ${row.title}` })),
        changes: changeRows.map(row => ({ id: row.id, name: `${row.name} · ${row.title}` })),
      });
    } catch (error) { respondWithApiError(res, error, "Failed to load risk link options"); }
  });

  app.get("/api/risks", ...read, async (_req, res) => {
    try { res.json(await getRiskRows()); }
    catch (error) { respondWithApiError(res, error, "Failed to fetch risks"); }
  });

  app.get("/api/risks/:riskId", ...read, async (req, res) => {
    try {
      const [risk] = await getRiskRows(req.params.riskId);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      res.json(risk);
    } catch (error) { respondWithApiError(res, error, "Failed to fetch risk"); }
  });

  app.post("/api/risks", ...manage, async (req, res) => {
    const parsed = riskAssessmentInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid IT risk assessment", errors: parsed.error.flatten() });
    try {
      const input = parsed.data;
      const residual = (input.residualLikelihood ?? input.likelihood) * (input.residualImpact ?? input.impact);
      const threshold = await readAppetiteThreshold();
      const treatment = input.treatmentStrategy ?? "Mitigate";
      if (treatment === "Accept" && residual >= threshold &&
          (!input.acceptanceJustification?.trim() || !input.acceptanceExpiresAt || input.acceptanceExpiresAt <= today())) {
        return res.status(400).json({ message: `Acceptance above risk appetite (${threshold}) requires justification and a future expiry date.` });
      }
      if (input.status === "accepted" && !input.acceptanceReason?.trim() && !input.acceptanceJustification?.trim()) {
        return res.status(400).json({ message: "An acceptance justification is required for accepted risks." });
      }
      const actorId = (req.user as any).id;
      const riskNumber = await reserveRiskNumber();
      const acceptance = treatment === "Accept" ? { acceptedByUserId: actorId, acceptedAt: new Date() } : {};
      const [risk] = await db.insert(risks).values({
        ...input,
        riskNumber,
        treatmentStrategy: treatment,
        riskScore: input.impact * input.likelihood,
        acceptedByUserId: "acceptedByUserId" in acceptance ? actorId : null,
        acceptedAt: "acceptedAt" in acceptance ? acceptance.acceptedAt : null,
        acceptanceJustification: input.acceptanceJustification ?? input.acceptanceReason ?? null,
        acceptanceReason: input.acceptanceReason ?? input.acceptanceJustification ?? null,
        createdById: actorId,
      }).returning();
      await db.insert(riskReviewHistory).values({
        riskId: risk.id, reviewedById: actorId, eventType: "created",
        inherentScore: risk.riskScore, residualScore: residual, status: risk.status,
      });
      await writeRiskAudit(req, "CREATE", risk, undefined, risk);
      res.status(201).json(risk);
    } catch (error) { respondWithApiError(res, error, "Failed to create IT risk"); }
  });

  app.put("/api/risks/:riskId", ...manage, async (req, res) => {
    const parsed = riskAssessmentInputSchema.partial().strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid IT risk assessment", errors: parsed.error.flatten() });
    try {
      const [previous] = await db.select().from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!previous) return res.status(404).json({ message: "Risk not found" });
      const input = parsed.data;
      const likelihood = input.likelihood ?? previous.likelihood;
      const impact = input.impact ?? previous.impact;
      const residual = (input.residualLikelihood ?? previous.residualLikelihood ?? likelihood) *
        (input.residualImpact ?? previous.residualImpact ?? impact);
      const treatment = input.treatmentStrategy ?? previous.treatmentStrategy;
      const threshold = await readAppetiteThreshold();
      const justification = input.acceptanceJustification !== undefined
        ? input.acceptanceJustification : previous.acceptanceJustification ?? previous.acceptanceReason;
      const expiry = input.acceptanceExpiresAt !== undefined
        ? input.acceptanceExpiresAt : isoDate(previous.acceptanceExpiresAt);
      if (treatment === "Accept" && residual >= threshold &&
          (!justification?.trim() || !expiry || expiry <= today())) {
        return res.status(400).json({ message: `Acceptance above risk appetite (${threshold}) requires justification and a future expiry date.` });
      }
      if ((input.status ?? previous.status) === "accepted" && !justification?.trim()) {
        return res.status(400).json({ message: "An acceptance justification is required for accepted risks." });
      }
      const actorId = (req.user as any).id;
      const acceptanceFields = treatment === "Accept"
        ? { acceptedByUserId: actorId, acceptedAt: new Date() }
        : { acceptedByUserId: null, acceptedAt: null, acceptanceExpiresAt: null, acceptanceJustification: null };
      const [risk] = await db.update(risks).set({
        ...input,
        ...acceptanceFields,
        riskScore: likelihood * impact,
        acceptanceJustification: treatment === "Accept" ? justification : null,
        acceptanceReason: input.acceptanceReason ?? (treatment === "Accept" ? justification : null),
        updatedAt: new Date(),
      }).where(eq(risks.id, req.params.riskId)).returning();
      await db.insert(riskReviewHistory).values({
        riskId: risk.id, reviewedById: actorId, eventType: "updated",
        previousInherentScore: previous.riskScore, inherentScore: risk.riskScore,
        previousResidualScore: residualRiskScore(previous), residualScore: residual,
        previousStatus: previous.status, status: risk.status,
      });
      await writeRiskAudit(req, "UPDATE", risk, previous, risk);
      res.json(risk);
    } catch (error) { respondWithApiError(res, error, "Failed to update IT risk"); }
  });

  app.delete("/api/risks/:riskId", ...manage, async (req, res) => {
    try {
      const [risk] = await db.delete(risks).where(eq(risks.id, req.params.riskId)).returning();
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      await writeRiskAudit(req, "DELETE", risk, risk, undefined);
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to delete IT risk"); }
  });

  app.post("/api/risks/:riskId/actions", ...manage, async (req, res) => {
    const parsed = riskMitigationActionInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid mitigation action", errors: parsed.error.flatten() });
    try {
      const [risk] = await db.select().from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      const [action] = await db.insert(riskMitigationActions).values({
        ...parsed.data,
        riskId: risk.id,
        completedAt: parsed.data.status === "Completed" ? new Date() : null,
      }).returning();
      await writeRiskAudit(req, "CREATE_MITIGATION_ACTION", risk, undefined, action);
      res.status(201).json(action);
    } catch (error) { respondWithApiError(res, error, "Failed to create mitigation action"); }
  });

  app.put("/api/risks/:riskId/actions/:actionId", ...manage, async (req, res) => {
    const parsed = riskMitigationActionInputSchema.partial().strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return res.status(400).json({ message: "Invalid mitigation action", errors: parsed.success ? undefined : parsed.error.flatten() });
    try {
      const [previous] = await db.select().from(riskMitigationActions).where(and(
        eq(riskMitigationActions.id, req.params.actionId), eq(riskMitigationActions.riskId, req.params.riskId),
      )).limit(1);
      if (!previous) return res.status(404).json({ message: "Mitigation action not found" });
      const completedAt = parsed.data.status === "Completed" ? previous.completedAt ?? new Date()
        : parsed.data.status ? null : undefined;
      const [action] = await db.update(riskMitigationActions).set({
        ...parsed.data,
        ...(completedAt !== undefined ? { completedAt } : {}),
        updatedAt: new Date(),
      }).where(eq(riskMitigationActions.id, previous.id)).returning();
      await writeRiskAudit(req, "UPDATE_MITIGATION_ACTION", { ...previous, riskNumber: req.params.riskId }, previous, action);
      res.json(action);
    } catch (error) { respondWithApiError(res, error, "Failed to update mitigation action"); }
  });

  app.delete("/api/risks/:riskId/actions/:actionId", ...manage, async (req, res) => {
    try {
      const [action] = await db.delete(riskMitigationActions).where(and(
        eq(riskMitigationActions.id, req.params.actionId), eq(riskMitigationActions.riskId, req.params.riskId),
      )).returning();
      if (!action) return res.status(404).json({ message: "Mitigation action not found" });
      await writeRiskAudit(req, "DELETE_MITIGATION_ACTION", { id: action.riskId, title: action.title }, action, undefined);
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to delete mitigation action"); }
  });

  app.post("/api/risks/:riskId/reviews", ...manage, async (req, res) => {
    const parsed = riskReviewInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid review", errors: parsed.error.flatten() });
    try {
      const [risk] = await db.select().from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      const reviewedAt = new Date();
      const nextReviewDate = addReviewFrequency(reviewedAt, risk.reviewFrequency as typeof IT_RISK_REVIEW_FREQUENCIES[number])
        .toISOString().slice(0, 10);
      const residual = residualRiskScore(risk);
      const [updated] = await db.update(risks).set({ lastReviewedAt: reviewedAt, nextReviewDate, updatedAt: reviewedAt })
        .where(eq(risks.id, risk.id)).returning();
      const [history] = await db.insert(riskReviewHistory).values({
        riskId: risk.id, reviewedById: (req.user as any).id, eventType: "review",
        notes: parsed.data.notes ?? null, previousInherentScore: risk.riskScore,
        inherentScore: risk.riskScore, previousResidualScore: residual, residualScore: residual,
        previousStatus: risk.status, status: risk.status,
      }).returning();
      await writeRiskAudit(req, "REVIEW", updated, risk, { ...updated, reviewNotes: parsed.data.notes });
      res.status(201).json({ risk: updated, history });
    } catch (error) { respondWithApiError(res, error, "Failed to record risk review"); }
  });

  app.post("/api/risks/:riskId/links", ...manage, async (req, res) => {
    const parsed = z.object({ type: riskLinkTypeSchema, targetId: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Select a valid IT record to link", errors: parsed.error.flatten() });
    try {
      const [risk] = await db.select({ id: risks.id, title: risks.title }).from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      const { type, targetId } = parsed.data;
      const link = linkTypes[type] as any;
      if (!await isFeatureEnabled(link.module)) return sendFeatureNotEnabled(res, link.module);
      const targetTable = link.target as any;
      const [target] = await db.select({ id: targetTable.id }).from(targetTable).where(eq(targetTable.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "The selected linked record was not found" });
      const inserted = await db.insert(link.table as any).values({ riskId: risk.id, [link.field]: targetId }).onConflictDoNothing().returning();
      const created = Array.isArray(inserted) ? inserted[0] : undefined;
      await writeRiskAudit(req, "LINK_RECORD", risk, undefined, { type, targetId });
      res.status(created ? 201 : 200).json(created ?? { riskId: risk.id, type, targetId });
    } catch (error) { respondWithApiError(res, error, "Failed to link IT record to risk"); }
  });

  app.delete("/api/risks/:riskId/links/:type/:targetId", ...manage, async (req, res) => {
    const typeParsed = riskLinkTypeSchema.safeParse(req.params.type);
    const targetParsed = z.string().uuid().safeParse(req.params.targetId);
    if (!typeParsed.success || !targetParsed.success) return res.status(400).json({ message: "Invalid risk link" });
    try {
      const link = linkTypes[typeParsed.data] as any;
      const targetColumn = (link.table as any)[link.field];
      await db.delete(link.table as any).where(and(
        eq((link.table as any).riskId, req.params.riskId),
        eq(targetColumn, targetParsed.data),
      ));
      await writeRiskAudit(req, "UNLINK_RECORD", { id: req.params.riskId, title: "Risk" }, undefined, { type: typeParsed.data, targetId: targetParsed.data });
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to unlink IT record"); }
  });

  app.post("/api/risks/:riskId/spawn-change", ...manage, requireModule("itsm"), async (req, res) => {
    try {
      const [risk] = await db.select().from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      const change = await storage.createChange({
        title: `Risk response: ${risk.title}`,
        description: risk.description ?? `Change request created to address ${risk.riskNumber}.`,
        type: "normal",
        priority: risk.riskScore >= 16 ? "high" : "medium",
        risk: risk.riskScore >= 16 ? "high" : "medium",
        impact: String(risk.impact),
        implementationPlan: risk.mitigation,
        rollbackPlan: risk.contingencyPlan ?? risk.contingency,
        status: "draft",
        cabRequired: true,
        requestedById: (req.user as any).id,
        projectId: null,
      });
      await db.insert(riskChangeLinks).values({ riskId: risk.id, changeId: change.id }).onConflictDoNothing();
      if (!risk.changeId) await db.update(risks).set({ changeId: change.id, updatedAt: new Date() }).where(eq(risks.id, risk.id));
      await writeRiskAudit(req, "SPAWN_CHANGE", risk, undefined, { id: change.id, changeNumber: change.changeNumber });
      res.status(201).json(change);
    } catch (error) { respondWithApiError(res, error, "Failed to spawn change request"); }
  });

  app.post("/api/risks/:riskId/spawn-problem", ...manage, requireModule("itsm"), async (req, res) => {
    try {
      const [risk] = await db.select().from(risks).where(eq(risks.id, req.params.riskId)).limit(1);
      if (!risk) return res.status(404).json({ message: "Risk not found" });
      const problem = await storage.createProblem({
        title: `Risk remediation: ${risk.title}`,
        description: risk.description,
        priority: risk.riskScore >= 16 ? "high" : "medium",
        category: risk.category,
        rootCause: risk.vulnerability,
        workaround: risk.mitigation,
        createdById: (req.user as any).id,
      });
      await db.insert(riskProblemLinks).values({ riskId: risk.id, problemId: problem.id }).onConflictDoNothing();
      await writeRiskAudit(req, "SPAWN_PROBLEM", risk, undefined, { id: problem.id, problemNumber: problem.problemNumber });
      res.status(201).json(problem);
    } catch (error) { respondWithApiError(res, error, "Failed to spawn problem record"); }
  });
}
