---
title: ITIL Incident & Change Enablement Operations
category: ITIL Service Operation & Change Management
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# ITIL Incident & Change Enablement Operations

The ITSM workspace provides incident and change workflows with ITIL-aligned controls. This guide describes implemented product behavior; it is not a claim of formal ITIL certification or full organizational process compliance.

## Incident Lifecycle Management

Incident status changes use a centralized transition service:

`New` → `In Progress` → `Pending` / `Resolved` → `Closed`

An incident in `Resolved` can return to `In Progress` if additional work is required. `Closed` is terminal. Direct jumps outside the allowed transitions are rejected.

### Resolution and SLA Controls

- Moving an incident to `Resolved` or `Closed` requires a category, resolution code, and resolution notes.
- The transition service records `firstRespondedAt`, `resolvedAt`, and `closedAt` where appropriate.
- Response and resolution SLA targets are stored as `responseDueAt` and `resolveDueAt`. Transition activity records whether applicable targets were met or breached.
- Priority is stored as `P1`–`P4` and the API validates those values. The current workflow does not automatically calculate priority from Impact and Urgency.

### Incident Catalog and Incident Tracker

The **Incident Catalog** (`/incident-catalog`) contains break/fix templates and their default category, priority, impact, urgency, and assignment group. End-user intake is simplified: end users select a catalog incident type, describe the issue, and may attach supporting files. They do not choose technical routing or an SLA. The server applies the selected template and applicable SLA rules. The project selector is limited to the submitter's assigned projects and is hidden when there is no project choice to make.

IT Agents and authorized managers use the **Incident Tracker** (`/incidents/tracker`) to triage incidents. The tracker exposes technical fields such as Priority, Impact, Urgency, Assignment Group, Assigned Engineer, and SLA Policy, along with status, SLA timing, and resolution controls. Assignment and state changes are recorded by the operational workflow.

## Service Catalog and Request Tracker

The **Service Catalog** (`/service-catalog`) is separate from the Incident Catalog. It handles standard service requests such as hardware, software, and access, and may render item-specific fields or approval requirements. Agents use the Request Tracker to review assignment, approval, and fulfillment stage. A request requiring approval remains in its approval workflow before fulfillment proceeds.

## Change Enablement & CAB Governance

Change requests support the types `standard`, `normal`, and `emergency`, and can store implementation, rollback, and test plans, risk, and scheduled start/end times. These fields are part of the RFC record; the application does not require every plan field for every submission.

Normal and emergency changes require CAB review. High- or critical-risk changes also require CAB review, regardless of type. Standard changes can be marked CAB-required when needed.

### CMDB Impact Summary

When ITSM and CMDB are both enabled, a change can link target applications and servers. Its impact summary includes directly selected targets, related applications or servers derived from the application-to-server links, and affected application business and technical owners. This computed impact summary is for changes; it is not automatically generated for incidents.

### CAB Approval Workflow

1. **Submission**: The RFC is recorded with its available planning fields and schedule.
2. **Review assignment**: Active CAB approvers are assigned to the change.
3. **Individual votes**: Each assigned CAB member records an approval or rejection.
4. **Status derivation**: A CAB-required change becomes approved only after every active assigned approver approves it. A rejection rejects the change; an empty active roster does not count as approval. There is no configurable majority-quorum policy in the current workflow.
5. **Re-review after escalation**: Increasing a CAB-required change's type or risk level resets the active vote round so the escalated proposal receives fresh decisions; prior decisions remain in history.

### Project Change Requests

An End User can submit a project change only for a project assigned to that account. The request enters review and receives active System Administrator, IT Manager, and CAB Member reviewers. Every assigned reviewer must approve; a rejection prevents approval. Final approval creates one linked task in that project's Project Tasks workspace. This creates a Change Request and a project task—not an Incident or Service Request—and the change detail shows the linked task reference.

## Problem Management

Use the **Problems** workspace to investigate the underlying cause of recurring or significant incidents, document analysis and workarounds, assign ownership, and track the problem lifecycle. Problem records are distinct from incidents: an incident restores service; a problem record tracks investigation and prevention. Where linked incident references are present, use them to review related symptoms and operational history.
