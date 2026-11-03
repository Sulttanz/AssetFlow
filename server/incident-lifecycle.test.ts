import { describe, expect, it } from "vitest";
import type { Incident } from "@shared/schema";
import { allowedIncidentTransitions, IncidentTransitionError, planIncidentTransition } from "./incident-lifecycle";

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "incident-1",
    status: "New",
    category: null,
    resolutionCode: null,
    resolutionNotes: null,
    responseDueAt: new Date("2026-03-01T10:00:00.000Z"),
    resolveDueAt: new Date("2026-03-02T10:00:00.000Z"),
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  } as Incident;
}

describe("incident lifecycle state machine", () => {
  it("allows only the defined next statuses, including reopen and terminal close", () => {
    expect(allowedIncidentTransitions("New")).toEqual(["In Progress"]);
    expect(allowedIncidentTransitions("In Progress")).toEqual(["Pending", "Resolved"]);
    expect(allowedIncidentTransitions("Resolved")).toEqual(["In Progress", "Closed"]);
    expect(allowedIncidentTransitions("Closed")).toEqual([]);
    expect(allowedIncidentTransitions("open")).toEqual(["In Progress"]);
  });

  it("rejects illegal jumps instead of bypassing the lifecycle", () => {
    expect(() => planIncidentTransition(incident(), {
      status: "Resolved",
      category: "Hardware",
      resolutionCode: "Solved",
      resolutionNotes: "Fixed",
    })).toThrowError(IncidentTransitionError);
    try {
      planIncidentTransition(incident(), { status: "Resolved", category: "Hardware", resolutionCode: "Solved", resolutionNotes: "Fixed" });
    } catch (error) {
      expect((error as IncidentTransitionError).statusCode).toBe(409);
    }
  });

  it("requires category, resolution code, and fresh notes for every resolved or closed transition", () => {
    const inProgress = incident({ status: "In Progress", resolutionNotes: "old note", resolutionCode: "Old code", category: "Hardware" });
    expect(() => planIncidentTransition(inProgress, { status: "Resolved" })).toThrow(/category|required/i);
    expect(() => planIncidentTransition(inProgress, { status: "Resolved", category: "Hardware" })).toThrow(/resolution code/i);
    expect(() => planIncidentTransition(inProgress, { status: "Resolved", category: "Hardware", resolutionCode: "Solved" })).toThrow(/notes/i);
    expect(() => planIncidentTransition(inProgress, { status: "Closed" })).toThrow(/cannot transition/i);
  });

  it("stamps first response time and records SLA compliance plus an escalation on breach", () => {
    const now = new Date("2026-03-01T11:00:00.000Z");
    const plan = planIncidentTransition(incident(), { status: "In Progress" }, now);
    expect(plan.update.firstRespondedAt).toEqual(now);
    expect(plan.details).toContain("Response SLA: Breached");
    expect(plan.details).toContain("Resolution SLA: Pending");
    expect(plan.escalationDetails).toContain("response");
  });

  it("stamps resolution and closure timestamps on their legal transitions", () => {
    const resolvedAt = new Date("2026-03-01T12:00:00.000Z");
    const resolved = planIncidentTransition(incident({ status: "In Progress" }), {
      status: "Resolved", category: "Network", resolutionCode: "Solved (Permanent Fix)", resolutionNotes: "Restored connectivity.",
    }, resolvedAt);
    expect(resolved.update.resolvedAt).toEqual(resolvedAt);
    expect(resolved.details).toContain("Category: Network");
    expect(resolved.details).toContain("Resolution SLA: Met");

    const closedAt = new Date("2026-03-01T13:00:00.000Z");
    const closed = planIncidentTransition(incident({ status: "Resolved", resolvedAt }), {
      status: "Closed", category: "Network", resolutionCode: "Solved (Permanent Fix)", resolutionNotes: "User confirmed service restored.",
    }, closedAt);
    expect(closed.update.closedAt).toEqual(closedAt);
    expect(closed.update.resolvedAt).toEqual(resolvedAt);
  });
});
