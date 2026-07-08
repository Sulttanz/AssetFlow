---
name: ITSM ticketing module scope decisions
description: Decisions and gotchas from building the Incident & Service Request ticketing pillar (tickets, comments, attachments, RBAC, reporting).
---

## Requester scope
Any authenticated user can file a ticket — not limited to a special "Employee" role. Keep this consistent for future ticket-related features.

## RBAC model
Two permissions gate the whole module: view-all-tickets vs. manage-tickets (assign/status/edit/delete any ticket, set due date). Non-managers can only edit their own ticket's basic fields. The real gate is server-side; any client-side "my tickets" toggle or inline-editable field is just UX on top of that.

## Category field
Ticket category is an admin-managed dropdown, not a hardcoded enum — matches the pattern used for other configurable lists in the app.

## Due date / SLA
SLA breach automation (auto-escalation, notifications) is explicitly out of scope. What *is* in scope: a manual due-date field settable by managers, an "overdue" computed flag, and average-resolution-time metrics. These derived metrics are duplicated (dashboard widget + report page) and computed client-side from the ticket list rather than a shared aggregation endpoint — if the ticket list response shape changes, update both call sites.

**Why:** the task spec asked for these metrics on both the dashboard and the reports page, and there was no existing shared aggregation endpoint to reuse.

## Date column gotcha
Due date is a plain `date` (not `timestamp`) column, stored as a `"YYYY-MM-DD"` string. Feed `<input type="date">` that raw string directly and send it back as-is — don't round-trip through `new Date(...).toISOString()` or `new Date(dateOnlyString)` for display/comparison, since both introduce a timezone-driven off-by-one-day risk. Parse as local time by appending `T00:00:00` when you need a Date object.

## Attachment deletion
Deleting a ticket attachment is manager-only (`ticket_manage` permission) — the requester who uploaded it cannot delete it themselves, even though they can upload and download. This intentionally diverges from the general "owner or manager" pattern used elsewhere in the module.

**Why:** explicit user request — attachments should not be removable by the person who filed the ticket, only by IT staff/admin, to preserve an audit trail of what was submitted.

## Assignment UI
Ticket assignment also has a dedicated page (`/tickets/assign`, `ticket_manage`-gated) separate from the main Tickets list/detail view — a table of tickets with an inline assignee dropdown per row, for bulk/quick reassignment. The inline assignee dropdown inside the ticket detail dialog was kept too; both call the same `PUT /api/tickets/:id { assignedToId }`.

**Why:** explicit user request for an easier way to control assignments outside the per-ticket detail popup.
