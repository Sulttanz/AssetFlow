---
name: ITSM ticketing module scope decisions
description: Decisions and gotchas from building the Incident & Service Request ticketing pillar (tickets, comments, attachments, RBAC, reporting).
---

## Requester scope
Any authenticated user can file a ticket (requesterId = current user) — not limited to a special "Employee" role. Keep this consistent for future ticket-related features.

## RBAC model
Two permissions gate the whole module: `ticket_view_all` (see the full queue, not just your own) and `ticket_manage` (assign/status/edit/delete any ticket, set due date). Non-managers can only edit title/description/category/priority on their own tickets. Backend enforces this via `canManageAllTickets`/`canManageTicket` helpers in `server/routes.ts` — the frontend's "My Tickets"/"All Tickets" scope toggle and inline-editable fields (Due Date, Assigned To, Status, Priority) are just UX layered on top; the real gate is server-side.

## Category field
Ticket category is an admin-managed dropdown (`ticketCategory` type in Dropdown Management), not a hardcoded enum — matches the pattern used for other configurable lists in the app.

## Due date / SLA
SLA breach automation (auto-escalation, notifications) is explicitly out of scope. What *is* in scope: a manual due-date field settable by managers, an "overdue" computed flag (dueDate < now AND status not resolved/closed), and average-resolution-time metrics (resolvedAt - createdAt). These three derived metrics are duplicated in two places — the dashboard "Open Tickets" widget and the `/reports/tickets` report page — computed client-side from the ticket list rather than a dedicated backend endpoint. If the ticket list response shape changes, update both call sites.

**Why:** the task spec asked for these metrics on both the dashboard and the reports page, and there was no existing shared aggregation endpoint to reuse.

## Date column gotcha
`dueDate` is a Drizzle `date` column (not `timestamp`) — send it as a plain `"YYYY-MM-DD"` string from `<input type="date">`, not `new Date(...).toISOString()`, to avoid timezone-shift-by-a-day bugs when round-tripping.
