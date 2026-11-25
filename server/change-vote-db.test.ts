// @vitest-environment node
import 
{
 randomUUID 
}
 from "node:crypto"
;

import type 
{
 Server 
}
 from "node:http"
;

import express from "express"
;

import 
{
 Pool 
}
 from "pg"
;

import 
{
 afterAll, beforeAll, beforeEach, describe, expect, it, vi 
}
 from "vitest"
;

import 
{
 eq 
}
 from "drizzle-orm"
;

import 
{
 auditLogs, changeApprovals, changeEnvironmentStages, changes, users
}
 from "@shared/schema"
;

import 
{
 initializeTestSchema 
}
 from "./test-database"
;


const testDatabaseUrl = process.env.VITEST_TEST_DATABASE_URL
;

const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  Boolean(testDatabaseUrl)
;


vi.mock("./auth", () => (
{

  setupAuth: (app: express.Express) => 
{

    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => 
{

      const userId = req.header("x-test-user")
;

      req.isAuthenticated = () => !!userId
;

      if (userId) req.user = { id: userId } as express.Request["user"];

      next()
;

    
}
)
;

  
}
,
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.isAuthenticated() ? next() : res.sendStatus(401),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireAnyPermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}
))
;


describe.skipIf(!databaseIntegrationEnabled)("concurrent CAB votes (PostgreSQL and HTTP)", () => 
{

  const schema = `test_cab_vote_${randomUUID().replace(/-/g, "")}`
;

  const originalUrl = testDatabaseUrl
;

  let setupPool: Pool
;

  let appPool: Pool
;

  let server: Server
;

  let baseUrl: string
;

  let storage: typeof import("./storage").storage
;

  let db: typeof import("./db").db
;


  beforeAll(async () => 
{

    if (!originalUrl) throw new Error("VITEST_TEST_DATABASE_URL is required for the CAB concurrency test")
;

    setupPool = new Pool(
{
 connectionString: originalUrl 
}
)
;

    const setupClient = await setupPool.connect()
;

    try 
{

      await initializeTestSchema(setupClient, schema)
;

    
}
 finally 
{

      setupClient.release()
;

    
}


    const url = new URL(originalUrl)
;

    url.searchParams.set("options", `-c search_path=${schema}`)
;

    process.env.DATABASE_URL = url.toString()
;

    (
{
 db, pool: appPool 
}
 = await import("./db"))
;

    (
{
 storage 
}
 = await import("./storage"))
;

    vi.spyOn(storage, "getModuleSetting").mockResolvedValue(undefined)
;


    const app = express()
;

    app.use(express.json())
;

    server = await (await import("./routes")).registerRoutes(app)
;

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
;

    const address = server.address()
;

    if (!address || typeof address === "string") throw new Error("Expected a TCP listener")
;

    baseUrl = `http://127.0.0.1:${address.port}`
;

  
}
, 60_000)
;


  it("rejects inactive and status-missing assignees for changes and environment stages", async () => {
    const managerId = randomUUID();
    const activeAssigneeId = randomUUID();
    const inactiveAssigneeId = randomUUID();
    const statusMissingAssigneeId = randomUUID();
    const changeId = randomUUID();
    const stageChangeId = randomUUID();
    const stageId = randomUUID();

    await db.insert(users).values([
      {
        id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "Change", lastName: "Manager",
      },
      {
        id: activeAssigneeId, username: `active-${activeAssigneeId}`, email: `${activeAssigneeId}@example.invalid`,
        password: "test-only", firstName: "Active", lastName: "Assignee", isActive: true,
      },
      {
        id: inactiveAssigneeId, username: `inactive-${inactiveAssigneeId}`, email: `${inactiveAssigneeId}@example.invalid`,
        password: "test-only", firstName: "Inactive", lastName: "Assignee", isActive: false,
      },
      {
        id: statusMissingAssigneeId, username: `status-missing-${statusMissingAssigneeId}`,
        email: `${statusMissingAssigneeId}@example.invalid`,
        password: "test-only", firstName: "Status Missing", lastName: "Assignee", isActive: null,
      },
    ]);
    await db.insert(changes).values([
      {
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Direct change assignment",
        status: "draft",
      },
      {
        id: stageChangeId, changeNumber: `TEST-${stageChangeId}`, title: "Direct stage assignment",
        status: "in_progress",
      },
    ]);
    await db.insert(changeEnvironmentStages).values({
      id: stageId, changeId: stageChangeId, environment: "development", order: 1,
    });

    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const headers = { "content-type": "application/json", "x-test-user": managerId };
    const assignChange = (assignedToId: string) => fetch(`${baseUrl}/api/changes/${changeId}/assign`, {
      method: "POST", headers, body: JSON.stringify({ assignedToId }),
    });
    const updateChangeAssignment = (assignedToId: string) => fetch(`${baseUrl}/api/changes/${changeId}`, {
      method: "PUT", headers, body: JSON.stringify({ assignedToId }),
    });
    const assignStage = (assignedToId: string) => fetch(`${baseUrl}/api/changes/${stageChangeId}/stages/${stageId}`, {
      method: "PUT", headers, body: JSON.stringify({ assignedToId }),
    });

    try {
      for (const assigneeId of [inactiveAssigneeId, statusMissingAssigneeId]) {
        const changeResponse = await assignChange(assigneeId);
        expect(changeResponse.status).toBe(400);
        const changeUpdateResponse = await updateChangeAssignment(assigneeId);
        expect(changeUpdateResponse.status).toBe(400);
        const stageResponse = await assignStage(assigneeId);
        expect(stageResponse.status).toBe(400);
      }

      const [unchangedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      const [unchangedStage] = await db.select().from(changeEnvironmentStages)
        .where(eq(changeEnvironmentStages.id, stageId));
      expect(unchangedChange.assignedToId).toBeNull();
      expect(unchangedStage.assignedToId).toBeNull();

      expect((await assignChange(activeAssigneeId)).status).toBe(200);
      expect((await updateChangeAssignment(activeAssigneeId)).status).toBe(200);
      expect((await assignStage(activeAssigneeId)).status).toBe(200);
      const [assignedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      const [assignedStage] = await db.select().from(changeEnvironmentStages)
        .where(eq(changeEnvironmentStages.id, stageId));
      expect(assignedChange.assignedToId).toBe(activeAssigneeId);
      expect(assignedStage.assignedToId).toBe(activeAssigneeId);
    } finally {
      permissionSpy.mockRestore();
    }
  }, 15_000);

  it("preserves captured CAB labels after approver and remover profile changes", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const activeApproverId = randomUUID();
    const changeId = randomUUID();

    await db.insert(users).values([
      {
        id: managerId,
        username: `manager-${managerId}`,
        email: `${managerId}@example.invalid`,
        password: "test-only",
        firstName: "Original",
        lastName: "Manager",
      },
      {
        id: approverId,
        username: `approver-${approverId}`,
        email: `${approverId}@example.invalid`,
        password: "test-only",
        firstName: "Original",
        lastName: "Approver",
      },
      {
        id: activeApproverId,
        username: `approver-${activeApproverId}`,
        email: `${activeApproverId}@example.invalid`,
        password: "test-only",
        firstName: "Active",
        lastName: "Approver",
      },
    ]);
    await db.insert(changes).values({
      id: changeId,
      changeNumber: `TEST-${changeId}`,
      title: "CAB labels survive profile changes",
      status: "submitted",
    });

    const removedApproval = await storage.createChangeApproval({
      changeId,
      approverId,
      decision: "pending",
    });
    const activeApproval = await storage.createChangeApproval({
      changeId,
      approverId: activeApproverId,
      decision: "pending",
    });
    expect(removedApproval.approverLabel).toBe("Original Approver");

    const removed = await storage.removeChangeApproval(removedApproval.id, managerId);
    expect(removed).toMatchObject({
      id: removedApproval.id,
      approverLabel: "Original Approver",
      removedById: managerId,
      removedByLabel: "Original Manager",
    });

    await storage.updateUser(approverId, { firstName: "Updated", lastName: "Approver" });
    await storage.updateUser(managerId, { firstName: "Updated", lastName: "Manager" });

    expect(await storage.getUser(approverId)).toMatchObject({
      firstName: "Updated",
      lastName: "Approver",
    });
    expect(await storage.getUser(managerId)).toMatchObject({
      firstName: "Updated",
      lastName: "Manager",
    });

    const history = await storage.getAllChangeApprovalRecords(changeId);
    expect(history).toHaveLength(2);
    expect(history.find(record => record.id === removedApproval.id)).toMatchObject({
      approverId,
      originalApproverId: approverId,
      approverLabel: "Original Approver",
      removedById: managerId,
      removedByLabel: "Original Manager",
    });
    expect(history.find(record => record.id === activeApproval.id)).toMatchObject({
      approverId: activeApproverId,
      approverLabel: "Active Approver",
      removedAt: null,
    });
    expect(await storage.getChangeApprovals(changeId)).toEqual([expect.objectContaining({
      id: activeApproval.id,
      approverId: activeApproverId,
      approverLabel: "Active Approver",
      removedAt: null,
    })]);
  });

  afterAll(async () => 
{

    vi.restoreAllMocks()
;

    if (server?.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
;

    if (appPool) await appPool.end()
;

    process.env.DATABASE_URL = originalUrl
;

    if (setupPool) 
{

      try 
{

        await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
;

      
}
 finally 
{

        await setupPool.end()
;

      
}

    
}

  
}
)
;


  beforeEach(() => 
{

    // Vitest restores spies between tests; keep the route's module gate enabled
    // independently of system_settings values in the isolated test schema.
    vi.spyOn(storage, "getModuleSetting").mockResolvedValue(undefined)
;

  
}
)
;


  it("records a new manual submission time and preserves it on later edits", async () =>
{
    const userId = randomUUID();
    const changeId = randomUUID();
    const previousSubmission = new Date("2025-01-01T00:00:00.000Z");

    await db.insert(users).values({
      id: userId, username: `manager-${userId}`, email: `${userId}@example.invalid`,
      password: "test-only", firstName: "Change", lastName: "Manager",
    });
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Manual resubmission",
      type: "standard", status: "rejected", risk: "low", submittedAt: previousSubmission,
    });

    const update = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/changes/${changeId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": userId },
      body: JSON.stringify(body),
    });

    const submitResponse = await update({ status: "submitted" });
    expect(submitResponse.status).toBe(200);
    const submittedResponse = await submitResponse.json() as { submittedAt: string };
    const [submitted] = await db.select().from(changes).where(eq(changes.id, changeId));
    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedAt).toBeInstanceOf(Date);
    expect(submitted.submittedAt!.getTime()).toBeGreaterThan(previousSubmission.getTime());
    expect(new Date(submittedResponse.submittedAt).getTime()).toBe(submitted.submittedAt!.getTime());

    const editResponse = await update({ title: "Manual resubmission edited" });
    expect(editResponse.status).toBe(200);
    const [edited] = await db.select().from(changes).where(eq(changes.id, changeId));
    expect(edited.submittedAt?.getTime()).toBe(submitted.submittedAt!.getTime());
  });

  it.each([
    { status: "approved", timestamp: "approvedAt" },
    { status: "in_progress", timestamp: "actualStart" },
    { status: "completed", timestamp: "actualEnd" },
  ] as const)("records and preserves the $timestamp lifecycle timestamp for a manual $status transition", async (
{
 status, timestamp 
}
) => 
{

    const userId = randomUUID()
;

    const changeId = randomUUID()
;

    await db.insert(users).values(
{

      id: userId, username: `manager-${userId}`, email: `${userId}@example.invalid`,
      password: "test-only", firstName: "Change", lastName: "Manager",
    
}
)
;

    await db.insert(changes).values(
{

      id: changeId, changeNumber: `TEST-${changeId}`, title: "Manual lifecycle update",
      type: "standard", status: "submitted", risk: "low",
    
}
)
;


    const update = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/changes/${changeId}`, 
{

      method: "PUT",
      headers: 
{
 "content-type": "application/json", "x-test-user": userId 
}
,
      body: JSON.stringify(body),
    
}
)
;


    const transitionResponse = await update(
{
 status 
}
)
;

    expect(transitionResponse.status).toBe(200)
;

    const [transitioned] = await db.select().from(changes).where(eq(changes.id, changeId))
;

    const firstTimestamp = transitioned[timestamp]
;

    expect(firstTimestamp).toBeInstanceOf(Date)
;


    const editResponse = await update(
{
 status, title: "Manual lifecycle update edited" 
}
)
;

    expect(editResponse.status).toBe(200)
;

    const [edited] = await db.select().from(changes).where(eq(changes.id, changeId))
;

    expect(edited[timestamp]?.getTime()).toBe(firstTimestamp?.getTime())
;

  
}
)
;


  it.each(["pending", null] as const)(
    "accepts exactly one of two competing votes when the original decision is %s",
    async initial => 
{

      const userId = randomUUID()
;

      const changeId = randomUUID()
;

      const approvalId = randomUUID()
;

      await db.insert(users).values(
{

        id: userId, username: `voter-${userId}`, email: `${userId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter",
      
}
)
;

      await db.insert(changes).values(
{

        id: changeId, changeNumber: `TEST-${changeId}`, title: "Concurrent CAB vote",
        status: "submitted",
      
}
)
;

      await db.insert(changeApprovals).values(
{

        id: approvalId, changeId, approverId: userId, originalApproverId: userId,
        approverLabel: "CAB Voter", decision: initial,
      
}
)
;


      // Hold each request after its initial read, so both see the same uncast
      // approval before either reaches the real conditional UPDATE.
      const originalRead = storage.getChangeApprovals.bind(storage)
;

      let arrived = 0
;

      let release!: () => void
;

      const bothRead = new Promise<void>(resolve => 
{
 release = resolve
;
 
}
)
;

      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => 
{

        const rows = await originalRead(id)
;

        if (id === changeId && arrived < 2) 
{

          arrived++
;

          if (arrived === 2) release()
;

          await bothRead
;

        
}

        return rows
;

      
}
)
;


      try 
{

        const path = `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`
;

        const cast = (decision: string) => fetch(path, 
{

          method: "PUT",
          headers: 
{
 "content-type": "application/json", "x-test-user": userId 
}
,
          body: JSON.stringify(
{
 decision, comments: `Vote: ${decision}` 
}
),
        
}
)
;

        const responses = await Promise.all([cast("approved"), cast("rejected")])
;

        if (arrived !== 2) 
{

          throw new Error(`Both requests did not reach the approval read: ${JSON.stringify(await Promise.all(responses.map(async response => ({ status: response.status, body: await response.text() }))))}`)
;

        
}

        expect(arrived).toBe(2)
;

        expect(responses.map(response => response.status).sort()).toEqual([200, 409])
;

        const winner = responses.find(response => response.status === 200)!
;

        const loser = responses.find(response => response.status === 409)!
;

        const recorded = await winner.json() as 
{
 id: string
;
 decision: string
;
 comments: string 
}
;

        expect(recorded.id).toBe(approvalId)
;

        expect(recorded.decision).toMatch(/^(approved|rejected)$/)
;

        expect(recorded.comments).toBe(`Vote: ${recorded.decision}`)
;

        expect((await loser.json()).message).toMatch(/already voted on|already been recorded/)
;


        const [saved] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId))
;

        expect(saved).toMatchObject(
{

          decision: recorded.decision, comments: recorded.comments, approverId: userId,
        
}
)
;

        expect(saved.decidedAt).toBeInstanceOf(Date)
;

      
}
 finally 
{

        readSpy.mockRestore()
;

      
}

    
}
,
    15_000,
  )
;


  it.each(["vote", "removal"] as const)(
    "keeps only the %s when a vote races an assignment removal",
    async first => 
{

      const voterId = randomUUID()
;

      const managerId = randomUUID()
;

      const changeId = randomUUID()
;

      const approvalId = randomUUID()
;

      await db.insert(users).values([
        
{
 id: voterId, username: `voter-${voterId}`, email: `${voterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
        
{
 id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" 
}
,
      ])
;

      await db.insert(changes).values(
{

        id: changeId, changeNumber: `TEST-${changeId}`, title: "Vote versus removal",
        status: "submitted",
      
}
)
;

      await db.insert(changeApprovals).values(
{

        id: approvalId, changeId, approverId: voterId, originalApproverId: voterId,
        approverLabel: "CAB Voter", decision: "pending",
      
}
)
;


      // Both HTTP handlers must read the same pending row before either writes.
      const originalRead = storage.getChangeApprovals.bind(storage)
;

      let arrived = 0
;

      let releaseReads!: () => void
;

      const bothRead = new Promise<void>(resolve => 
{
 releaseReads = resolve
;
 
}
)
;

      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => 
{

        const rows = await originalRead(id)
;

        if (id === changeId && arrived < 2) 
{

          expect(rows.find(row => row.id === approvalId)).toMatchObject(
{

            decision: "pending", removedAt: null,
          
}
)
;

          if (++arrived === 2) releaseReads()
;

          await bothRead
;

        
}

        return rows
;

      
}
)
;

      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;


      // Release the second storage call only after the first real DB update
      // commits. This covers both possible outcomes without replacing either UPDATE.
      let releaseSecond!: () => void
;

      const firstFinished = new Promise<void>(resolve => 
{
 releaseSecond = resolve
;
 
}
)
;

      const originalVote = storage.updateChangeApproval.bind(storage)
;

      const originalRemove = storage.removeChangeApproval.bind(storage)
;

      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (...args) => 
{

        if (first === "removal") await firstFinished
;

        try 
{

          return await originalVote(...args)
;

        
}
 finally 
{

          if (first === "vote") releaseSecond()
;

        
}

      
}
)
;

      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => 
{

        if (first === "vote") await firstFinished
;

        try 
{

          return await originalRemove(...args)
;

        
}
 finally 
{

          if (first === "removal") releaseSecond()
;

        
}

      
}
)
;


      try 
{

        const path = `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`
;

        const [vote, removal] = await Promise.all([
          fetch(path, 
{

            method: "PUT",
            headers: 
{
 "content-type": "application/json", "x-test-user": voterId 
}
,
            body: JSON.stringify(
{
 decision: "approved", comments: "Approved in race" 
}
),
          
}
),
          fetch(path, 
{
 method: "DELETE", headers: 
{
 "x-test-user": managerId 
}
 
}
),
        ])
;

        expect(arrived).toBe(2)
;

        expect([vote.status, removal.status].sort()).toEqual([200, 409])
;

        expect([vote.status, removal.status]).toEqual(first === "vote" ? [200, 409] : [409, 200])
;

        const loser = first === "vote" ? removal : vote
;

        expect((await loser.json()).message).toBe("This CAB approval was already voted on or removed")
;

        if (first === "vote") 
{

          expect(await vote.json()).toMatchObject(
{
 id: approvalId, decision: "approved" 
}
)
;

        
}
 else 
{

          expect(await removal.json()).toEqual(
{
 success: true 
}
)
;

        
}


        const [saved] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId))
;

        expect(saved).toMatchObject(
{

          decision: first === "vote" ? "approved" : "pending",
          comments: first === "vote" ? "Approved in race" : null,
          removedById: first === "removal" ? managerId : null,
          removedByLabel: first === "removal" ? "CAB Manager" : null,
        
}
)
;

        expect(saved.decidedAt instanceof Date).toBe(first === "vote")
;

        expect(saved.removedAt instanceof Date).toBe(first === "removal")
;

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

        expect(savedChange.status).toBe(first === "vote" ? "approved" : "submitted")
;

        const history = await storage.getAllChangeApprovalRecords(changeId)
;

        expect(history).toHaveLength(1)
;

        expect(history[0].id).toBe(approvalId)
;

        expect((await storage.getChangeApprovals(changeId)).map(row => row.id))
          .toEqual(first === "vote" ? [approvalId] : [])
;

      
}
 finally 
{

        readSpy.mockRestore()
;

        permissionSpy.mockRestore()
;

        auditSpy.mockRestore()
;

        voteSpy.mockRestore()
;

        removeSpy.mockRestore()
;

      
}

    
}
,
    15_000,
  )
;


  it("approves a change when removing the last pending member leaves only approved votes", async () => 
{

    const managerId = randomUUID()
;

    const approvedVoterId = randomUUID()
;

    const pendingVoterId = randomUUID()
;

    const changeId = randomUUID()
;

    const approvedId = randomUUID()
;

    const pendingId = randomUUID()
;

    await db.insert(users).values([
      
{
 id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" 
}
,
      
{
 id: approvedVoterId, username: `voter-${approvedVoterId}`, email: `${approvedVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
      
{
 id: pendingVoterId, username: `voter-${pendingVoterId}`, email: `${pendingVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
    ])
;

    await db.insert(changes).values(
{

      id: changeId, changeNumber: `TEST-${changeId}`, title: "Remove final pending CAB member",
      status: "submitted",
    
}
)
;

    await db.insert(changeApprovals).values([
      
{
 id: approvedId, changeId, approverId: approvedVoterId, originalApproverId: approvedVoterId,
        approverLabel: "CAB Voter", decision: "approved", decidedAt: new Date() 
}
,
      
{
 id: pendingId, changeId, approverId: pendingVoterId, originalApproverId: pendingVoterId,
        approverLabel: "CAB Voter", decision: "pending" 
}
,
    ])
;

    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;


    try 
{

      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${pendingId}`, 
{

        method: "DELETE",
        headers: 
{
 "x-test-user": managerId 
}
,
      
}
)
;

      expect(response.status).toBe(200)
;

      expect(await response.json()).toEqual(
{
 success: true 
}
)
;


      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

      expect(savedChange.status).toBe("approved")
;

      expect(savedChange.approvedAt).toBeInstanceOf(Date)
;

      const active = await storage.getChangeApprovals(changeId)
;

      expect(active).toHaveLength(1)
;

      expect(active[0]).toMatchObject(
{
 id: approvedId, decision: "approved" 
}
)
;

      const [removed] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, pendingId))
;

      expect(removed.removedAt).toBeInstanceOf(Date)
;

      expect(removed.removedById).toBe(managerId)
;

    
}
 finally 
{

      permissionSpy.mockRestore()
;

      auditSpy.mockRestore()
;

    
}

  
}
)
;


  it("keeps one accurate removal record when managers concurrently remove the same CAB assignment", async () => {
    const managerAId = randomUUID();
    const managerBId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();

    await db.insert(users).values([
      {
        id: managerAId,
        username: `manager-${managerAId}`,
        email: `${managerAId}@example.invalid`,
        password: "test-only",
        firstName: "CAB",
        lastName: "Manager A",
      },
      {
        id: managerBId,
        username: `manager-${managerBId}`,
        email: `${managerBId}@example.invalid`,
        password: "test-only",
        firstName: "CAB",
        lastName: "Manager B",
      },
      {
        id: approverId,
        username: `approver-${approverId}`,
        email: `${approverId}@example.invalid`,
        password: "test-only",
        firstName: "CAB",
        lastName: "Approver",
      },
    ]);

    await db.insert(changes).values({
      id: changeId,
      changeNumber: `TEST-${changeId}`,
      title: "Concurrent removal of one CAB assignment",
      status: "submitted",
    });

    await db.insert(changeApprovals).values({
      id: approvalId,
      changeId,
      approverId,
      originalApproverId: approverId,
      approverLabel: "CAB Approver",
      decision: "pending",
    });

    // Ensure both route-level reads see the active assignment before either
    // request reaches the real transactional removal.
    const originalRead = storage.getChangeApprovals.bind(storage);
    let readCount = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>(resolve => {
      releaseReads = resolve;
    });
    const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => {
      const rows = await originalRead(id);
      if (id === changeId && readCount < 2) {
        if (++readCount === 2) releaseReads();
        await bothRead;
      }
      return rows;
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);

    try {
      const remove = (managerId: string) => fetch(
        `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`,
        { method: "DELETE", headers: { "x-test-user": managerId } },
      );
      const responses = await Promise.all([remove(managerAId), remove(managerBId)]);

      expect(readCount).toBe(2);
      expect(responses.map(response => response.status).sort()).toEqual([200, 409]);

      const winnerIndex = responses.findIndex(response => response.status === 200);
      const loserIndex = 1 - winnerIndex;
      const winnerId = winnerIndex === 0 ? managerAId : managerBId;
      const winnerLabel = winnerIndex === 0 ? "CAB Manager A" : "CAB Manager B";

      expect(await responses[winnerIndex].json()).toEqual({ success: true });
      expect(await responses[loserIndex].json()).toMatchObject({
        message: "This CAB approval was already voted on or removed",
      });

      const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: approvalId,
        decision: "pending",
        removedById: winnerId,
        removedByLabel: winnerLabel,
      });
      expect(history[0].removedAt).toBeInstanceOf(Date);
      expect(await storage.getChangeApprovals(changeId)).toEqual([]);

      const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.recordId, approvalId));
      expect(audit).toMatchObject({
        userId: winnerId,
        action: "DELETE",
        tableName: "change_approvals",
        recordId: approvalId,
      });
      expect(JSON.parse(audit.newValues!)).toMatchObject({
        removedById: winnerId,
      });
    } finally {
      readSpy.mockRestore();
      permissionSpy.mockRestore();
    }
  }, 15_000);

  it("recalculates status after concurrent removals leave only approved CAB members", async () => 
{

    const managerAId = randomUUID()
;

    const managerBId = randomUUID()
;

    const approvedVoterId = randomUUID()
;

    const pendingVoterAId = randomUUID()
;

    const pendingVoterBId = randomUUID()
;

    const changeId = randomUUID()
;

    const approvedId = randomUUID()
;

    const pendingAId = randomUUID()
;

    const pendingBId = randomUUID()
;

    await db.insert(users).values([
      
{
 id: managerAId, username: `manager-${managerAId}`, email: `${managerAId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager A" 
}
,
      
{
 id: managerBId, username: `manager-${managerBId}`, email: `${managerBId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager B" 
}
,
      
{
 id: approvedVoterId, username: `voter-${approvedVoterId}`, email: `${approvedVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" 
}
,
      
{
 id: pendingVoterAId, username: `voter-${pendingVoterAId}`, email: `${pendingVoterAId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" 
}
,
      
{
 id: pendingVoterBId, username: `voter-${pendingVoterBId}`, email: `${pendingVoterBId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" 
}
,
    ])
;

    await db.insert(changes).values(
{

      id: changeId, changeNumber: `TEST-${changeId}`, title: "Concurrent CAB member removals",
      status: "submitted",
    
}
)
;

    await db.insert(changeApprovals).values([
      
{
 id: approvedId, changeId, approverId: approvedVoterId, originalApproverId: approvedVoterId,
        approverLabel: "CAB Approver", decision: "approved", decidedAt: new Date() 
}
,
      
{
 id: pendingAId, changeId, approverId: pendingVoterAId, originalApproverId: pendingVoterAId,
        approverLabel: "CAB Approver", decision: "pending" 
}
,
      
{
 id: pendingBId, changeId, approverId: pendingVoterBId, originalApproverId: pendingVoterBId,
        approverLabel: "CAB Approver", decision: "pending" 
}
,
    ])
;


    // Both requests must pass their route-level membership read before either
    // removal reaches storage, then enter the real database operation together.
    const originalRead = storage.getChangeApprovals.bind(storage)
;

    let readCount = 0
;

    let releaseReads!: () => void
;

    const bothRead = new Promise<void>(resolve => 
{
 releaseReads = resolve
;
 
}
)
;

    const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => 
{

      const rows = await originalRead(id)
;

      if (id === changeId && readCount < 2) 
{

        if (++readCount === 2) releaseReads()
;

        await bothRead
;

      
}

      return rows
;

    
}
)
;

    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;

    const originalRemove = storage.removeChangeApproval.bind(storage)
;

    let removalCount = 0
;

    let releaseRemovals!: () => void
;

    const bothRemovals = new Promise<void>(resolve => 
{
 releaseRemovals = resolve
;
 
}
)
;

    const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => 
{

      if (++removalCount === 2) releaseRemovals()
;

      await bothRemovals
;

      return originalRemove(...args)
;

    
}
)
;


    try 
{

      const remove = (approvalId: string, managerId: string) => fetch(
        `${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`,
        
{
 method: "DELETE", headers: 
{
 "x-test-user": managerId 
}
 
}
,
      )
;

      const responses = await Promise.all([
        remove(pendingAId, managerAId),
        remove(pendingBId, managerBId),
      ])
;

      expect(readCount).toBe(2)
;

      expect(removalCount).toBe(2)
;

      expect(responses.map(response => response.status)).toEqual([200, 200])
;

      expect(await Promise.all(responses.map(response => response.json())))
        .toEqual([
{
 success: true 
}
, 
{
 success: true 
}
])
;


      const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId))
;

      expect(history).toHaveLength(3)
;

      expect(history.find(row => row.id === pendingAId))
        .toMatchObject(
{
 decision: "pending", removedById: managerAId 
}
)
;

      expect(history.find(row => row.id === pendingBId))
        .toMatchObject(
{
 decision: "pending", removedById: managerBId 
}
)
;

      expect(history.find(row => row.id === pendingAId)?.removedAt).toBeInstanceOf(Date)
;

      expect(history.find(row => row.id === pendingBId)?.removedAt).toBeInstanceOf(Date)
;

      const active = await storage.getChangeApprovals(changeId)
;

      expect(active.map(row => row.id)).toEqual([approvedId])
;

      expect(active[0].decision).toBe("approved")
;


      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

      expect(savedChange.status).toBe("approved")
;

      expect(savedChange.approvedAt).toBeInstanceOf(Date)
;

    
}
 finally 
{

      readSpy.mockRestore()
;

      permissionSpy.mockRestore()
;

      auditSpy.mockRestore()
;

      removeSpy.mockRestore()
;

    
}

  
}
, 15_000)
;


  it("keeps an active rejection when multiple pending CAB assignments are removed concurrently", async () => {
    const managerAId = randomUUID();
    const managerBId = randomUUID();
    const rejectedVoterId = randomUUID();
    const pendingVoterAId = randomUUID();
    const pendingVoterBId = randomUUID();
    const changeId = randomUUID();
    const rejectedApprovalId = randomUUID();
    const pendingApprovalAId = randomUUID();
    const pendingApprovalBId = randomUUID();
    const rejectedAt = new Date();

    await db.insert(users).values([
      {
        id: managerAId, username: `manager-${managerAId}`, email: `${managerAId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager A",
      },
      {
        id: managerBId, username: `manager-${managerBId}`, email: `${managerBId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager B",
      },
      {
        id: rejectedVoterId, username: `voter-${rejectedVoterId}`, email: `${rejectedVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver",
      },
      {
        id: pendingVoterAId, username: `voter-${pendingVoterAId}`, email: `${pendingVoterAId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver",
      },
      {
        id: pendingVoterBId, username: `voter-${pendingVoterBId}`, email: `${pendingVoterBId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver",
      },
    ]);

    await db.insert(changes).values({
      id: changeId,
      changeNumber: `TEST-${changeId}`,
      title: "Concurrent removals preserve CAB rejection",
      status: "rejected",
      cabRequired: true,
    });

    await db.insert(changeApprovals).values([
      {
        id: rejectedApprovalId,
        changeId,
        approverId: rejectedVoterId,
        originalApproverId: rejectedVoterId,
        approverLabel: "CAB Approver",
        decision: "rejected",
        decidedAt: rejectedAt,
      },
      {
        id: pendingApprovalAId,
        changeId,
        approverId: pendingVoterAId,
        originalApproverId: pendingVoterAId,
        approverLabel: "CAB Approver",
        decision: "pending",
      },
      {
        id: pendingApprovalBId,
        changeId,
        approverId: pendingVoterBId,
        originalApproverId: pendingVoterBId,
        approverLabel: "CAB Approver",
        decision: "pending",
      },
    ]);

    const removals = await Promise.all([
      storage.removeChangeApproval(pendingApprovalAId, managerAId),
      storage.removeChangeApproval(pendingApprovalBId, managerBId),
    ]);

    expect(removals.map(row => row?.id).sort()).toEqual([pendingApprovalAId, pendingApprovalBId].sort());

    const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
    expect(history).toHaveLength(3);
    expect(history.find(row => row.id === rejectedApprovalId)).toMatchObject({
      decision: "rejected",
      approverId: rejectedVoterId,
      removedAt: null,
      decidedAt: rejectedAt,
    });
    expect(history.find(row => row.id === pendingApprovalAId)).toMatchObject({
      decision: "pending",
      removedById: managerAId,
      removedByLabel: "CAB Manager A",
    });
    expect(history.find(row => row.id === pendingApprovalBId)).toMatchObject({
      decision: "pending",
      removedById: managerBId,
      removedByLabel: "CAB Manager B",
    });
    expect(history.find(row => row.id === pendingApprovalAId)?.removedAt).toBeInstanceOf(Date);
    expect(history.find(row => row.id === pendingApprovalBId)?.removedAt).toBeInstanceOf(Date);

    const active = await storage.getChangeApprovals(changeId);
    expect(active.map(row => row.id)).toEqual([rejectedApprovalId]);
    expect(active[0]).toMatchObject({ decision: "rejected", approverId: rejectedVoterId });

    const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
    expect(savedChange.status).toBe("rejected");
    expect(savedChange.approvedAt).toBeNull();
  }, 15_000);

  it.each(["manual-update", "removal"] as const)(
    "keeps status and active CAB membership accurate when the %s commits first",
    async first => 
{

      const managerId = randomUUID()
;

      const approvedVoterId = randomUUID()
;

      const pendingVoterId = randomUUID()
;

      const changeId = randomUUID()
;

      const approvedId = randomUUID()
;

      const pendingId = randomUUID()
;

      await db.insert(users).values([
        
{
 id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" 
}
,
        
{
 id: approvedVoterId, username: `voter-${approvedVoterId}`, email: `${approvedVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" 
}
,
        
{
 id: pendingVoterId, username: `voter-${pendingVoterId}`, email: `${pendingVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" 
}
,
      ])
;

      await db.insert(changes).values(
{

        id: changeId, changeNumber: `TEST-${changeId}`, title: "Manual status versus CAB removal",
        status: "submitted", cabRequired: true,
      
}
)
;

      await db.insert(changeApprovals).values([
        
{
 id: approvedId, changeId, approverId: approvedVoterId, originalApproverId: approvedVoterId,
          approverLabel: "CAB Approver", decision: "approved", decidedAt: new Date() 
}
,
        
{
 id: pendingId, changeId, approverId: pendingVoterId, originalApproverId: pendingVoterId,
          approverLabel: "CAB Approver", decision: "pending" 
}
,
      ])
;


      // Hold both real storage operations until each request has arrived, then
      // allow the selected operation to commit before the other one proceeds.
      let arrived = 0
;

      let releaseBoth!: () => void
;

      const bothArrived = new Promise<void>(resolve => 
{
 releaseBoth = resolve
;
 
}
)
;

      const rendezvous = async () => 
{

        if (++arrived === 2) releaseBoth()
;

        await bothArrived
;

      
}
;

      let releaseSecond!: () => void
;

      const firstCommitted = new Promise<void>(resolve => 
{
 releaseSecond = resolve
;
 
}
)
;

      const originalManualUpdate = storage.updateChangeWithCabStatusGuard.bind(storage)
;

      const originalRemove = storage.removeChangeApproval.bind(storage)
;

      const manualUpdateSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (...args) => 
{

        await rendezvous()
;

        if (first === "removal") await firstCommitted
;

        try 
{

          return await originalManualUpdate(...args)
;

        
}
 finally 
{

          if (first === "manual-update") releaseSecond()
;

        
}

      
}
)
;

      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => 
{

        await rendezvous()
;

        if (first === "manual-update") await firstCommitted
;

        try 
{

          return await originalRemove(...args)
;

        
}
 finally 
{

          if (first === "removal") releaseSecond()
;

        
}

      
}
)
;

      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;


      try 
{

        const [manual, removal] = await Promise.all([
          fetch(`${baseUrl}/api/changes/${changeId}`, 
{

            method: "PUT",
            headers: 
{
 "content-type": "application/json", "x-test-user": managerId 
}
,
            body: JSON.stringify(
{
 status: "in_progress" 
}
),
          
}
),
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${pendingId}`, 
{

            method: "DELETE",
            headers: 
{
 "x-test-user": managerId 
}
,
          
}
),
        ])
;

        expect(arrived).toBe(2)
;

        expect(removal.status).toBe(200)
;

        expect(await removal.json()).toEqual(
{
 success: true 
}
)
;

        if (first === "manual-update") 
{

          expect(manual.status).toBe(403)
;

          expect(await manual.json()).toMatchObject(
{
 code: "CAB_PENDING" 
}
)
;

        
}
 else 
{

          expect(manual.status).toBe(200)
;

          expect((await manual.json()).status).toBe("in_progress")
;

        
}


        const [removed, approved] = await Promise.all([
          db.select().from(changeApprovals).where(eq(changeApprovals.id, pendingId)).then(rows => rows[0]),
          db.select().from(changeApprovals).where(eq(changeApprovals.id, approvedId)).then(rows => rows[0]),
        ])
;

        expect(removed.removedAt).toBeInstanceOf(Date)
;

        expect(removed.removedById).toBe(managerId)
;

        expect(approved).toMatchObject(
{
 decision: "approved", removedAt: null 
}
)
;

        expect((await storage.getChangeApprovals(changeId)).map(row => row.id)).toEqual([approvedId])
;


        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

        expect(savedChange.status).toBe(first === "manual-update" ? "approved" : "in_progress")
;

        expect(savedChange.approvedAt).toBeInstanceOf(Date)
;

        expect(savedChange.actualStart instanceof Date).toBe(first === "removal")
;

      
}
 finally 
{

        manualUpdateSpy.mockRestore()
;

        removeSpy.mockRestore()
;

        permissionSpy.mockRestore()
;

        auditSpy.mockRestore()
;

      
}

    
}
,
    15_000,
  )
;


  it("keeps an opted-in change unapproved when removing its final pending assignment leaves no active voters", async () => 
{

    const managerId = randomUUID()
;

    const pendingVoterId = randomUUID()
;

    const changeId = randomUUID()
;

    const pendingId = randomUUID()
;

    await db.insert(users).values([
      
{
 id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" 
}
,
      
{
 id: pendingVoterId, username: `voter-${pendingVoterId}`, email: `${pendingVoterId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
    ])
;

    await db.insert(changes).values(
{

      id: changeId, changeNumber: `TEST-${changeId}`, title: "Remove the final pending CAB assignment",
      status: "submitted", cabRequired: true,
    
}
)
;

    await db.insert(changeApprovals).values(
{

      id: pendingId, changeId, approverId: pendingVoterId, originalApproverId: pendingVoterId,
      approverLabel: "CAB Voter", decision: "pending",
    
}
)
;

    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;


    try 
{

      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${pendingId}`, 
{

        method: "DELETE",
        headers: 
{
 "x-test-user": managerId 
}
,
      
}
)
;

      expect(response.status).toBe(200)
;

      expect(await response.json()).toEqual(
{
 success: true 
}
)
;


      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

      // With no active CAB approvals, the change remains submitted and cannot
      // be treated as approved merely because there are no pending votes.
      expect(savedChange).toMatchObject(
{

        status: "submitted", cabRequired: true, approvedAt: null,
      
}
)
;

      expect(await storage.getChangeApprovals(changeId)).toEqual([])
;

      const [removed] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, pendingId))
;

      expect(removed.removedAt).toBeInstanceOf(Date)
;

      expect(removed.removedById).toBe(managerId)
;

    
}
 finally 
{

      permissionSpy.mockRestore()
;

      auditSpy.mockRestore()
;

    
}

  
}
)
;


  it.each([
    
{
 first: "vote", decision: "approved" 
}
,
    
{
 first: "removal", decision: "approved" 
}
,
    
{
 first: "vote", decision: "rejected" 
}
,
    
{
 first: "removal", decision: "rejected" 
}
,
  ] as const)(
    "serializes a $decision vote on another assignment against removal when the $first commits first",
    async (
{
 first, decision 
}
) => 
{

      const managerId = randomUUID()
;

      const alreadyApprovedId = randomUUID()
;

      const removedVoterId = randomUUID()
;

      const votingVoterId = randomUUID()
;

      const changeId = randomUUID()
;

      const alreadyApprovedApprovalId = randomUUID()
;

      const removedApprovalId = randomUUID()
;

      const votingApprovalId = randomUUID()
;

      await db.insert(users).values([
        
{
 id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" 
}
,
        
{
 id: alreadyApprovedId, username: `voter-${alreadyApprovedId}`, email: `${alreadyApprovedId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
        
{
 id: removedVoterId, username: `voter-${removedVoterId}`, email: `${removedVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
        
{
 id: votingVoterId, username: `voter-${votingVoterId}`, email: `${votingVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter" 
}
,
      ])
;

      await db.insert(changes).values(
{

        id: changeId, changeNumber: `TEST-${changeId}`, title: "Vote and removal on separate CAB assignments",
        status: "submitted",
      
}
)
;

      await db.insert(changeApprovals).values([
        
{
 id: alreadyApprovedApprovalId, changeId, approverId: alreadyApprovedId,
          originalApproverId: alreadyApprovedId, approverLabel: "CAB Voter",
          decision: "approved", decidedAt: new Date() 
}
,
        
{
 id: removedApprovalId, changeId, approverId: removedVoterId,
          originalApproverId: removedVoterId, approverLabel: "CAB Voter", decision: "pending" 
}
,
        
{
 id: votingApprovalId, changeId, approverId: votingVoterId,
          originalApproverId: votingVoterId, approverLabel: "CAB Voter", decision: "pending" 
}
,
      ])
;


      // Both routes inspect the initial membership before either storage write.
      const originalRead = storage.getChangeApprovals.bind(storage)
;

      let arrived = 0
;

      let releaseReads!: () => void
;

      const bothRead = new Promise<void>(resolve => 
{
 releaseReads = resolve
;
 
}
)
;

      const readSpy = vi.spyOn(storage, "getChangeApprovals").mockImplementation(async id => 
{

        const rows = await originalRead(id)
;

        if (id === changeId && arrived < 2) 
{

          if (++arrived === 2) releaseReads()
;

          await bothRead
;

        
}

        return rows
;

      
}
)
;

      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"])
;

      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never)
;


      let releaseSecond!: () => void
;

      const firstCommitted = new Promise<void>(resolve => 
{
 releaseSecond = resolve
;
 
}
)
;

      const originalVote = storage.updateChangeApproval.bind(storage)
;

      const originalRemove = storage.removeChangeApproval.bind(storage)
;

      const voteSpy = vi.spyOn(storage, "updateChangeApproval").mockImplementation(async (...args) => 
{

        if (first === "removal") await firstCommitted
;

        try 
{

          return await originalVote(...args)
;

        
}
 finally 
{

          if (first === "vote") releaseSecond()
;

        
}

      
}
)
;

      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => 
{

        if (first === "vote") await firstCommitted
;

        try 
{

          return await originalRemove(...args)
;

        
}
 finally 
{

          if (first === "removal") releaseSecond()
;

        
}

      
}
)
;


      try 
{

        const [vote, removal] = await Promise.all([
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${votingApprovalId}`, 
{

            method: "PUT",
            headers: 
{
 "content-type": "application/json", "x-test-user": votingVoterId 
}
,
            body: JSON.stringify(
{
 decision, comments: "Voted during removal" 
}
),
          
}
),
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${removedApprovalId}`, 
{

            method: "DELETE",
            headers: 
{
 "x-test-user": managerId 
}
,
          
}
),
        ])
;

        expect(arrived).toBe(2)
;

        expect(vote.status).toBe(200)
;

        expect(removal.status).toBe(200)
;


        const savedApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId))
;

        expect(savedApprovals.find(row => row.id === alreadyApprovedApprovalId)?.decision).toBe("approved")
;

        expect(savedApprovals.find(row => row.id === votingApprovalId))
          .toMatchObject(
{
 decision, comments: "Voted during removal" 
}
)
;

        expect(savedApprovals.find(row => row.id === removedApprovalId)?.removedAt).toBeInstanceOf(Date)
;

        const active = await storage.getChangeApprovals(changeId)
;

        expect(active.map(row => row.id).sort()).toEqual([alreadyApprovedApprovalId, votingApprovalId].sort())
;

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId))
;

        expect(savedChange.status).toBe(decision)
;

        expect(savedChange.approvedAt instanceof Date).toBe(decision === "approved")
;

      
}
 finally 
{

        readSpy.mockRestore()
;

        permissionSpy.mockRestore()
;

        auditSpy.mockRestore()
;

        voteSpy.mockRestore()
;

        removeSpy.mockRestore()
;

      
}

    
}
,
    15_000,
  )
;


  it.each(["approved", "rejected"] as const)(
    "keeps the change rejected when the %s vote commits first on a separate approval",
    async firstDecision => 
{

      const changeId = randomUUID()
;

      const voters = [
        
{
 id: randomUUID(), decision: "approved" 
}
,
        
{
 id: randomUUID(), decision: "rejected" 
}
,
      ] as const
;

      const approvalIds = [randomUUID(), randomUUID()]
;

      for (const voter of voters) 
{

        await db.insert(users).values(
{

          id: voter.id, username: `voter-${voter.id}`, email: `${voter.id}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Voter",
        
}
)
;

      
}

      await db.insert(changes).values(
{

        id: changeId, changeNumber: `TEST-${changeId}`, title: "Competing CAB decisions",
        status: "submitted",
      
}
)
;

      for (const [index, voter] of voters.entries()) 
{

        await db.insert(changeApprovals).values(
{

          id: approvalIds[index], changeId, approverId: voter.id,
          originalApproverId: voter.id, approverLabel: "CAB Voter", decision: "pending",
        
}
)
;

      
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

  it.each([
    { isActive: true, expectedStatus: 201 },
    { isActive: false, expectedStatus: 409 },
  ])("assigns CAB approvers only when their account is active (isActive=$isActive)", async ({ isActive, expectedStatus }) => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver", isActive },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "CAB assignment account status",
      status: "submitted",
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ approverId }),
      });
      expect(response.status).toBe(expectedStatus);

      if (isActive) {
        expect(await response.json()).toMatchObject({ approverId, decision: "pending" });
      } else {
        expect(await response.json()).toEqual({
          code: "CAB_APPROVER_INACTIVE",
          message: "This account is inactive and cannot be assigned as a CAB approver.",
        });
      }

      const assignments = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
      expect(assignments).toHaveLength(isActive ? 1 : 0);
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it.each([
    { first: "deactivation", decision: "approved", expectedDecision: "pending", expectedStatus: "submitted" },
    { first: "vote", decision: "approved", expectedDecision: "approved", expectedStatus: "approved" },
    { first: "vote", decision: "rejected", expectedDecision: "rejected", expectedStatus: "rejected" },
  ] as const)(
    "keeps account deactivation and CAB voting consistent when $first commits first",
    async ({ first, decision, expectedDecision, expectedStatus }) => {
      const managerId = randomUUID();
      const approverId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Account deactivation and CAB vote",
        status: "submitted", cabRequired: true,
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId, originalApproverId: approverId,
        approverLabel: "CAB Approver", decision: "pending",
      });
      const permissionSpy = vi.spyOn(storage, "getUserPermissions")
        .mockResolvedValue(["user_update", "change_manage", "ticket_view_all"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);
      let votePromise: Promise<Response> | undefined;

      const castVote = () => fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": approverId },
        body: JSON.stringify({ decision }),
      });
      const deactivate = () => storage.updateUser(approverId, { isActive: false });

      try {
        if (first === "deactivation") {
          const deactivationClient = await appPool.connect();
          try {
            await deactivationClient.query("BEGIN");
            await deactivationClient.query(
              'UPDATE "users" SET "is_active" = FALSE WHERE "id" = $1',
              [approverId],
            );
            votePromise = castVote();

            const lockWaitDeadline = Date.now() + 5_000;
            let voteWaitingOnApprover = false;
            while (Date.now() < lockWaitDeadline) {
              const result = await appPool.query<{ waiting: boolean }>(`
                SELECT EXISTS (
                  SELECT 1 FROM pg_stat_activity
                  WHERE wait_event_type = 'Lock'
                    AND state = 'active'
                    AND query ILIKE '%FOR UPDATE%'
                    AND query ILIKE '%users%'
                ) AS waiting
              `);
              if (result.rows[0]?.waiting) {
                voteWaitingOnApprover = true;
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            expect(voteWaitingOnApprover).toBe(true);
            await deactivationClient.query("COMMIT");
          } catch (error) {
            await deactivationClient.query("ROLLBACK");
            throw error;
          } finally {
            deactivationClient.release();
          }

          const voteResponse = await votePromise;
          expect(voteResponse.status).toBe(409);
        } else {
          const voteResponse = await castVote();
          expect(voteResponse.status).toBe(200);
          const deactivatedUser = await deactivate();
          expect(deactivatedUser?.isActive).toBe(false);
        }

        const [savedUser] = await db.select().from(users).where(eq(users.id, approverId));
        expect(savedUser.isActive).toBe(false);
        const [savedApproval] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
        expect(savedApproval).toMatchObject({ decision: expectedDecision, approverId, removedAt: null });
        expect(savedApproval.decidedAt instanceof Date).toBe(first === "vote");
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange).toMatchObject({ status: expectedStatus });
        expect(savedChange.approvedAt instanceof Date).toBe(expectedStatus === "approved");
      } finally {
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
  );

  it("blocks votes on every active change when deactivation holds the approver row lock", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeIds = [randomUUID(), randomUUID(), randomUUID()];
    const approvalIds = changeIds.map(() => randomUUID());
    await db.insert(users).values([
      {
        id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager",
      },
      {
        id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver",
      },
    ]);
    await db.insert(changes).values(changeIds.map((id, index) => ({
      id, changeNumber: `TEST-${id}`, title: `Account deactivation race ${index + 1}`,
      status: "submitted", cabRequired: true,
    })));
    await db.insert(changeApprovals).values(changeIds.map((changeId, index) => ({
      id: approvalIds[index], changeId, approverId, originalApproverId: approverId,
      approverLabel: "CAB Approver", decision: "pending",
    })));
    const permissionSpy = vi.spyOn(storage, "getUserPermissions")
      .mockResolvedValue(["user_update", "change_approve", "change_manage", "ticket_view_all"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);
    const castVote = (changeIndex: number) => fetch(
      `${baseUrl}/api/changes/${changeIds[changeIndex]}/approvals/${approvalIds[changeIndex]}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": approverId },
        body: JSON.stringify({ decision: "approved" }),
      },
    );

    try {
      const committedVote = await castVote(0);
      expect(committedVote.status).toBe(200);

      const deactivationClient = await appPool.connect();
      let voteResponses: Response[];
      try {
        await deactivationClient.query("BEGIN");
        await deactivationClient.query(
          'UPDATE "users" SET "is_active" = FALSE WHERE "id" = $1',
          [approverId],
        );

        const inFlightVotes = [castVote(1), castVote(2)];
        const lockWaitDeadline = Date.now() + 5_000;
        let waitingVoteCount = 0;
        while (Date.now() < lockWaitDeadline) {
          const result = await appPool.query<{ waiting: string }>(`
            SELECT COUNT(*)::text AS waiting
            FROM pg_stat_activity
            WHERE wait_event_type = 'Lock'
              AND state = 'active'
              AND query ILIKE '%FOR UPDATE%'
              AND query ILIKE '%users%'
          `);
          waitingVoteCount = Number(result.rows[0]?.waiting ?? 0);
          if (waitingVoteCount >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waitingVoteCount).toBeGreaterThanOrEqual(2);
        await deactivationClient.query("COMMIT");
        voteResponses = await Promise.all(inFlightVotes);
      } catch (error) {
        await deactivationClient.query("ROLLBACK");
        throw error;
      } finally {
        deactivationClient.release();
      }

      expect(voteResponses.map(response => response.status)).toEqual([409, 409]);
      const [savedUser] = await db.select().from(users).where(eq(users.id, approverId));
      expect(savedUser.isActive).toBe(false);

      const savedApprovals = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.approverId, approverId));
      expect(savedApprovals).toHaveLength(3);
      const approvalsByChange = new Map(savedApprovals.map(approval => [approval.changeId, approval]));
      expect(approvalsByChange.get(changeIds[0])).toMatchObject({
        decision: "approved", approverId, removedAt: null,
      });
      expect(approvalsByChange.get(changeIds[0])?.decidedAt).toBeInstanceOf(Date);
      for (const changeId of changeIds.slice(1)) {
        expect(approvalsByChange.get(changeId)).toMatchObject({
          decision: "pending", approverId, removedAt: null, decidedAt: null,
        });
      }

      const savedChanges = await db.select().from(changes);
      const changesById = new Map(savedChanges.map(change => [change.id, change]));
      expect(changesById.get(changeIds[0])).toMatchObject({ status: "approved" });
      expect(changesById.get(changeIds[0])?.approvedAt).toBeInstanceOf(Date);
      for (const changeId of changeIds.slice(1)) {
        expect(changesById.get(changeId)).toMatchObject({ status: "submitted", approvedAt: null });
      }
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it("keeps a disabled approver's vote pending, exposes the disabled state, and allows manager removal", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Disabled CAB approver",
      status: "submitted", cabRequired: true,
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId, originalApproverId: approverId,
      approverLabel: "CAB Approver", decision: "pending",
    });
    await db.update(users).set({ isActive: false }).where(eq(users.id, approverId));
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage", "ticket_view_all"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const detailResponse = await fetch(`${baseUrl}/api/changes/${changeId}`, {
        headers: { "x-test-user": managerId },
      });
      expect(detailResponse.status).toBe(200);
      const detail = await detailResponse.json();
      expect(detail).toMatchObject({
        status: "submitted",
        approvedAt: null,
        approvals: [{
          id: approvalId,
          decision: "pending",
          approver: { id: approverId, isActive: false },
        }],
      });

      const voteResponse = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": approverId },
        body: JSON.stringify({ decision: "approved" }),
      });
      expect(voteResponse.status).toBe(409);
      const [stillPending] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
      expect(stillPending).toMatchObject({ decision: "pending", approverId, removedAt: null, decidedAt: null });
      const [notApproved] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(notApproved).toMatchObject({ status: "submitted", approvedAt: null });

      const removalResponse = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
        method: "DELETE",
        headers: { "x-test-user": managerId },
      });
      expect(removalResponse.status).toBe(200);
      const [removed] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
      expect(removed).toMatchObject({ decision: "pending", approverId, removedById: managerId });
      expect(removed.removedAt).toBeInstanceOf(Date);
      const [removalAudit] = await db.select().from(auditLogs).where(eq(auditLogs.recordId, approvalId));
      expect(removalAudit).toMatchObject({
        userId: managerId,
        action: "DELETE",
        tableName: "change_approvals",
      });
      expect(JSON.parse(removalAudit.newValues!)).toMatchObject({
        changeId,
        approverId,
        removedById: managerId,
      });
      const [afterRemoval] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(afterRemoval).toMatchObject({ status: "submitted", approvedAt: null });
      expect(await storage.getChangeApprovals(changeId)).toEqual([]);
    } finally {
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it.each(["approved", "in_progress"] as const)(
    "blocks a manual %s transition while a disabled approver's vote is pending",
    async status => {
      const managerId = randomUUID();
      const approverId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Manual CAB status transition",
        type: "standard", risk: "low", status: "submitted", cabRequired: true,
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId, originalApproverId: approverId,
        approverLabel: "CAB Approver", decision: "pending",
      });

      const disabledApprover = await storage.updateUser(approverId, { isActive: false });
      expect(disabledApprover?.isActive).toBe(false);
      const [pendingBefore] = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.id, approvalId));
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      try {
        const response = await fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ status }),
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: "CAB_PENDING" });

        const [unchangedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(unchangedChange).toMatchObject({ status: "submitted", approvedAt: null });
        const [unchangedApproval] = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.id, approvalId));
        expect(unchangedApproval).toEqual(pendingBefore);
      } finally {
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
  );

  it("rolls back CAB removal when its audit event cannot be stored", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "CAB audit persistence failure",
      status: "submitted", cabRequired: true,
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId, originalApproverId: approverId,
      approverLabel: "CAB Approver", decision: "pending",
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);

    try {
      await appPool.query(`
        CREATE FUNCTION reject_cab_removal_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.table_name = 'change_approvals' AND NEW.action = 'DELETE' THEN
            RAISE EXCEPTION 'simulated audit storage outage';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_cab_removal_audit
        BEFORE INSERT ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION reject_cab_removal_audit();
      `);

      const response = await fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
        method: "DELETE",
        headers: { "x-test-user": managerId },
      });
      expect(response.status).toBe(500);

      const [stillAssigned] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, approvalId));
      expect(stillAssigned).toMatchObject({
        id: approvalId,
        removedAt: null,
        removedById: null,
      });
      const [missingAudit] = await db.select().from(auditLogs).where(eq(auditLogs.recordId, approvalId));
      expect(missingAudit).toBeUndefined();
      expect(await storage.getChangeApprovals(changeId)).toHaveLength(1);
    } finally {
      await appPool.query("DROP TRIGGER IF EXISTS reject_cab_removal_audit ON audit_logs");
      await appPool.query("DROP FUNCTION IF EXISTS reject_cab_removal_audit()");
      permissionSpy.mockRestore();
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

  it("keeps removed CAB history readable after the approver account is deleted", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "Casey", lastName: "Reviewer" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Deleted CAB approver history",
      status: "submitted",
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId, originalApproverId: approverId,
      approverLabel: "Casey Reviewer", decision: "pending",
    });

    try {
      const removed = await storage.removeChangeApproval(approvalId, managerId);
      expect(removed?.removedAt).toBeInstanceOf(Date);
      expect(removed).toMatchObject({
        id: approvalId,
        originalApproverId: approverId,
        approverLabel: "Casey Reviewer",
        removedById: managerId,
        removedByLabel: "CAB Manager",
      });

      expect(await storage.deleteUser(approverId)).toBe(true);

      const [historyRecord] = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.id, approvalId));
      expect(historyRecord).toMatchObject({
        id: approvalId,
        changeId,
        approverId: null,
        originalApproverId: approverId,
        approverLabel: "Casey Reviewer",
        decision: "pending",
        removedById: managerId,
        removedByLabel: "CAB Manager",
        removedAt: removed!.removedAt,
      });
      expect(await storage.getAllChangeApprovalRecords(changeId)).toHaveLength(1);
      expect(await storage.getChangeApprovals(changeId)).toEqual([]);

      const details = await storage.getChange(changeId);
      expect(details?.approvals).toEqual([]);
      expect(details?.removedApproverIds).toEqual([approverId]);
      expect(details?.removedApprovals).toMatchObject([{
        id: approvalId,
        approverId: null,
        originalApproverId: approverId,
        approverLabel: "Casey Reviewer",
        removedById: managerId,
        removedByLabel: "CAB Manager",
        removedAt: removed!.removedAt,
      }]);
    } finally {
      await db.delete(auditLogs).where(eq(auditLogs.recordId, approvalId));
      await db.delete(changes).where(eq(changes.id, changeId));
      await db.delete(users).where(eq(users.id, approverId));
      await db.delete(users).where(eq(users.id, managerId));
    }
  });

  it("preserves removed CAB history when account deletion races assignment removal", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "Casey", lastName: "Reviewer" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Concurrent CAB account deletion",
      status: "submitted",
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId, originalApproverId: approverId,
      approverLabel: "Casey Reviewer", decision: "pending",
    });

    try {
      const [deletionResult, removalResult] = await Promise.allSettled([
        storage.deleteUser(approverId),
        storage.removeChangeApproval(approvalId, managerId),
      ]);

      expect(deletionResult.status).toBe("fulfilled");
      if (deletionResult.status !== "fulfilled") throw deletionResult.reason;
      expect(deletionResult.value).toBe(true);

      expect(removalResult.status).toBe("fulfilled");
      if (removalResult.status !== "fulfilled") throw removalResult.reason;
      expect(removalResult.value?.removedAt).toBeInstanceOf(Date);

      const history = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.changeId, changeId));
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: approvalId,
        changeId,
        approverId: null,
        originalApproverId: approverId,
        approverLabel: "Casey Reviewer",
        decision: "pending",
        removedById: managerId,
        removedByLabel: "CAB Manager",
        removedAt: removalResult.value!.removedAt,
      });
      expect(await storage.getChangeApprovals(changeId)).toEqual([]);
      expect(await storage.getAllChangeApprovalRecords(changeId)).toHaveLength(1);
    } finally {
      await db.delete(auditLogs).where(eq(auditLogs.recordId, approvalId));
      await db.delete(changes).where(eq(changes.id, changeId));
      await db.delete(users).where(eq(users.id, approverId));
      await db.delete(users).where(eq(users.id, managerId));
    }
  });

  it("rolls back CAB removal when PostgreSQL rejects status recalculation", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const remainingApproverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
      { id: remainingApproverId, username: `approver-${remainingApproverId}`,
        email: `${remainingApproverId}@example.invalid`, password: "test-only",
        firstName: "CAB", lastName: "Remaining Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Atomic CAB removal",
      status: "submitted", cabRequired: true,
    });
    await db.insert(changeApprovals).values([
      {
        id: approvalId, changeId, approverId, originalApproverId: approverId,
        approverLabel: "CAB Approver", decision: "pending",
      },
      {
        changeId, approverId: remainingApproverId, originalApproverId: remainingApproverId,
        approverLabel: "CAB Remaining Approver", decision: "approved", decidedAt: new Date(),
      },
    ]);

    try {
      await setupPool.query(`
        CREATE FUNCTION "${schema}".fail_cab_status_recalculation() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.id = '${changeId}' AND NEW.status = 'approved' THEN
            RAISE EXCEPTION 'fixture CAB status recalculation failure';
          END IF;
          RETURN NEW;
        END
        $$
      `);
      await setupPool.query(`
        CREATE TRIGGER fail_cab_status_recalculation
        BEFORE UPDATE OF status ON "${schema}".changes
        FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_cab_status_recalculation()
      `);

      await expect(storage.removeChangeApproval(approvalId, managerId))
        .rejects.toThrow(/Failed query: update "changes"/);

      const [savedApproval] = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.id, approvalId));
      expect(savedApproval).toMatchObject({
        decision: "pending",
        approverId,
        removedAt: null,
        removedById: null,
        removedByLabel: null,
      });

      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange).toMatchObject({ status: "submitted", approvedAt: null });
    } finally {
      await setupPool.query(`DROP TRIGGER IF EXISTS fail_cab_status_recalculation ON "${schema}".changes`);
      await setupPool.query(`DROP FUNCTION IF EXISTS "${schema}".fail_cab_status_recalculation()`);
      await db.delete(changes).where(eq(changes.id, changeId));
      await db.delete(users).where(eq(users.id, managerId));
      await db.delete(users).where(eq(users.id, approverId));
      await db.delete(users).where(eq(users.id, remainingApproverId));
    }
  });

  it.each([
    { status: "completed", first: "removal" },
    { status: "completed", first: "terminal update" },
    { status: "cancelled", first: "removal" },
    { status: "cancelled", first: "terminal update" },
  ] as const)(
    "preserves a $status change when CAB removal races and the $first commits first",
    async ({ status, first }) => {
      const managerId = randomUUID();
      const approvedVoterId = randomUUID();
      const pendingVoterId = randomUUID();
      const changeId = randomUUID();
      const approvedId = randomUUID();
      const pendingId = randomUUID();
      const submittedAt = new Date("2026-10-01T10:00:00.000Z");
      const actualStart = new Date("2026-10-02T10:00:00.000Z");

      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: approvedVoterId, username: `approver-${approvedVoterId}`, email: `${approvedVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
        { id: pendingVoterId, username: `approver-${pendingVoterId}`, email: `${pendingVoterId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Terminal change versus CAB removal",
        status: "submitted", cabRequired: true, submittedAt, actualStart,
      });
      await db.insert(changeApprovals).values([
        {
          id: approvedId, changeId, approverId: approvedVoterId, originalApproverId: approvedVoterId,
          approverLabel: "CAB Approver", decision: "approved", decidedAt: submittedAt,
        },
        {
          id: pendingId, changeId, approverId: pendingVoterId, originalApproverId: pendingVoterId,
          approverLabel: "CAB Approver", decision: "pending",
        },
      ]);

      let operationCount = 0;
      let releaseBothOperations!: () => void;
      const bothOperationsStarted = new Promise<void>(resolve => { releaseBothOperations = resolve; });
      const waitForBothOperations = async () => {
        if (++operationCount === 2) releaseBothOperations();
        await bothOperationsStarted;
      };
      let releaseFirst!: () => void;
      const firstCommitted = new Promise<void>(resolve => { releaseFirst = resolve; });
      const originalTerminalUpdate = storage.updateChangeWithCabStatusGuard.bind(storage);
      const originalRemove = storage.removeChangeApproval.bind(storage);
      const terminalUpdateSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard")
        .mockImplementation(async (...args) => {
          await waitForBothOperations();
          if (first === "removal") await firstCommitted;
          try {
            return await originalTerminalUpdate(...args);
          } finally {
            if (first === "terminal update") releaseFirst();
          }
        });
      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => {
        await waitForBothOperations();
        if (first === "terminal update") await firstCommitted;
        try {
          return await originalRemove(...args);
        } finally {
          if (first === "removal") releaseFirst();
        }
      });

      try {
        const [terminalUpdate, removal] = await Promise.all([
          storage.updateChangeWithCabStatusGuard(changeId, { status }),
          storage.removeChangeApproval(pendingId, managerId),
        ]);
        expect(terminalUpdate.change?.status).toBe(status);
        expect(removal?.removedAt).toBeInstanceOf(Date);

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange.status).toBe(status);
        expect(savedChange.submittedAt).toEqual(submittedAt);
        expect(savedChange.actualStart).toEqual(actualStart);
        if (status === "completed") {
          expect(savedChange.actualEnd).toBeInstanceOf(Date);
        } else {
          expect(savedChange.actualEnd).toBeNull();
        }
        // Removal can establish approval before a later terminal transition,
        // but must not manufacture approval after the terminal status commits.
        expect(savedChange.approvedAt instanceof Date).toBe(first === "removal");

        const [savedApproval] = await db.select().from(changeApprovals).where(eq(changeApprovals.id, pendingId));
        expect(savedApproval.removedAt).toBeInstanceOf(Date);
        expect(savedApproval.removedById).toBe(managerId);
      } finally {
        terminalUpdateSpy.mockRestore();
        removeSpy.mockRestore();
        await db.delete(auditLogs).where(eq(auditLogs.recordId, pendingId));
        await db.delete(changes).where(eq(changes.id, changeId));
        await db.delete(users).where(eq(users.id, pendingVoterId));
        await db.delete(users).where(eq(users.id, approvedVoterId));
        await db.delete(users).where(eq(users.id, managerId));
      }
    },
    15_000,
  );

  it.each(["removal", "assignment"] as const)(
    "does not reopen a removed CAB assignment when %s reaches the database first",
    async first => {
      const managerId = randomUUID();
      const approverId = randomUUID();
      const changeId = randomUUID();
      const approvalId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Assignment and removal race",
        status: "submitted",
      });
      await db.insert(changeApprovals).values({
        id: approvalId, changeId, approverId, originalApproverId: approverId,
        approverLabel: "CAB Approver", decision: "pending",
      });

      let operationCount = 0;
      let releaseOperations!: () => void;
      const bothOperationsStarted = new Promise<void>(resolve => { releaseOperations = resolve; });
      const waitForBothOperations = async () => {
        if (++operationCount === 2) releaseOperations();
        await bothOperationsStarted;
      };
      let releaseFirst!: () => void;
      const firstCommitted = new Promise<void>(resolve => { releaseFirst = resolve; });
      const originalAssignment = storage.createChangeApproval.bind(storage);
      const originalRemove = storage.removeChangeApproval.bind(storage);
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);
      const assignmentSpy = vi.spyOn(storage, "createChangeApproval").mockImplementation(async (...args) => {
        await waitForBothOperations();
        if (first === "removal") await firstCommitted;
        try {
          return await originalAssignment(...args);
        } finally {
          if (first === "assignment") releaseFirst();
        }
      });
      const removeSpy = vi.spyOn(storage, "removeChangeApproval").mockImplementation(async (...args) => {
        await waitForBothOperations();
        if (first === "assignment") await firstCommitted;
        try {
          return await originalRemove(...args);
        } finally {
          if (first === "removal") releaseFirst();
        }
      });

      try {
        const [assignment, removal] = await Promise.all([
          fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-test-user": managerId },
            body: JSON.stringify({ approverId }),
          }),
          fetch(`${baseUrl}/api/changes/${changeId}/approvals/${approvalId}`, {
            method: "DELETE",
            headers: { "x-test-user": managerId },
          }),
        ]);

        expect(operationCount).toBe(2);
        expect(assignment.status).toBe(409);
        expect(removal.status).toBe(200);
        const expectedAssignmentCode = first === "removal" ? "CAB_APPROVER_REMOVED" : "CAB_APPROVER_DUPLICATE";
        expect(await assignment.json()).toMatchObject({ code: expectedAssignmentCode });
        expect(await removal.json()).toEqual({ success: true });

        const history = await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
          id: approvalId,
          approverId,
          originalApproverId: approverId,
          decision: "pending",
          removedById: managerId,
          removedByLabel: "CAB Manager",
        });
        expect(history[0].removedAt).toBeInstanceOf(Date);
        expect(await storage.getChangeApprovals(changeId)).toEqual([]);
      } finally {
        assignmentSpy.mockRestore();
        removeSpy.mockRestore();
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
    15_000,
  );

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
    { escalation: "type", updates: { type: "emergency" }, targetStatus: "approved" },
    { escalation: "type", updates: { type: "normal" }, targetStatus: "in_progress" },
    { escalation: "risk", updates: { risk: "high" }, targetStatus: "approved" },
    { escalation: "risk", updates: { risk: "critical" }, targetStatus: "in_progress" },
  ] as const)(
    "requires all active CAB approvals when a $escalation escalation and $targetStatus status are requested together",
    async ({ updates, targetStatus }) => {
      const managerId = randomUUID();
      const approvedApproverId = randomUUID();
      const pendingApproverId = randomUUID();
      const changeId = randomUUID();
      const approvedId = randomUUID();
      const pendingId = randomUUID();
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        { id: approvedApproverId, username: `approver-${approvedApproverId}`, email: `${approvedApproverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
        { id: pendingApproverId, username: `approver-${pendingApproverId}`, email: `${pendingApproverId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Escalate change while requesting approval",
        type: "standard", risk: "low", status: "submitted", cabRequired: false,
      });
      await db.insert(changeApprovals).values([
        { id: approvedId, changeId, approverId: approvedApproverId, originalApproverId: approvedApproverId,
          approverLabel: "CAB Approver", decision: "approved", decidedAt: new Date() },
        { id: pendingId, changeId, approverId: pendingApproverId, originalApproverId: pendingApproverId,
          approverLabel: "CAB Approver", decision: "pending" },
      ]);
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);
      const update = { ...updates, status: targetStatus, cabRequired: false };
      const request = (body: Record<string, unknown> = update) => fetch(`${baseUrl}/api/changes/${changeId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify(body),
      });

      try {
        const escalationResponse = await request();
        expect(escalationResponse.status).toBe(200);
        expect(await escalationResponse.json()).toMatchObject({
          ...updates, status: "submitted", cabRequired: true, cabReviewVersion: 2, cabReviewReset: true,
        });

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange).toMatchObject({
          ...updates, status: "submitted", cabRequired: true, cabReviewVersion: 2,
        });
        const activeApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(activeApprovals.map(approval => approval.decision)).toEqual(["pending", "pending"]);
        expect(activeApprovals.find(approval => approval.id === approvedId)?.decisionHistory)
          .toEqual([expect.objectContaining({ decision: "approved", reviewVersion: 1 })]);

        const statusResponse = await request({ status: targetStatus });
        expect(statusResponse.status).toBe(403);
        expect(await statusResponse.json()).toMatchObject({ code: "CAB_PENDING" });
      } finally {
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
    15_000,
  );

  it.each([
    { escalation: "risk", updates: { risk: "high" }, first: "approval" },
    { escalation: "risk", updates: { risk: "high" }, first: "escalation" },
    { escalation: "type", updates: { type: "emergency" }, first: "approval" },
    { escalation: "type", updates: { type: "emergency" }, first: "escalation" },
  ] as const)(
    "serializes concurrent approval and $escalation escalation when both requests read stale state ($first first)",
    async ({ escalation, updates, first }) => {
      const managerId = randomUUID();
      const changeId = randomUUID();
      await db.insert(users).values({
        id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager",
      });
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Approval racing risk escalation",
        type: "standard", risk: "low", status: "submitted", cabRequired: false,
      });

      // Force both HTTP handlers to capture the same old standard/low state.
      const originalRead = storage.getChange.bind(storage);
      let readCount = 0;
      let releaseReads!: () => void;
      const bothReads = new Promise<void>(resolve => { releaseReads = resolve; });
      const readSpy = vi.spyOn(storage, "getChange").mockImplementation(async id => {
        const change = await originalRead(id);
        if (id === changeId && readCount < 2) {
          expect(change).toMatchObject({ type: "standard", risk: "low", status: "submitted", cabRequired: false });
          if (++readCount === 2) releaseReads();
          await bothReads;
        }
        return change;
      });

      // Both handlers have already read the old state; choose which guarded
      // transaction commits first to exercise both lock orderings.
      const originalGuard = storage.updateChangeWithCabStatusGuard.bind(storage);
      let releaseFirstGuard!: () => void;
      const firstGuardFinished = new Promise<void>(resolve => { releaseFirstGuard = resolve; });
      const guardSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (id, update) => {
        if (id === changeId) {
          const isEscalation = update.risk === "high" || update.type === "emergency";
          const isFirst = first === "approval" ? update.status === "approved" : isEscalation;
          if (!isFirst) await firstGuardFinished;
          try {
            return await originalGuard(id, update);
          } finally {
            if (isFirst) releaseFirstGuard();
          }
        }
        return originalGuard(id, update);
      });
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

      try {
        const update = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify(body),
        });
        const approvalRequest = update({ status: "approved" });
        const escalationRequest = update({ ...updates, cabRequired: false });
        // Reaching both stale reads guarantees the race setup is real rather
        // than relying on request timing or a single sequential update.
        await bothReads;
        expect(readCount).toBe(2);
        releaseReads();

        const [approvalResponse, escalationResponse] = await Promise.all([
          approvalRequest, escalationRequest,
        ]);
        const firstResponse = first === "approval" ? approvalResponse : escalationResponse;
        const secondResponse = first === "approval" ? escalationResponse : approvalResponse;
        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(first === "approval" ? 200 : 403);
        if (first === "escalation") {
          expect(await secondResponse.json()).toMatchObject({ code: "CAB_PENDING" });
        }

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        // Whether approval or escalation wins first, an escalation cannot
        // leave a change approved using votes from the prior risk/type.
        expect(savedChange).toMatchObject({
          type: escalation === "type" ? "emergency" : "standard",
          risk: escalation === "risk" ? "high" : "low",
          status: "submitted", cabRequired: true, cabReviewVersion: 2,
        });
        const activeApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(savedChange.status === "approved" && savedChange.cabRequired)
          .toBe(activeApprovals.length > 0 && activeApprovals.every(row => row.decision === "approved"));
      } finally {
        releaseReads();
        releaseFirstGuard();
        readSpy.mockRestore();
        guardSpy.mockRestore();
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
      }
    },
    15_000,
  );

  it.each(["approved", "in_progress"] as const)(
    "allows a non-CAB change with no approvals to move to %s through the general update route",
    async targetStatus => {
      const managerId = randomUUID();
      const changeId = randomUUID();
      await db.insert(users).values({
        id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager",
      });
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Optional CAB change",
        type: "standard", risk: "low", status: "submitted", cabRequired: false,
      });
      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);

      try {
        const response = await fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ status: targetStatus }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          id: changeId, type: "standard", risk: "low", status: targetStatus, cabRequired: false,
        });
        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange).toMatchObject({
          type: "standard", risk: "low", status: targetStatus, cabRequired: false,
        });
        expect(await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId)))
          .toHaveLength(0);
      } finally {
        permissionSpy.mockRestore();
      }
    },
    15_000,
  );

  it.each([
    { name: "risk", update: { risk: "critical" } },
    { name: "type", update: { type: "emergency" } },
  ])(
    "requires fresh votes after unanimous approvals and a $name escalation",
    async ({ update }) => {
      const managerId = randomUUID();
      const approverIds = [randomUUID(), randomUUID()];
      const changeId = randomUUID();
      const approvalIds = [randomUUID(), randomUUID()];
      const decidedAt = new Date("2026-10-30T12:00:00.000Z");
      await db.insert(users).values([
        { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Manager" },
        ...approverIds.map(id => ({
          id, username: `approver-${id}`, email: `${id}@example.invalid`,
          password: "test-only", firstName: "CAB", lastName: "Approver",
        })),
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `TEST-${changeId}`, title: "Approved change before escalation",
        type: "standard", risk: "low", status: "approved", cabRequired: true,
        cabReviewVersion: 1, approvedAt: decidedAt, requestedById: managerId,
      });
      await db.insert(changeApprovals).values(approvalIds.map((id, index) => ({
        id, changeId, approverId: approverIds[index], originalApproverId: approverIds[index],
        approverLabel: "CAB Approver", decision: "approved", comments: `Approved vote ${index + 1}`,
        decidedAt, reviewVersion: 1,
      })));

      const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
      const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);
      try {
        const response = await fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify(update),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          ...update,
          status: "submitted",
          cabRequired: true,
          cabReviewVersion: 2,
          cabReviewReset: true,
          cabReviewMessage: expect.stringMatching(/prior CAB decisions remain in history/i),
        });

        const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
        expect(savedChange).toMatchObject({
          ...update, status: "submitted", cabRequired: true, cabReviewVersion: 2, approvedAt: null,
        });
        const activeApprovals = await db.select().from(changeApprovals)
          .where(eq(changeApprovals.changeId, changeId));
        expect(activeApprovals).toHaveLength(2);
        for (const approval of activeApprovals) {
          expect(approval).toMatchObject({
            decision: "pending", comments: null, decidedAt: null, reviewVersion: 2,
          });
          expect(approval.decisionHistory).toEqual([expect.objectContaining({
            decision: "approved",
            reviewVersion: 1,
            comments: expect.stringMatching(/^Approved vote/),
            reason: expect.stringMatching(/escalated from low \/ standard/),
          })]);
        }

        const approvalsResponse = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
          headers: { "x-test-user": managerId },
        });
        expect(approvalsResponse.status).toBe(200);
        expect((await approvalsResponse.json()).map((approval: { decision: string }) => approval.decision))
          .toEqual(["pending", "pending"]);

        // A request that captured the old review version cannot cast a vote
        // into the new review after the escalation commits.
        expect(await storage.updateChangeApproval(changeId, approvalIds[0], "approved", "stale vote", 1))
          .toBeUndefined();

        const attemptedApproval = await fetch(`${baseUrl}/api/changes/${changeId}`, {
          method: "PUT",
          headers: { "content-type": "application/json", "x-test-user": managerId },
          body: JSON.stringify({ status: "approved" }),
        });
        expect(attemptedApproval.status).toBe(403);
        expect(await attemptedApproval.json()).toMatchObject({ code: "CAB_PENDING" });
      } finally {
        permissionSpy.mockRestore();
        auditSpy.mockRestore();
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

  it("submits using the latest risk and CAB requirement after a concurrent escalation", async () => {
    const managerId = randomUUID();
    const changeId = randomUUID();
    await db.insert(users).values({
      id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
      password: "test-only", firstName: "CAB", lastName: "Manager",
    });
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Submit during risk escalation",
      type: "standard", risk: "low", status: "draft", cabRequired: false,
    });

    const originalGuard = storage.updateChangeWithCabStatusGuard.bind(storage);
    let releaseSubmit!: () => void;
    let reportSubmit!: () => void;
    const submitReachedGuard = new Promise<void>(resolve => { reportSubmit = resolve; });
    const continueSubmit = new Promise<void>(resolve => { releaseSubmit = resolve; });
    let heldSubmit = false;
    const guardSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (id, update, options) => {
      if (id === changeId && update.status === "submitted" && !heldSubmit) {
        heldSubmit = true;
        reportSubmit();
        await continueSubmit;
      }
      return originalGuard(id, update, options);
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);

    try {
      const submitRequest = fetch(`${baseUrl}/api/changes/${changeId}/submit`, {
        method: "POST",
        headers: { "x-test-user": managerId },
      });
      await submitReachedGuard;

      const escalationResponse = await fetch(`${baseUrl}/api/changes/${changeId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ risk: "high" }),
      });
      expect(escalationResponse.status).toBe(200);

      releaseSubmit();
      const submitResponse = await submitRequest;
      expect(submitResponse.status).toBe(200);
      expect(await submitResponse.json()).toMatchObject({
        risk: "high", status: "submitted", cabRequired: true,
      });

      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange).toMatchObject({
        risk: "high", status: "submitted", cabRequired: true,
      });
      expect(await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId)))
        .toHaveLength(0);
    } finally {
      releaseSubmit();
      guardSpy.mockRestore();
      permissionSpy.mockRestore();
    }
  }, 15_000);

  it("does not start a stale approved change after it becomes CAB-required", async () => {
    const managerId = randomUUID();
    const changeId = randomUUID();
    await db.insert(users).values({
      id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
      password: "test-only", firstName: "CAB", lastName: "Manager",
    });
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Start during risk escalation",
      type: "standard", risk: "low", status: "approved", cabRequired: false,
    });

    const originalGuard = storage.updateChangeWithCabStatusGuard.bind(storage);
    let releaseStart!: () => void;
    let reportStart!: () => void;
    const startReachedGuard = new Promise<void>(resolve => { reportStart = resolve; });
    const continueStart = new Promise<void>(resolve => { releaseStart = resolve; });
    let heldStart = false;
    const guardSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (id, update, options) => {
      if (id === changeId && update.status === "in_progress" && !heldStart) {
        heldStart = true;
        reportStart();
        await continueStart;
      }
      return originalGuard(id, update, options);
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);

    try {
      const startRequest = fetch(`${baseUrl}/api/changes/${changeId}/start`, {
        method: "POST",
        headers: { "x-test-user": managerId },
      });
      await startReachedGuard;

      const escalationResponse = await fetch(`${baseUrl}/api/changes/${changeId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ risk: "high", status: "submitted" }),
      });
      expect(escalationResponse.status).toBe(200);
      expect(await escalationResponse.json()).toMatchObject({
        risk: "high", status: "submitted", cabRequired: true,
      });

      releaseStart();
      const startResponse = await startRequest;
      expect(startResponse.status).toBe(400);
      expect(await startResponse.json()).toMatchObject({
        message: "Change must be approved before starting",
      });

      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange).toMatchObject({
        risk: "high", status: "submitted", cabRequired: true, actualStart: null,
      });
      expect(await db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId)))
        .toHaveLength(0);
    } finally {
      releaseStart();
      guardSpy.mockRestore();
      permissionSpy.mockRestore();
    }
  }, 15_000);

  it("does not allow a CAB assignment to add a pending vote after start commits", async () => {
    const managerId = randomUUID();
    const approverId = randomUUID();
    const newApproverId = randomUUID();
    const changeId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(users).values([
      { id: managerId, username: `manager-${managerId}`, email: `${managerId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Manager" },
      { id: approverId, username: `approver-${approverId}`, email: `${approverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
      { id: newApproverId, username: `approver-${newApproverId}`, email: `${newApproverId}@example.invalid`,
        password: "test-only", firstName: "CAB", lastName: "Approver" },
    ]);
    await db.insert(changes).values({
      id: changeId, changeNumber: `TEST-${changeId}`, title: "Assignment after start",
      type: "normal", risk: "low", status: "approved", cabRequired: true,
    });
    await db.insert(changeApprovals).values({
      id: approvalId, changeId, approverId, originalApproverId: approverId,
      approverLabel: "CAB Approver", decision: "approved", decidedAt: new Date(),
    });

    const originalGuard = storage.updateChangeWithCabStatusGuard.bind(storage);
    let releaseStartResponse!: () => void;
    let reportStartCommitted!: () => void;
    const startCommitted = new Promise<void>(resolve => { reportStartCommitted = resolve; });
    const continueStartResponse = new Promise<void>(resolve => { releaseStartResponse = resolve; });
    const guardSpy = vi.spyOn(storage, "updateChangeWithCabStatusGuard").mockImplementation(async (id, update, options) => {
      const result = await originalGuard(id, update, options);
      if (id === changeId && update.status === "in_progress" && result.change) {
        reportStartCommitted();
        await continueStartResponse;
      }
      return result;
    });
    const permissionSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue(["change_manage"]);
    const auditSpy = vi.spyOn(storage, "createAuditLog").mockResolvedValue(undefined as never);

    try {
      const startRequest = fetch(`${baseUrl}/api/changes/${changeId}/start`, {
        method: "POST",
        headers: { "x-test-user": managerId },
      });
      await startCommitted;

      const assignmentResponse = await fetch(`${baseUrl}/api/changes/${changeId}/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": managerId },
        body: JSON.stringify({ approverId: newApproverId }),
      });
      expect(assignmentResponse.status).toBe(409);
      expect(await assignmentResponse.json()).toMatchObject({
        code: "CAB_CHANGE_ALREADY_APPROVED",
        message: expect.stringMatching(/approved or started/i),
      });

      releaseStartResponse();
      const startResponse = await startRequest;
      expect(startResponse.status).toBe(200);
      expect(await startResponse.json()).toMatchObject({
        status: "in_progress", cabRequired: true,
      });

      const [savedChange] = await db.select().from(changes).where(eq(changes.id, changeId));
      expect(savedChange.status).toBe("in_progress");
      const activeApprovals = await db.select().from(changeApprovals)
        .where(eq(changeApprovals.changeId, changeId));
      expect(activeApprovals).toHaveLength(1);
      expect(activeApprovals[0]).toMatchObject({ decision: "approved", removedAt: null });
    } finally {
      releaseStartResponse();
      guardSpy.mockRestore();
      permissionSpy.mockRestore();
      auditSpy.mockRestore();
    }
  }, 15_000);
});
