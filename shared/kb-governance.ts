import { z } from "zod";
import { isSystemAdministrator, personaRolesForUser, type PersonaUserLike } from "./personas";

/** Internal documents fail closed for unrecognized/read-only personas. */
export function canManageKnowledge(user: PersonaUserLike | null | undefined): boolean {
  if (isSystemAdministrator(user)) return true;
  const personas = personaRolesForUser(user);
  if (personas.some(role => role === "it_agent" || role === "it_manager")) return true;
  if (personas.length) return false;
  return user?.roles?.some(role => [
    "manager", "it staff", "it support staff", "helpdesk agent", "help desk agent",
  ].includes(role.name.trim().toLowerCase())) ?? false;
}

export function canAuditPublishedPolicies(user: PersonaUserLike | null | undefined): boolean {
  if (!user) return false;
  return personaRolesForUser(user).includes("auditor") ||
    user.permissions?.some(permission => ["audit_view", "compliance_view"].includes(permission)) === true;
}

export function canReadKnowledge(
  user: PersonaUserLike | null | undefined,
  article: { status: string; isPublic: boolean; category: string; authorId?: string | null; ownerId?: string | null },
): boolean {
  if (!user) return false;
  if (user.id && (article.authorId === user.id || article.ownerId === user.id)) return true;
  if (canAuditPublishedPolicies(user) && article.status === "published" &&
    article.category.trim().toLowerCase() === "policy") return true;
  return canManageKnowledge(user) ||
    (article.status === "published" && article.isPublic &&
      ["policy", "user guide"].includes(article.category.trim().toLowerCase()));
}

export function canDeleteKnowledgeArticle(
  user: PersonaUserLike | null | undefined,
  article: { isSystemGuide?: boolean; authorId?: string | null; ownerId?: string | null },
): boolean {
  if (!user) return false;
  if (article.isSystemGuide) return isSystemAdministrator(user);
  return canManageKnowledge(user) ||
    (!!user.id && (article.authorId === user.id || article.ownerId === user.id));
}

export function nextKnowledgeVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error("Invalid stored article version");
  return `${match[1]}.${Number(match[2]) + 1}`;
}

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

export const knowledgeArticleInput = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().min(10).max(80000),
  category: z.string().trim().min(1).max(150),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).optional(),
  tags: z.string().max(2000).nullable().optional(),
  ownerId: z.string().min(1).nullable().optional(),
  reviewDate: calendarDate.nullable().optional(),
  status: z.enum(["draft", "under_review", "published", "archived"]),
  isPublic: z.boolean(),
  changeNote: z.string().trim().min(1).max(1000).optional(),
}).strict();
