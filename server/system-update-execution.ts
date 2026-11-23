import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { auditLogs, systemUpdateJobs } from "@shared/schema";
import { db } from "./db";
import { compareAppVersions } from "./startup-migrations";
import { readPackageAppVersion } from "./app-release-history";
import { checkSystemUpdate } from "./system-update-check";

const UPDATE_JOB_LOCK_ID = 24871015;
const STALE_UPDATE_AFTER_MS = 60 * 60 * 1000;
const MAX_SCRIPT_TIMEOUT_MS = 60 * 60 * 1000;

export type UpdateRuntimeEnvironment = "replit" | "self_hosted";
export type UpdateJobStatus = "idle" | "running" | "restarting" | "republish_required" | "failed";
export type UpdateApplicationDecision = "idle" | "republish_required" | "self_hosted_apply";

export type SystemUpdateStatusResponse = {
  runtimeEnvironment: UpdateRuntimeEnvironment;
  status: UpdateJobStatus;
  currentVersion: string;
  targetVersion: string | null;
  message: string;
  startedAt: string | null;
  updatedAt: string;
};

export function detectUpdateRuntime(env: NodeJS.ProcessEnv = process.env): UpdateRuntimeEnvironment {
  return env.REPLIT_DEPLOYMENT === "1" || Boolean(env.REPL_ID) ? "replit" : "self_hosted";
}

export function decideUpdateApplication(
  runtime: UpdateRuntimeEnvironment,
  updateAvailable: boolean,
): UpdateApplicationDecision {
  if (!updateAvailable) return "idle";
  return runtime === "replit" ? "republish_required" : "self_hosted_apply";
}

function statusResponse(
  runtimeEnvironment: UpdateRuntimeEnvironment,
  currentVersion: string,
  job?: typeof systemUpdateJobs.$inferSelect,
): SystemUpdateStatusResponse {
  return {
    runtimeEnvironment,
    status: (job?.status as UpdateJobStatus | undefined) ?? "idle",
    currentVersion,
    targetVersion: job?.targetVersion ?? null,
    message: job?.message ?? "No update operation is currently running.",
    startedAt: job?.startedAt?.toISOString() ?? null,
    updatedAt: job?.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

function auditValues(status: string, message: string, version: string, runtime: string) {
  return JSON.stringify({ status, message, version, runtimeEnvironment: runtime });
}

async function insertUpdateAudit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    action: string;
    jobId: string;
    recordName: string;
    userId: string | null;
    oldValues?: string | null;
    newValues: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  await tx.insert(auditLogs).values({
    userId: input.userId,
    action: input.action,
    tableName: "system_update_jobs",
    recordId: input.jobId,
    recordName: input.recordName,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

async function setJobStatus(
  jobId: string,
  status: UpdateJobStatus,
  message: string,
  audit: { userId: string | null; ipAddress?: string | null; userAgent?: string | null },
  finished = false,
) {
  return db.transaction(async tx => {
    const [before] = await tx.select().from(systemUpdateJobs).where(eq(systemUpdateJobs.id, jobId)).limit(1);
    if (!before) return null;
    const [after] = await tx.update(systemUpdateJobs).set({
      status,
      message,
      updatedAt: new Date(),
      finishedAt: finished ? new Date() : null,
    }).where(eq(systemUpdateJobs.id, jobId)).returning();
    await insertUpdateAudit(tx, {
      action: "UPDATE",
      jobId,
      recordName: `${before.currentVersion} → ${before.targetVersion ?? "no release target"}`,
      userId: audit.userId,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      oldValues: auditValues(before.status, before.message, before.currentVersion, before.runtimeEnvironment),
      newValues: auditValues(after.status, after.message, after.currentVersion, after.runtimeEnvironment),
    });
    return after;
  });
}

async function recordOneShotStatus(input: {
  currentVersion: string;
  targetVersion: string | null;
  runtime: UpdateRuntimeEnvironment;
  status: UpdateJobStatus;
  message: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const id = randomUUID();
  return db.transaction(async tx => {
    const [job] = await tx.insert(systemUpdateJobs).values({
      id,
      requestedByUserId: input.userId,
      currentVersion: input.currentVersion,
      targetVersion: input.targetVersion,
      runtimeEnvironment: input.runtime,
      status: input.status,
      message: input.message,
      ...(input.status === "idle" || input.status === "failed" ? { finishedAt: new Date() } : {}),
    }).returning();
    await insertUpdateAudit(tx, {
      action: input.status === "republish_required" ? "REPUBLISH_REQUIRED" : "APPLY_NOT_STARTED",
      jobId: id,
      recordName: `${input.currentVersion} → ${input.targetVersion ?? "no release target"}`,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      newValues: auditValues(input.status, input.message, input.currentVersion, input.runtime),
    });
    return job;
  });
}

async function claimUpdateJob(input: {
  currentVersion: string;
  targetVersion: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const id = randomUUID();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${UPDATE_JOB_LOCK_ID})`);
    const [active] = await tx.select().from(systemUpdateJobs)
      .where(inArray(systemUpdateJobs.status, ["running", "restarting"]))
      .orderBy(desc(systemUpdateJobs.startedAt))
      .limit(1);
    if (active) {
      const age = Date.now() - active.updatedAt.getTime();
      if (age <= STALE_UPDATE_AFTER_MS) return { job: active, alreadyRunning: true };
      const [failed] = await tx.update(systemUpdateJobs).set({
        status: "failed",
        message: "A previous update operation stopped responding and was marked failed.",
        updatedAt: new Date(),
        finishedAt: new Date(),
      }).where(eq(systemUpdateJobs.id, active.id)).returning();
      await insertUpdateAudit(tx, {
        action: "UPDATE",
        jobId: active.id,
        recordName: `${active.currentVersion} → ${active.targetVersion ?? "no release target"}`,
        userId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        oldValues: auditValues(active.status, active.message, active.currentVersion, active.runtimeEnvironment),
        newValues: auditValues(failed.status, failed.message, failed.currentVersion, failed.runtimeEnvironment),
      });
    }

    const [job] = await tx.insert(systemUpdateJobs).values({
      id,
      requestedByUserId: input.userId,
      currentVersion: input.currentVersion,
      targetVersion: input.targetVersion,
      runtimeEnvironment: "self_hosted",
      status: "running",
      message: "Update job accepted; preparing to verify the pre-update backup.",
    }).returning();
    await insertUpdateAudit(tx, {
      action: "APPLY_STARTED",
      jobId: id,
      recordName: `${input.currentVersion} → ${input.targetVersion}`,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      newValues: auditValues(job.status, job.message, job.currentVersion, job.runtimeEnvironment),
    });
    return { job, alreadyRunning: false };
  });
}

async function findActiveUpdateJob() {
  const [job] = await db.select().from(systemUpdateJobs)
    .where(inArray(systemUpdateJobs.status, ["running", "restarting"]))
    .orderBy(desc(systemUpdateJobs.startedAt))
    .limit(1);
  return job ?? null;
}

async function auditConflictingApply(input: {
  job: typeof systemUpdateJobs.$inferSelect;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await db.insert(auditLogs).values({
    userId: input.userId,
    action: "APPLY_CONFLICT",
    tableName: "system_update_jobs",
    recordId: input.job.id,
    recordName: `${input.job.currentVersion} → ${input.job.targetVersion ?? "no release target"}`,
    oldValues: null,
    newValues: auditValues(input.job.status, "Another update job is already active.", input.job.currentVersion, input.job.runtimeEnvironment),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

async function validatedExecutablePath(value: string | undefined): Promise<string | null> {
  if (!value || !path.isAbsolute(value)) return null;
  try {
    const info = await lstat(value);
    if (!info.isFile() || (info.mode & 0o111) === 0 || (info.mode & 0o022) !== 0) return null;
    return value;
  } catch {
    return null;
  }
}

function runScript(scriptPath: string, targetVersion: string, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    let finished = false;
    const child = spawn(scriptPath, [targetVersion], {
      cwd: process.cwd(),
      env: { ...process.env, UPDATE_TARGET_VERSION: targetVersion },
      shell: false,
      stdio: "ignore",
    });
    const finish = (success: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(success);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const forceKill = setTimeout(() => child.kill("SIGKILL"), 5000);
      forceKill.unref();
      finish(false);
    }, Math.max(1000, Math.min(timeoutMs, MAX_SCRIPT_TIMEOUT_MS)));
    child.once("error", () => finish(false));
    child.once("exit", code => finish(code === 0));
  });
}

function launchDetachedRestart(
  scriptPath: string,
  targetVersion: string,
  onNonZeroExit: () => void,
): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    let spawned = false;
    const child = spawn(scriptPath, [targetVersion], {
      cwd: process.cwd(),
      env: { ...process.env, UPDATE_TARGET_VERSION: targetVersion },
      shell: false,
      detached: true,
      stdio: "ignore",
    });
    child.once("spawn", () => {
      if (settled) return;
      spawned = true;
      settled = true;
      child.unref();
      resolve(true);
    });
    child.once("exit", code => {
      if (spawned && code !== 0) onNonZeroExit();
    });
    child.once("error", () => {
      if (settled) return;
      settled = true;
      resolve(false);
    });
  });
}

async function executeUpdateJob(
  jobId: string,
  targetVersion: string,
  scripts: { backup: string; update: string; restart: string },
  audit: { userId: string; ipAddress?: string | null; userAgent?: string | null },
) {
  try {
    await setJobStatus(jobId, "running", "Creating and validating the pre-update backup.", audit);
    if (!await runScript(scripts.backup, targetVersion, 10 * 60 * 1000)) {
      await setJobStatus(jobId, "failed", "The pre-update backup check failed; no release changes were started.", audit, true);
      return;
    }

    await setJobStatus(jobId, "running", "Backup verified; fetching and staging the selected release.", audit);
    if (!await runScript(scripts.update, targetVersion, MAX_SCRIPT_TIMEOUT_MS)) {
      await setJobStatus(jobId, "failed", "Release staging failed. Check the self-hosted update adapter logs.", audit, true);
      return;
    }

    await setJobStatus(jobId, "restarting", "Release staged; requesting a detached service restart.", audit);
    const markRestartFailed = () => {
      void setJobStatus(jobId, "failed", "The detached restart script exited unsuccessfully.", audit, true)
        .catch(() => console.error("Could not persist the detached restart failure status."));
    };
    if (!await launchDetachedRestart(scripts.restart, targetVersion, markRestartFailed)) {
      await setJobStatus(jobId, "failed", "The detached restart could not be started.", audit, true);
    }
  } catch {
    try {
      await setJobStatus(jobId, "failed", "The update operation failed. Check restricted server-side adapter logs.", audit, true);
    } catch {
      // Do not create an unhandled rejection if the database is also unavailable.
      console.error("Could not persist the final system update failure status.");
    }
  }
}

export async function applySystemUpdate(input: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
}) {
  const env = input.env ?? process.env;
  const runtime = detectUpdateRuntime(env);
  const currentVersion = readPackageAppVersion();
  const activeJob = await findActiveUpdateJob();
  if (activeJob && Date.now() - activeJob.updatedAt.getTime() <= STALE_UPDATE_AFTER_MS) {
    await auditConflictingApply({ job: activeJob, userId: input.userId, ipAddress: input.ipAddress, userAgent: input.userAgent });
    return { httpStatus: 409, status: statusResponse(runtime, currentVersion, activeJob) };
  }
  const check = await checkSystemUpdate({
    currentVersion,
    env,
    fetcher: input.fetcher,
  });

  const decision = decideUpdateApplication(runtime, check.updateAvailable && Boolean(check.latestAvailableVersion));
  if (decision === "idle") {
    const message = check.source === "none" && !check.message.includes("No release source is configured")
      ? check.message
      : check.source === "none"
        ? "No release source is configured; no update was started."
        : `No newer release is available than ${currentVersion}.`;
    const status: UpdateJobStatus = check.source === "none" && !check.message.includes("No release source is configured")
      ? "failed"
      : "idle";
    const job = await recordOneShotStatus({
      currentVersion,
      targetVersion: check.latestAvailableVersion,
      runtime,
      status,
      message,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { httpStatus: status === "failed" ? 503 : 200, status: statusResponse(runtime, currentVersion, job) };
  }
  const targetVersion = check.latestAvailableVersion;
  if (!targetVersion) {
    throw new Error("No verified release target was available.");
  }

  if (decision === "republish_required") {
    const message = env.REPLIT_DEPLOYMENT === "1"
      ? `Replit has a newer release (${targetVersion}); click Republish to promote the new build snapshot.`
      : `A newer release (${targetVersion}) is available. Publish this Replit workspace; published deployments require Republish.`;
    const job = await recordOneShotStatus({
      currentVersion,
      targetVersion,
      runtime,
      status: "republish_required",
      message,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { httpStatus: 200, status: statusResponse(runtime, currentVersion, job) };
  }

  const backupScript = await validatedExecutablePath(env.SELF_HOSTED_UPDATE_BACKUP_CHECK_SCRIPT);
  const updateScript = await validatedExecutablePath(env.SELF_HOSTED_UPDATE_SCRIPT);
  const restartScript = await validatedExecutablePath(env.SELF_HOSTED_UPDATE_RESTART_SCRIPT);
  if (!backupScript || !updateScript || !restartScript) {
    const message = "Self-hosted automatic updates are not configured. Configure the backup-check, release-staging, and detached-restart scripts before applying updates.";
    const job = await recordOneShotStatus({
      currentVersion,
      targetVersion,
      runtime,
      status: "idle",
      message,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { httpStatus: 200, status: statusResponse(runtime, currentVersion, job) };
  }

  const claimed = await claimUpdateJob({
    currentVersion,
    targetVersion,
    userId: input.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  if (claimed.alreadyRunning) {
    return {
      httpStatus: 409,
      status: statusResponse(runtime, currentVersion, claimed.job),
    };
  }

  const audit = {
    userId: input.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
  setImmediate(() => {
    void executeUpdateJob(claimed.job.id, targetVersion, {
      backup: backupScript,
      update: updateScript,
      restart: restartScript,
    }, audit);
  });
  return { httpStatus: 202, status: statusResponse(runtime, currentVersion, claimed.job) };
}

async function failStaleRestartingJob() {
  const [job] = await db.select().from(systemUpdateJobs)
    .where(inArray(systemUpdateJobs.status, ["running", "restarting"]))
    .orderBy(desc(systemUpdateJobs.startedAt))
    .limit(1);
  if (!job || Date.now() - job.updatedAt.getTime() < STALE_UPDATE_AFTER_MS) return job;
  return setJobStatus(job.id, "failed", "The update job did not complete within the allowed time and was marked failed.", {
    userId: job.requestedByUserId,
  }, true);
}

export async function getSystemUpdateJobStatus(env: NodeJS.ProcessEnv = process.env): Promise<SystemUpdateStatusResponse> {
  const runtime = detectUpdateRuntime(env);
  const currentVersion = readPackageAppVersion();
  const job = await failStaleRestartingJob();
  if (job) return statusResponse(runtime, currentVersion, job);
  const [latestJob] = await db.select().from(systemUpdateJobs)
    .orderBy(desc(systemUpdateJobs.startedAt))
    .limit(1);
  return statusResponse(runtime, currentVersion, latestJob);
}

export async function reconcileSystemUpdateJobAtStartup(currentVersion = readPackageAppVersion()) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${UPDATE_JOB_LOCK_ID})`);
    const [job] = await tx.select().from(systemUpdateJobs)
      .where(inArray(systemUpdateJobs.status, ["running", "restarting", "republish_required"]))
      .orderBy(desc(systemUpdateJobs.startedAt))
      .limit(1);
    if (!job) return null;
    const installed = compareAppVersions(currentVersion, job.targetVersion ?? job.currentVersion) >= 0;
    if (job.status === "republish_required" && !installed) return null;
    const status: UpdateJobStatus = installed ? "idle" : "failed";
    const message = installed
      ? `Update applied successfully; this service is now running ${currentVersion}.`
      : `The service restarted without activating the requested version ${job.targetVersion ?? "unknown"}.`;
    const [updated] = await tx.update(systemUpdateJobs).set({
      status,
      message,
      updatedAt: new Date(),
      finishedAt: new Date(),
    }).where(eq(systemUpdateJobs.id, job.id)).returning();
    await insertUpdateAudit(tx, {
      action: installed ? "UPDATE_APPLIED" : "UPDATE_FAILED",
      jobId: job.id,
      recordName: `${job.currentVersion} → ${job.targetVersion ?? "no release target"}`,
      userId: job.requestedByUserId,
      oldValues: auditValues(job.status, job.message, job.currentVersion, job.runtimeEnvironment),
      newValues: auditValues(updated.status, updated.message, updated.currentVersion, updated.runtimeEnvironment),
    });
    return updated;
  });
}
