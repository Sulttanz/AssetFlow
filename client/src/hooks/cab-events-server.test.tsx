import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import type { Response } from "express";
import { publishCabChange, startCabEventListener, subscribeToCabEvents } from "../../../server/cab-events";

const { query, clients } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({}),
  clients: [] as Array<{
    emit: (event: string, payload: object) => void;
    query: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock("../../../server/db", () => ({ pool: { query } }));

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
  const unsubscribeFirst = subscribeToCabEvents(first, "first", "session-1")!;
  const unsubscribeSecond = subscribeToCabEvents(second, "second", "session-2")!;
  try {
    await publishCabChange();
    expect(first.write).toHaveBeenCalledWith("event: cab-change\ndata: {}\n\n");
    expect(second.write).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    await publishCabChange();
    expect(first.write).toHaveBeenCalledTimes(1);
    expect(second.write).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", ["cab_changes", expect.any(String)]);
  } finally {
    unsubscribeFirst();
    unsubscribeSecond();
  }
});

it("fans out notifications from another server without echoing its own publish", async () => {
  startCabEventListener();
  const client = clients[0];
  await vi.waitFor(() => expect(client.query).toHaveBeenCalledWith("LISTEN cab_changes"));
  const stream = streamResponse();
  const unsubscribe = subscribeToCabEvents(stream, "first", "session-1")!;
  try {
    client.emit("notification", { channel: "cab_changes", payload: "another-server" });
    expect(stream.write).toHaveBeenCalledOnce();
    await publishCabChange();
    expect(stream.write).toHaveBeenCalledTimes(2);
    client.emit("notification", { channel: "cab_changes", payload: query.mock.calls.at(-1)![1][1] });
    expect(stream.write).toHaveBeenCalledTimes(2);
  } finally {
    unsubscribe();
  }
});