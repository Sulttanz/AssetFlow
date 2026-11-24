// @vitest-environment node
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGracefulShutdown, registerShutdownTask, stopBackgroundTasks } from "./graceful-shutdown";

afterEach(() => vi.useRealTimers());

describe("bounded graceful shutdown", () => {
  it("stops accepting requests, cleans background work, closes the database, and handles repeated signals once", async () => {
    const events: string[] = [];
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const exit = vi.fn();
    const stop = createGracefulShutdown({
      server: () => server,
      stopTasks: async () => {
        expect(server.listening).toBe(false);
        events.push("background");
      },
      closeDatabase: async () => { events.push("database"); },
      exit,
    });
    await Promise.all([stop("SIGTERM"), stop("SIGINT")]);
    expect(events).toEqual(["background", "database"]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("exits nonzero by the shutdown deadline if active work never finishes", async () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const closeDatabase = vi.fn();
    const stop = createGracefulShutdown({
      server: () => undefined,
      stopTasks: () => new Promise(() => {}),
      closeDatabase,
      exit,
      timeoutMs: 100,
    });
    void stop("SIGTERM");
    await vi.advanceTimersByTimeAsync(100);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(closeDatabase).not.toHaveBeenCalled();
  });

  it("runs every registered background cleanup once", async () => {
    const cleanup = vi.fn();
    registerShutdownTask(cleanup);
    await stopBackgroundTasks();
    await stopBackgroundTasks();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
