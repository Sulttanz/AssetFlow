import { randomUUID } from "node:crypto";
import { Client } from "@neondatabase/serverless";
import type { Response } from "express";
import { pool } from "./db";

// Notifications contain no CAB data. The API remains the source of truth.
const channel = "cab_changes";
const instanceId = randomUUID();
const drainTimeoutMs = 10_000;
const changeEvent = "event: cab-change\ndata: {}\n\n";
const maxStreamsPerUser = 6;
const maxStreamsPerSession = 3;
type Subscriber = {
  res: Response;
  userId: string;
  sessionId: string;
  blocked: boolean;
  pendingChange: boolean;
  drainTimer?: ReturnType<typeof setTimeout>;
  onDrain: () => void;
};
const subscribers = new Set<Subscriber>();
const streamsByUser = new Map<string, Set<Subscriber>>();
let listener: Client | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 1000;
let started = false;

function removeSubscriber(subscriber: Subscriber): void {
  subscribers.delete(subscriber);
  const userStreams = streamsByUser.get(subscriber.userId);
  userStreams?.delete(subscriber);
  if (userStreams?.size === 0) streamsByUser.delete(subscriber.userId);
  subscriber.res.off("drain", subscriber.onDrain);
  if (subscriber.drainTimer) clearTimeout(subscriber.drainTimer);
  subscriber.drainTimer = undefined;
}

function disconnect(subscriber: Subscriber): void {
  removeSubscriber(subscriber);
  subscriber.res.destroy();
}

function send(subscriber: Subscriber, message: string): void {
  if (!subscribers.has(subscriber)) return;
  const { res } = subscriber;
  if (res.destroyed || res.writableEnded) {
    removeSubscriber(subscriber);
    return;
  }
  if (subscriber.blocked) {
    if (message === changeEvent) subscriber.pendingChange = true;
    return;
  }
  try {
    if (!res.write(message)) {
      subscriber.blocked = true;
      subscriber.drainTimer = setTimeout(() => disconnect(subscriber), drainTimeoutMs);
      subscriber.drainTimer.unref();
    }
  } catch {
    disconnect(subscriber);
  }
}

function broadcast(): void {
  subscribers.forEach(subscriber => send(subscriber, changeEvent));
}

// Neon transaction-pooler endpoints cannot hold a LISTEN subscription. Use
// the matching direct endpoint for this one long-lived connection instead.
function listenerConnectionString(): string {
  const url = new URL(process.env.CAB_EVENTS_DATABASE_URL || process.env.DATABASE_URL!);
  if (!process.env.CAB_EVENTS_DATABASE_URL && url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace(/-pooler(?=\.[^.]+(?:\.[^.]+)*\.neon\.tech$)/, "");
  }
  return url.toString();
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void connectListener();
  }, retryDelay);
  retryTimer.unref();
  retryDelay = Math.min(retryDelay * 2, 30_000);
}

async function connectListener(): Promise<void> {
  const client = new Client({ connectionString: listenerConnectionString() });
  listener = client;
  let disconnected = false;
  const reconnect = (error?: Error) => {
    if (disconnected) return;
    disconnected = true;
    if (error) console.error("CAB notification listener disconnected:", error);
    if (listener === client) listener = undefined;
    // A failed connection can still own a socket; release it before retrying.
    void client.end().catch(() => {});
    scheduleRetry();
  };
  client.on("error", reconnect);
  client.on("end", () => reconnect());
  client.on("notification", notification => {
    if (notification.channel === channel && notification.payload !== instanceId) broadcast();
  });
  try {
    await client.connect();
    if (disconnected) return;
    await client.query(`LISTEN ${channel}`);
    if (disconnected) return;
    retryDelay = 1000;
    // Reconcile streams that stayed open while the shared listener was offline.
    broadcast();
  } catch (error) {
    reconnect(error instanceof Error ? error : new Error(String(error)));
  }
}

export function startCabEventListener(): void {
  if (started) return;
  started = true;
  void connectListener();
}

// Browser tabs share a session cookie: leave existing streams active and reserve
// room for a reconnect that arrives before the old socket closes.
export function subscribeToCabEvents(
  res: Response, userId: string, sessionId: string,
): ((() => void) & { sendHeartbeat: () => void }) | null {
  const userStreams = streamsByUser.get(userId);
  if ((userStreams?.size ?? 0) >= maxStreamsPerUser ||
      Array.from(userStreams ?? []).filter(stream => stream.sessionId === sessionId).length >= maxStreamsPerSession) {
    return null;
  }
  const subscriber: Subscriber = {
    res,
    userId,
    sessionId,
    blocked: false,
    pendingChange: false,
    onDrain: () => {
      if (!subscribers.has(subscriber)) return;
      subscriber.blocked = false;
      if (subscriber.drainTimer) clearTimeout(subscriber.drainTimer);
      subscriber.drainTimer = undefined;
      if (subscriber.pendingChange) {
        subscriber.pendingChange = false;
        send(subscriber, changeEvent);
      }
    },
  };
  subscribers.add(subscriber);
  const active = streamsByUser.get(userId) ?? new Set<Subscriber>();
  active.add(subscriber);
  streamsByUser.set(userId, active);
  res.on("drain", subscriber.onDrain);
  return Object.assign(() => removeSubscriber(subscriber), {
    sendHeartbeat: () => send(subscriber, ": heartbeat\n\n"),
  });
}

export async function publishCabChange(): Promise<void> {
  // Local streams should not depend on the shared transport's availability.
  broadcast();
  try {
    await pool.query("SELECT pg_notify($1, $2)", [channel, instanceId]);
  } catch (error) {
    // The write already succeeded; polling and reconnect will reconcile.
    console.error("Failed to publish CAB notification:", error);
  }
}