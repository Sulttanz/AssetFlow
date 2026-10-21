---
name: Legacy catalog metadata
description: Nullable legacy inventory metadata can break catalogs that combine several modules.
---

Treat optional metadata from existing inventory and lookup records as nullable at catalog boundaries, even when current form or TypeScript contracts appear stricter.

**Why:** Existing inventory contains unfilled legacy metadata. A missing classification or lifecycle value must not make the entire cross-module access catalog unavailable.

**How to apply:** Preserve source identities and required-field validation. Normalize absent optional metadata before string operations, and include nullable legacy records when checking combined catalogs.
