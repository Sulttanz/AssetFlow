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
});
