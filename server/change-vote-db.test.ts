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
      CREATE TABLE "${schema}".change_environment_stages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), change_id varchar NOT NULL REFERENCES "${schema}".changes(id),
        environment text NOT NULL, "order" integer NOT NULL, status text NOT NULL DEFAULT 'pending',
        assigned_to_id varchar, due_date timestamp, started_at timestamp, completed_at timestamp,
        attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
        notes text, evidence text, deployed_by_id varchar, created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
      CREATE TABLE "${schema}".change_approvals (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(), change_id varchar NOT NULL REFERENCES "${schema}".changes(id),
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

  it("approves a change when removing the last pending member leaves only approved votes", async () => {
    const managerId = randomUUID();
    const approvedVoterId = randomUUID();
    const pendingVoterId = randomUUID();
    const changeId = randomUUID();
    const approvedId = randomUUID();
    const pendingId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approvedVoterId, username: `voter-${approvedVoterId}`, email: `${approvedVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter" },
      { id: pendingVoterId, username: `voter-${pendingVoterId}`, email: `${pendingVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Remove final pending CAB member",
      status: "submitted",
    });
    await db.insert(changeApprovals).values([
      { id: approvedId, changeId, approverId: approvedVoterId, originalApproverId: approvedVoterId,
        approverLabel: "CAB Voter", decision: "approved", decidedAt: new Date() },
      { id: pendingId, changeId, approverId: pendingVoterId, originalApproverId: pendingVoterId,
        approverLabel: "CAB Voter", decision: "pending" },
    ]);
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${pendingId}`, {
        method: "DELETE",
        headers: { "x-test-user": managerId },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });

      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange.status).toBe("approved");
      expect(savedChange.approvedAt).toBeInstanceOf(Date);
      const active = await storage.getChangeApprovals(changeId);
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({ id: approvedId, decision: "approved" });
      const [removed] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, pendingId));
      expect(removed.removedAt).toBeInstanceOf(Date);
      expect(removed.removedById).toBe(managerId);
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it.each([
    { first: "vote", decision: "approved" },
    { first: "removal", decision: "approved" },
    { first: "vote", decision: "rejected" },
    { first: "removal", decision: "rejected" },
  ] as const)(
    "serializes a $decision vote on another assignment against removal when the $first commits first",
    async ({ first, decision }) => {
      const managerId = randomUUID();
      const alreadyApprovedId = randomUUID();
      const removedVoterId = randomUUID();
      const votingVoterId = randomUUID();
      const changeId = randomUUID();
      const alreadyApprovedApprovalId = randomUUID();
      const removedApprovalId = randomUUID();
      const votingApprovalId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: alreadyApprovedId, username: `voter-${alreadyApprovedId}`, email: `${alreadyApprovedId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" },
        { id: removedVoterId, username: `voter-${removedVoterId}`, email: `${removedVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" },
        { id: votingVoterId, username: `voter-${votingVoterId}`, email: `${votingVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Vote and removal on separate CAB assignments",
        status: "submitted",
      });
      await db.insert(changeApprovals).values([
        { id: alreadyApprovedApprovalId, changeId, approverId: alreadyApprovedId,
          originalApproverId: alreadyApprovedId, approverLabel: "CAB Voter",
          decision: "approved", decidedAt: new Date() },
        { id: removedApprovalId, changeId, approverId: removedVoterId,
          originalApproverId: removedVoterId, approverLabel: "CAB Voter", decision: "pending" },
        { id: votingApprovalId, changeId, approverId: votingVoterId,
          originalApproverId: votingVoterId, approverLabel: "CAB Voter", decision: "pending" },
      ]);

      // Both routes inspect the initial membership before either storage write.
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
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      let releaseSecond!: () => void;
      const firstCommitted = new Promise<void>(resolve => { releaseSecond = resolve; });
      const originalVote = storage.updateChangeApproval.bind(storage);
      const originalRemove = storage.removeChangeApproval.bind(storage);
      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (...args) => {
        if (first === "removal") await firstCommitted;
        try {
          return await originalVote(...args);
        } finally {
          if (first === "vote") releaseSecond();
        }
      });
      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => {
        if (first === "vote") await firstCommitted;
        try {
          return await originalRemove(...args);
        } finally {
          if (first === "removal") releaseSecond();
        }
      });

      try {
        const [vote, removal] = await Promise.all([
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${votingApprovalId}`, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-test-user": votingVoterId },
            body: JSON.stringify({ decision, comments: "Voted during removal" }),
          }),
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${removedApprovalId}`, {
            method: "DELETE",
            headers: { "x-test-user": managerId },
          }),
        ]);
        expect(arrived).toBe(2);
        expect(vote.status).toBe(200);
        expect(removal.status).toBe(200);

        const savedApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(savedApprovals.find(row => row.id === alreadyApprovedApprovalId)?.decision).toBe("approved");
        expect(savedApprovals.find(row => row.id === votingApprovalId))
          .toMatchObject({ decision, comments: "Voted during removal" });
        expect(savedApprovals.find(row => row.id === removedApprovalId)?.removedAt).toBeInstanceOf(Date);
        const active = await storage.getChangeApprovals(changeId);
        expect(active.map(row => row.id).sort()).toEqual([alreadyApprovedApprovalId, votingApprovalId].sort());
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe(decision);
        expect(savedChange.approvedAt instanceof Date).toBe(decision === "approved");
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

  it("rejects a new CAB assignment when the change is already approved", async () => {
    const managerId = randomUUID();
    const existingApproverId = randomUUID();
    const newApproverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    const approvedAt = new Date("2026-01-02T03:04:05.000Z");
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: existingApproverId, username: `approver-${existingApproverId}`, email: `${existingApproverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
      { id: newApproverId, username: `approver-${newApproverId}`, email: `${newApproverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Approved change",
      status: "approved", approvedAt,
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId: existingApproverId, originalApproverId: existingApproverId,
      approverLabel: "CAB Approver", decision: "approved",
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ approverId: newApproverId }),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "CAB_CHANGE_ALREADY_APPROVED",
        message: expect.stringMatching(/cannot be added after a change is approved/i),
      });
      const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
      expect(history).toHaveLength(1);
      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange.status).toBe("approved");
      expect(savedChange.approvedAt?.getTime()).toBe(approvedAt.getTime());
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it("allows only one of two concurrent requests to assign the same CAB member", async () => {
    const managerIds = [randomUUID(), randomUUID()];
    const approverId = randomUUID();
    const changeId = randomUUID();
    await db.insert(users).values([
      ...managerIds.map(id => ({
        id, username: `manager-${id}`, email: `${id}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager",
      })),
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Concurrent CAB assignment",
      status: "submitted",
    });

    let arrivals = 0;
    let releaseAssignments!: () => void;
    const bothArrived = new Promise<void>(resolve => { releaseAssignments = resolve; });
    const originalCreate = storage.createChangeApproval.bind(storage);
    const assignmentSpy = vi.spyOn(storage, "createChangeApproval").mockImplementation(async approval => {
      if (++arrivals === 2) releaseAssignments();
      await bothArrived;
      return originalCreate(approval);
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const responses = await Promise.all(managerIds.map(managerId =>
        fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ approverId }),
        }),
      ));
      expect(arrivals).toBe(2);
      expect(responses.map(response => response.status).sort()).toEqual([201, 409]);

      const outcomes = await Promise.all(responses.map(response => response.json()));
      expect(outcomes.find(body => body.code === "CAB_APPROVER_DUPLICATE")).toMatchObject({
        message: "This CAB member is already assigned to the change.",
      });
      const saved = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
      expect(saved).toHaveLength(1);
      expect(saved[0].originalApproverId).toBe(approverId);
    } finally {
      assignmentSpy.mockRestore();
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  }, 15_000);

  it("does not allow a removed CAB member to be assigned again", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Removed CAB assignment",
      status: "submitted",
    });
    await db.insert(changeApprovals).values({
      changeId, approverId, originalApproverId: approverId, approverLabel: "CAB Approver",
      decision: "pending", removedAt: new Date(), removedByLabel: "CAB Manager",
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ approverId }),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "CAB_APPROVER_REMOVED",
        message: "This CAB member was removed from the change and cannot be re-added.",
      });
      const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
      expect(history).toHaveLength(1);
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it.each(["vote", "assignment"] as const)(
    "serializes a new CAB assignment against a vote when the %s commits first",
    async first => {
      const voterId = randomUUID();
      const managerId = randomUUID();
      const newApproverId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values([
        { id: voterId, username: `voter-${voterId}`, email: `${voterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" },
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: newApproverId, username: `approver-${newApproverId}`, email: `${newApproverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Assignment and vote race",
        status: "submitted",
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId: voterId, originalApproverId: voterId,
        approverLabel: "CAB Voter", decision: "pending",
      });

      // Make both requests reach storage before controlling which transaction
      // reaches the shared parent-row lock first.
      let operationCount = 0;
      let releaseOperations!: () => void;
      const bothOperationsStarted = new Promise<void>(resolve => { releaseOperations = resolve; });
      const waitForBothOperations = async () => {
        if (++operationCount === 2) releaseOperations();
        await bothOperationsStarted;
      };
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      let releaseFirst!: () => void;
      const firstCommitted = new Promise<void>(resolve => { releaseFirst = resolve; });
      const originalAssignment = storage.createChangeApproval.bind(storage);
      const originalVote = storage.updateChangeApproval.bind(storage);
      const assignmentSpy = vi.spyOn(storage, "createChangeApproval").mockImplementation(async (...args) => {
        await waitForBothOperations();
        if (first === "vote") await firstCommitted;
        try {
          return await originalAssignment(...args);
        } finally {
          if (first === "assignment") releaseFirst();
        }
      });
      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (...args) => {
        await waitForBothOperations();
        if (first === "assignment") await firstCommitted;
        try {
          return await originalVote(...args);
        } finally {
          if (first === "vote") releaseFirst();
        }
      });

      try {
        const [vote, assignment] = await Promise.all([
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-test-user": voterId },
            body: JSON.stringify({ decision: "approved" }),
          }),
          fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-test-user": managerId },
            body: JSON.stringify({ approverId: newApproverId }),
          }),
        ]);

        expect(operationCount).toBe(2);
        expect(vote.status).toBe(200);
        if (first === "vote") {
          expect(assignment.status).toBe(409);
          expect(await assignment.json()).toMatchObject({ code: "CAB_CHANGE_ALREADY_APPROVED" });
        } else {
          expect(assignment.status).toBe(201);
          expect((await assignment.json()).decision).toBe("pending");
        }

        const savedApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(savedApprovals).toHaveLength(first === "vote" ? 1 : 2);
        expect(savedApprovals.find(row => row.id === approvalId)?.decision).toBe("approved");
        if (first === "assignment") {
          expect(savedApprovals.find(row => row.approverId === newApproverId)?.decision).toBe("pending");
        }
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe(first === "vote" ? "approved" : "submitted");
        expect(savedChange.approvedAt instanceof Date).toBe(first === "vote");
      } finally {
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
        assignmentSpy.mockRestore();
        voteSpy.mockRestore();
      }
    },
    15_000,
  );

  it.each([
    { targetStatus: "approved", clearCabOptIn: false },
    { targetStatus: "in_progress", clearCabOptIn: false },
    { targetStatus: "approved", clearCabOptIn: true },
    { targetStatus: "in_progress", clearCabOptIn: true },
  ] as const)(
    "does not allow a manual $targetStatus transition to overwrite a concurrent CAB rejection (opt-out: $clearCabOptIn)",
    async ({ targetStatus, clearCabOptIn }) => {
      const managerId = randomUUID();
      const originalApproverId = randomUUID();
      const concurrentApproverId = randomUUID();
      const changeId = randomUUID();
      const originalApprovalId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: originalApproverId, username: `approver-${originalApproverId}`, email: `${originalApproverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
        { id: concurrentApproverId, username: `approver-${concurrentApproverId}`, email: `${concurrentApproverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Manual status versus CAB rejection",
        status: "submitted", type: clearCabOptIn ? "standard" : "normal", cabRequired: true,
      });
      if (!clearCabOptIn) {
        await db.insert(changeApprovals).values({
          id: originalApprovalId, changeId, approverId: originalApproverId,
          originalApproverId, approverLabel: "CAB Approver", decision: "approved",
        });
      }

      // Hold the manual endpoint immediately before its guarded transaction.
      // While held, add and reject a new active approver over HTTP/database.
      const originalGuard = storage.updateChangeWithCabStatusGuard.bind(storage);
      let releaseManualGuard!: () => void;
      let reportManualGuard!: () => void;
      const manualGuardReached = new Promise<void>(resolve => { reportManualGuard = resolve; });
      const continueManual = new Promise<void>(resolve => { releaseManualGuard = resolve; });
      let heldManualGuard = false;
      const guardSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (id, update) => {
        if (id === changeId && !heldManualGuard) {
          heldManualGuard = true;
          reportManualGuard();
          await continueManual;
        }
        return originalGuard(id, update);
      });
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      try {
        const manualUpdate = fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ status: targetStatus, ...(clearCabOptIn ? { cabRequired: false } : {}) }),
        });
        await manualGuardReached;

        const assignmentResponse = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ approverId: concurrentApproverId }),
        });
        expect(assignmentResponse.status).toBe(201);
        const assignment = await assignmentResponse.json() as { id: string };

        const rejectionResponse = await fetch(
          `${baseUrl}/api/changes/${changeId}/approvals/${assignment.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json", "x-test-user": concurrentApproverId },
            body: JSON.stringify({ decision: "rejected" }),
          },
        );
        expect(rejectionResponse.status).toBe(200);

        releaseManualGuard();
        const manualResponse = await manualUpdate;
        expect(manualResponse.status).toBe(403);
        expect(await manualResponse.json()).toMatchObject({ code: "CAB_PENDING" });

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe("rejected");
        expect(savedChange.approvedAt).toBeNull();
        expect(savedChange.cabRequired).toBe(true);
        const savedApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(savedApprovals.map(approval => approval.decision).sort())
          .toEqual(clearCabOptIn ? ["rejected"] : ["approved", "rejected"]);
      } finally {
        releaseManualGuard();
        guardSpy.mockRestore();
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
    15_000,
  );
});