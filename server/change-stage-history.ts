import type { ChangeEnvironmentStage, InsertChangeEnvironmentStage } from "@shared/schema";

type StageUpdate = Partial<InsertChangeEnvironmentStage> & { deployedById?: string | null };

function asIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function withStageRetryHistory(
  current: Pick<ChangeEnvironmentStage, "status" | "startedAt" | "completedAt" | "attempts">,
  updates: StageUpdate,
): StageUpdate {
  const next = { ...updates };
  if (updates.status !== "in_progress") return next;

  if (current.status === "completed" || current.status === "failed") {
    next.attempts = [
      ...(current.attempts ?? []),
      {
        status: current.status,
        startedAt: asIsoString(current.startedAt),
        completedAt: asIsoString(current.completedAt),
      },
    ];
  }

  // Completion belongs to the attempt that just ended, not the new one.
  next.completedAt = null;
  return next;
}
