---
name: Standalone ITSM risk management
description: User decision on the boundaries of risk management in this ITSM application.
---

Risk Management is the **internal IT Department Risk Register**, completely separate from Project Management and its project risk register. It must not expose project selectors, link to project tables, or require Project Management to run. Risks may optionally link to internal IT changes/problems and infrastructure, but must remain independently usable with those modules disabled.

**Why:** The user explicitly required an internal IT risk scope, “100% separate and isolated from the Project Management module,” while retaining optional internal IT infrastructure and ITSM relationships.

**How to apply:** Keep project risks in the project workspace. Optional IT links must respect feature gates; creating a treatment change/problem from an internal IT risk must never create a project association. Preserve historical optional associations during edits.
