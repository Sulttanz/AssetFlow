---
name: Zod refined schema composition
description: Runtime restrictions when changing fields on schemas with cross-field refinements.
---

Define field overrides on the object schema before attaching cross-field refinements. Do not assume that `extend` or `safeExtend` can replace fields on an already refined schema.

**Why:** With the installed Zod version, refined-schema field replacement failed at runtime even when compilation appeared acceptable. This surfaced only when the HTTP creation handler parsed a request.

**How to apply:** Compose the final field shape first, then add refinements, and exercise the actual HTTP parsing path in a regression test. Keep database decimal string contracts separate from API numeric coercion.
