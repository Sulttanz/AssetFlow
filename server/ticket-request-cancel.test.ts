// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ticketComments, tickets, users } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";

describe("requester ticket cancellation (PostgreSQL)", () => {
  it("cancels open, in-progress, and resolved requests and records the requester reason", async () => {
    const suffix = randomUUID();
    const requesterId = randomUUID();
    const statuses = ["open", "in_progress", "resolved"] as const;
    const ticketIds = statuses.map(() => randomUUID());
    const resolvedAt = new Date();

    try {
      await db.insert(users).values({
        id: requesterId,
        username: `cancel-requester-${suffix}`,
        email: `cancel-requester-${suffix}@example.invalid`,
        password: "test-only",
        firstName: "Request",
        lastName: "Owner",
      });
      await db.insert(tickets).values(statuses.map((status, index) => ({
        id: ticketIds[index],
        ticketNumber: `CANCEL-${suffix}-${index}`,
        title: `Cancellation regression ${status}`,
        description: "Disposable ticket for a cancellation test.",
        type: "incident",
        requesterId,
        status,
        resolvedAt: status === "resolved" ? resolvedAt : null,
      })));

      for (const [index, status] of statuses.entries()) {
        const cancelled = await storage.cancelTicketForRequester(ticketIds[index], {
          ticketId: ticketIds[index],
          authorId: requesterId,
          message: `Cancelled by requester: ${status} test reason`,
          isInternal: false,
        });

        expect(cancelled).toMatchObject({ id: ticketIds[index], status: "cancelled", resolvedAt: null });
        const [comment] = await db.select().from(ticketComments).where(
          and(eq(ticketComments.ticketId, ticketIds[index]), eq(ticketComments.authorId, requesterId)),
        );
        expect(comment).toMatchObject({
          message: `Cancelled by requester: ${status} test reason`,
          isInternal: false,
        });
      }
    } finally {
      await db.delete(tickets).where(inArray(tickets.id, ticketIds));
      await db.delete(users).where(eq(users.id, requesterId));
    }
  });

  it("allows only one concurrent cancellation and leaves closed or cancelled tickets unchanged", async () => {
    const suffix = randomUUID();
    const requesterId = randomUUID();
    const activeId = randomUUID();
    const closedId = randomUUID();
    const cancelledId = randomUUID();
    const ticketIds = [activeId, closedId, cancelledId];

    try {
      await db.insert(users).values({
        id: requesterId,
        username: `cancel-race-${suffix}`,
        email: `cancel-race-${suffix}@example.invalid`,
        password: "test-only",
        firstName: "Race",
        lastName: "Owner",
      });
      await db.insert(tickets).values([
        { id: activeId, ticketNumber: `CANCEL-RACE-${suffix}`, title: "Race test", description: "Test", type: "incident", requesterId, status: "open" },
        { id: closedId, ticketNumber: `CANCEL-CLOSED-${suffix}`, title: "Closed test", description: "Test", type: "incident", requesterId, status: "closed" },
        { id: cancelledId, ticketNumber: `CANCEL-DONE-${suffix}`, title: "Already cancelled test", description: "Test", type: "incident", requesterId, status: "cancelled" },
      ]);

      const [first, second] = await Promise.all(["first", "second"].map(label =>
        storage.cancelTicketForRequester(activeId, {
          ticketId: activeId,
          authorId: requesterId,
          message: `Concurrent cancellation ${label}`,
          isInternal: false,
        }),
      ));
      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(await storage.cancelTicketForRequester(closedId, {
        ticketId: closedId, authorId: requesterId, message: "Must stay closed", isInternal: false,
      })).toBeUndefined();
      expect(await storage.cancelTicketForRequester(cancelledId, {
        ticketId: cancelledId, authorId: requesterId, message: "Must stay cancelled", isInternal: false,
      })).toBeUndefined();

      const [active, closed, alreadyCancelled] = await Promise.all(
        ticketIds.map(id => db.select().from(tickets).where(eq(tickets.id, id)).then(rows => rows[0])),
      );
      expect(active.status).toBe("cancelled");
      expect(closed.status).toBe("closed");
      expect(alreadyCancelled.status).toBe("cancelled");
      const comments = await db.select().from(ticketComments).where(eq(ticketComments.ticketId, activeId));
      expect(comments).toHaveLength(1);
    } finally {
      await db.delete(tickets).where(inArray(tickets.id, ticketIds));
      await db.delete(users).where(eq(users.id, requesterId));
    }
  });
});