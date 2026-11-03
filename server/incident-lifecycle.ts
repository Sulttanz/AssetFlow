import { and, eq } from "drizzle-orm";
import type { Incident } from "@shared/schema";
import { incidentActivities, incidents } from "@shared/schema";
import { db } from "./db";

export const INCIDENT_STATUSES = ["New", "In Progress", "Pending", "Resolved", "Closed"] as const;
export type IncidentStatus = typeof INCIDENT_STATUSES[number];

const transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  New: ["In Progress"],
  "In Progress": ["Pending", "Resolved"],
  Pending: ["In Progress", "Resolved"],
  Resolved: ["In Progress", "Closed"],
  Closed: [],
};

const legacyStatusMap: Record<string, IncidentStatus> = {
  new: "New",
  open: "New",
  "in progress": "In Progress",
  in_progress: "In Progress",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

export class IncidentTransitionError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function canonicalStatus(value: string): IncidentStatus | undefined {
  return legacyStatusMap[value.trim().toLowerCase()];
}

function slaLabel(dueAt: Date | null | undefined, at: Date, terminal: boolean) {
  if (!dueAt) return "Not configured";
  if (!terminal && at.getTime() <= dueAt.getTime()) return "Pending";
  return at.getTime() <= dueAt.getTime() ? "Met" : "Breached";
}

export function allowedIncidentTransitions(status: string): IncidentStatus[] {
  const canonical = canonicalStatus(status);
  return canonical ? [...transitions[canonical]] : [];
}

export function planIncidentTransition(
  incident: Incident,
  input: {
    status: string;
    category?: string | null;
    resolutionCode?: string | null;
    resolutionNotes?: string | null;
    updates?: Partial<Incident>;
  },
  at = new Date(),
) {
  const currentStatus = canonicalStatus(incident.status);
  const nextStatus = canonicalStatus(input.status);
  if (!nextStatus) throw new IncidentTransitionError(400, "Invalid incident status.");
  if (!currentStatus || !transitions[currentStatus].includes(nextStatus)) {
    throw new IncidentTransitionError(409, `Incident cannot transition from ${incident.status} to ${nextStatus}.`);
  }

  const terminal = nextStatus === "Resolved" || nextStatus === "Closed";
  const category = (input.category ?? incident.category)?.trim() || null;
  const resolutionCode = input.resolutionCode?.trim() || null;
  const resolutionNotes = input.resolutionNotes?.trim() || null;
  if (terminal && !category) {
    throw new IncidentTransitionError(400, "An incident category is required before resolving or closing.");
  }
  if (terminal && !resolutionCode) {
    throw new IncidentTransitionError(400, "A resolution code is required before resolving or closing.");
  }
  if (terminal && !resolutionNotes) {
    throw new IncidentTransitionError(400, "Resolution or closure notes are required before resolving or closing.");
  }

  const firstResponse = currentStatus === "New" && nextStatus === "In Progress";
  const resolved = nextStatus === "Resolved";
  const closed = nextStatus === "Closed";
  const firstRespondedAt = incident.firstRespondedAt ?? (firstResponse ? at : null);
  const resolvedAt = resolved ? at : (nextStatus === "In Progress" && currentStatus === "Resolved" ? null : incident.resolvedAt);
  const closedAt = closed ? at : incident.closedAt;
  const responseSla = firstRespondedAt
    ? slaLabel(incident.responseDueAt, firstRespondedAt, true)
    : slaLabel(incident.responseDueAt, at, false);
  const resolutionSla = terminal
    ? slaLabel(incident.resolveDueAt, at, true)
    : slaLabel(incident.resolveDueAt, at, false);
  const breachedTargets = [
    ...(responseSla === "Breached" && firstResponse ? ["response"] : []),
    ...(resolutionSla === "Breached" && terminal ? ["resolution"] : []),
  ];
  const update = {
    ...(input.updates ?? {}),
    status: nextStatus,
    ...(input.category !== undefined || terminal ? { category } : {}),
    ...(input.resolutionCode !== undefined || terminal ? { resolutionCode } : {}),
    ...(input.resolutionNotes !== undefined || terminal ? { resolutionNotes } : {}),
    ...(firstResponse ? { firstRespondedAt } : {}),
    ...(resolved ? { resolvedAt } : {}),
    ...(nextStatus === "In Progress" && currentStatus === "Resolved" ? { resolvedAt: null } : {}),
    ...(closed ? { resolvedAt } : {}),
    ...(closed ? { closedAt } : {}),
    updatedAt: at,
  };
  const details = [
    `${incident.status} → ${nextStatus}`,
    `Category: ${category ?? "—"}`,
    `Response SLA: ${responseSla}${incident.responseDueAt ? ` (due ${incident.responseDueAt.toISOString()})` : ""}`,
    `Resolution SLA: ${resolutionSla}${incident.resolveDueAt ? ` (due ${incident.resolveDueAt.toISOString()})` : ""}`,
  ].join("; ");
  return {
    update,
    details,
    breachedTargets,
    escalationDetails: breachedTargets.length
      ? `SLA target breached: ${breachedTargets.join(" and ")}. Review ownership and escalation actions.`
      : null,
  };
}

export async function transitionIncident(input: {
  incidentId: string;
  actorId: string;
  status: string;
  category?: string | null;
  resolutionCode?: string | null;
  resolutionNotes?: string | null;
  updates?: Partial<Incident>;
}) {
  return db.transaction(async tx => {
    const [incident] = await tx.select().from(incidents)
      .where(eq(incidents.id, input.incidentId))
      .for("update");
    if (!incident) throw new IncidentTransitionError(404, "Incident not found.");
    const plan = planIncidentTransition(incident, input);
    const [updated] = await tx.update(incidents).set(plan.update)
      .where(and(eq(incidents.id, incident.id), eq(incidents.status, incident.status)))
      .returning();
    if (!updated) throw new IncidentTransitionError(409, "Incident status changed. Refresh and try again.");
    await tx.insert(incidentActivities).values({
      incidentId: incident.id,
      actorId: input.actorId,
      action: "Status changed",
      details: plan.details,
    });
    if (plan.escalationDetails) {
      await tx.insert(incidentActivities).values({
        incidentId: incident.id,
        actorId: input.actorId,
        action: "SLA escalation required",
        details: plan.escalationDetails,
      });
    }
    return updated;
  });
}
