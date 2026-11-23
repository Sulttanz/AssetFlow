import type { Express, RequestHandler } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

async function writeRiskAudit(req: any, action: string, risk: any, previous?: unknown, next?: unknown, executor: any = db) {
  const actorId = req.user?.id ?? null;
  await executor.insert(auditLogs).values({
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
  const itsmEnabled = await isFeatureEnabled("itsm");
  const query = db.select({
    risk: risks,
    ownerId: users.id,
    ownerUsername: users.username,
    ownerFirstName: users.firstName,
    ownerLastName: users.lastName,
  }).from(risks)
    .leftJoin(users, eq(risks.ownerId, users.id));
  const baseRows = riskId
    ? await query.where(eq(risks.id, riskId)).limit(1)
    : await query.orderBy(desc(risks.updatedAt), desc(risks.createdAt));
  if (!baseRows.length) return [];
  const ids = baseRows.map(row => row.risk.id);
  const changeIds = baseRows.flatMap(row => row.risk.changeId ? [row.risk.changeId] : []);
  const linkedChanges = itsmEnabled && changeIds.length ? await db.select({
    id: changes.id, changeNumber: changes.changeNumber, title: changes.title,
  }).from(changes).where(inArray(changes.id, changeIds)) : [];
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
    change: linkedChanges.find(change => change.id === row.risk.changeId) ?? null,
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

class RiskInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function riskFailure(res: any, error: unknown, operation: string) {
  if (error instanceof RiskInputError) return res.status(error.status).json({ message: error.message });
  return respondWithApiError(res, error, operation);
}

async function saveRiskAssessment(req: any, id?: string) {
  const input = id ? riskAssessmentInputSchema.partial().strict().parse(req.body) : riskAssessmentInputSchema.parse(req.body);
  if (!Object.keys(input).length) throw new RiskInputError("Provide an assessment field to update");
  const threshold = await readAppetiteThreshold();
  return db.transaction(async tx => {
    const [previous] = id ? await tx.select().from(risks).where(eq(risks.id, id)).for("update") : [];
    if (id && !previous) throw new RiskInputError("Risk not found", 404);
    if (input.changeId) {
      if (!await isFeatureEnabled("itsm")) throw new RiskInputError("ITSM is not enabled for change links", 403);
      const [change] = await tx.select({ id: changes.id, projectId: changes.projectId }).from(changes).where(eq(changes.id, input.changeId));
      if (!change || change.projectId) throw new RiskInputError("Only internal IT changes may be linked to this register");
    }
    if (input.ownerId) {
      const [owner] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, input.ownerId), eq(users.isActive, true)));
      if (!owner) throw new RiskInputError("Select an active risk owner");
    }
    const next = { ...previous, ...input };
    const likelihood = next.likelihood!;
    const impact = next.impact!;
    const residual = (next.residualLikelihood ?? likelihood) * (next.residualImpact ?? impact);
    const treatment = input.status === "accepted" && !input.treatmentStrategy ? "Accept" : next.treatmentStrategy ?? "Mitigate";
    const justification = input.acceptanceJustification !== undefined ? input.acceptanceJustification :
      input.acceptanceReason !== undefined ? input.acceptanceReason : previous?.acceptanceJustification ?? previous?.acceptanceReason ?? null;
    if (treatment === "Accept" && residual >= threshold &&
        (!justification?.trim() || !next.acceptanceExpiresAt || next.acceptanceExpiresAt <= today())) {
      throw new RiskInputError(`Acceptance at or above risk appetite (${threshold}) requires justification and a future expiry date.`);
    }
    if (next.status === "accepted" && treatment !== "Accept") throw new RiskInputError("Accepted risks must use the Accept treatment strategy");
    if (next.status === "accepted" && !justification?.trim()) throw new RiskInputError("An acceptance justification is required for accepted risks");
    if ((next.targetImpact == null) !== (next.targetLikelihood == null)) throw new RiskInputError("Provide both target impact and target likelihood");
    if ((next.residualImpact == null) !== (next.residualLikelihood == null)) throw new RiskInputError("Provide both residual impact and residual likelihood");
    const actorId = req.user.id;
    const accepting = treatment === "Accept";
    const reSign = !previous || previous.treatmentStrategy !== "Accept" ||
      ["acceptanceJustification", "acceptanceReason", "acceptanceExpiresAt", "impact", "likelihood", "residualImpact", "residualLikelihood"]
        .some(key => key in input && (input as any)[key] !== (previous as any)[key]);
    const values = {
      ...input,
      treatmentStrategy: treatment,
      riskScore: impact * likelihood,
      acceptanceJustification: accepting ? justification : null,
      acceptanceReason: accepting ? justification : null,
      acceptanceExpiresAt: accepting ? next.acceptanceExpiresAt ?? null : null,
      acceptedByUserId: accepting ? reSign ? actorId : previous?.acceptedByUserId : null,
      acceptedAt: accepting ? reSign ? new Date() : previous?.acceptedAt : null,
      updatedAt: new Date(),
    };
    const [risk] = id
      ? await tx.update(risks).set(values).where(eq(risks.id, id)).returning()
      : await tx.insert(risks).values({ ...values, title: input.title!, category: input.category!, likelihood, impact, createdById: actorId }).returning();
    await tx.insert(riskReviewHistory).values({
      riskId: risk.id, reviewedById: actorId, eventType: previous ? "updated" : "created",
      previousInherentScore: previous?.riskScore, inherentScore: risk.riskScore,
      previousResidualScore: previous ? residualRiskScore(previous) : null, residualScore: residual,
      previousStatus: previous?.status, status: risk.status,
    });
    await writeRiskAudit(req, previous ? "UPDATE" : "CREATE", risk, previous, risk, tx);
    return risk;
  });
}

async function mutateRisk<T>(req: any, action: string, mutate: (tx: any, risk: typeof risks.$inferSelect) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    const [risk] = await tx.select().from(risks).where(eq(risks.id, req.params.riskId)).for("update");
    if (!risk) throw new RiskInputError("Risk not found", 404);
    const result = await mutate(tx, risk);
    await writeRiskAudit(req, action, risk, risk, result, tx);
    return result;
  });
}

export function registerRiskManagementRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requirePermission: MiddlewareFactory,
  requireModule: MiddlewareFactory,
) {
  const manage = [requireAuth, requirePermission("risk_manage", "change_manage", "system_admin"), requireModule("risk_management")];
  const read = [requireAuth, requirePermission("risk_manage", "change_manage", "system_admin", "compliance_view", "audit_view"), requireModule("risk_management")];

  app.get("/api/risk-users", ...read, async (_req, res) => {
    try {
      res.json(await db.select({
        id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName,
      }).from(users).where(eq(users.isActive, true)));
    } catch (error) { respondWithApiError(res, error, "Failed to fetch risk owners"); }
  });

  app.get("/api/risk-management/settings", ...read, async (_req, res) => {
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

  app.get("/api/risks/options", ...read, async (_req, res) => {
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
        itsmEnabled ? db.select({ id: changes.id, name: changes.changeNumber, title: changes.title }).from(changes).where(isNull(changes.projectId)) : [],
      ]);
      res.json({
        itsmEnabled,
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
    try { res.status(201).json(await saveRiskAssessment(req)); }
    catch (error) { riskFailure(res, error, "Failed to create IT risk"); }
  });

  app.put("/api/risks/:riskId", ...manage, async (req, res) => {
    try { res.json(await saveRiskAssessment(req, req.params.riskId)); }
    catch (error) { riskFailure(res, error, "Failed to update IT risk"); }
  });

  app.delete("/api/risks/:riskId", ...manage, async (req, res) => {
    try {
      await mutateRisk(req, "DELETE", async (tx, risk) => {
        await tx.delete(risks).where(eq(risks.id, risk.id));
        return { deleted: true };
      });
      res.json({ success: true });
    } catch (error) { riskFailure(res, error, "Failed to delete IT risk"); }
  });

  app.post("/api/risks/:riskId/actions", ...manage, async (req, res) => {
    const parsed = riskMitigationActionInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid mitigation action", errors: parsed.error.flatten() });
    try {
      const action = await mutateRisk(req, "CREATE_MITIGATION_ACTION", async (tx, risk) => {
        const [action] = await tx.insert(riskMitigationActions).values({
          ...parsed.data, riskId: risk.id, completedAt: parsed.data.status === "Completed" ? new Date() : null,
        }).returning();
        return action;
      });
      res.status(201).json(action);
    } catch (error) { riskFailure(res, error, "Failed to create mitigation action"); }
  });

  app.put("/api/risks/:riskId/actions/:actionId", ...manage, async (req, res) => {
    const parsed = riskMitigationActionInputSchema.partial().strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return res.status(400).json({ message: "Invalid mitigation action", errors: parsed.success ? undefined : parsed.error.flatten() });
    try {
      const action = await mutateRisk(req, "UPDATE_MITIGATION_ACTION", async (tx) => {
      const [previous] = await tx.select().from(riskMitigationActions).where(and(
        eq(riskMitigationActions.id, req.params.actionId), eq(riskMitigationActions.riskId, req.params.riskId),
      )).limit(1);
      if (!previous) throw new RiskInputError("Mitigation action not found", 404);
      const completedAt = parsed.data.status === "Completed" ? previous.completedAt ?? new Date()
        : parsed.data.status ? null : undefined;
      const [action] = await tx.update(riskMitigationActions).set({
        ...parsed.data,
        ...(completedAt !== undefined ? { completedAt } : {}),
        updatedAt: new Date(),
      }).where(eq(riskMitigationActions.id, previous.id)).returning();
      return { ...action, previousValues: previous };
      });
      res.json(action);
    } catch (error) { riskFailure(res, error, "Failed to update mitigation action"); }
  });

  app.delete("/api/risks/:riskId/actions/:actionId", ...manage, async (req, res) => {
    try {
      await mutateRisk(req, "DELETE_MITIGATION_ACTION", async tx => {
      const [action] = await tx.delete(riskMitigationActions).where(and(
        eq(riskMitigationActions.id, req.params.actionId), eq(riskMitigationActions.riskId, req.params.riskId),
      )).returning();
      if (!action) throw new RiskInputError("Mitigation action not found", 404);
      return { deleted: action };
      });
      res.json({ success: true });
    } catch (error) { riskFailure(res, error, "Failed to delete mitigation action"); }
  });

  app.post("/api/risks/:riskId/reviews", ...manage, async (req, res) => {
    const parsed = riskReviewInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid review", errors: parsed.error.flatten() });
    try {
      const result = await mutateRisk(req, "REVIEW", async (tx, risk) => {
      const reviewedAt = new Date();
      const nextReviewDate = addReviewFrequency(reviewedAt, risk.reviewFrequency as typeof IT_RISK_REVIEW_FREQUENCIES[number])
        .toISOString().slice(0, 10);
      const residual = residualRiskScore(risk);
      const [updated] = await tx.update(risks).set({ lastReviewedAt: reviewedAt, nextReviewDate, updatedAt: reviewedAt })
        .where(eq(risks.id, risk.id)).returning();
      const [history] = await tx.insert(riskReviewHistory).values({
        riskId: risk.id, reviewedById: (req.user as any).id, eventType: "review",
        notes: parsed.data.notes ?? null, previousInherentScore: risk.riskScore,
        inherentScore: risk.riskScore, previousResidualScore: residual, residualScore: residual,
        previousStatus: risk.status, status: risk.status,
      }).returning();
      return { risk: updated, history };
      });
      res.status(201).json(result);
    } catch (error) { riskFailure(res, error, "Failed to record risk review"); }
  });

  app.post("/api/risks/:riskId/links", ...manage, async (req, res) => {
    const parsed = z.object({ type: riskLinkTypeSchema, targetId: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Select a valid IT record to link", errors: parsed.error.flatten() });
    try {
      const { type, targetId } = parsed.data;
      const link = linkTypes[type] as any;
      if (!await isFeatureEnabled(link.module)) return sendFeatureNotEnabled(res, link.module);
      const targetTable = link.target as any;
      const [target] = await db.select({ id: targetTable.id }).from(targetTable).where(eq(targetTable.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "The selected linked record was not found" });
      if (type === "changes") {
        const [change] = await db.select({ projectId: changes.projectId }).from(changes).where(eq(changes.id, targetId));
        if (change?.projectId) return res.status(400).json({ message: "Project changes cannot be linked to the internal IT risk register" });
      }
      const result = await mutateRisk(req, "LINK_RECORD", async (tx, risk) => {
        const [created] = await tx.insert(link.table).values({ riskId: risk.id, [link.field]: targetId }).onConflictDoNothing().returning();
        return created ?? { riskId: risk.id, type, targetId };
      });
      res.status(201).json(result);
    } catch (error) { riskFailure(res, error, "Failed to link IT record to risk"); }
  });

  app.delete("/api/risks/:riskId/links/:type/:targetId", ...manage, async (req, res) => {
    const typeParsed = riskLinkTypeSchema.safeParse(req.params.type);
    const targetParsed = z.string().uuid().safeParse(req.params.targetId);
    if (!typeParsed.success || !targetParsed.success) return res.status(400).json({ message: "Invalid risk link" });
    try {
      const link = linkTypes[typeParsed.data] as any;
      const targetColumn = (link.table as any)[link.field];
      await mutateRisk(req, "UNLINK_RECORD", async tx => {
      await tx.delete(link.table).where(and(
        eq((link.table as any).riskId, req.params.riskId),
        eq(targetColumn, targetParsed.data),
      ));
      return { type: typeParsed.data, targetId: targetParsed.data };
      });
      res.json({ success: true });
    } catch (error) { riskFailure(res, error, "Failed to unlink IT record"); }
  });

  app.post("/api/risks/:riskId/spawn-change", ...manage, requireModule("itsm"), async (req, res) => {
    try {
      const change = await mutateRisk(req, "SPAWN_CHANGE", async (tx, risk) => {
      const changeNumber = `CHG-${risk.riskNumber}`;
      const [existing] = await tx.select().from(changes).where(eq(changes.changeNumber, changeNumber));
      const [change] = existing ? [existing] : await tx.insert(changes).values({
        changeNumber,
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
      }).returning();
      await tx.insert(riskChangeLinks).values({ riskId: risk.id, changeId: change.id }).onConflictDoNothing();
      if (!risk.changeId) await tx.update(risks).set({ changeId: change.id, updatedAt: new Date() }).where(eq(risks.id, risk.id));
      return change;
      });
      res.status(201).json(change);
    } catch (error) { riskFailure(res, error, "Failed to spawn change request"); }
  });

  app.post("/api/risks/:riskId/spawn-problem", ...manage, requireModule("itsm"), async (req, res) => {
    try {
      const problem = await mutateRisk(req, "SPAWN_PROBLEM", async (tx, risk) => {
      const problemNumber = `PRB-${risk.riskNumber}`;
      const [existing] = await tx.select().from(problems).where(eq(problems.problemNumber, problemNumber));
      const [problem] = existing ? [existing] : await tx.insert(problems).values({
        problemNumber,
        title: `Risk remediation: ${risk.title}`,
        description: risk.description,
        priority: risk.riskScore >= 16 ? "high" : "medium",
        category: risk.category,
        rootCause: risk.vulnerability,
        workaround: risk.mitigation,
        createdById: (req.user as any).id,
      }).returning();
      await tx.insert(riskProblemLinks).values({ riskId: risk.id, problemId: problem.id }).onConflictDoNothing();
      return problem;
      });
      res.status(201).json(problem);
    } catch (error) { riskFailure(res, error, "Failed to spawn problem record"); }
  });
}
