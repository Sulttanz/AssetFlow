// @vitest-environment node
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

const query = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("./db", () => ({ pool: { query } }));

import { publishCabChange, subscribeToCabEvents } from "./cab-events";

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
const response = () => new TestResponse();
const subscribe = (res: TestResponse, userId = "test-user", sessionId = randomUUID()) => {
  const stream = subscribeToCabEvents(res as unknown as Response, userId, sessionId);
  if (!stream) throw new Error("Unexpected CAB stream limit");
  return stream;
};

describe("CAB stream backpressure", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces signals for a blocked client without blocking other streams", async () => {
    vi.useFakeTimers();
    const slow = response();
    const fast = response();
    slow.write.mockReturnValueOnce(false);
    const slowStream = subscribe(slow);
    const fastStream = subscribe(fast);
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
      slowStream();
      fastStream();
    }
  });

  it("disconnects a client that cannot drain, without affecting healthy streams", async () => {
    vi.useFakeTimers();
    const slow = response();
    const fast = response();
    slow.write.mockReturnValue(false);
    const slowStream = subscribe(slow);
    const fastStream = subscribe(fast);
    try {
      slowStream.sendHeartbeat();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(slow.destroy).toHaveBeenCalledTimes(1);
      await publishCabChange();
      expect(slow.write).toHaveBeenCalledTimes(1);
      expect(fast.write).toHaveBeenCalledWith(event);
    } finally {
      slowStream();
      fastStream();
    }
  });

  it("cleans up a stalled stream when it closes normally", async () => {
    vi.useFakeTimers();
    const slow = response();
    slow.write.mockReturnValue(false);
    const stream = subscribe(slow);
    stream.sendHeartbeat();
    stream();
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
    const releaseFirst = subscribe(first, "alice", "session-a");
    const releaseSecond = subscribe(second, "alice", "session-a");
    const releaseReconnect = subscribe(reconnecting, "alice", "session-a");
    const releaseOther = subscribe(other, "bob", "session-b");
    try {
      expect(subscribeToCabEvents(excess as unknown as Response, "alice", "session-a")).toBeNull();
      expect(excess.listenerCount("drain")).toBe(0);
      await publishCabChange();
      expect(first.write).toHaveBeenCalledWith(event);
      expect(second.write).toHaveBeenCalledWith(event);
      expect(reconnecting.write).toHaveBeenCalledWith(event);
      expect(other.write).toHaveBeenCalledWith(event);
      releaseFirst();
      const releaseNew = subscribe(excess, "alice", "session-a");
      try {
        await publishCabChange();
        expect(first.write).toHaveBeenCalledTimes(1);
        expect(excess.write).toHaveBeenCalledWith(event);
      } finally {
        releaseNew();
      }
    } finally {
      releaseFirst();
      releaseSecond();
      releaseReconnect();
      releaseOther();
    }
  });

  it("refuses a seventh stream for one user, then admits it after a stream closes", async () => {
    const active = Array.from({ length: 6 }, () => response());
    const denied = response();
    const releases = active.map((res, index) => subscribe(res, "limited", String(index)));
    let releaseFourth: (() => void) | null = null;
    try {
      expect(subscribeToCabEvents(denied as unknown as Response, "limited", "6")).toBeNull();
      expect(denied.listenerCount("drain")).toBe(0);
      releases[0]();
      releaseFourth = subscribe(denied, "limited", "6");
      await publishCabChange();
      expect(active[0].write).not.toHaveBeenCalled();
      expect(denied.write).toHaveBeenCalledWith(event);
      active.slice(1).forEach(res => expect(res.write).toHaveBeenCalledWith(event));
    } finally {
      releases.forEach(release => release());
      releaseFourth?.();
    }
  });
});