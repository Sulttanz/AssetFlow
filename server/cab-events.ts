import { randomUUID } from "node:crypto";
import { Client } from "@neondatabase/serverless";
import type { Response } from "express";
import { pool } from "./db";

// Notifications contain no CAB data. The API remains the source of truth.
const channel = "cab_changes";
const accessChannel = "cab_access";
const instanceId = randomUUID();
const drainTimeoutMs = 10_000;
const changeEvent = "event: cab-change\ndata: {}\n\n";
const itsmEnabledEvent = "event: itsm-enabled\ndata: {}\n\n";
const maxStreamsPerUser = 6;
const maxStreamsPerSession = 3;
const streamLeaseDurationMs = 90_000;
const streamLeaseCleanupIntervalMs = 60_000;
type Subscriber = {
  res: Response;
  userId: string;
  sessionId: string;
  leaseId: string;
  eventType: "cab" | "access";
  blocked: boolean;
  pendingChange: boolean;
  pendingItsmEnabled: boolean;
  drainTimer?: ReturnType<typeof setTimeout>;
  onDrain: () => void;
  onClose: () => void;
};
const subscribers = new Set<Subscriber>();
const streamsByUser = new Map<string, Set<Subscriber>>();
let listener: Client | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let leaseCleanupTimer: ReturnType<typeof setInterval> | undefined;
let retryDelay = 1000;
let started = false;

async function acquireStreamLease(leaseId: string, userId: string, sessionId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Every replica serializes admission for one account through the same
    // transaction-scoped lock. Separate statements ensure the count query sees
    // leases committed by a replica while this request was waiting for the lock.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`cab-stream:${userId}`]);
    const now = new Date();
    await client.query(
      "DELETE FROM cab_stream_leases WHERE user_id = $1 AND expires_at <= $2",
      [userId, now],
    );
    const { rows } = await client.query<{ user_count: number; session_count: number }>(
      `SELECT
         COUNT(*)::int AS user_count,
         COUNT(*) FILTER (WHERE session_id = $2)::int AS session_count
       FROM cab_stream_leases
       WHERE user_id = $1 AND expires_at > $3`,
      [userId, sessionId, now],
    );
    if (Number(rows[0]?.user_count ?? 0) >= maxStreamsPerUser ||
        Number(rows[0]?.session_count ?? 0) >= maxStreamsPerSession) {
      await client.query("COMMIT");
      return false;
    }
    await client.query(
      "INSERT INTO cab_stream_leases (id, user_id, session_id, expires_at) VALUES ($1, $2, $3, $4)",
      [leaseId, userId, sessionId, new Date(Date.now() + streamLeaseDurationMs)],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function renewStreamLease(leaseId: string): Promise<boolean> {
  const now = new Date();
  const result = await pool.query(
    `UPDATE cab_stream_leases
     SET expires_at = $2
     WHERE id = $1 AND expires_at > $3
     RETURNING id`,
    [leaseId, new Date(Date.now() + streamLeaseDurationMs), now],
  );
  return (result.rowCount ?? result.rows.length) > 0;
}

async function releaseStreamLease(leaseId: string): Promise<void> {
  await pool.query("DELETE FROM cab_stream_leases WHERE id = $1", [leaseId]);
}

async function cleanupExpiredStreamLeases(): Promise<void> {
  await pool.query("DELETE FROM cab_stream_leases WHERE expires_at <= $1", [new Date()]);
}

function startStreamLeaseCleanup(): void {
  if (leaseCleanupTimer) return;
  void cleanupExpiredStreamLeases().catch(error => {
    console.error("Failed to clean expired CAB stream leases:", error);
  });
  leaseCleanupTimer = setInterval(() => {
    void cleanupExpiredStreamLeases().catch(error => {
      console.error("Failed to clean expired CAB stream leases:", error);
    });
  }, streamLeaseCleanupIntervalMs);
  leaseCleanupTimer.unref();
}

function removeSubscriber(subscriber: Subscriber): Promise<void> {
  if (!subscribers.delete(subscriber)) return Promise.resolve();
  const userStreams = streamsByUser.get(subscriber.userId);
  userStreams?.delete(subscriber);
  if (userStreams?.size === 0) streamsByUser.delete(subscriber.userId);
  subscriber.res.off("drain", subscriber.onDrain);
  subscriber.res.off("close", subscriber.onClose);
  if (subscriber.drainTimer) clearTimeout(subscriber.drainTimer);
  subscriber.drainTimer = undefined;
  return releaseStreamLease(subscriber.leaseId).catch(error => {
    console.error("Failed to release CAB stream lease:", error);
  });
}

function disconnect(subscriber: Subscriber): void {
  void removeSubscriber(subscriber);
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
    if (message === itsmEnabledEvent) subscriber.pendingItsmEnabled = true;
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
  subscribers.forEach(subscriber => {
    if (subscriber.eventType === "cab") send(subscriber, changeEvent);
  });
}

function broadcastItsmEnabled(): void {
  subscribers.forEach(subscriber => {
    if (subscriber.eventType === "access") send(subscriber, itsmEnabledEvent);
  });
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
    if (notification.payload === instanceId) return;
    if (notification.channel === channel) broadcast();
    if (notification.channel === accessChannel) broadcastItsmEnabled();
  });
  try {
    await client.connect();
    if (disconnected) return;
    await client.query(`LISTEN ${channel}`);
    await client.query(`LISTEN ${accessChannel}`);
    if (disconnected) return;
    retryDelay = 1000;
    // Reconcile streams that stayed open while the shared listener was offline.
    broadcast();
    // Paused clients use a separate access stream and cannot hear the CAB
    // reconciliation. Wake them so they can recheck ITSM and session state.
    broadcastItsmEnabled();
  } catch (error) {
    reconnect(error instanceof Error ? error : new Error(String(error)));
  }
}

export function startCabEventListener(): void {
  if (started) return;
  started = true;
  startStreamLeaseCleanup();
  void connectListener();
}

// Browser tabs share a session cookie: leave existing streams active and reserve
// room for a reconnect that arrives before the old socket closes. The database
// lease makes both limits account-wide across app replicas.
export async function subscribeToCabEvents(
  res: Response, userId: string, sessionId: string,
): Promise<CabEventSubscription | null> {
  return subscribeToEventStream(res, userId, sessionId, "cab");
}

export async function subscribeToItsmAccessEvents(
  res: Response, userId: string, sessionId: string,
): Promise<CabEventSubscription | null> {
  return subscribeToEventStream(res, userId, sessionId, "access");
}

type CabEventSubscription = (() => Promise<void>) & {
  sendHeartbeat: () => void;
  renewLease: () => Promise<boolean>;
};

async function subscribeToEventStream(
  res: Response, userId: string, sessionId: string, eventType: Subscriber["eventType"],
): Promise<CabEventSubscription | null> {
  const userStreams = streamsByUser.get(userId);
  if (res.destroyed || res.writableEnded ||
      (userStreams?.size ?? 0) >= maxStreamsPerUser ||
      Array.from(userStreams ?? []).filter(stream => stream.sessionId === sessionId).length >= maxStreamsPerSession) {
    return null;
  }
  const leaseId = randomUUID();
  if (!await acquireStreamLease(leaseId, userId, sessionId)) return null;
  if (res.destroyed || res.writableEnded) {
    await releaseStreamLease(leaseId);
    return null;
  }
  const subscriber: Subscriber = {
    res,
    userId,
    sessionId,
    leaseId,
    eventType,
    blocked: false,
    pendingChange: false,
    pendingItsmEnabled: false,
    onClose: () => {
      void removeSubscriber(subscriber);
    },
    onDrain: () => {
      if (!subscribers.has(subscriber)) return;
      subscriber.blocked = false;
      if (subscriber.drainTimer) clearTimeout(subscriber.drainTimer);
      subscriber.drainTimer = undefined;
      if (subscriber.pendingChange) {
        subscriber.pendingChange = false;
        send(subscriber, changeEvent);
      }
      if (subscriber.pendingItsmEnabled) {
        subscriber.pendingItsmEnabled = false;
        send(subscriber, itsmEnabledEvent);
      }
    },
  };
  subscribers.add(subscriber);
  const active = streamsByUser.get(userId) ?? new Set<Subscriber>();
  active.add(subscriber);
  streamsByUser.set(userId, active);
  res.on("drain", subscriber.onDrain);
  res.once("close", subscriber.onClose);
  return Object.assign(() => removeSubscriber(subscriber), {
    sendHeartbeat: () => send(subscriber, ": heartbeat\n\n"),
    renewLease: () => renewStreamLease(leaseId),
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

export async function publishItsmEnabled(): Promise<void> {
  broadcastItsmEnabled();
  try {
    await pool.query("SELECT pg_notify($1, $2)", [accessChannel, instanceId]);
  } catch (error) {
    // The setting write already succeeded; paused clients still have polling as
    // a fallback if the shared notification transport is unavailable.
    console.error("Failed to publish ITSM access notification:", error);
  }
}