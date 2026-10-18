// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeApprovals, changes, users } from "@shared/schema";
import { cabApprovalsGranted } from "./cab-gate";
import { db } from "./db";
import { storage } from "./storage";

describe("CAB approvals after an approver account is deleted (PostgreSQL)", () => {
  it("keeps pending and decided history, blocks the gate until the pending assignment is removed", async () => {
    const suffix = randomUUID();
    const approverId = randomUUID();

    const decidedApproverId = randomUUID();
    const removerId = randomUUID();
    const changeId = randomUUID();

    try {
      await db.insert(users).values([
        { id: approverId, username: `cab-approver-${suffix}`, email: `cab-approver-${suffix}@example.invalid`,
          password: "test-only", firstName: "Casey", lastName: "Reviewer" },
        { id: decidedApproverId, username: `cab-decided-approver-${suffix}`, email: `cab-decided-approver-${suffix}@example.invalid`,
          password: "test-only", firstName: "Jordan", lastName: "Reviewer" },
        { id: removerId, username: `cab-remover-${suffix}`, email: `cab-remover-${suffix}@example.invalid`,
          password: "test-only", firstName: "Test", lastName: "Manager" },
      ]);
      await db.insert(changes).values({
        id: changeId, changeNumber: `CAB-TEST-${suffix}`, title: "CAB account deletion regression",
        type: "normal", status: "submitted", cabRequired: true,
      });

      const pending = await storage.createChangeApproval({ changeId, approverId, decision: "pending" });

      // Keep the decided history on a separate approver so this fixture follows
      // the one-approver rule while preserving the account-deletion coverage.
      const decidedAt = new Date();
      const [decided] = await db.insert(changeApprovals).values({
        changeId,
        approverId: decidedApproverId,
        originalApproverId: decidedApproverId,
        approverLabel: "Jordan Reviewer",
        decision: "approved",
        comments: "Approved before account deletion",
        decidedAt,
      }).returning();
      expect(decided).toBeDefined();
      expect(pending.createdAt).toBeInstanceOf(Date);
      expect(decided!.createdAt).toBeInstanceOf(Date);
      expect(decided!.decidedAt).toBeInstanceOf(Date);

      expect(await storage.deleteUser(approverId)).toBe(true);
      expect(await storage.deleteUser(decidedApproverId)).toBe(true);
      expect(await db.select().from(users).where(eq(users.id, approverId))).toEqual([]);
      expect(await db.select().from(users).where(eq(users.id, decidedApproverId))).toEqual([]);

      const history = await storage.getAllChangeApprovalRecords(changeId);
      expect(history).toHaveLength(2);
      const byId = new Map(history.map(approval => [approval.id, approval]));
      expect(byId.get(pending.id)).toMatchObject({
        id: pending.id, changeId, approverId: null, originalApproverId: approverId,
        approverLabel: "Casey Reviewer", decision: "pending", comments: null,
        decidedAt: null, removedAt: null, createdAt: pending.createdAt,
      });
      expect(byId.get(decided!.id)).toMatchObject({
        id: decided!.id, changeId, approverId: null, originalApproverId: decidedApproverId,
        approverLabel: "Jordan Reviewer", decision: "approved",
        comments: "Approved before account deletion", decidedAt: decided!.decidedAt,
        removedAt: null, createdAt: decided!.createdAt,
      });

      const active = await storage.getChangeApprovals(changeId);
      expect(active).toHaveLength(2);
      expect(cabApprovalsGranted(active)).toBe(false);
      expect(await storage.updateChangeApproval(changeId, pending.id, "approved")).toBeUndefined();

      const removed = await storage.removeChangeApproval(pending.id, removerId);
      expect(removed?.removedAt).toBeInstanceOf(Date);
      expect(removed?.removedByLabel).toBe("Test Manager");
      const remaining = await storage.getChangeApprovals(changeId);
      expect(remaining.map(approval => approval.id)).toEqual([decided!.id]);
      expect(cabApprovalsGranted(remaining)).toBe(true);
      expect((await storage.getAllChangeApprovalRecords(changeId))).toHaveLength(2);
      expect(await storage.deleteUser(removerId)).toBe(true);
      const details = await storage.getChange(changeId);
      expect(details?.approvals?.map(a => a.id)).toEqual([decided!.id]);
      expect(details?.removedApproverIds).toEqual([approverId]);
      expect(details?.removedApprovals).toMatchObject([{
        id: pending.id, originalApproverId: approverId, approverLabel: "Casey Reviewer",
        removedById: null, removedByLabel: "Test Manager", removedAt: removed!.removedAt,
      }]);
    } finally {
      // Only delete fixtures identified by their generated IDs; never touch existing changes or users.
      try {
        await db.delete(changes).where(eq(changes.id, changeId)); // cascades to fixture approvals
      } finally {
        try {
          await db.delete(users).where(eq(users.id, approverId));
        } finally {
          try {
            await db.delete(users).where(eq(users.id, decidedApproverId));
          } finally {
            await db.delete(users).where(eq(users.id, removerId));
          }
        }
      }
    }
  });
});
