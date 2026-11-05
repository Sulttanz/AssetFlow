import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, or, sql } from "drizzle-orm";
import { kbArticles, kbArticleVersions, users } from "@shared/schema";
import { nextKnowledgeVersion } from "@shared/kb-governance";
import { db } from "./db";

const DEFAULT_MANUAL_DIRECTORY = path.resolve(process.cwd(), "docs/system-manual");

type ManualDocument = {
  slug: string;
  title: string;
  content: string;
  category: string;
  isPublic: boolean;
  initialVersion: string;
  author: string | null;
  owner: string | null;
};

async function markdownFiles(directory: string, root = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolute, root);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return [path.relative(root, absolute)];
    return [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

function toManualDocument(relativePath: string, content: string): ManualDocument {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const fileTitle = path.basename(normalizedPath, path.extname(normalizedPath))
    .replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const frontmatter = Object.fromEntries((frontmatterMatch?.[1] ?? "").split(/\r?\n/)
    .map(line => line.match(/^\s*([a-zA-Z][\w-]*)\s*:\s*(.*?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => [match[1].toLowerCase(), match[2].replace(/^["']|["']$/g, "")]));
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;
  const heading = body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  const category = frontmatter.category || (frontmatter.audience?.toLowerCase() === "employee" ? "User Guide" : "Technical SOP");
  const isPublic = frontmatter.audience?.toLowerCase() === "employee" &&
    ["policy", "user guide"].includes(category.trim().toLowerCase());
  const versionParts = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(frontmatter.version ?? "");
  const initialVersion = versionParts ? `${versionParts[1]}.${versionParts[2]}` : "1.0";
  const slugPath = normalizedPath.replace(/\.md$/i, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    slug: `system-manual-${slugPath}`,
    title: frontmatter.title || heading || fileTitle,
    content: body.trim(),
    category,
    isPublic,
    initialVersion,
    author: frontmatter.author || null,
    owner: frontmatter.owner || null,
  };
}

async function resolveManualUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  name: string | null,
) {
  const label = name?.trim();
  if (!label) return null;
  const matches = await tx.select({ id: users.id }).from(users).where(and(
    eq(users.isActive, true),
    or(
      sql`lower(${users.username}) = lower(${label})`,
      sql`lower(concat_ws(' ', ${users.firstName}, ${users.lastName})) = lower(${label})`,
    ),
  )).limit(2);
  return matches.length === 1 ? matches[0].id : null;
}

function guideValues(document: ManualDocument, sourceTag: string, authorId: string | null, ownerId: string | null) {
  return {
    title: document.title,
    slug: document.slug,
    content: document.content,
    category: document.category,
    tags: `system manual, ${sourceTag}`,
    status: "published",
    authorId,
    ownerId,
    authorLabel: document.author,
    ownerLabel: document.owner,
    reviewDate: null,
    version: document.initialVersion,
    isPublic: document.isPublic,
    isSystemGuide: true,
  };
}

async function recordVersion(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], article: typeof kbArticles.$inferSelect, note: string) {
  await tx.insert(kbArticleVersions).values({
    articleId: article.id,
    version: article.version,
    snapshot: JSON.parse(JSON.stringify(article)),
    actorId: null,
    changeNote: note,
  }).onConflictDoNothing();
}

/** Synchronize repository-owned Markdown into protected, employee-visible KB records. */
export async function syncSystemManualArticles(
  directory = DEFAULT_MANUAL_DIRECTORY,
): Promise<{ inserted: number; updated: number; archived: number; unchanged: number }> {
  const files = await markdownFiles(directory);
  const documents = await Promise.all(files.map(async relativePath => toManualDocument(
    relativePath,
    await readFile(path.join(directory, relativePath), "utf8"),
  )));
  const slugs = new Set(documents.map(document => document.slug));
  const relativeSource = path.relative(process.cwd(), path.resolve(directory)).replace(/\\/g, "/");
  const sourceTag = `system-manual-source:${relativeSource || path.basename(directory)}`;
  const result = { inserted: 0, updated: 0, archived: 0, unchanged: 0 };

  for (const document of documents) {
    await db.transaction(async tx => {
      const [previous] = await tx.select().from(kbArticles)
        .where(sql`lower(${kbArticles.slug}) = ${document.slug}`).for("update");
      if (previous && !previous.isSystemGuide) {
        throw new Error(`System manual slug conflicts with a custom article: ${document.slug}`);
      }
      const authorId = await resolveManualUser(tx, document.author);
      const ownerId = await resolveManualUser(tx, document.owner);
      const values = guideValues(document, sourceTag, authorId, ownerId);
      if (!previous) {
        const [created] = await tx.insert(kbArticles).values(values).returning();
        await recordVersion(tx, created, "Imported from repository system manual");
        result.inserted += 1;
        return;
      }

      const unchanged = previous.title === values.title &&
        previous.content === values.content &&
        previous.category === values.category &&
        previous.tags === values.tags &&
        previous.status === values.status &&
        previous.isPublic === values.isPublic &&
        previous.authorId === values.authorId &&
        previous.ownerId === values.ownerId &&
        previous.authorLabel === values.authorLabel &&
        previous.ownerLabel === values.ownerLabel;
      if (unchanged) {
        result.unchanged += 1;
        return;
      }

      await recordVersion(tx, previous, "Preserved prior repository manual version");
      const [updated] = await tx.update(kbArticles).set({
        ...values,
        version: nextKnowledgeVersion(previous.version),
        updatedAt: new Date(),
        publishedAt: previous.publishedAt ?? new Date(),
      }).where(eq(kbArticles.id, previous.id)).returning();
      await recordVersion(tx, updated, "Updated from repository system manual");
      result.updated += 1;
    });
  }

  const existingGuides = await db.select().from(kbArticles).where(and(
    eq(kbArticles.isSystemGuide, true),
    eq(kbArticles.tags, `system manual, ${sourceTag}`),
  ));
  for (const guide of existingGuides) {
    if (slugs.has(guide.slug) || guide.status === "archived") continue;
    await db.transaction(async tx => {
      await recordVersion(tx, guide, "Preserved prior repository manual version");
      const [archived] = await tx.update(kbArticles).set({
        status: "archived",
        isPublic: false,
        version: nextKnowledgeVersion(guide.version),
        updatedAt: new Date(),
      }).where(eq(kbArticles.id, guide.id)).returning();
      await recordVersion(tx, archived, "Archived because its repository Markdown source was removed");
      result.archived += 1;
    });
  }
  return result;
}

