// @vitest-environment node
import { describe, expect, it } from "vitest";
import { withStageRetryHistory } from "./change-stage-history";

describe("deployment stage retry history", () => {
  it.each(["completed", "failed"] as const)("archives a %s attempt before starting the next one", status => {
    const priorStartedAt = new Date("2026-06-02T10:00:00.000Z");
    const priorCompletedAt = new Date("2026-06-02T10:30:00.000Z");
    const nextStartedAt = new Date("2026-06-02T11:00:00.000Z");
    const current = {
      status,
      startedAt: priorStartedAt,
      completedAt: priorCompletedAt,
      attempts: [{
        status: "failed" as const,
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: "2026-06-01T09:20:00.000Z",
      }],
    };

    expect(withStageRetryHistory(current, {
      status: "in_progress",
      startedAt: nextStartedAt,
      completedAt: priorCompletedAt,
    })).toEqual({
      status: "in_progress",
      startedAt: nextStartedAt,
      completedAt: null,
      attempts: [
        {
          status: "failed",
          startedAt: "2026-06-01T09:00:00.000Z",
          completedAt: "2026-06-01T09:20:00.000Z",
        },
        {
          status,
          startedAt: priorStartedAt.toISOString(),
          completedAt: priorCompletedAt.toISOString(),
        },
      ],
    });
  });

  it("preserves the active attempt and timeline when a duplicate retry arrives", () => {
    const priorStartedAt = new Date("2026-06-02T10:00:00.000Z");
    const priorCompletedAt = new Date("2026-06-02T10:30:00.000Z");
    const firstRetryStartedAt = new Date("2026-06-02T11:00:00.000Z");
    const duplicateRetryStartedAt = new Date("2026-06-02T11:01:00.000Z");
    const current = {
      status: "failed" as const,
      startedAt: priorStartedAt,
      completedAt: priorCompletedAt,
      attempts: [{
        status: "completed" as const,
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: "2026-06-01T09:20:00.000Z",
      }],
    };

    const firstRetry = withStageRetryHistory(current, {
      status: "in_progress",
      startedAt: firstRetryStartedAt,
      completedAt: priorCompletedAt,
    });
    const activeAttempt = { ...current, ...firstRetry };
    const duplicateRetry = withStageRetryHistory(activeAttempt, {
      status: "in_progress",
      startedAt: duplicateRetryStartedAt,
      completedAt: null,
    });
    const persistedStage = { ...activeAttempt, ...duplicateRetry };

    expect(persistedStage.startedAt).toBe(firstRetryStartedAt);
    expect(persistedStage.completedAt).toBeNull();
    expect(persistedStage.attempts).toEqual([
      ...current.attempts,
      {
        status: "failed",
        startedAt: priorStartedAt.toISOString(),
        completedAt: priorCompletedAt.toISOString(),
      },
    ]);
  });
});
