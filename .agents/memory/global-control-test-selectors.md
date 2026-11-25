---
name: Global controls and test selectors
description: Prevent unrelated tests from breaking when shared header controls are added.
---

When testing page-specific filters, locate them by accessible label or within the report/filter region, not by their position among all controls of the same role on the page.

**Why:** A shared header dropdown added a new combobox before existing report filters; tests that selected the first, second, or third combobox clicked the wrong control despite no change to report behavior.

**How to apply:** When adding a global control, search for tests that query controls by role and index. Scope selectors to the intended region or use unique accessible names; keep global controls accessible.
