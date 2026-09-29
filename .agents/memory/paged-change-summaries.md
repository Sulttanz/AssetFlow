---
name: Paged change summaries
description: Scope rules for metrics and CAB vote access when the changes list is paginated.
---

When a list loads one page at a time, summary counts computed from those rows are page snapshots, not organization-wide totals. Label them accordingly rather than implying they cover the whole history. User-specific pending CAB votes must remain accessible even when the corresponding change falls outside the current page or filter.

**Why:** Pagination otherwise silently changes the meaning of existing dashboard cards and can hide a vote that still needs action.

**How to apply:** When adding new change-list metrics, decide explicitly whether they are page-scoped or should use a separate aggregate query. Keep links to individual CAB changes independent of the list's current page.