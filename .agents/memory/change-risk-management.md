---
name: Standalone ITSM risk management
description: User decision on the boundaries of risk management in this ITSM application.
---

Risk Management remains a standalone ITSM register and workflow. Risks may optionally link to a change when managed from the change tracker, but standalone risks must not require a change or make the register dependent on Change Management.

**Why:** The user clarified that Risk Management must remain independently usable; change-tracker workflows also need optional linked risk records.

**How to apply:** Keep the standalone risk page usable without a change. In change workflows, preserve an optional change association and its owner across risk updates.
