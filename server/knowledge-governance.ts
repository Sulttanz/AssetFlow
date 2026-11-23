import { respondWithApiError } from "./api-error-handler";
import type { Express, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { unlink } from "node:fs/promises";
import { and, desc, eq, getTableColumns, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  auditLogs, dropdownOptions, incidentActivities, incidents, kbArticles,
  kbArticleAttachments, kbArticleControlMappings, kbArticleVersions, kbTicketLinks,
  serviceRequestActivities, serviceRequests, users,
  type KbArticle,
} from "@shared/schema";
import {
  canAuditPublishedPolicies, canDeleteKnowledgeArticle, canManageKnowledge, canReadKnowledge,
  knowledgeArticleInput, nextKnowledgeVersion,
} from "@shared/kb-governance";
import { isSystemAdministrator } from "@shared/personas";
import { db } from "./db";
import { storage } from "./storage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Viewer = { id: string; roles: { name: string }[]; permissions: string[] };
class KnowledgeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const owners = alias(users, "kb_owner");
const revisionAuthors = alias(users, "kb_revision_author");
const revisionOwners = alias(users, "kb_revision_owner");
const articleSelection = {
  ...getTableColumns(kbArticles),
  authorName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${kbArticles.authorLabel})`,
  ownerName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${owners.firstName}, ${owners.lastName}), ''), ${kbArticles.ownerLabel})`,
};

async function viewer(req: Request): Promise<Viewer> {
  if (!req.user?.id) throw new KnowledgeError(401, "Authentication required");
  const [roles, permissions] = await Promise.all([
    storage.getUserRoles(req.user.id), storage.getUserPermissions(req.user.id),
  ]);
  return { id: req.user.id, roles, permissions };
}

function requireEditor(user: Viewer) {
  if (!canManageKnowledge(user)) throw new KnowledgeError(403, "IT staff or manager access required");
}

function requireSystemGuideAdministrator(user: Viewer, article: Pick<KbArticle, "isSystemGuide">) {
  if (article.isSystemGuide && !isSystemAdministrator(user)) {
    throw new KnowledgeError(403, "Only an administrator can modify a repository-owned system guide");
  }
}

function visibleArticles(user: Viewer): SQL | undefined {
  if (canManageKnowledge(user)) return undefined;
  const owned = or(eq(kbArticles.authorId, user.id), eq(kbArticles.ownerId, user.id));
  if (canAuditPublishedPolicies(user)) return and(
    or(and(
      eq(kbArticles.status, "published"),
      sql`lower(trim(${kbArticles.category})) = 'policy'`,
    ), and(eq(kbArticles.status, "published"), eq(kbArticles.isSystemGuide, true)), owned),
  );
  return or(and(
    eq(kbArticles.status, "published"),
    eq(kbArticles.isPublic, true),
    inArray(sql`lower(trim(${kbArticles.category}))`, ["policy", "user guide"]),
  ), and(eq(kbArticles.status, "published"), eq(kbArticles.isSystemGuide, true)), owned);
}

async function articleDetail(id: string, user: Viewer) {
  const [article] = await db.select(articleSelection).from(kbArticles)
    .leftJoin(users, eq(kbArticles.authorId, users.id))
    .leftJoin(owners, eq(kbArticles.ownerId, owners.id))
    .where(and(eq(kbArticles.id, id), visibleArticles(user)));
  if (!article || !canReadKnowledge(user, article)) throw new KnowledgeError(404, "Article not found");
  return article;
}

async function revision(tx: Transaction, article: KbArticle, actorId: string, note: string, preserveExisting = false) {
  const insertion = tx.insert(kbArticleVersions).values({
    articleId: article.id, version: article.version,
    snapshot: JSON.parse(JSON.stringify(article)), actorId, changeNote: note,
  });
  if (preserveExisting) await insertion.onConflictDoNothing();
  else await insertion;
}

async function audit(tx: Transaction, req: Request, actorId: string, article: KbArticle, previous?: KbArticle) {
  await tx.insert(auditLogs).values({
    userId: actorId, action: previous ? "UPDATE" : "CREATE", tableName: "kb_articles",
    recordId: article.id, recordName: article.title,
    oldValues: previous ? JSON.stringify(previous) : null,
    newValues: JSON.stringify(article), ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

async function validateReferences(tx: Transaction, input: z.infer<typeof knowledgeArticleInput>, previous?: KbArticle) {
  if (input.isPublic && !["policy", "user guide"].includes(input.category.toLowerCase())) {
    throw new KnowledgeError(400, "Only policies and user guides may be published to employees");
  }
  if (input.category !== previous?.category) {
    const [category] = await tx.select({ id: dropdownOptions.id }).from(dropdownOptions).where(and(
      eq(dropdownOptions.category, "kb_category"), eq(dropdownOptions.value, input.category),
      eq(dropdownOptions.isActive, true),
    ));
    if (!category) throw new KnowledgeError(400, "Choose an active knowledge-base category");
  }
  if (input.ownerId && input.ownerId !== previous?.ownerId) {
    const [owner] = await tx.select({ id: users.id }).from(users).where(and(
      eq(users.id, input.ownerId), eq(users.isActive, true),
    ));
    if (!owner) throw new KnowledgeError(400, "Choose an active article owner");
  }
}

const updateInput = knowledgeArticleInput.extend({
  expectedVersion: z.string().regex(/^\d+\.\d+$/),
});

async function updateArticle(
  req: Request, user: Viewer,
  transition?: { from?: string; status: string; reviewed?: boolean },
) {
  requireEditor(user);
  const parsed = transition ? undefined : updateInput.parse(req.body);
  return db.transaction(async tx => {
    const [previous] = await tx.select().from(kbArticles)
      .where(eq(kbArticles.id, req.params.id)).for("update");
    if (!previous) throw new KnowledgeError(404, "Article not found");
    requireSystemGuideAdministrator(user, previous);
    if (transition?.from && previous.status !== transition.from) {
      throw new KnowledgeError(409, `Only ${transition.from} articles support this action`);
    }
    if (parsed && parsed.expectedVersion !== previous.version) {
      throw new KnowledgeError(409, "This article changed. Reload it before saving.");
    }
    // The concurrency token is never persisted in the article itself.
    const input = parsed ? (({ expectedVersion: _expected, ...fields }) => fields)(parsed) : undefined;
    if (input) await validateReferences(tx, input, previous);
    await revision(tx, previous, user.id, "Preserved prior version", true);
    const { changeNote, ...fields } = input ?? {};
    const status = transition?.status ?? input!.status;
    const [updated] = await tx.update(kbArticles).set({
      ...fields, status,
      version: nextKnowledgeVersion(previous.version),
      updatedAt: new Date(),
      publishedAt: status === "published" ? previous.publishedAt ?? new Date() : previous.publishedAt,
      ...(transition?.reviewed ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
    }).where(eq(kbArticles.id, previous.id)).returning();
    await revision(tx, updated, user.id, changeNote ?? (transition ? `Status changed to ${status}` : "Article updated"));
    await audit(tx, req, user.id, updated, previous);
    return updated;
  });
}

/** Mounted after global authentication/persona/module gates. */
export function registerKnowledgeRoutes(
  app: Express,
  requireAuth: RequestHandler,
  uploadSingleFile?: RequestHandler,
) {
  const route = (handler: (req: Request, res: Response, user: Viewer) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      try { await handler(req, res, await viewer(req)); }
      catch (error) {
        if (error instanceof KnowledgeError) return void res.status(error.status).json({ message: error.message });
        if (error instanceof z.ZodError) return void res.status(400).json({ message: "Invalid article data", errors: error.issues });
        const code = (error as any)?.code ?? (error as any)?.cause?.code;
        if (code === "23505") return void res.status(409).json({ message: "A duplicate article, attachment, or control mapping already exists" });
        console.error("Knowledge governance request failed", error instanceof Error ? error.message : "Unknown error");
        respondWithApiError(res, error, "Knowledge-base request failed");
      }
    };
  const editorMiddleware: RequestHandler = async (req, res, next) => {
    try {
      requireEditor(await viewer(req));
      next();
    } catch (error) {
      if (error instanceof KnowledgeError) return void res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Could not verify knowledge governance access");
    }
  };
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const fileMiddleware = uploadSingleFile ?? passThrough;

  const list = (publishedOnly = false) => route(async (req, res, user) => {
    const query = z.object({
      q: z.string().max(200).optional(),
      status: z.enum(["draft", "under_review", "published", "archived", "all"]).optional(),
      category: z.string().max(150).optional(),
    }).parse(req.query);
    const search = query.q?.trim().replace(/[\\%_]/g, "\\$&");
    const rows = await db.select(articleSelection).from(kbArticles)
      .leftJoin(users, eq(kbArticles.authorId, users.id))
      .leftJoin(owners, eq(kbArticles.ownerId, owners.id))
      .where(and(
        visibleArticles(user),
        publishedOnly ? eq(kbArticles.status, "published") :
          query.status && query.status !== "all" ? eq(kbArticles.status, query.status) : undefined,
        query.category && query.category !== "all" ? eq(kbArticles.category, query.category) : undefined,
        search ? or(ilike(kbArticles.title, `%${search}%`), ilike(kbArticles.content, `%${search}%`),
          ilike(kbArticles.tags, `%${search}%`)) : undefined,
      )).orderBy(desc(kbArticles.updatedAt));
    res.json(rows.filter(article => canReadKnowledge(user, article)));
  });

  app.get("/api/kb/options", requireAuth, route(async (_req, res, user) => {
    const categories = await db.select({ value: dropdownOptions.value, label: dropdownOptions.label })
      .from(dropdownOptions).where(and(eq(dropdownOptions.category, "kb_category"), eq(dropdownOptions.isActive, true)))
      .orderBy(dropdownOptions.displayOrder, dropdownOptions.label);
    const staff = canManageKnowledge(user);
    const activeOwners = staff ? await db.select({
      id: users.id, name: sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
    }).from(users).where(eq(users.isActive, true)).orderBy(users.firstName, users.lastName) : [];
    res.json({ canManage: staff, categories, owners: activeOwners });
  }));
  app.get("/api/kb/articles", requireAuth, list());
  app.get("/api/kb/search", requireAuth, list(true));
  app.get("/api/reports/kb-articles", requireAuth, list());
  app.get("/api/kb/articles/:id", requireAuth, route(async (req, res, user) => {
    const article = await articleDetail(req.params.id, user);
    await db.update(kbArticles).set({ views: sql`${kbArticles.views} + 1` }).where(eq(kbArticles.id, article.id));
    res.json(article);
  }));
  app.get("/api/kb/articles/:id/versions", requireAuth, route(async (req, res, user) => {
    const article = await articleDetail(req.params.id, user);
    const versions = await db.select({
      ...getTableColumns(kbArticleVersions),
      actorName: sql<string | null>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
      snapshotAuthorName: sql<string | null>`concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})`,
      snapshotOwnerName: sql<string | null>`concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})`,
    }).from(kbArticleVersions).leftJoin(users, eq(kbArticleVersions.actorId, users.id))
      .leftJoin(revisionAuthors, eq(revisionAuthors.id, sql`${kbArticleVersions.snapshot}->>'authorId'`))
      .leftJoin(revisionOwners, eq(revisionOwners.id, sql`${kbArticleVersions.snapshot}->>'ownerId'`))
      .where(and(eq(kbArticleVersions.articleId, article.id),
        canManageKnowledge(user) ? undefined : eq(kbArticleVersions.version, article.version)))
      .orderBy(desc(kbArticleVersions.createdAt));
    const visible = canManageKnowledge(user) ? versions :
      versions.filter(version => version.version === article.version && canReadKnowledge(user, version.snapshot as any));
    res.json(visible.map(({ snapshotAuthorName, snapshotOwnerName, ...version }) => ({
      ...version, snapshot: {
        ...version.snapshot,
        authorName: snapshotAuthorName ?? (typeof version.snapshot.authorLabel === "string" ? version.snapshot.authorLabel : null),
        ownerName: snapshotOwnerName ?? (typeof version.snapshot.ownerLabel === "string" ? version.snapshot.ownerLabel : null),
      },
    })));
  }));
  app.post("/api/kb/articles", requireAuth, route(async (req, res, user) => {
    requireEditor(user);
    const input = knowledgeArticleInput.parse(req.body);
    const { changeNote, ...fields } = input;
    const article = await db.transaction(async tx => {
      await validateReferences(tx, input);
      const [created] = await tx.insert(kbArticles).values({
        ...fields, authorId: user.id, ownerId: input.ownerId === undefined ? user.id : input.ownerId, version: "1.0",
        slug: input.slug ?? `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160) || "article"}-${randomUUID().slice(0, 8)}`,
        publishedAt: input.status === "published" ? new Date() : null,
      }).returning();
      await revision(tx, created, user.id, changeNote ?? "Article created");
      await audit(tx, req, user.id, created);
      return created;
    });
    res.status(201).json(article);
  }));
  app.put("/api/kb/articles/:id", requireAuth, route(async (req, res, user) => {
    res.json(await updateArticle(req, user));
  }));
  // Preserve revision and ticket-link history: legacy deletion now archives.
  app.delete("/api/kb/articles/:id", requireAuth, route(async (req, res, user) => {
    const archived = await db.transaction(async tx => {
      const [previous] = await tx.select().from(kbArticles)
        .where(eq(kbArticles.id, req.params.id)).for("update");
      if (!previous) throw new KnowledgeError(404, "Article not found");
      if (!canDeleteKnowledgeArticle(user, previous)) {
        throw new KnowledgeError(403, previous.isSystemGuide
          ? "Only an administrator can archive a system guide"
          : "You can only archive your own custom articles");
      }
      if (previous.status === "archived") return previous;
      await revision(tx, previous, user.id, "Preserved prior version", true);
      const [updated] = await tx.update(kbArticles).set({
        status: "archived",
        ...(previous.isSystemGuide ? { isPublic: false } : {}),
        version: nextKnowledgeVersion(previous.version),
        updatedAt: new Date(),
      }).where(eq(kbArticles.id, previous.id)).returning();
      await revision(tx, updated, user.id, "Article archived");
      await audit(tx, req, user.id, updated, previous);
      return updated;
    });
    res.json({ success: true, status: archived.status });
  }));
  for (const [action, transition] of Object.entries({
    "request-review": { from: "draft", status: "under_review" },
    approve: { from: "under_review", status: "published", reviewed: true },
    reject: { from: "under_review", status: "draft", reviewed: true },
  })) {
    app.post(`/api/kb/articles/:id/${action}`, requireAuth, route(async (req, res, user) => {
      res.json(await updateArticle(req, user, transition));
    }));
  }
  app.post("/api/kb/articles/:id/rate", requireAuth, route(async (req, res, user) => {
    await articleDetail(req.params.id, user);
    const { helpful } = z.object({ helpful: z.boolean() }).parse(req.body);
    const field = helpful ? kbArticles.helpfulCount : kbArticles.notHelpfulCount;
    await db.update(kbArticles).set(helpful
      ? { helpfulCount: sql`coalesce(${field}, 0) + 1` }
      : { notHelpfulCount: sql`coalesce(${field}, 0) + 1` }).where(eq(kbArticles.id, req.params.id));
    res.json({ success: true });
  }));

  app.get("/api/kb/articles/:id/attachments", requireAuth, route(async (req, res, user) => {
    const article = await articleDetail(req.params.id, user);
    if (!["policy", "technical sop", "dr plan"].includes(article.category.trim().toLowerCase())) {
      throw new KnowledgeError(404, "Policy documents not found");
    }
    const rows = await db.select({
      id: kbArticleAttachments.id,
      articleId: kbArticleAttachments.articleId,
      articleVersion: kbArticleAttachments.articleVersion,
      documentType: kbArticleAttachments.documentType,
      version: kbArticleAttachments.version,
      originalName: kbArticleAttachments.originalName,
      fileType: kbArticleAttachments.fileType,
      fileSize: kbArticleAttachments.fileSize,
      uploadedAt: kbArticleAttachments.uploadedAt,
      uploadedBy: kbArticleAttachments.uploadedBy,
      uploadedByName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
    }).from(kbArticleAttachments).leftJoin(users, eq(kbArticleAttachments.uploadedBy, users.id))
      .where(eq(kbArticleAttachments.articleId, article.id))
      .orderBy(desc(kbArticleAttachments.uploadedAt), desc(kbArticleAttachments.version));
    if (canManageKnowledge(user)) return res.json(rows);
    const latest = new Map<string, typeof rows[number]>();
    for (const row of rows) {
      const key = `${row.originalName.trim().toLowerCase()}|${row.documentType.toLowerCase()}`;
      if (!latest.has(key)) latest.set(key, row);
    }
    res.json(Array.from(latest.values()));
  }));
  app.post("/api/kb/articles/:id/attachments", requireAuth, editorMiddleware, fileMiddleware, route(async (req, res, user) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new KnowledgeError(400, "Choose a policy document to upload");
    let body: { documentType: string };
    try {
      body = z.object({
        documentType: z.string().trim().min(1).max(100).default("official_policy"),
      }).strict().parse(req.body);
    } catch (error) {
      await unlink(file.path).catch(() => {});
      throw error;
    }
    const originalName = basename(file.originalname.replace(/\\/g, "/")).slice(0, 255);
    try {
      const attachment = await db.transaction(async tx => {
        const [article] = await tx.select().from(kbArticles)
          .where(eq(kbArticles.id, req.params.id)).for("update");
        if (!article) throw new KnowledgeError(404, "Article not found");
        requireSystemGuideAdministrator(user, article);
        if (!["policy", "technical sop", "dr plan"].includes(article.category.trim().toLowerCase())) {
          throw new KnowledgeError(400, "Attachments are only supported for policies, technical SOPs, and DR plans");
        }
        const [latest] = await tx.select({ version: kbArticleAttachments.version })
          .from(kbArticleAttachments).where(and(
            eq(kbArticleAttachments.articleId, article.id),
            sql`lower(btrim(${kbArticleAttachments.originalName})) = ${originalName.trim().toLowerCase()}`,
            eq(kbArticleAttachments.documentType, body.documentType),
          )).orderBy(desc(kbArticleAttachments.version)).limit(1);
        const [created] = await tx.insert(kbArticleAttachments).values({
          articleId: article.id,
          articleVersion: article.version,
          documentType: body.documentType,
          version: (latest?.version ?? 0) + 1,
          originalName,
          fileName: basename(file.filename),
          fileType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
          uploadedBy: user.id,
        }).returning();
        await tx.insert(auditLogs).values({
          userId: user.id, action: "CREATE", tableName: "kb_article_attachments",
          recordId: created.id, recordName: `${article.title}: ${originalName} v${created.version}`,
          newValues: JSON.stringify({ ...created, filePath: undefined }),
          ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null,
        });
        return created;
      });
      const { filePath: _filePath, fileName: _fileName, ...safeAttachment } = attachment;
      res.status(201).json(safeAttachment);
    } catch (error) {
      await unlink(file.path).catch(() => {});
      throw error;
    }
  }));
  app.get("/api/kb/articles/:id/attachments/:attachmentId", requireAuth, route(async (req, res, user) => {
    const article = await articleDetail(req.params.id, user);
    const [attachment] = await db.select().from(kbArticleAttachments).where(and(
      eq(kbArticleAttachments.articleId, article.id),
      eq(kbArticleAttachments.id, req.params.attachmentId),
    )).limit(1);
    if (!attachment) throw new KnowledgeError(404, "Policy document not found");
    if (!canManageKnowledge(user)) {
      const [latest] = await db.select({ id: kbArticleAttachments.id })
        .from(kbArticleAttachments).where(and(
          eq(kbArticleAttachments.articleId, article.id),
          eq(kbArticleAttachments.documentType, attachment.documentType),
          sql`lower(btrim(${kbArticleAttachments.originalName})) = ${attachment.originalName.trim().toLowerCase()}`,
        )).orderBy(desc(kbArticleAttachments.version)).limit(1);
      if (!latest || latest.id !== attachment.id) throw new KnowledgeError(404, "Policy document not found");
    }
    return res.download(attachment.filePath, attachment.originalName);
  }));

  app.get("/api/kb/articles/:id/controls", requireAuth, route(async (req, res, user) => {
    if (!canManageKnowledge(user) && !canAuditPublishedPolicies(user)) {
      throw new KnowledgeError(403, "Compliance control mappings are restricted to IT governance staff and auditors");
    }
    const article = await articleDetail(req.params.id, user);
    const rows = await db.select({
      ...getTableColumns(kbArticleControlMappings),
      mapperName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
    }).from(kbArticleControlMappings).leftJoin(users, eq(kbArticleControlMappings.mappedBy, users.id))
      .where(and(
        eq(kbArticleControlMappings.articleId, article.id),
        canManageKnowledge(user) ? undefined : and(
          eq(kbArticleControlMappings.isActive, true),
          eq(kbArticleControlMappings.articleVersion, article.version),
        ),
      )).orderBy(desc(kbArticleControlMappings.createdAt));
    res.json(rows);
  }));
  app.post("/api/kb/articles/:id/controls", requireAuth, editorMiddleware, route(async (req, res, user) => {
    const input = z.object({
      framework: z.string().trim().min(1).max(120),
      controlId: z.string().trim().min(1).max(120),
      controlTitle: z.string().trim().min(1).max(300),
      implementationNotes: z.string().trim().max(4000).nullable().optional(),
    }).strict().parse(req.body);
    const mapping = await db.transaction(async tx => {
      const [article] = await tx.select().from(kbArticles).where(eq(kbArticles.id, req.params.id)).for("update");
      if (!article) throw new KnowledgeError(404, "Article not found");
      requireSystemGuideAdministrator(user, article);
      if (!["policy", "technical sop", "dr plan"].includes(article.category.trim().toLowerCase())) {
        throw new KnowledgeError(400, "Control mappings are only supported for policies, technical SOPs, and DR plans");
      }
      const [created] = await tx.insert(kbArticleControlMappings).values({
        articleId: article.id, articleVersion: article.version, ...input, mappedBy: user.id,
      }).returning();
      await tx.insert(auditLogs).values({
        userId: user.id, action: "CREATE", tableName: "kb_article_control_mappings",
        recordId: created.id, recordName: `${input.framework} ${input.controlId}`,
        newValues: JSON.stringify(created), ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
      return created;
    });
    res.status(201).json(mapping);
  }));
  app.post("/api/kb/articles/:id/controls/:mappingId/remove", requireAuth, editorMiddleware, route(async (req, res, user) => {
    const { removalNote } = z.object({ removalNote: z.string().trim().min(5).max(1000) }).strict().parse(req.body);
    const updated = await db.transaction(async tx => {
      const [before] = await tx.select().from(kbArticleControlMappings).where(and(
        eq(kbArticleControlMappings.id, req.params.mappingId),
        eq(kbArticleControlMappings.articleId, req.params.id),
      )).for("update");
      if (!before) throw new KnowledgeError(404, "Control mapping not found");
      const [article] = await tx.select().from(kbArticles)
        .where(eq(kbArticles.id, before.articleId)).for("update");
      if (!article) throw new KnowledgeError(404, "Article not found");
      requireSystemGuideAdministrator(user, article);
      if (!before.isActive) throw new KnowledgeError(409, "Control mapping has already been removed");
      const [after] = await tx.update(kbArticleControlMappings).set({
        isActive: false, removedBy: user.id, removedAt: new Date(), removalNote,
      }).where(eq(kbArticleControlMappings.id, before.id)).returning();
      await tx.insert(auditLogs).values({
        userId: user.id, action: "UPDATE", tableName: "kb_article_control_mappings",
        recordId: after.id, recordName: `${after.framework} ${after.controlId}`,
        oldValues: JSON.stringify(before), newValues: JSON.stringify(after),
        ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null,
      });
      return after;
    });
    res.json(updated);
  }));

  for (const kind of ["incidents", "service-requests"] as const) {
    const isIncident = kind === "incidents";
    const ticketTable = isIncident ? incidents : serviceRequests;
    const targetColumn = isIncident ? kbTicketLinks.incidentId : kbTicketLinks.serviceRequestId;
    app.get(`/api/${kind}/:id/kb-articles`, requireAuth, route(async (req, res, user) => {
      requireEditor(user);
      const [ticket] = await db.select({ id: ticketTable.id }).from(ticketTable).where(eq(ticketTable.id, req.params.id));
      if (!ticket) throw new KnowledgeError(404, "Ticket not found");
      res.json(await db.select({
        id: kbTicketLinks.id, articleId: kbTicketLinks.articleId, articleVersion: kbTicketLinks.articleVersion,
        createdAt: kbTicketLinks.createdAt, title: kbArticles.title, category: kbArticles.category,
        status: kbArticles.status, version: kbArticles.version,
      }).from(kbTicketLinks).innerJoin(kbArticles, eq(kbTicketLinks.articleId, kbArticles.id))
        .where(eq(targetColumn, req.params.id)).orderBy(desc(kbTicketLinks.createdAt)));
    }));
    app.post(`/api/${kind}/:id/kb-articles`, requireAuth, route(async (req, res, user) => {
      requireEditor(user);
      const { articleId } = z.object({ articleId: z.string().min(1) }).strict().parse(req.body);
      const result = await db.transaction(async tx => {
        const [article] = await tx.select().from(kbArticles).where(eq(kbArticles.id, articleId)).for("update");
        if (!article || article.status !== "published") throw new KnowledgeError(409, "Only published articles can be linked");
        const [ticket] = await tx.select({ id: ticketTable.id }).from(ticketTable)
          .where(eq(ticketTable.id, req.params.id)).for("update");
        if (!ticket) throw new KnowledgeError(404, "Ticket not found");
        const [link] = await tx.insert(kbTicketLinks).values({
          articleId, articleVersion: article.version, linkedById: user.id,
          incidentId: isIncident ? ticket.id : null,
          serviceRequestId: isIncident ? null : ticket.id,
        }).onConflictDoNothing().returning();
        if (!link) {
          const [existing] = await tx.select().from(kbTicketLinks).where(and(
            eq(targetColumn, ticket.id), eq(kbTicketLinks.articleId, articleId),
          ));
          return { link: existing, created: false };
        }
        const event = { actorId: user.id, action: "kb_article_linked", details: `Linked KB article "${article.title}" (version ${article.version})` };
        if (isIncident) await tx.insert(incidentActivities).values({ ...event, incidentId: ticket.id });
        else await tx.insert(serviceRequestActivities).values({ ...event, serviceRequestId: ticket.id });
        await tx.insert(auditLogs).values({
          userId: user.id, action: "CREATE", tableName: "kb_ticket_links", recordId: link.id,
          recordName: article.title, newValues: JSON.stringify(link), ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        });
        return { link, created: true };
      });
      res.status(result.created ? 201 : 200).json(result.link);
    }));
  }
}
