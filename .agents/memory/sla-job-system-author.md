---
name: SLA job system author
description: How to find a system_admin user ID inside the SLA enforcement background job for inserting ticket comments.
---

The `users` table has no `role` column. Roles are stored in `userRoles` (join table) → `roles`.

To find a system_admin user inside the SLA job (or any background job that does dynamic imports):

```ts
const { users, userRoles, roles } = await import("@shared/schema");
const { eq, and } = await import("drizzle-orm");
const [systemUser] = await db
  .select({ id: users.id })
  .from(users)
  .innerJoin(userRoles, eq(userRoles.userId, users.id))
  .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.name, "system_admin")))
  .limit(1);
const systemAuthorId = systemUser?.id ?? null;
if (!systemAuthorId) return; // guard — skip if no admin exists
```

**Why:** ticket_comments.author_id is NOT NULL; system-generated comments must be attributed to a real user. The SLA job previously crashed with `null value in column "author_id"`.

**How to apply:** Any background job that inserts ticket comments or other author-attributed records must resolve a real user ID first.
