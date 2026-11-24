// @vitest-environment node
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

const mockDatabase = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  leases: [] as Array<{ id: string; userId: string; sessionId: string; expiresAt: Date }>,
}));
const mockListenerState = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock("./db", () => ({ pool: { query: mockDatabase.query, connect: mockDatabase.connect } }));
vi.mock("pg", () => {
  class MockPgListenerClient {
    handlers = new Map<string, Array<(...args: any[]) => void>>();
    connect = vi.fn().mockResolvedValue(undefined);
    query = vi.fn().mockResolvedValue({ rows: [] });
    end = vi.fn().mockResolvedValue(undefined);

    constructor(readonly options: Record<string, unknown>) {
      mockListenerState.instances.push(Object.assign(this, { driver: "pg" }));
    }

    on(event: string, handler: (...args: any[]) => void) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args);
    }
  }
  return { Client: MockPgListenerClient };
});
vi.mock("@neondatabase/serverless", () => {
  class MockListenerClient {
    handlers = new Map<string, Array<(...args: any[]) => void>>();
    connect = vi.fn().mockResolvedValue(undefined);
    query = vi.fn().mockResolvedValue({ rows: [] });
    end = vi.fn().mockResolvedValue(undefined);

    constructor(readonly options: { connectionString: string }) {
      mockListenerState.instances.push(Object.assign(this, { driver: "neon" }));
    }

    on(event: string, handler: (...args: any[]) => void) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args);
    }
  }
  return { Client: MockListenerClient };
});

import {
  publishCabChange,
  publishItsmEnabled,
  resolveCabListenerConnectionString,
  resolveCabListenerDriver,
  startCabEventListener,
  subscribeToCabEvents,
  subscribeToItsmAccessEvents,
} from "./cab-events";

class TestResponse extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  write = vi.fn((_message: string): boolean => true);
  destroy = vi.fn(() => {
    this.destroyed = true;
    this.emit("close");
    return this;
  });
  end = vi.fn((message?: string) => {
    if (message) this.write(message);
    this.writableEnded = true;
    this.emit("close");
    return this;
  });
}

const event = "event: cab-change\ndata: {}\n\n";
const accessEvent = "event: itsm-enabled\ndata: {}\n\n";
const response = () => new TestResponse();
const subscribe = async (res: TestResponse, userId = "test-user", sessionId = randomUUID()) => {
  const stream = await subscribeToCabEvents(res as unknown as Response, userId, sessionId);
  if (!stream) throw new Error("Unexpected CAB stream limit");
  return stream;
};

async function fakeDatabaseQuery(sql: string, parameters: any[] = []) {
  const statement = sql.replace(/\s+/g, " ").trim();
  if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement) ||
      statement.startsWith("SELECT pg_advisory_xact_lock")) {
    return { rows: [], rowCount: 0 };
  }
  if (statement.startsWith("DELETE FROM cab_stream_leases WHERE user_id =")) {
    const [userId, now] = parameters as [string, Date];
    const before = mockDatabase.leases.length;
    mockDatabase.leases = mockDatabase.leases.filter(lease =>
      lease.userId !== userId || lease.expiresAt > now);
    return { rows: [], rowCount: before - mockDatabase.leases.length };
  }
  if (statement.startsWith("DELETE FROM cab_stream_leases WHERE expires_at <=")) {
    const [now] = parameters as [Date];
    const before = mockDatabase.leases.length;
    mockDatabase.leases = mockDatabase.leases.filter(lease => lease.expiresAt > now);
    return { rows: [], rowCount: before - mockDatabase.leases.length };
  }
  if (statement.startsWith("SELECT COUNT(*)::int AS user_count")) {
    const [userId, sessionId, now] = parameters as [string, string, Date];
    const active = mockDatabase.leases.filter(lease => lease.userId === userId && lease.expiresAt > now);
    return {
      rows: [{
        user_count: active.length,
        session_count: active.filter(lease => lease.sessionId === sessionId).length,
      }],
      rowCount: 1,
    };
  }
  if (statement.startsWith("INSERT INTO cab_stream_leases")) {
    const [id, userId, sessionId, expiresAt] = parameters as [string, string, string, Date];
    mockDatabase.leases.push({ id, userId, sessionId, expiresAt });
    return { rows: [], rowCount: 1 };
  }
  if (statement.startsWith("UPDATE cab_stream_leases SET expires_at")) {
    const [id, expiresAt, now] = parameters as [string, Date, Date];
    const lease = mockDatabase.leases.find(item => item.id === id && item.expiresAt > now);
    if (lease) lease.expiresAt = expiresAt;
    return { rows: lease ? [{ id }] : [], rowCount: lease ? 1 : 0 };
  }
  if (statement.startsWith("DELETE FROM cab_stream_leases WHERE id =")) {
    const [id] = parameters as [string];
    const before = mockDatabase.leases.length;
    mockDatabase.leases = mockDatabase.leases.filter(lease => lease.id !== id);
    return { rows: [], rowCount: before - mockDatabase.leases.length };
  }
  if (statement.startsWith("SELECT pg_notify")) return { rows: [], rowCount: 1 };
  throw new Error(`Unexpected mocked database query: ${statement}`);
}

beforeEach(() => {
  mockDatabase.leases.length = 0;
  mockDatabase.query.mockImplementation(fakeDatabaseQuery);
  mockDatabase.connect.mockImplementation(async () => ({
    query: fakeDatabaseQuery,
    release: vi.fn(),
  }));
});

describe("CAB stream backpressure", () => {
  afterEach(() => {
  vi.clearAllTimers();
    vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mockListenerState.instances.length = 0;
  });

describe("CAB PostgreSQL listener recovery", () => {
  it("uses direct endpoints and rejects configured transaction poolers", () => {
    const direct = resolveCabListenerConnectionString({
      DATABASE_URL: "postgresql://app:secret@ep-example-pooler.us-east-2.aws.neon.tech/app?sslmode=require",
    });
    expect(new URL(direct).hostname).toBe("ep-example.us-east-2.aws.neon.tech");

    expect(() => resolveCabListenerConnectionString({
      DATABASE_URL: "postgresql://app:secret@db.example.test/app",
      CAB_EVENTS_DATABASE_URL: "postgresql://app:secret@db-pooler.example.test/app",
    })).toThrow(/must use a direct PostgreSQL endpoint/);
    expect(() => resolveCabListenerConnectionString({
      DATABASE_URL: "postgresql://app:secret@db.example.test:6432/app",
    })).toThrow(/known pooler/);
    expect(resolveCabListenerDriver({
      DATABASE_URL: "postgresql://app:secret@ep-example.neon.tech/app",
      DB_DRIVER: "neon",
      CAB_EVENTS_DATABASE_URL: "postgresql://app:secret@127.0.0.1/app",
    })).toBe("pg");
    expect(resolveCabListenerDriver({
      DATABASE_URL: "postgresql://app:secret@custom-neon-proxy.example.test/app",
      CAB_EVENTS_DB_DRIVER: "neon",
    })).toBe("neon");
  });

  it("uses native pg for standard PostgreSQL and retains Neon for explicitly selected Neon endpoints", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("DB_DRIVER", "");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: startPg } = await import("./cab-events");
    startPg();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const pgClient = mockListenerState.instances.at(-1);
    expect(pgClient.driver).toBe("pg");
    expect(pgClient.options).toMatchObject({
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      application_name: "assetflow-cab-events",
    });

    vi.clearAllTimers();
    mockListenerState.instances.length = 0;
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@ep-example.us-east-2.aws.neon.tech/app?sslmode=require");
    vi.resetModules();
    const { startCabEventListener: startNeon } = await import("./cab-events");
    startNeon();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockListenerState.instances.at(-1).driver).toBe("neon");
  });

  it("keeps the listener alive with a database heartbeat and reconnects if the heartbeat fails", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("DB_DRIVER", "pg");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: start } = await import("./cab-events");
    start();
    const flushConnect = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    await flushConnect();
    const client = mockListenerState.instances.at(-1);
    expect(client.driver).toBe("pg");

    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.query).toHaveBeenCalledWith("SELECT 1");
    client.query.mockRejectedValueOnce(Object.assign(new Error("server closed idle session"), { code: "57P01" }));
    await vi.advanceTimersByTimeAsync(20_000);
    await flushConnect();
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(warnLog).toHaveBeenCalledWith(expect.stringContaining("reconnect in 2000ms"));
    expect(warnLog).toHaveBeenCalledWith(expect.stringContaining("57P01"));
  });

  it("progressively backs off across repeated short-lived drops and caps retries at 30 seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    const errorLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: start } = await import("./cab-events");
    start();
    const flushConnect = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };
    await flushConnect();
    expect(mockListenerState.instances).toHaveLength(1);

    for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
      const previousCount = mockListenerState.instances.length;
      const client = mockListenerState.instances.at(-1);
      const databaseError = Object.assign(new Error("terminating connection"), { code: "57P01" });
      client.emit("error", databaseError);
      expect(client.end).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(mockListenerState.instances).toHaveLength(previousCount);
      await vi.advanceTimersByTimeAsync(1);
      await flushConnect();
      expect(mockListenerState.instances).toHaveLength(previousCount + 1);
    }
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("PostgreSQL error 57P01"));
  });

  it("resets the backoff only after a connection stays healthy for the stability window", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: start } = await import("./cab-events");
    const flushConnect = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };
    start();
    await flushConnect();
    mockListenerState.instances[0].emit("end");
    await vi.advanceTimersByTimeAsync(2_000);
    await flushConnect();
    expect(mockListenerState.instances).toHaveLength(2);
    expect(infoLog).toHaveBeenCalledWith(expect.stringContaining("listener re-established"));

    await vi.advanceTimersByTimeAsync(60_000);
    mockListenerState.instances[1].emit("end");
    await vi.advanceTimersByTimeAsync(1_999);
    expect(mockListenerState.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await flushConnect();
    expect(mockListenerState.instances).toHaveLength(3);
  });

  it("logs one retry per disconnect even when error and end both fire", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("DB_DRIVER", "pg");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: start } = await import("./cab-events");
    start();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    const client = mockListenerState.instances.at(-1);
    client.emit("error", Object.assign(new Error("connection reset"), { code: "ECONNRESET" }));
    client.emit("end");
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled heartbeat and ignores late errors after deliberate shutdown", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DATABASE_URL", "postgresql://app:secret@db.example.test/app");
    vi.stubEnv("DB_DRIVER", "pg");
    vi.stubEnv("CAB_EVENTS_DATABASE_URL", "");
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.resetModules();
    const { startCabEventListener: start, stopCabEventListener: stop } = await import("./cab-events");
    start();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const first = mockListenerState.instances.at(-1);
    first.query.mockImplementationOnce(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(first.end).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(first.end).toHaveBeenCalledTimes(1);
    expect(warnLog).toHaveBeenCalledWith(expect.stringContaining("ETIMEDOUT"));
    await vi.advanceTimersByTimeAsync(2_000);
    const recovered = mockListenerState.instances.at(-1);
    expect(recovered).not.toBe(first);
    warnLog.mockClear();
    await stop();
    recovered.emit("end");
    recovered.emit("error", new Error("late close"));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(recovered.end).toHaveBeenCalledTimes(1);
    expect(warnLog).not.toHaveBeenCalled();
    expect(mockListenerState.instances).toHaveLength(2);
  });
});

  it("coalesces signals for a blocked client without blocking other streams", async () => {
    vi.useFakeTimers();
    const slow = response();
    const fast = response();
    slow.write.mockReturnValueOnce(false);
    const slowStream = await subscribe(slow);
    const fastStream = await subscribe(fast);
    try {
      await publishCabChange();
      await publishCabChange();
      slowStream.sendHeartbeat();
      expect(slow.write).toHaveBeenCalledTimes(1);
      expect(fast.write).toHaveBeenCalledTimes(2);

      slow.emit("drain");
      expect(slow.write).toHaveBeenCalledTimes(2);
      expect(slow.write).toHaveBeenLastCalledWith(event);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(slow.destroy).not.toHaveBeenCalled();
    } finally {
      await slowStream();
      await fastStream();
    }
  });

  it("disconnects a client that cannot drain, without affecting healthy streams", async () => {
    vi.useFakeTimers();
    const slow = response();
    const fast = response();
    slow.write.mockReturnValue(false);
    const slowStream = await subscribe(slow);
    const fastStream = await subscribe(fast);
    try {
      slowStream.sendHeartbeat();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(slow.destroy).toHaveBeenCalledTimes(1);
      await publishCabChange();
      expect(slow.write).toHaveBeenCalledTimes(1);
      expect(fast.write).toHaveBeenCalledWith(event);
    } finally {
      await slowStream();
      await fastStream();
    }
  });

  it("cleans up a stalled stream when it closes normally", async () => {
    vi.useFakeTimers();
    const slow = response();
    slow.write.mockReturnValue(false);
    const stream = await subscribe(slow);
    stream.sendHeartbeat();
    await stream();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(slow.destroy).not.toHaveBeenCalled();
    expect(slow.listenerCount("drain")).toBe(0);
  });
});

describe("CAB stream connection limits", () => {
  it("keeps tabs sharing one session active and allows one in-flight reconnect", async () => {
    const first = response();
    const second = response();
    const reconnecting = response();
    const excess = response();
    const other = response();
    const releaseFirst = await subscribe(first, "alice", "session-a");
    const releaseSecond = await subscribe(second, "alice", "session-a");
    const releaseReconnect = await subscribe(reconnecting, "alice", "session-a");
    const releaseOther = await subscribe(other, "bob", "session-b");
    try {
      expect(await subscribeToCabEvents(excess as unknown as Response, "alice", "session-a")).toBeNull();
      expect(excess.listenerCount("drain")).toBe(0);
      await publishCabChange();
      expect(first.write).toHaveBeenCalledWith(event);
      expect(second.write).toHaveBeenCalledWith(event);
      expect(reconnecting.write).toHaveBeenCalledWith(event);
      expect(other.write).toHaveBeenCalledWith(event);
      await releaseFirst();
      const releaseNew = await subscribe(excess, "alice", "session-a");
      try {
        await publishCabChange();
        expect(first.write).toHaveBeenCalledTimes(1);
        expect(excess.write).toHaveBeenCalledWith(event);
      } finally {
        await releaseNew();
      }
    } finally {
      await releaseFirst();
      await releaseSecond();
      await releaseReconnect();
      await releaseOther();
    }
  });

  it("refuses a seventh stream for one user, then admits it after a stream closes", async () => {
    const active = Array.from({ length: 6 }, () => response());
    const denied = response();
    const releases = await Promise.all(active.map((res, index) => subscribe(res, "limited", String(index))));
    let releaseFourth: Awaited<ReturnType<typeof subscribe>> | null = null;
    try {
      expect(await subscribeToCabEvents(denied as unknown as Response, "limited", "6")).toBeNull();
      expect(denied.listenerCount("drain")).toBe(0);
      await releases[0]();
      releaseFourth = await subscribe(denied, "limited", "6");
      await publishCabChange();
      expect(active[0].write).not.toHaveBeenCalled();
      expect(denied.write).toHaveBeenCalledWith(event);
      active.slice(1).forEach(res => expect(res.write).toHaveBeenCalledWith(event));
    } finally {
      await Promise.all(releases.map(release => release()));
      if (releaseFourth) await releaseFourth();
    }
  });

  it("enforces user and session limits across independent app instances", async () => {
    const replicaOne = [
      await subscribe(response(), "shared-user", "session-a"),
      await subscribe(response(), "shared-user", "session-a"),
      await subscribe(response(), "shared-user", "session-b"),
      await subscribe(response(), "shared-user", "session-b"),
    ];
    vi.resetModules();
    const { subscribeToCabEvents: subscribeOnReplicaTwo } = await import("./cab-events");
    const replicaTwo = [
      await subscribe(response(), "shared-user", "session-a"),
      await subscribe(response(), "shared-user", "session-c"),
    ];
    try {
      expect(await subscribeOnReplicaTwo(response() as unknown as Response, "shared-user", "session-a")).toBeNull();
      expect(await subscribeOnReplicaTwo(response() as unknown as Response, "shared-user", "session-d")).toBeNull();
      await replicaOne[0]();
      const reconnect = await subscribeOnReplicaTwo(response() as unknown as Response, "shared-user", "session-a");
      expect(reconnect).not.toBeNull();
      const otherAccount = await subscribeOnReplicaTwo(response() as unknown as Response, "other-user", "session-a");
      expect(otherAccount).not.toBeNull();
      if (reconnect) await reconnect();
      if (otherAccount) await otherAccount();
    } finally {
      await Promise.all([...replicaOne, ...replicaTwo].map(release => release()));
    }
  });

  it("removes expired abandoned leases before admitting a replacement stream", async () => {
    vi.useFakeTimers();
    const originalTime = Date.now();
    const active = await Promise.all(
      Array.from({ length: 6 }, (_, index) => subscribe(response(), "expired-user", `session-${index}`)),
    );
    vi.setSystemTime(originalTime + 90_001);
    vi.resetModules();
    const { subscribeToCabEvents: subscribeOnReplicaTwo } = await import("./cab-events");
    try {
      const replacement = await subscribeOnReplicaTwo(response() as unknown as Response, "expired-user", "replacement");
      expect(replacement).not.toBeNull();
      expect(mockDatabase.leases).toHaveLength(1);
      if (replacement) await replacement();
    } finally {
      await Promise.all(active.map(release => release()));
      vi.useRealTimers();
    }
  });

  it("renews live leases and rejects a lease that already expired", async () => {
    vi.useFakeTimers();
    const stream = await subscribe(response(), "renewing-user", "session-a");
    try {
      const lease = mockDatabase.leases[0];
      const initialExpiry = lease.expiresAt.getTime();
      vi.setSystemTime(Date.now() + 60_000);
      expect(await stream.renewLease()).toBe(true);
      expect(lease.expiresAt.getTime()).toBeGreaterThan(initialExpiry);
      vi.setSystemTime(lease.expiresAt.getTime() + 1);
      expect(await stream.renewLease()).toBe(false);
    } finally {
      await stream();
      vi.useRealTimers();
    }
  });
});

it("sends ITSM restoration signals only to paused access streams", async () => {
  const cabResponse = response();
  const accessResponse = response();
  const releaseCab = await subscribe(cabResponse);
  const accessStream = await subscribeToItsmAccessEvents(
    accessResponse as unknown as Response,
    "paused-user",
    randomUUID(),
  );
  if (!accessStream) throw new Error("Unexpected access stream limit");

  try {
    await publishItsmEnabled();
    expect(cabResponse.write).not.toHaveBeenCalled();
    expect(accessResponse.write).toHaveBeenCalledWith(accessEvent);
    expect(mockDatabase.query).toHaveBeenCalledWith(
      "SELECT pg_notify($1, $2)",
      ["cab_access", expect.any(String)],
    );
  } finally {
    await releaseCab();
    await accessStream();
  }
});