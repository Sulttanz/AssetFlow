import { and, eq } from "drizzle-orm";
import type { Incident } from "@shared/schema";
import { assignmentGroupMembers, assignmentGroups, incidentActivities, incidents, slaPolicies, systemNotifications, users } from "@shared/schema";
import { db } from "./db";
import { inArray, sql } from "drizzle-orm";

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

type EscalationTarget = "response" | "resolution";
type SlaEscalationPolicy = {
  responseEscalationGroup?: string | null;
  responseEscalationUserId?: string | null;
  resolutionEscalationGroup?: string | null;
  resolutionEscalationUserId?: string | null;
};

export function getIncidentSlaEscalationRoute(
  incident: Pick<Incident, "assignmentGroup" | "assigneeId" | "assignedToId">,
  policy: SlaEscalationPolicy | null | undefined,
  target: EscalationTarget,
) {
  const configuredGroup = target === "response" ? policy?.responseEscalationGroup : policy?.resolutionEscalationGroup;
  const configuredUserId = target === "response" ? policy?.responseEscalationUserId : policy?.resolutionEscalationUserId;
  const assigneeId = incident.assigneeId ?? incident.assignedToId ?? null;
  return {
    groupNames: configuredGroup?.trim() ? [configuredGroup.trim()] : incident.assignmentGroup?.trim() ? [incident.assignmentGroup.trim()] : [],
    userIds: Array.from(new Set([configuredUserId, assigneeId].filter((id): id is string => Boolean(id)))),
  };
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
      const [policy] = incident.slaPolicyId
        ? await tx.select({
          responseEscalationGroup: slaPolicies.responseEscalationGroup,
          responseEscalationUserId: slaPolicies.responseEscalationUserId,
          resolutionEscalationGroup: slaPolicies.resolutionEscalationGroup,
          resolutionEscalationUserId: slaPolicies.resolutionEscalationUserId,
        }).from(slaPolicies).where(eq(slaPolicies.id, incident.slaPolicyId)).limit(1)
        : [];
      const routeDescriptions: string[] = [];
      let notifiedRecipientCount = 0;
      for (const target of plan.breachedTargets as EscalationTarget[]) {
        const route = getIncidentSlaEscalationRoute(incident, policy, target);
        const groupRecipientRows = route.groupNames.length
          ? await tx.selectDistinct({ userId: assignmentGroupMembers.userId })
            .from(assignmentGroupMembers)
            .innerJoin(assignmentGroups, eq(assignmentGroups.id, assignmentGroupMembers.groupId))
            .innerJoin(users, eq(users.id, assignmentGroupMembers.userId))
            .where(and(
              eq(assignmentGroups.active, true),
              eq(users.isActive, true),
              sql`lower(btrim(${assignmentGroups.name})) = lower(btrim(${route.groupNames[0]}))`,
            ))
          : [];
        const recipientIds = Array.from(new Set([
          ...route.userIds,
          ...groupRecipientRows.map(row => row.userId),
        ]));
        const recipientRows = recipientIds.length
          ? await tx.select({
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
          }).from(users).where(and(inArray(users.id, recipientIds), eq(users.isActive, true)))
          : [];
        const activeRecipientIds = recipientRows.map(row => row.id);
        notifiedRecipientCount += activeRecipientIds.length;
        const targetLabel = target === "response" ? "Response" : "Resolution";
        const destinationLabels = [
          ...route.groupNames.map(name => `group "${name}"`),
          ...route.userIds.filter(id => id !== (incident.assigneeId ?? incident.assignedToId)).map(id =>
            recipientRows.find(row => row.id === id)?.username ?? "configured staff member",
          ),
          ...(incident.assigneeId || incident.assignedToId ? ["assigned engineer"] : []),
        ];
        if (activeRecipientIds.length) {
          const severity = incident.priority === "P1" ? "critical" : incident.priority === "P2" ? "high" : "medium";
          await tx.insert(systemNotifications).values(activeRecipientIds.map(userId => ({
            userId,
            type: "incident_sla",
            severity,
            title: `${targetLabel} SLA breached: ${incident.incidentNumber}`,
            message: `${incident.title} breached its ${targetLabel.toLowerCase()} SLA. Review the incident and its assignment.`,
            link: "/incidents/tracker",
            relatedType: "incident",
            relatedId: incident.id,
            dedupeKey: `incident:${incident.id}:sla:${target}:${(target === "response" ? incident.responseDueAt : incident.resolveDueAt)?.toISOString() ?? "no-due-date"}`,
          }))).onConflictDoNothing();
        }
        const notifiedNames = recipientRows.map(row =>
          [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username,
        );
        routeDescriptions.push(
          `${targetLabel}: ${destinationLabels.length ? destinationLabels.join(", ") : "no escalation recipient configured"}; ` +
          `${activeRecipientIds.length ? `notified ${notifiedNames.join(", ")}` : "no active recipients were found"}`,
        );
      }
      await tx.insert(incidentActivities).values({
        incidentId: incident.id,
        actorId: input.actorId,
        action: notifiedRecipientCount ? "SLA escalation sent" : "SLA escalation needs assignment",
        details: `${plan.escalationDetails} ${routeDescriptions.join("; ")}.`,
      });
    }
    return updated;
  });
}
