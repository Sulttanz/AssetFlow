---
name: Sidebar collapsible nav sections
description: How the sidebar's two levels of collapse (section-level and nested submenu) coexist without conflicting state.
---

The sidebar has two independent collapse mechanisms:
1. Section-level collapse — each top-level nav section (Overview, Asset Management, Organization, Financial, Operations, IT Service Management, Analytics, Tools, System) has its own expand/collapse toggle with a chevron icon, backed by a single `expandedSections: Record<string, boolean>` state object keyed by section title (default all expanded).
2. Nested submenu collapse — some individual nav items (e.g. "Reports" inside "Analytics") have their own deeper submenu that expands/collapses independently (its own boolean state, e.g. `reportsExpanded`).

**Why:** These two levels must stay decoupled — collapsing a section should hide its whole item list without resetting or coupling to the nested submenu's own open/closed state, and vice versa.

**How to apply:** When adding a new sidebar section or a new item with a nested submenu, give it its own toggle following the existing pattern rather than trying to unify into one state shape. Keep data-testid conventions: `section-toggle-<section-name>` for section headers, `nav-<item-name>` for items.
