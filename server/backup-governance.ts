import { respondWithApiError } from "./api-error-handler";
import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs, backupEvidenceAttachments, backupJobRuns, backupRestoreTests, backupSchedules,
  cmdbApplications, servers, users,
} from "@shared/schema";
import { getPersonaRoleKeys, isSystemAdministrator } from "@shared/personas";
import { db } from "./db";
import { storage } from "./storage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Viewer = { id: string; roles: { name: string }[]; permissions: string[] };
type EvidenceKind = "runs" | "restore-tests";
class BackupError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const evidenceUploadLimit = 10 * 1024 * 1024;
const evidenceRoot = resolve(process.env.BACKUP_EVIDENCE_UPLOAD_DIR || "server/uploads/backup-evidence");
const evidenceExtensions = new Set(["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "txt", "csv", "log"]);
const evidenceMimeTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  txt: ["text/plain"],
  log: ["text/plain"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
};
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: evidenceUploadLimit, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    if (!evidenceExtensions.has(extension)) {
      callback(new Error("Supported backup evidence files: PDF, DOCX, XLSX, PNG, JPG, TXT, CSV, and LOG."));
      return;
    }
    callback(null, true);
  },
});

function validateEvidenceFile(file: Pick<Express.Multer.File, "originalname" | "mimetype" | "size" | "buffer">) {
  const extension = extname(file.originalname).slice(1).toLowerCase();
  if (!evidenceExtensions.has(extension) || !evidenceMimeTypes[extension]?.includes(file.mimetype.toLowerCase())) {
    throw new BackupError(400, "Choose an approved evidence file type: PDF, DOCX, XLSX, PNG, JPG, TXT, CSV, or LOG.");
  }
  if (file.size < 1 || file.size > evidenceUploadLimit) {
    throw new BackupError(400, "Evidence files must be between 1 byte and 10 MB.");
  }

  const bytes = file.buffer;
  const validSignature = extension === "pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    : extension === "docx" || extension === "xlsx" ? bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === "jpg" || extension === "jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : !bytes.includes(0) && (() => {
          try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; }
          catch { return false; }
        })();
  if (!validSignature) throw new BackupError(400, "The file contents do not match the selected evidence file type.");
}

function safeEvidenceName(value: string) {
  return basename(value.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").slice(0, 255) || "backup-evidence";
}

const isoDateTime = z.string().datetime({ offset: true });
const scheduleInput = z.object({
  name: z.string().trim().min(1).max(180),
  serverId: z.string().min(1).nullable(),
  applicationId: z.string().min(1).nullable(),
  backupType: z.enum(["full", "incremental", "differential", "snapshot"]),
  frequency: z.enum(["hourly", "daily", "weekly", "monthly", "custom"]),
  customFrequency: z.string().trim().max(160).nullable().optional(),
  retentionDays: z.coerce.number().int().min(1).max(36500),
  retentionPolicy: z.string().trim().max(2000).nullable().optional(),
  destination: z.string().trim().min(1).max(500),
  ownerId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
  nextDueAt: isoDateTime.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Number(Boolean(value.serverId)) + Number(Boolean(value.applicationId)) !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose exactly one server or application target" });
  }
  if (value.frequency === "custom" && !value.customFrequency?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customFrequency"], message: "Describe the custom backup frequency" });
  }
});

const jobRunInput = z.object({
  status: z.enum(["success", "failed", "partial"]),
  startedAt: isoDateTime,
  completedAt: isoDateTime.nullable().optional(),
  dataSizeMb: z.coerce.number().int().min(0).nullable().optional(),
  restorePoint: z.string().trim().max(500).nullable().optional(),
  evidenceReference: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().min(5).max(4000),
}).strict().refine(value => !value.completedAt || new Date(value.completedAt) >= new Date(value.startedAt), {
  message: "Completion time must be after the start time",
  path: ["completedAt"],
});

const restoreTestInput = z.object({
  testedAt: isoDateTime.optional(),
  outcome: z.enum(["passed", "failed", "partial"]),
  recoveryPoint: z.string().trim().max(500).nullable().optional(),
  measuredRtoMinutes: z.coerce.number().int().min(0).nullable().optional(),
  measuredRpoMinutes: z.coerce.number().int().min(0).nullable().optional(),
  evidenceReference: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().min(5).max(4000),
}).strict();

async function loadViewer(req: Request): Promise<Viewer> {
  if (!req.user?.id) throw new BackupError(401, "Authentication required");
  const [roles, permissions] = await Promise.all([
    storage.getUserRoles(req.user.id),
    storage.getUserPermissions(req.user.id),
  ]);
  return { id: req.user.id, roles, permissions };
}

function isManager(user: Viewer): boolean {
  const personas = getPersonaRoleKeys(user.roles.map(role => role.name));
  return isSystemAdministrator(user) || user.permissions.includes("asset_update") ||
    personas.some(role => role === "it_agent" || role === "it_manager");
}

function canRead(user: Viewer): boolean {
  const personas = getPersonaRoleKeys(user.roles.map(role => role.name));
  return isManager(user) ||
    user.permissions.some(permission => ["asset_view", "cmdb_view", "audit_view", "compliance_view"].includes(permission)) ||
    personas.some(role => role === "auditor");
}

async function evidenceRowsFor(kind: EvidenceKind, recordIds: string[]) {
  if (!recordIds.length) return [];
  const base = {
    id: backupEvidenceAttachments.id,
    jobRunId: backupEvidenceAttachments.jobRunId,
    restoreTestId: backupEvidenceAttachments.restoreTestId,
    version: backupEvidenceAttachments.version,
    originalName: backupEvidenceAttachments.originalName,
    fileType: backupEvidenceAttachments.fileType,
    fileSize: backupEvidenceAttachments.fileSize,
    uploadedAt: backupEvidenceAttachments.uploadedAt,
    uploadedBy: backupEvidenceAttachments.uploadedBy,
    uploadedByName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
  };
  const rows = await (kind === "runs"
    ? db.select(base).from(backupEvidenceAttachments).leftJoin(users, eq(backupEvidenceAttachments.uploadedBy, users.id))
      .where(inArray(backupEvidenceAttachments.jobRunId, recordIds))
    : db.select(base).from(backupEvidenceAttachments).leftJoin(users, eq(backupEvidenceAttachments.uploadedBy, users.id))
      .where(inArray(backupEvidenceAttachments.restoreTestId, recordIds)))
    .orderBy(desc(backupEvidenceAttachments.uploadedAt), desc(backupEvidenceAttachments.version));
  return rows;
}

function advanceDueDate(from: Date, frequency: string): Date | null {
  const next = new Date(from);
  switch (frequency) {
    case "hourly": next.setUTCHours(next.getUTCHours() + 1); return next;
    case "daily": next.setUTCDate(next.getUTCDate() + 1); return next;
    case "weekly": next.setUTCDate(next.getUTCDate() + 7); return next;
    case "monthly": {
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
      return next;
    }
    default: return null;
  }
}

async function writeAudit(
  tx: Transaction,
  req: Request,
  userId: string,
  action: string,
  tableName: string,
  recordId: string,
  recordName: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(auditLogs).values({
    userId,
    action,
    tableName,
    recordId,
    recordName,
    oldValues: before == null ? null : JSON.stringify(before),
    newValues: after == null ? null : JSON.stringify(after),
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

export function registerBackupGovernanceRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAssetManagement: RequestHandler,
) {
  const route = (
    write: boolean,
    handler: (req: Request, res: Response, viewer: Viewer) => Promise<unknown>,
  ): RequestHandler => async (req, res) => {
    try {
      const user = await loadViewer(req);
      if (write ? !isManager(user) : !canRead(user)) {
        throw new BackupError(403, write ? "Backup register edit access required" : "Backup register access required");
      }
      await handler(req, res, user);
    } catch (error) {
      if (error instanceof BackupError) return void res.status(error.status).json({ message: error.message });
        if (error instanceof z.ZodError) return void res.status(400).json({ message: "Invalid backup governance data", errors: error.issues });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return void res.status(409).json({ message: "This backup record already exists" });
      if (code === "23503") return void res.status(409).json({ message: "This backup record is still referenced" });
      console.error("Backup governance request failed", error instanceof Error ? error.message : "Unknown error");
      respondWithApiError(res, error, "Backup governance request failed");
    }
  };
  const requireManager: RequestHandler = async (req, res, next) => {
    try {
      if (!isManager(await loadViewer(req))) {
        return void res.status(403).json({ message: "Backup register edit access required" });
      }
      next();
    } catch (error) {
      if (error instanceof BackupError) return void res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Could not verify backup evidence access");
    }
  };
  const parseEvidenceUpload: RequestHandler = (req, res, next) => {
    evidenceUpload.single("file")(req, res, error => {
      if (!error) return next();
      const message = (error as any).code === "LIMIT_FILE_SIZE"
        ? "Evidence files must not exceed 10 MB."
        : error.message || "Could not upload backup evidence.";
      res.status(400).json({ message });
    });
  };
  const getEvidenceParent = async (kind: EvidenceKind, id: string, executor: any = db) => {
    if (kind === "runs") {
      const [row] = await executor.select({
        id: backupJobRuns.id, scheduleId: backupJobRuns.scheduleId, label: backupSchedules.name,
      }).from(backupJobRuns).innerJoin(backupSchedules, eq(backupJobRuns.scheduleId, backupSchedules.id))
        .where(eq(backupJobRuns.id, id)).limit(1);
      return row ?? null;
    }
    const [row] = await executor.select({
      id: backupRestoreTests.id, scheduleId: backupRestoreTests.scheduleId, label: backupSchedules.name,
    }).from(backupRestoreTests).innerJoin(backupSchedules, eq(backupRestoreTests.scheduleId, backupSchedules.id))
      .where(eq(backupRestoreTests.id, id)).limit(1);
    return row ?? null;
  };
  const registerEvidenceEndpoints = (kind: EvidenceKind, collectionPath: string) => {
    app.get(`${collectionPath}/:id/evidence`, requireAuth, requireAssetManagement, route(false, async (req, res) => {
      const parent = await getEvidenceParent(kind, req.params.id);
      if (!parent) throw new BackupError(404, "Backup record not found");
      res.json(await evidenceRowsFor(kind, [parent.id]));
    }));
    app.post(`${collectionPath}/:id/evidence`, requireAuth, requireAssetManagement, requireManager, parseEvidenceUpload,
      route(true, async (req, res, user) => {
        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) throw new BackupError(400, "Choose an evidence file to upload.");
        validateEvidenceFile(file);
        const originalName = safeEvidenceName(file.originalname);
        const id = randomUUID();
        const extension = extname(originalName).toLowerCase();
        const fileName = `${id}${extension}`;
        const filePath = resolve(evidenceRoot, fileName);
        try {
          await mkdir(evidenceRoot, { recursive: true });
          await writeFile(filePath, file.buffer, { flag: "wx" });
          const attachment = await db.transaction(async tx => {
            const parent = await getEvidenceParent(kind, req.params.id, tx);
            if (!parent) throw new BackupError(404, "Backup record not found");
            if (kind === "runs") {
              await tx.select({ id: backupJobRuns.id }).from(backupJobRuns)
                .where(eq(backupJobRuns.id, parent.id)).for("update");
            } else {
              await tx.select({ id: backupRestoreTests.id }).from(backupRestoreTests)
                .where(eq(backupRestoreTests.id, parent.id)).for("update");
            }
            const prior = kind === "runs"
              ? await tx.select({ version: backupEvidenceAttachments.version, originalName: backupEvidenceAttachments.originalName })
                .from(backupEvidenceAttachments).where(eq(backupEvidenceAttachments.jobRunId, parent.id))
              : await tx.select({ version: backupEvidenceAttachments.version, originalName: backupEvidenceAttachments.originalName })
                .from(backupEvidenceAttachments).where(eq(backupEvidenceAttachments.restoreTestId, parent.id));
            const matchingVersions = prior.filter(row => row.originalName.trim().toLowerCase() === originalName.trim().toLowerCase())
              .map(row => row.version);
            const version = Math.max(0, ...matchingVersions) + 1;
            const [created] = await tx.insert(backupEvidenceAttachments).values({
              id,
              ...(kind === "runs" ? { jobRunId: parent.id } : { restoreTestId: parent.id }),
              version,
              originalName,
              fileName,
              fileType: file.mimetype,
              fileSize: file.size,
              filePath,
              uploadedBy: user.id,
            }).returning();
            const { filePath: _storedPath, fileName: _generatedName, ...metadata } = created;
            await tx.insert(auditLogs).values({
              userId: user.id,
              action: "CREATE",
              tableName: "backup_evidence_attachments",
              recordId: created.id,
              recordName: `${kind === "runs" ? "Backup run" : "Restore test"}: ${originalName} v${version}`,
              newValues: JSON.stringify(metadata),
              ipAddress: req.ip ?? null,
              userAgent: req.get("user-agent") ?? null,
            });
            return { ...metadata, uploadedByName: null };
          });
          res.status(201).json(attachment);
        } catch (error) {
          await unlink(filePath).catch(() => {});
          throw error;
        }
      }));
    app.get(`${collectionPath}/:id/evidence/:attachmentId`, requireAuth, requireAssetManagement, route(false, async (req, res) => {
      const parent = await getEvidenceParent(kind, req.params.id);
      if (!parent) throw new BackupError(404, "Backup record not found");
      const [attachment] = await db.select().from(backupEvidenceAttachments).where(kind === "runs"
        ? eq(backupEvidenceAttachments.jobRunId, parent.id)
        : eq(backupEvidenceAttachments.restoreTestId, parent.id));
      if (!attachment || attachment.id !== req.params.attachmentId) throw new BackupError(404, "Evidence file not found");
      res.download(attachment.filePath, attachment.originalName, error => {
        if (error && !res.headersSent) res.status(404).json({ message: "Evidence file is unavailable." });
      });
    }));
  };

  app.get("/api/backup-schedules/options", requireAuth, requireAssetManagement, route(false, async (_req, res, user) => {
    const [serverRows, applicationRows, ownerRows] = await Promise.all([
      db.select({ id: servers.id, name: servers.hostname, status: servers.status }).from(servers).orderBy(asc(servers.hostname)),
      db.select({ id: cmdbApplications.id, name: cmdbApplications.name, status: cmdbApplications.status }).from(cmdbApplications).orderBy(asc(cmdbApplications.name)),
      isManager(user)
        ? db.select({
          id: users.id,
          name: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.firstName), asc(users.lastName))
        : Promise.resolve([]),
    ]);
    res.json({ servers: serverRows, applications: applicationRows, owners: ownerRows });
  }));

  app.get("/api/backup-schedules", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    const schedules = await db.select().from(backupSchedules).orderBy(desc(backupSchedules.updatedAt));
    if (!schedules.length) return res.json([]);
    const [runs, tests, serverRows, applicationRows] = await Promise.all([
      db.select().from(backupJobRuns).where(inArray(backupJobRuns.scheduleId, schedules.map(row => row.id)))
        .orderBy(desc(backupJobRuns.startedAt)),
      db.select().from(backupRestoreTests).where(inArray(backupRestoreTests.scheduleId, schedules.map(row => row.id)))
        .orderBy(desc(backupRestoreTests.testedAt)),
      db.select({ id: servers.id, name: servers.hostname }).from(servers),
      db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications),
    ]);
    const latestRuns = new Map<string, typeof runs[number]>();
    const latestTests = new Map<string, typeof tests[number]>();
    for (const run of runs) if (!latestRuns.has(run.scheduleId)) latestRuns.set(run.scheduleId, run);
    for (const test of tests) if (!latestTests.has(test.scheduleId)) latestTests.set(test.scheduleId, test);
    const serverNames = new Map(serverRows.map(row => [row.id, row.name]));
    const applicationNames = new Map(applicationRows.map(row => [row.id, row.name]));
    res.json(schedules.map(schedule => ({
      ...schedule,
      targetName: schedule.serverId
        ? serverNames.get(schedule.serverId) ?? "Removed server"
        : applicationNames.get(schedule.applicationId!) ?? "Removed application",
      targetType: schedule.serverId ? "server" : "application",
      latestJob: latestRuns.get(schedule.id) ?? null,
      latestRestoreTest: latestTests.get(schedule.id) ?? null,
    })));
  }));
  app.post("/api/backup-schedules", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = scheduleInput.parse(req.body);
    const [created] = await db.transaction(async tx => {
      const [row] = await tx.insert(backupSchedules).values({
        ...input,
        nextDueAt: input.nextDueAt ? new Date(input.nextDueAt) : null,
        createdById: user.id,
      }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "backup_schedules", row.id, row.name, null, row);
      return [row];
    });
    res.status(201).json(created);
  }));
  app.put("/api/backup-schedules/:id", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = scheduleInput.parse(req.body);
    const updated = await db.transaction(async tx => {
      const [before] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update");
      if (!before) throw new BackupError(404, "Backup schedule not found");
      const [after] = await tx.update(backupSchedules).set({
        ...input,
        nextDueAt: input.nextDueAt === undefined ? before.nextDueAt : input.nextDueAt ? new Date(input.nextDueAt) : null,
        updatedAt: new Date(),
      }).where(eq(backupSchedules.id, before.id)).returning();
      await writeAudit(tx, req, user.id, "UPDATE", "backup_schedules", after.id, after.name, before, after);
      return after;
    });
    res.json(updated);
  }));

  app.get("/api/backup-schedules/runs", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    const rows = await db.select({
      ...getTableColumns(backupJobRuns),
      scheduleName: backupSchedules.name,
      serverId: backupSchedules.serverId,
      applicationId: backupSchedules.applicationId,
    }).from(backupJobRuns).innerJoin(backupSchedules, eq(backupJobRuns.scheduleId, backupSchedules.id))
      .orderBy(desc(backupJobRuns.startedAt)).limit(1000);
    if (!rows.length) return res.json([]);
    const serverIds = Array.from(new Set<string>(rows.flatMap(row => row.serverId ? [row.serverId] : [])));
    const applicationIds = Array.from(new Set<string>(rows.flatMap(row => row.applicationId ? [row.applicationId] : [])));
    const [serverRows, applicationRows] = await Promise.all([
      serverIds.length ? db.select({ id: servers.id, name: servers.hostname }).from(servers).where(inArray(servers.id, serverIds)) : Promise.resolve([]),
      applicationIds.length ? db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications).where(inArray(cmdbApplications.id, applicationIds)) : Promise.resolve([]),
    ]);
    const names = new Map<string, string>([...serverRows, ...applicationRows].map(row => [row.id, row.name]));
    const evidence = await evidenceRowsFor("runs", rows.map(row => row.id));
    const evidenceByRecord = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const list = evidenceByRecord.get(item.jobRunId!) ?? [];
      list.push(item);
      evidenceByRecord.set(item.jobRunId!, list);
    }
    res.json(rows.map(row => ({
      ...row,
      targetName: names.get(row.serverId ?? row.applicationId ?? "") ?? "Removed target",
      evidence: evidenceByRecord.get(row.id) ?? [],
    })));
  }));
  app.get("/api/backup-schedules/restore-tests", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    const rows = await db.select({
      ...getTableColumns(backupRestoreTests),
      scheduleName: backupSchedules.name,
      serverId: backupSchedules.serverId,
      applicationId: backupSchedules.applicationId,
    }).from(backupRestoreTests).innerJoin(backupSchedules, eq(backupRestoreTests.scheduleId, backupSchedules.id))
      .orderBy(desc(backupRestoreTests.testedAt)).limit(1000);
    if (!rows.length) return res.json([]);
    const serverIds = Array.from(new Set<string>(rows.flatMap(row => row.serverId ? [row.serverId] : [])));
    const applicationIds = Array.from(new Set<string>(rows.flatMap(row => row.applicationId ? [row.applicationId] : [])));
    const [serverRows, applicationRows] = await Promise.all([
      serverIds.length ? db.select({ id: servers.id, name: servers.hostname }).from(servers).where(inArray(servers.id, serverIds)) : Promise.resolve([]),
      applicationIds.length ? db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications).where(inArray(cmdbApplications.id, applicationIds)) : Promise.resolve([]),
    ]);
    const names = new Map<string, string>([...serverRows, ...applicationRows].map(row => [row.id, row.name]));
    const evidence = await evidenceRowsFor("restore-tests", rows.map(row => row.id));
    const evidenceByRecord = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const list = evidenceByRecord.get(item.restoreTestId!) ?? [];
      list.push(item);
      evidenceByRecord.set(item.restoreTestId!, list);
    }
    res.json(rows.map(row => ({
      ...row,
      targetName: names.get(row.serverId ?? row.applicationId ?? "") ?? "Removed target",
      evidence: evidenceByRecord.get(row.id) ?? [],
    })));
  }));

  app.post("/api/backup-schedules/:id/runs", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = jobRunInput.parse(req.body);
    const created = await db.transaction(async tx => {
      const [schedule] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update");
      if (!schedule) throw new BackupError(404, "Backup schedule not found");
      const [run] = await tx.insert(backupJobRuns).values({
        ...input,
        scheduleId: schedule.id,
        startedAt: new Date(input.startedAt),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        loggedById: user.id,
      }).returning();
      const nextBase = run.completedAt ?? run.startedAt;
      const nextDue = advanceDueDate(nextBase, schedule.frequency);
      const [after] = await tx.update(backupSchedules).set({
        nextDueAt: nextDue,
        updatedAt: new Date(),
      }).where(eq(backupSchedules.id, schedule.id)).returning();
      await writeAudit(tx, req, user.id, "CREATE", "backup_job_runs", run.id, schedule.name, null, run);
      await writeAudit(tx, req, user.id, "UPDATE", "backup_schedules", after.id, after.name, schedule, after);
      return run;
    });
    res.status(201).json(created);
  }));
  app.post("/api/backup-schedules/:id/restore-tests", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = restoreTestInput.parse(req.body);
    const created = await db.transaction(async tx => {
      const [schedule] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update");
      if (!schedule) throw new BackupError(404, "Backup schedule not found");
      const [test] = await tx.insert(backupRestoreTests).values({
        ...input,
        scheduleId: schedule.id,
        testedAt: input.testedAt ? new Date(input.testedAt) : new Date(),
        testerId: user.id,
      }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "backup_restore_tests", test.id, schedule.name, null, test);
      return test;
    });
    res.status(201).json(created);
  }));
  registerEvidenceEndpoints("runs", "/api/backup-schedules/runs");
  registerEvidenceEndpoints("restore-tests", "/api/backup-schedules/restore-tests");
}

export const __backupGovernanceTestUtils = { advanceDueDate, validateEvidenceFile, evidenceUploadLimit };
