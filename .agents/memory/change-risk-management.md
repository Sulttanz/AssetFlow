---
name: Standalone ITSM risk management
description: User decision on the boundaries of risk management in this ITSM application.
---

Risk Management is a standalone ITSM register and workflow, independent of Change Management. New risks must not require or be attached to a change.

**Why:** The user clarified that Risk Management and its tracker do not belong to Change Management and must be separate.

**How to apply:** Use its own top-level page, API, and permissions. Preserve legacy records safely, but do not expose a change association or make Change Management a dependency for new risk records.
