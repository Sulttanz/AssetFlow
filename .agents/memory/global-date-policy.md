---
name: Global date policy
description: Required application-wide day-month-year presentation and calendar-date semantics.
---

Use DD-MM-YYYY for human-facing dates throughout this application, including
tables, drawers, badges, portal activity, and export reports. Keep time details
when showing timestamps. This is a global convention, not a selectable
month-first or ISO display preference.

**Why:** The user explicitly requested a consistent global Day-Month-Year
format and correct day/month preservation in date inputs and pickers.

**How to apply:** Use the centralized date helpers. Keep calendar dates as
YYYY-MM-DD for database/API/native-input contracts and parse them as local
calendar values, not UTC instants. Treat real timestamps as instants. Excel
calendar Date objects and serials need separate UTC-calendar extraction when
imported; export formatting must still roundtrip back to the original day.
