---
name: ITSM ticketing module scope decisions
description: Decisions and gotchas from building the Incident & Service Request ticketing pillar (tickets, comments, attachments, RBAC, reporting).
---

## Requester scope
Any authenticated user can file a ticket — not limited to a special "Employee" role. Keep this consistent for future ticket-related features.

Requesters can cancel their own open, in-progress, or resolved requests; cancellation is distinct from confirming a resolved ticket as closed. Preserve an optional cancellation reason as a public activity comment, and keep closed/cancelled requests ineligible for cancellation.

**Why:** users need to stop requests they no longer need or have fixed themselves without gaining staff assignment or workflow controls.

**How to apply:** keep requester-facing controls limited to status visibility, cancellation, and existing close/reopen actions; enforce ownership and eligible states on the server.

## RBAC model
Two permissions gate the whole module: view-all-tickets vs. manage-tickets (assign/status/edit/delete any ticket, set due date). Non-managers can only edit their own ticket's basic fields. The real gate is server-side; any client-side "my tickets" toggle or inline-editable field is just UX on top of that.

## Category field
Ticket category is an admin-managed dropdown, not a hardcoded enum — matches the pattern used for other configurable lists in the app.

## SLA Policies (configurable)
An `sla_policies` DB table stores admin-defined SLA rules with fields: `ticket_type`, `category`, `priority`, `response_hours`, `resolution_hours`, `is_active`. `computeTicketSlaDates()` in `server/storage.ts` does a DB lookup at ticket-creation time, resolving by specificity: type+category+priority → type+priority → priority-only → hardcoded `TICKET_SLA_HOURS` fallback. The admin page lives at `/sla-policies` (System sidebar section, requires `system_admin`). Categories available in the picker: Hardware, Software, Network, Security, Access, Operations, Other.

**Why:** Users need different SLA targets per ticket type and category (end-user vs security vs operations). Hardcoded constants are kept as a documented fallback.

## Due date / SLA
A manual due-date field (settable by managers) coexists with a separate, automatic SLA system added later: `impact` + `urgency` fields auto-derive `priority` via a `TICKET_PRIORITY_MATRIX` lookup (server-side, on create/update), which in turn drives `slaResponseDueAt`/`slaResolutionDueAt` computed from `TICKET_SLA_HOURS`. `/api/alerts` polls tickets and emits "ticket" alerts (severity high = breached, medium = due within 2h). The "overdue" flag and average-resolution-time metrics are still computed client-side from the ticket list rather than a shared aggregation endpoint — if the ticket list response shape changes, update both dashboard and report call sites.

**Why:** the task spec asked for these metrics on both the dashboard and the reports page, and there was no existing shared aggregation endpoint to reuse. SLA timers/priority matrix were added in a later pass to strengthen incident management before Change Management was built.

## Resolution codes & reopen tracking
Moving a ticket's status to `resolved` requires a non-null `resolutionCode` (enforced server-side in `PUT /api/tickets/:id`, not just client-side) — resolving without one returns an error. Moving a ticket back from `resolved`/`closed` to `open`/`in_progress` ("reopening") increments `reopenCount` and clears `resolvedAt`; this is detected by comparing old vs. new status inside the same update handler, not via a separate endpoint.

**Why:** resolution codes give reportable close-reasons; reopen tracking flags tickets that were prematurely marked resolved, both requested to strengthen Incident Management quality signals.

## Date column gotcha
Due date is a plain `date` (not `timestamp`) column, stored as a `"YYYY-MM-DD"` string. Feed `<input type="date">` that raw string directly and send it back as-is — don't round-trip through `new Date(...).toISOString()` or `new Date(dateOnlyString)` for display/comparison, since both introduce a timezone-driven off-by-one-day risk. Parse as local time by appending `T00:00:00` when you need a Date object.

## Attachment deletion
Deleting a ticket attachment is manager-only (`ticket_manage` permission) — the requester who uploaded it cannot delete it themselves, even though they can upload and download. This intentionally diverges from the general "owner or manager" pattern used elsewhere in the module.

**Why:** explicit user request — attachments should not be removable by the person who filed the ticket, only by IT staff/admin, to preserve an audit trail of what was submitted.

## Assignment UI
The standalone `/tickets/assign` page was removed (2026-07-08) after the user found it redundant with the main Tickets page. Its useful bits — an assignee filter (including "Unassigned") and an inline per-row assignee dropdown that updates without opening the ticket detail dialog — were folded into the Tickets page itself (`ticket_manage`-gated). The ticket detail dialog's own assignee dropdown was kept too; all three call the same `PUT /api/tickets/:id { assignedToId }`.

**Why:** one page covering status filtering, assignee filtering, and both bulk (inline) and detailed (dialog) assignment was judged simpler than maintaining two overlapping pages.

## Requester contact info has no direct FK
A ticket's `requesterId` points to `users`, but email/mobile/job title/department/location live on the separate `employees` table — there's no FK between them. The link is inferred at read time by matching `employees.email === users.email`; if no employee record shares that email, only the user's own `email` is available and the rest come back empty.

**Why:** the schema was never designed to link `users` and `employees` directly; email-matching is the only bridge that already existed in the codebase (same pattern used for Excel assignment import).

## Ticket Report has its own React Query cache key
`/reports/tickets` fetches `["/api/reports/tickets"]`, a separate cache key from `["/api/tickets"]` used by the Tickets and Assign Tickets pages, even though both endpoints return the same ticket data. Any mutation that changes ticket status/assignment must invalidate both keys or the report page shows stale status until a hard reload.

**Why:** discovered as a bug — status changes on the Tickets/Assignment pages weren't reflected in the Ticket Report because only `/api/tickets` was invalidated.
