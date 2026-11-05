---
name: Knowledge publication boundary
description: Employee-public semantics and why legacy publication or old revision visibility cannot be treated as authorization.
---

The user specified: "End users see published end-user guides; IT agents and managers see full technical SOPs and KEDB runbooks."

`isPublic` means visible to authenticated employees, not anonymous Internet publication. Public policies and user guides are employee-eligible; technical SOPs, KEDB runbooks, and DR plans remain internal.

Repository-synchronized system-manual Markdown defaults to an internal Technical SOP. A document is employee-visible only when its frontmatter explicitly sets `audience: employee` and its category is Policy or User Guide.

**Why:** The legacy KB had published articles without any employee-public distinction. Existing publication is not evidence that internal content was approved for employee disclosure, so upgrades must not automatically make legacy published articles public.

**How to apply:** Apply the same visibility boundary to list, search, detail, report, and history reads. Employee history is limited to the current accessible published snapshot, never historical private drafts or superseded snapshots. Keep full historical content staff-only, even when a newer version becomes employee-public. Treat repository docs as internal unless the source explicitly marks them for employee access.
