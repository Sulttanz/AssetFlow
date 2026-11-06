---
name: Assignment group compatibility
description: Compatibility boundary when introducing relational assignment group membership.
---

Preserve legacy incident assignment-group labels rather than automatically rewriting or clearing existing assignments. Apply group membership restrictions when an active managed group matches the selected label.

**Why:** Existing tickets use textual queue labels, and introducing group administration does not authorize bulk reassignment of historical tickets.

**How to apply:** Keep historical labels readable during future group migrations, renames, or deactivation work. Any conversion to group IDs or bulk reassignment needs an explicit migration and preservation strategy.
