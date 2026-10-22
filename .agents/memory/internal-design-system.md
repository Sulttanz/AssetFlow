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
