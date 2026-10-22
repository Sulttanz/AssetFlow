---
name: Sidebar collapsible nav sections
description: How the sidebar's two levels of collapse (section-level and nested submenu) coexist without conflicting state.
---

The sidebar has two independent collapse mechanisms: top-level sections and nested report submenus. Overview belongs at the top and should start expanded for administrators and managers.

**Why:** These two levels must stay decoupled — collapsing a section should hide its whole item list without resetting or coupling to the nested submenu's own open/closed state, and vice versa.

**How to apply:** When adding sections or nested navigation, preserve independent collapse state. Opening a destination may reveal its owning section, but rerenders must not undo a user's manual collapse.
