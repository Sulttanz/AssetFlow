---
name: Module licensing boundary
description: Dynamic customer licensing keeps one complete schema and preserves disabled-module links.
---

Use dynamic feature gates in the unified monolith, not physical module/table removal.
Shared identity, permissions, settings, and lookup data remain available.

Employee and personnel reporting is a core platform capability, independent of ITSM and other licensed business modules. Cross-module workload counts should include data only from enabled source modules.

**Why:** The user explicitly chose one codebase and database with modules enabled or disabled per customer license.

**How to apply:** Gate module-owned API routes and UI navigation, skip optional cross-module reads when the target module is disabled, and reject new links into disabled modules. Keep the personnel directory and its own activity summaries available to authenticated users; gate only optional asset, project, and ITSM workload counts. Preserve existing relationships on unrelated edits so re-enabling a license restores them without data loss. Project-owned risks and changes remain part of Project Management, not dependencies on GRC or ITSM.
