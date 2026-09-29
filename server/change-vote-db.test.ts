// @vitest-environment node
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeApprovals, changes, users } from "@shared/schema";

vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => {
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      const userId = req.header("x-test-user");
      req.isAuthenticated = () => !!userId;
      if (userId) req.user = { id: userId } as express.Request["user"];
      next();
    });
  },
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}));

describe("concurrent CAB votes (PostgreSQL and HTTP)", () => {
  const schema = `cab_vote_test_${randomUUID().replace(/-/g, "")}`;
  const originalUrl = process.env.DATABASE_URL;
  let setupPool: Pool;
  let appPool: Pool;
  let server: Server;
  let baseUrl: string;
  let storage: typeof import("./storage").storage;
  let db: typeof import("./db").db;

  beforeAll(async () => {
    if (!originalUrl) throw new Error("DATABASE_URL is required for the CAB concurrency test");
    neonConfig.webSocketConstructor = ws;
    setupPool = new Pool({ connectionString: originalUrl });
    // This schema belongs only to this test. In particular, never use the live
    // changes/approvals tables: their columns may differ during migrations.
    await setupPool.query(`CREATE SCHEMA "${schema}"`);
    await setupPool.query(`
      CREATE TABLE "${schema}".users (
        id varchar PRIMARY KEY, username text NOT NULL UNIQUE, email text NOT NULL UNIQUE,
        password text NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
        is_active boolean DEFAULT true, last_login timestamp, created_at timestamp DEFAULT now(),
        created_by varchar, two_factor_enabled boolean DEFAULT false, two_factor_secret text
      );
      CREATE TABLE "${schema}".changes (
        id varchar PRIMARY KEY, change_number text NOT NULL UNIQUE, title text NOT NULL,
        description text, type text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'draft',
        priority text NOT NULL DEFAULT 'medium', risk text DEFAULT 'low', impact text,
        rollback_plan text, implementation_plan text, test_plan text,
        scheduled_start timestamp, scheduled_end timestamp, actual_start timestamp,
        actual_end timestamp, assigned_at timestamp, submitted_at timestamp,
        approved_at timestamp, cab_required boolean DEFAULT false, cab_scheduled_for timestamp,
        requested_by_id varchar, assigned_to_id varchar, department_id varchar,
        created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
      );
      CREATE TABLE "${schema}".change_approvals (
        id varchar PRIMARY KEY, change_id varchar NOT NULL REFERENCES "${schema}".changes(id),
        approver_id varchar REFERENCES "${schema}".users(id),
        original_approver_id varchar NOT NULL, approver_label text NOT NULL,
        decision text, comments text, decided_at timestamp, removed_at timestamp,
        removed_by_id varchar, removed_by_label text, created_at timestamp DEFAULT now()
      )
    `);

    const url = new URL(originalUrl);
    url.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    ({ db, pool: appPool } = await import("./db"));
    ({ storage } = await import("./storage"));
    vi.spyOn(storage, "getPermissions").mockResolvedValue([
      { id: "ticket-view", name: "ticket_view_all" },
      { id: "ticket-manage", name: "ticket_manage" },
    ] as Awaited<ReturnType<typeof storage.getPermissions>>);
    vi.spyOn(storage, "getRolesWithDetails").mockResolvedValue([]);
    vi.spyOn(storage, "getModuleSetting").mockResolvedValue(undefined);

    const app = express();
    app.use(express.json());
    server = await (await import("./routes")).registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (appPool) await appPool.end();
    process.env.DATABASE_URL = originalUrl;
    if (setupPool) {
      try {
        await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await setupPool.end();
      }
    }
  });

  beforeEach(() => {
    // Vitest restores spies between tests; the route's module gate must not
    // consult the application's system_settings table in this tiny schema.
    vi.spyOn(storage, "getModuleSetting").mockResolvedValue(undefined);
  });

  it.each(["pending", null] as const)(
    "accepts exactly one of two competing votes when the original decision is %s",
    async initial => {
      const userId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values({
        id: userId, username: `voter-${userId}`, email: `${userId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter",
      });
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Concurrent CAB vote",
        status: "submitted",
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId: userId, originalApproverId: userId,
        approverLabel: "CAB Voter", decision: initial,
      });

      // Hold each request after its initial read, so both see the same uncast
      // approval before either reaches the real conditional UPDATE.
      const originalRead = storage.getChangeApprovals.bind(storage);
      let arrived = 0;
      let release!: () => void;
      const bothRead = new Promise<void>(resolve => { release = resolve; });
      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => {
        const rows = await originalRead(id);
        if (id === changeId && arrived < 2) {
          arrived++;
          if (arrived === 2) release();
          await bothRead;
        }
        return rows;
      });

      try {
        const path = `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`;
        const cast = (decision: string) => fetch(path, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": userId },
          body: JSON.stringify({ decision, comments: `Vote: ${decision}` }),
        });
        const responses = await Promise.all([cast("approved"), cast("rejected")]);
        if (arrived !== 2) {
          throw new Error(`Both requests did not reach the approval read: ${JSON.stringify(await Promise.all(responses.map(async response => ({ status: response.status, body: await response.text() }))))}`);
        }
        expect(arrived).toBe(2);
        expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
        const winner = responses.find(response => response.status === 200)!;
        const loser = responses.find(response => response.status === 409)!;
        const recorded = await winner.json() as { id: string; decision: string; comments: string };
        expect(recorded.id).toBe(approvalId);
        expect(recorded.decision).toMatch(/^(approved|rejected)$/);
        expect(recorded.comments).toBe(`Vote: ${recorded.decision}`);
        expect((await loser.json()).message).toMatch(/already voted on|already been recorded/);

        const [saved] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
        expect(saved).toMatchObject({
          decision: recorded.decision, comments: recorded.comments, approverId: userId,
        });
        expect(saved.decidedAt).toBeInstanceOf(Date);
      } finally {
        readSpy.mockRestore();
      }
    },
    15_000,
  );
});