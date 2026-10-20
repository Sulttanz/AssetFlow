---
name: Global date policy
description: Required application-wide day-month-year presentation and calendar-date semantics.
---

Use DD-MM-YYYY for human-facing dates throughout this application, including
tables, drawers, badges, portal activity, and export reports. Keep time details
when showing timestamps. This is a global convention, not a selectable
month-first or ISO display preference.

All date fields must also show DD-MM-YYYY when empty or focused. Do not switch
to a visible native `type="date"` editor: browser/OS locale controls its
placeholder and rendering, so formatting text outside the editor is insufficient.

**Why:** The user explicitly requested a consistent global Day-Month-Year
format and correct day/month preservation in date inputs and pickers. The user
repeated that this requirement includes input placeholders and focused fields,
not only formatted text elsewhere.

**How to apply:** Use the centralized date helpers. Keep calendar dates as
YYYY-MM-DD for database/API/form payload contracts and parse them as local
calendar values, not UTC instants. Treat real timestamps as instants. Excel
calendar Date objects and serials need separate UTC-calendar extraction when
imported; export formatting must still roundtrip back to the original day.
