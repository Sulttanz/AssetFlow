import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import type { Response } from "express";
import { publishCabChange, startCabEventListener, subscribeToCabEvents } from "../../../server/cab-events";

const { query, connect, clients, leases } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({}),
  connect: vi.fn(),
  clients: [] as Array<{
    emit: (event: string, payload: object) => void;
    query: ReturnType<typeof vi.fn>;
  }>,
  leases: [] as Array<{ id: string; userId: string; sessionId: string; expiresAt: Date }>,
}));
vi.mock("../../../server/db", () => ({ pool: { query, connect } }));

vi.mock("@neondatabase/serverless", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeClient extends EventEmitter {
    connect = vi.fn().mockResolvedValue(undefined);
    query = vi.fn().mockResolvedValue({});
    end = vi.fn().mockResolvedValue(undefined);
    constructor() {
      super();
      clients.push(this);
    }
  }
  return { Client: FakeClient };
});

beforeEach(() => {
  query.mockClear();
  leases.length = 0;
  query.mockImplementation(async (sql: string, parameters: any[] = []) => {
    if (sql.startsWith("DELETE FROM cab_stream_leases WHERE id =")) {
      const [id] = parameters;
      const before = leases.length;
      leases.splice(0, leases.length, ...leases.filter(lease => lease.id !== id));
      return { rows: [], rowCount: before - leases.length };
    }
    return { rows: [], rowCount: 0 };
  });
  connect.mockImplementation(async () => ({
    release: vi.fn(),
    query: async (sql: string, parameters: any[] = []) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" ||
          sql.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("DELETE FROM cab_stream_leases WHERE user_id =")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("SELECT")) return { rows: [{ user_count: 0, session_count: 0 }], rowCount: 1 };
      if (sql.startsWith("INSERT INTO cab_stream_leases")) {
        const [id, userId, sessionId, expiresAt] = parameters;
        leases.push({ id, userId, sessionId, expiresAt });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }));
  process.env.DATABASE_URL ||= "postgres://test@localhost/test";
});

function streamResponse(): Response {
  return Object.assign(new EventEmitter(), {
    write: vi.fn().mockReturnValue(true),
    destroyed: false,
    writableEnded: false,
  }) as unknown as Response;
}

it("broadcasts a data-free refresh signal to open sessions only", async () => {
  const first = streamResponse();
  const second = streamResponse();
  const unsubscribeFirst = await subscribeToCabEvents(first, "first", "session-1");
  const unsubscribeSecond = await subscribeToCabEvents(second, "second", "session-2");
  if (!unsubscribeFirst || !unsubscribeSecond) throw new Error("Expected CAB stream subscriptions");
  try {
    await publishCabChange();
    expect(first.write).toHaveBeenCalledWith("event: cab-change\ndata: {}\n\n");
    expect(second.write).toHaveBeenCalledTimes(1);
    await unsubscribeFirst();
    await publishCabChange();
    expect(first.write).toHaveBeenCalledTimes(1);
    expect(second.write).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", ["cab_changes", expect.any(String)]);
  } finally {
    await unsubscribeFirst();
    await unsubscribeSecond();
  }
});

it("fans out notifications from another server without echoing its own publish", async () => {
  startCabEventListener();
  const client = clients[0];
  await vi.waitFor(() => expect(client.query).toHaveBeenCalledWith("LISTEN cab_changes"));
  const stream = streamResponse();
  const unsubscribe = await subscribeToCabEvents(stream, "first", "session-1");
  if (!unsubscribe) throw new Error("Expected CAB stream subscription");
  try {
    client.emit("notification", { channel: "cab_changes", payload: "another-server" });
    expect(stream.write).toHaveBeenCalledOnce();
    await publishCabChange();
    expect(stream.write).toHaveBeenCalledTimes(2);
    client.emit("notification", { channel: "cab_changes", payload: query.mock.calls.at(-1)![1][1] });
    expect(stream.write).toHaveBeenCalledTimes(2);
  } finally {
    await unsubscribe();
  }
});