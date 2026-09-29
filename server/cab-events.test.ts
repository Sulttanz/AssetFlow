// @vitest-environment node
import { EventEmitter } from "node:events";
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
}

const event = "event: cab-change\ndata: {}\n\n";
const response = () => new TestResponse();
const subscribe = (res: TestResponse) => subscribeToCabEvents(res as unknown as Response);

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