// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { canDeleteKnowledgeArticle, canManageKnowledge, canReadKnowledge, knowledgeArticleInput, nextKnowledgeVersion } from "@shared/kb-governance";
import { isPersonaApiAllowed, isPersonaPageAllowed } from "@shared/personas";
import { assertAdditiveMigration } from "./startup-migrations";

const mock = vi.hoisted(() => {
  const state = {
    role: "end_user", selects: [] as any[][], filters: [] as any[],
    inserts: [] as { table: string; values: any }[], updates: [] as any[],
    existing: {} as any, duplicate: false, failure: undefined as any,
  };
  const query = (rows: any[]) => {
    const builder: any = {
      from: () => builder, leftJoin: () => builder, innerJoin: () => builder,
      where: (filter: any) => { state.filters.push(filter); return builder; },
      orderBy: () => builder, for: () => builder, returning: () => builder,
      onConflictDoNothing: () => builder,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  };
  const db: any = {
    select: vi.fn(() => query(state.selects.shift() ?? [])),
    insert: vi.fn((table: any) => ({
      values: (values: any) => {
        const name = table[Symbol.for("drizzle:Name")];
        state.inserts.push({ table: name, values });
        const rows = name === "kb_articles" ? [{ ...state.existing, ...values, id: "new-article" }]
          : name === "kb_ticket_links" && !state.duplicate ? [{ id: "link-1", ...values }] : [];
        return query(rows);
      },
    })),
    update: vi.fn(() => ({
      set: (values: any) => {
        state.updates.push(values);
        return query([{ ...state.existing, ...values }]);
      },
    })),
    transaction: vi.fn(async (callback: any) => {
      if (state.failure) throw state.failure;
      return callback(db);
    }),
  };
  return { state, db };
});
vi.mock("./db", () => ({ db: mock.db }));
vi.mock("./storage", () => ({ storage: {
  getUserRoles: async () => [{ name: mock.state.role }],
  getUserPermissions: async () => mock.state.role === "admin" ? ["system_admin"] : [],
} }));
import { registerKnowledgeRoutes } from "./knowledge-governance";

const article = {
  id: "guide-1", title: "Employee guidance", slug: "employee-guidance",
  content: "# Approved guidance\nFollow these instructions.", category: "User Guide",
  status: "published", isPublic: true, version: "1.0", authorId: "test-user",
  ownerId: "test-user", isSystemGuide: false, reviewDate: "2026-10-21", tags: "help",
  createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date(),
  reviewedAt: null, reviewedById: null, views: 0, helpfulCount: 0, notHelpfulCount: 0,
};
const payload = {
  title: article.title, content: article.content, category: article.category,
  status: "published", isPublic: true,
};

describe("knowledge persona and input policy", () => {
  it.each(["it_agent", "it_manager", "IT Staff", "manager", "admin"])("allows %s to govern articles", role => {
    expect(canManageKnowledge({ roles: [{ name: role }] })).toBe(true);
  });
  it.each(["end_user", "auditor", "cab_member", "custom_reader"])("keeps %s read-only and internal content hidden", role => {
    const user = { roles: [{ name: role }] };
    expect(canManageKnowledge(user)).toBe(false);
    expect(canReadKnowledge(user, article)).toBe(true);
    for (const changed of [
      { isPublic: false }, { status: "draft" }, { status: "archived" },
      { category: "Technical SOP" }, { category: "KEDB Article" }, { category: "DR Plan" },
    ]) expect(canReadKnowledge(user, { ...article, ...changed })).toBe(false);
  });
  it.each([
    "system_admin", "it_manager", "it_agent", "asset_manager", "cab_member",
    "auditor", "read_only_user", "demo_viewer", "end_user",
  ])("allows authenticated %s users to read published repository guides", role => {
    const user = { id: "reader", roles: [{ name: role }] };
    const guide = { ...article, category: "System Administration & RBAC", isPublic: true, isSystemGuide: true, authorId: null, ownerId: null };
    expect(canReadKnowledge(user, guide)).toBe(true);
    expect(canReadKnowledge(user, { ...guide, status: "draft" })).toBe(canManageKnowledge(user));
  });
  it("requires an authenticated viewer and allows employee navigation without mutations", () => {
    expect(canReadKnowledge(null, article)).toBe(false);
    for (const role of ["end_user", "it_agent", "cab_member", "it_manager", "auditor"]) {
      expect(isPersonaPageAllowed([role], [], "/knowledge-base")).toBe(true);
    }
    expect(isPersonaPageAllowed(["demo_viewer"], [], "/knowledge-base")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/kb/articles", "GET")).toBe(true);
    expect(isPersonaApiAllowed(["end_user"], [], "/kb/articles", "POST")).toBe(false);
    expect(isPersonaApiAllowed(["it_agent"], [], "/kb/articles", "POST")).toBe(true);
    expect(isPersonaApiAllowed(["it_manager"], [], "/kb/articles/a/versions", "GET")).toBe(true);
  });
  it("allows owners to manage custom articles but reserves system guides for administrators", () => {
    expect(canDeleteKnowledgeArticle({ id: "owner-1", roles: [{ name: "end_user" }] }, {
      authorId: "owner-1", isSystemGuide: false,
    })).toBe(true);
    expect(canDeleteKnowledgeArticle({ id: "other-user", roles: [{ name: "end_user" }] }, {
      authorId: "owner-1", isSystemGuide: false,
    })).toBe(false);
    expect(canDeleteKnowledgeArticle({ id: "owner-1", roles: [{ name: "end_user" }] }, {
      authorId: "owner-1", isSystemGuide: true,
    })).toBe(false);
    expect(canDeleteKnowledgeArticle({ roles: [{ name: "admin" }] }, {
      authorId: null, isSystemGuide: true,
    })).toBe(true);
  });
  it("validates calendar dates and rejects protected fields", () => {
    expect(knowledgeArticleInput.safeParse({ ...payload, reviewDate: "2026-02-30" }).success).toBe(false);
    expect(knowledgeArticleInput.safeParse({ ...payload, reviewDate: "21-10-2026" }).success).toBe(false);
    expect(knowledgeArticleInput.safeParse({ ...payload, reviewDate: "2028-02-29" }).success).toBe(true);
    expect(knowledgeArticleInput.safeParse({ ...payload, authorId: "someone-else" }).success).toBe(false);
    expect(knowledgeArticleInput.safeParse({ ...payload, authorLabel: "Sulttanz" }).success).toBe(false);
    expect(knowledgeArticleInput.safeParse({ ...payload, version: "99.0" }).success).toBe(false);
    expect(knowledgeArticleInput.parse({ ...payload, slug: "EMPLOYEE-GUIDANCE" }).slug).toBe("employee-guidance");
    expect(nextKnowledgeVersion("1.9")).toBe("1.10");
  });
  it("uses an additive startup migration", async () => {
    const migration = await readFile("migrations/onprem/20261116_protected_knowledge_system_manual.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "protected system manual")).not.toThrow();
  });
});

describe("knowledge governance HTTP boundaries", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.get("x-anonymous") !== "yes") req.user = { id: "test-user" } as any;
      next();
    });
    registerKnowledgeRoutes(app, (req, res, next) => req.user ? next() : void res.sendStatus(401));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mock.state, {
      role: "end_user", selects: [], filters: [], inserts: [], updates: [],
      existing: { ...article }, duplicate: false, failure: undefined,
    });
  });
  const request = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });

  it.each(["/api/kb/articles", "/api/kb/search?q=guide", "/api/reports/kb-articles"])("filters all article discovery paths: %s", async path => {
    mock.state.selects.push([
      article, { ...article, id: "internal", isPublic: false },
      { ...article, id: "draft", status: "draft" },
      { ...article, id: "sop", category: "Technical SOP" },
      { ...article, id: "system-sop", category: "Technical SOP", isPublic: true, isSystemGuide: true },
      { ...article, id: "policy", category: "Policy" },
    ].map((row, index) => ({ ...row, authorId: index === 0 ? "test-user" : "another-user", ownerId: index === 0 ? "test-user" : "another-user" })));
    const response = await request(path);
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: any) => row.id)).toEqual(["guide-1", "system-sop", "policy"]);
    const condition = new PgDialect().sqlToQuery(mock.state.filters[0]);
    expect(condition.params).toEqual(expect.arrayContaining(["published", true, "policy", "user guide"]));
  });
  it("hides private articles on direct detail access", async () => {
    mock.state.selects.push([{ ...article, isPublic: false, authorId: "another-user", ownerId: "another-user" }]);
    expect((await request("/api/kb/articles/guide-1")).status).toBe(404);
    expect(mock.state.updates).toHaveLength(0);
  });
  it("allows every authenticated persona to open a published system guide directly", async () => {
    mock.state.selects.push([{
      ...article, category: "System Administration & RBAC", isPublic: true, isSystemGuide: true,
      authorId: null, ownerId: null,
    }]);
    expect((await request("/api/kb/articles/guide-1")).status).toBe(200);
  });
  it("does not expose historical private or superseded public snapshots to employees", async () => {
    mock.state.selects.push([article], [
      { id: "v1", version: "1.0", snapshot: article },
      { id: "old-private", version: "0.8", snapshot: { ...article, isPublic: false } },
      { id: "old-public", version: "0.9", snapshot: article },
    ]);
    const response = await request("/api/kb/articles/guide-1/versions");
    expect((await response.json()).map((row: any) => row.id)).toEqual(["v1"]);
  });
  it("allows IT agents to read internal articles and all revisions", async () => {
    mock.state.role = "it_agent";
    mock.state.selects.push([{ ...article, isPublic: false }], [{ id: "old", version: "0.9", snapshot: { ...article, isPublic: false } }]);
    const response = await request("/api/kb/articles/guide-1/versions");
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1);
  });
  it.each([
    ["POST", "/api/kb/articles"], ["POST", "/api/kb/articles/guide-1/request-review"],
    ["POST", "/api/kb/articles/guide-1/approve"], ["POST", "/api/kb/articles/guide-1/reject"],
    ["GET", "/api/incidents/ticket-1/kb-articles"], ["POST", "/api/service-requests/ticket-1/kb-articles"],
  ])("blocks employee mutation/internal linking: %s %s", async (method, path) => {
    expect((await request(path, method, method === "GET" ? undefined : {})).status).toBe(403);
    expect(mock.db.select).not.toHaveBeenCalled();
    expect(mock.db.transaction).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    expect((await fetch(`${base}/api/kb/articles`, { headers: { "x-anonymous": "yes" } })).status).toBe(401);
  });
  it("writes a version and audit entry with an authenticated author", async () => {
    mock.state.role = "it_agent";
    mock.state.selects.push([{ id: "category-1" }]);
    const response = await request("/api/kb/articles", "POST", payload);
    expect(response.status).toBe(201);
    expect(mock.state.inserts.find(row => row.table === "kb_articles")!.values.authorId).toBe("test-user");
    expect(mock.state.inserts.filter(row => row.table === "kb_article_versions")).toHaveLength(1);
    expect(mock.state.inserts.find(row => row.table === "audit_logs")!.values.userId).toBe("test-user");
  });
  it("preserves prior content and atomically records a new revision when updating", async () => {
    mock.state.role = "it_manager";
    mock.state.selects.push([article]);
    const response = await request("/api/kb/articles/guide-1", "PUT", {
      ...payload, content: "Updated approved instructions", expectedVersion: "1.0",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe("1.1");
    const revisions = mock.state.inserts.filter(row => row.table === "kb_article_versions");
    expect(revisions.map(row => row.values.version)).toEqual(["1.0", "1.1"]);
    expect(revisions[0].values.snapshot.content).toBe(article.content);
    expect(mock.state.inserts.some(row => row.table === "audit_logs")).toBe(true);
  });
  it("rejects stale edits before modifying content or audit history", async () => {
    mock.state.role = "it_agent";
    mock.state.selects.push([{ ...article, version: "1.1" }]);
    expect((await request("/api/kb/articles/guide-1", "PUT", { ...payload, expectedVersion: "1.0" })).status).toBe(409);
    expect(mock.state.inserts).toHaveLength(0);
    expect(mock.state.updates).toHaveLength(0);
  });
  it("archives rather than deleting governed history", async () => {
    mock.state.role = "it_manager";
    mock.state.selects.push([article]);
    expect((await request("/api/kb/articles/guide-1", "DELETE")).status).toBe(200);
    expect(mock.state.updates[0]).toMatchObject({ status: "archived", version: "1.1" });
  });
  it("keeps custom article editing restricted to IT staff while preserving owner archive rights", async () => {
    mock.state.existing = { ...article, status: "draft", isPublic: false };
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1", "PUT", {
      ...payload, status: "draft", isPublic: false, expectedVersion: "1.0",
      content: "Updated private employee guidance",
    })).status).toBe(403);
    expect(mock.state.updates).toHaveLength(0);
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1", "DELETE")).status).toBe(200);
    expect(mock.state.updates.at(-1)).toMatchObject({ status: "archived" });
  });
  it("denies non-admin archive and update of a repository system guide", async () => {
    mock.state.existing = { ...article, isSystemGuide: true, authorId: null, ownerId: null };
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1", "DELETE")).status).toBe(403);
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1", "PUT", {
      ...payload, expectedVersion: "1.0",
    })).status).toBe(403);
  });
  it("denies non-admin edits to system-guide governance metadata", async () => {
    mock.state.role = "it_agent";
    mock.state.existing = { ...article, isSystemGuide: true, authorId: null, ownerId: null };
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1/controls", "POST", {
      framework: "ISO", controlId: "A.1", controlTitle: "Fixture",
    })).status).toBe(403);
  });
  it("allows only an administrator to archive a system guide", async () => {
    mock.state.role = "admin";
    mock.state.existing = { ...article, isSystemGuide: true, authorId: null, ownerId: null };
    mock.state.selects.push([{ ...mock.state.existing }]);
    expect((await request("/api/kb/articles/guide-1", "DELETE")).status).toBe(200);
    expect(mock.state.updates[0]).toMatchObject({ status: "archived", isPublic: false });
  });
  it("maps database uniqueness conflicts to HTTP 409", async () => {
    mock.state.role = "it_agent";
    mock.state.failure = { cause: { code: "23505" } };
    expect((await request("/api/kb/articles", "POST", payload)).status).toBe(409);
  });
  it.each(["incidents", "service-requests"])("links a published article to %s with an activity and audit record", async kind => {
    mock.state.role = "it_agent";
    mock.state.selects.push([{ ...article, isPublic: false }], [{ id: "ticket-1" }]);
    expect((await request(`/api/${kind}/ticket-1/kb-articles`, "POST", { articleId: article.id })).status).toBe(201);
    const activity = mock.state.inserts.find(row => row.table === (kind === "incidents" ? "incident_activities" : "service_request_activities"));
    expect(activity?.values).toMatchObject({ actorId: "test-user", action: "kb_article_linked" });
    expect(activity?.values.details).toContain("version 1.0");
    expect(mock.state.inserts.find(row => row.table === "kb_ticket_links")!.values.articleVersion).toBe("1.0");
    expect(mock.state.inserts.some(row => row.table === "audit_logs")).toBe(true);
  });
  it("makes repeat links idempotent without duplicate audit or activity entries", async () => {
    mock.state.role = "it_agent";
    mock.state.duplicate = true;
    mock.state.selects.push([article], [{ id: "ticket-1" }], [{ id: "existing-link" }]);
    expect((await request("/api/incidents/ticket-1/kb-articles", "POST", { articleId: article.id })).status).toBe(200);
    expect(mock.state.inserts).toHaveLength(1);
  });
  it("rejects draft articles during ticket linking", async () => {
    mock.state.role = "it_agent";
    mock.state.selects.push([{ ...article, status: "draft" }]);
    expect((await request("/api/incidents/ticket-1/kb-articles", "POST", { articleId: article.id })).status).toBe(409);
    expect(mock.state.inserts).toHaveLength(0);
  });
});
