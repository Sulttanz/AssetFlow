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
  } else if (current.status === "in_progress" && current.startedAt) {
    // A duplicate retry may have waited for the row lock; it belongs to the
    // active attempt and must not move that attempt's start time.
    next.startedAt = current.startedAt;
  }

  // Completion belongs to the attempt that just ended, not the new one.
  next.completedAt = null;
  return next;
}
