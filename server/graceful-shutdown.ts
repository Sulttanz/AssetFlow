import type { Server } from "node:http";

const shutdownTasks = new Set<() => void | Promise<void>>();

export function registerShutdownTask(task: () => void | Promise<void>) {
  shutdownTasks.add(task);
  return () => shutdownTasks.delete(task);
}

export async function stopBackgroundTasks() {
  const tasks = Array.from(shutdownTasks);
  shutdownTasks.clear();
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  for (const result of results) {
    if (result.status === "rejected") console.error("Background shutdown task failed:", result.reason);
  }
}

export function createGracefulShutdown(options: {
  server: () => Server | undefined;
  stopTasks: () => Promise<void>;
  closeDatabase: () => Promise<void>;
  exit: (code: number) => void;
  timeoutMs?: number;
}) {
  let shuttingDown = false;
  return async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal}: stopping new requests and draining active work.`);
    const server = options.server();
    const timeout = setTimeout(() => {
      console.error("Graceful shutdown deadline exceeded; forcing exit.");
      server?.closeAllConnections();
      options.exit(1);
    }, options.timeoutMs ?? 25_000);
    try {
      // Call close first so new connections stop before background teardown.
      const drained = server?.listening
        ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        : Promise.resolve();
      const tasks = options.stopTasks();
      server?.closeIdleConnections();
      await Promise.all([drained, tasks]);
      await options.closeDatabase();
      clearTimeout(timeout);
      options.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      console.error("Graceful shutdown failed:", error);
      options.exit(1);
    }
  };
}
