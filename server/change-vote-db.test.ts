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

  it.each(["vote", "removal"] as const)(
    "keeps only the %s when a vote races an assignment removal",
    async first => {
      const voterId = randomUUID();
      const managerId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values([
        { id: voterId, username: `voter-${voterId}`, email: `${voterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" },
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Vote versus removal",
        status: "submitted",
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId: voterId, originalApproverId: voterId,
        approverLabel: "CAB Voter", decision: "pending",
      });

      // Both HTTP handlers must read the same pending row before either writes.
      const originalRead = storage.getChangeApprovals.bind(storage);
      let arrived = 0;
      let releaseReads!: () => void;
      const bothRead = new Promise<void>(resolve => { releaseReads = resolve; });
      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => {
        const rows = await originalRead(id);
        if (id === changeId && arrived < 2) {
          expect(rows.find(row => row.id === approvalId)).toMatchObject({
            decision: "pending", removedAt: null,
          });
          if (++arrived === 2) releaseReads();
          await bothRead;
        }
        return rows;
      });
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      // Release the second storage call only after the first real DB update
      // commits. This covers both possible outcomes without replacing either UPDATE.
      let releaseSecond!: () => void;
      const firstFinished = new Promise<void>(resolve => { releaseSecond = resolve; });
      const originalVote = storage.updateChangeApproval.bind(storage);
      const originalRemove = storage.removeChangeApproval.bind(storage);
      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (...args) => {
        if (first === "removal") await firstFinished;
        try {
          return await originalVote(...args);
        } finally {
          if (first === "vote") releaseSecond();
        }
      });
      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => {
        if (first === "vote") await firstFinished;
        try {
          return await originalRemove(...args);
        } finally {
          if (first === "removal") releaseSecond();
        }
      });

      try {
        const path = `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`;
        const [vote, removal] = await Promise.all([
          fetch(path, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-test-user": voterId },
            body: JSON.stringify({ decision: "approved", comments: "Approved in race" }),
          }),
          fetch(path, { method: "DELETE", headers: { "x-test-user": managerId } }),
        ]);
        expect(arrived).toBe(2);
        expect([vote.status, removal.status].sort()).toEqual([200, 409]);
        expect([vote.status, removal.status]).toEqual(first === "vote" ? [200, 409] : [409, 200]);
        const loser = first === "vote" ? removal : vote;
        expect((await loser.json()).message).toBe("This CAB approval was already voted on or removed");
        if (first === "vote") {
          expect(await vote.json()).toMatchObject({ id: approvalId, decision: "approved" });
        } else {
          expect(await removal.json()).toEqual({ success: true });
        }

        const [saved] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
        expect(saved).toMatchObject({
          decision: first === "vote" ? "approved" : "pending",
          comments: first === "vote" ? "Approved in race" : null,
          removedById: first === "removal" ? managerId : null,
          removedByLabel: first === "removal" ? "CAB Manager" : null,
        });
        expect(saved.decidedAt instanceof Date).toBe(first === "vote");
        expect(saved.removedAt instanceof Date).toBe(first === "removal");
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe(first === "vote" ? "approved" : "submitted");
        const history = await storage.getAllChangeApprovalRecords(changeId);
        expect(history).toHaveLength(1);
        expect(history[0].id).toBe(approvalId);
        expect((await storage.getChangeApprovals(changeId)).map(row => row.id))
          .toEqual(first === "vote" ? [approvalId] : []);
      } finally {
        readSpy.mockRestore();
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
        voteSpy.mockRestore();
        removeSpy.mockRestore();
      }
    },
    15_000,
  );

  it.each(["approved", "rejected"] as const)(
    "keeps the change rejected when the %s vote commits first on a separate approval",
    async firstDecision => {
      const changeId = randomUUID();
      const voters = [
        { id: randomUUID(), decision: "approved" },
        { id: randomUUID(), decision: "rejected" },
      ] as const;
      const approvalIds = [randomUUID(), randomUUID()];
      for (const voter of voters) {
        await db.insert(users).values({
          id: voter.id, username: `voter-${voter.id}`, email: `${voter.id}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter",
        });
      }
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Competing CAB decisions",
        status: "submitted",
      });
      for (const [index, voter] of voters.entries()) {
        await db.insert(changeApprovals).values({
          id: approvalIds[index], changeId, approverId: voter.id,
          originalApproverId: voter.id, approverLabel: "CAB Voter", decision: "pending",
        });
      }

      // Both requests pass the route's initial approval read before either vote
      // starts. Control the commit order while still using real database writes.
      const originalRead = storage.getChangeApprovals.bind(storage);
      let arrived = 0;
      let releaseReads!: () => void;
      const bothRead = new Promise<void>(resolve => { releaseReads = resolve; });
      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => {
        const rows = await originalRead(id);
        if (id === changeId && arrived < 2) {
          if (++arrived === 2) releaseReads();
          await bothRead;
        }
        return rows;
      });
      const originalVote = storage.updateChangeApproval.bind(storage);
      let releaseSecond!: () => void;
      const firstSaved = new Promise<void>(resolve => { releaseSecond = resolve; });
      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (id, approvalId, decision, comments) => {
        if (decision !== firstDecision) await firstSaved;
        const result = await originalVote(id, approvalId, decision, comments);
        if (decision === firstDecision) releaseSecond();
        return result;
      });

      try {
        const responses = await Promise.all(voters.map((voter, index) =>
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalIds[index]}`, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-test-user": voter.id },
            body: JSON.stringify({ decision: voter.decision }),
          })));
        expect(arrived).toBe(2);
        expect(responses.map(response => response.status)).toEqual([200, 200]);
        const savedApprovals = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
        expect(savedApprovals.map(a => a.decision).sort()).toEqual(["approved", "rejected"]);
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe("rejected");
        expect(savedChange.approvedAt).toBeNull();
      } finally {
        readSpy.mockRestore();
        voteSpy.mockRestore();
      }
    },
    15_000,
  );
});