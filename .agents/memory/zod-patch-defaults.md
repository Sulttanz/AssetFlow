---
name: Zod PATCH defaults
description: Creation defaults can silently populate omitted fields in partial update schemas.
---

Do not assume that making a creation schema partial removes its defaults. Explicitly redefine defaulted fields as optional, without defaults, for PATCH validation.

**Why:** The installed Zod behavior populated creation defaults inside optional fields. A status-only task update reset workload hours, and an owner-only risk response acquired an unrelated category field and was rejected.

**How to apply:** When deriving update schemas from create schemas, inspect parsed minimal updates and assert that omitted fields remain absent. Preserve creation defaults only for POST operations.
