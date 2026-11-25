---
name: Internal enterprise design direction
description: Keep the internal application aligned with the restored login palette and simple enterprise styling.
---

The internal application should follow the same modern blue/slate direction as the login: vibrant blue primary actions, light slate canvas, white softly bordered rounded cards, sans-serif typography, blue active navigation, and softly tinted status/KPI accents. Optional dark mode should be crisp navy rather than black or teal.

**Why:** The user explicitly extended the restored login aesthetic to the entire internal application and asked for clean, simple, user-friendly consistency.

**How to apply:** Prefer shared tokens/components over new page-specific palettes. Keep headers and filter bars consistent, preserve table overflow and deliberate compact layouts, and do not change workflow or authorization behavior during visual refinements.

Semantic badge colors should not reinterpret arbitrary category names, counts or rich content. Explicit semantic variants and caller overrides take precedence over automatic plain-text status styling.

**Why:** Global status consistency must not turn unrelated category labels into misleading success, warning or critical indicators.

**How to apply:** Any automatic status treatment should recognize exact status labels only.

Use Daylight Clean on desktop and Midnight Command on mobile only when no manual theme is saved. Keep Hybrid Navy Rail available, and preserve each account's chosen theme across logout and devices.

**Why:** The user requested device-aware defaults without overriding a person's explicit choice or sharing one user's theme with another.

**How to apply:** Treat themes as personal preferences, not tenant settings. English/Arabic switching should preserve the same colors, spacing, and typography; Arabic uses RTL with English fallback for untranslated technical labels.
