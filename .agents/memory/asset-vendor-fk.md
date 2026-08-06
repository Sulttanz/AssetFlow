---
name: Asset vendor FK pattern
description: How vendor data is stored and surfaced on the asset form — dual field approach.
---

The `assets` table has two vendor-related fields:
- `primaryVendorId` — FK → vendors.id (relational, nullable)
- `vendor` — text (legacy free-text, nullable)

**Pattern:** The asset form populates both. `primaryVendorId` uses a `<Select>` dropdown fed from `GET /api/vendors` (returns `{ id, name }[]`). The free-text `vendor` field is kept alongside it for backward compatibility and for cases where the vendor isn't in the system.

**Why:** Existing assets have the text vendor field populated; removing it would lose data. Adding the FK dropdown enables proper vendor relationship tracking going forward.

**How to apply:** When building any feature that references an asset's vendor, prefer `primaryVendorId` for relational queries; fall back to `vendor` text for display when FK is null.
