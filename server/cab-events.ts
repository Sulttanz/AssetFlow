import { randomUUID } from "node:crypto";
import { Client as NeonClient } from "@neondatabase/serverless";
import { Client as PgClient } from "pg";
import type { Response } from "express";
import { pool } from "./db";
import { resolvePostgresDriver, type PostgresDriver } from "./db-driver-selection";
import { registerShutdownTask } from "./graceful-shutdown";

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
const initialRetryDelayMs = 2_000;
const maxRetryDelayMs = 30_000;
const stableConnectionWindowMs = 60_000;
const listenerHeartbeatIntervalMs = 20_000;
type ListenerClient = {
  connect: () => Promise<void>;
  query: (query: string) => Promise<unknown>;
  end: () => Promise<unknown>;
  on: (event: string, listener: (...args: any[]) => void) => unknown;
};
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
let listener: ListenerClient | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let leaseCleanupTimer: ReturnType<typeof setInterval> | undefined;
let listenerHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
let listenerHeartbeatTimeout: ReturnType<typeof setTimeout> | undefined;
let closeListener: (() => Promise<void>) | undefined;
let retryDelay = initialRetryDelayMs;
let stableConnectionTimer: ReturnType<typeof setTimeout> | undefined;
let hasConnectedBefore = false;
let started = false;
let stopping = false;

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

// LISTEN requires a persistent session. Prefer a dedicated direct endpoint,
// and only rewrite Neon pooler hosts when falling back to the main URL.
export function resolveCabListenerConnectionString(env: NodeJS.ProcessEnv = process.env): string {
  const dedicatedUrl = env.CAB_EVENTS_DATABASE_URL?.trim();
  const rawUrl = dedicatedUrl || env.DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("DATABASE_URL or CAB_EVENTS_DATABASE_URL must be configured for the CAB listener");

  const url = new URL(rawUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("CAB listener connection must use a PostgreSQL URL");
  }

  const usesKnownPooler = url.hostname.toLowerCase().includes("pooler") ||
    ["6432", "6543"].includes(url.port) ||
    ["true", "1"].includes((url.searchParams.get("pgbouncer") ?? "").toLowerCase());

  if (dedicatedUrl && usesKnownPooler) {
    throw new Error("CAB_EVENTS_DATABASE_URL must use a direct PostgreSQL endpoint, not a transaction pooler");
  }

  if (!dedicatedUrl && url.hostname.endsWith(".neon.tech") && url.hostname.includes("-pooler")) {
    url.hostname = url.hostname.replace(/-pooler(?=\.[^.]+(?:\.[^.]+)*\.neon\.tech$)/, "");
  } else if (!dedicatedUrl && usesKnownPooler) {
    throw new Error("DATABASE_URL uses a known pooler; configure CAB_EVENTS_DATABASE_URL with the direct PostgreSQL endpoint");
  }

  return url.toString();
}

export function resolveCabListenerDriver(env: NodeJS.ProcessEnv = process.env): PostgresDriver {
  const dedicatedUrl = env.CAB_EVENTS_DATABASE_URL?.trim();
  const rawUrl = dedicatedUrl || env.DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("DATABASE_URL or CAB_EVENTS_DATABASE_URL must be configured for the CAB listener");
  const configuredDriver = env.CAB_EVENTS_DB_DRIVER?.trim() || (dedicatedUrl ? undefined : env.DB_DRIVER);
  return resolvePostgresDriver(rawUrl, configuredDriver);
}

function describeListenerError(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error && error.code ? String(error.code) : undefined;
    return `${code ? `PostgreSQL error ${code}: ` : ""}${error.message || "unknown error"}`;
  }
  if (typeof error === "object" && error !== null) {
    const record = error as { message?: unknown; code?: unknown };
    const code = record.code ? String(record.code) : undefined;
    const message = typeof record.message === "string" ? record.message : "unknown error";
    return `${code ? `PostgreSQL error ${code}: ` : ""}${message}`;
  }
  return typeof error === "string" && error ? error : "unknown error";
}

function scheduleRetry(reason: string): void {
  if (retryTimer || stopping) return;
  const delay = retryDelay;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void connectListener();
  }, delay);
  retryTimer.unref();
  retryDelay = Math.min(retryDelay * 2, maxRetryDelayMs);
  console.warn(`[CAB events] PostgreSQL LISTEN reconnect in ${delay}ms (${reason})`);
}

async function connectListener(): Promise<void> {
  if (stopping) return;
  let connectionString: string;
  let driver: PostgresDriver;
  try {
    connectionString = resolveCabListenerConnectionString();
    driver = resolveCabListenerDriver();
  } catch (error) {
    scheduleRetry(`invalid direct-listener database configuration: ${describeListenerError(error)}`);
    return;
  }
  const connectionUrl = new URL(connectionString);
  let client: ListenerClient;
  try {
    client = driver === "neon"
      ? new NeonClient({ connectionString, connectionTimeoutMillis: 10_000, query_timeout: 10_000 }) as unknown as ListenerClient
      : new PgClient({
          connectionString,
          application_name: "assetflow-cab-events",
          connectionTimeoutMillis: 10_000,
          query_timeout: 10_000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10_000,
        }) as unknown as ListenerClient;
  } catch (error) {
    scheduleRetry(`could not create ${driver} listener client: ${describeListenerError(error)}`);
    return;
  }
  listener = client;
  let disconnected = false;
  let heartbeatInFlight = false;
  const clearHeartbeat = () => {
    if (listenerHeartbeatTimer) clearInterval(listenerHeartbeatTimer);
    if (listenerHeartbeatTimeout) clearTimeout(listenerHeartbeatTimeout);
    listenerHeartbeatTimer = undefined;
    listenerHeartbeatTimeout = undefined;
  };
  const close = async () => {
    disconnected = true;
    clearHeartbeat();
    if (stableConnectionTimer) clearTimeout(stableConnectionTimer);
    stableConnectionTimer = undefined;
    if (listener === client) listener = undefined;
    if (closeListener === close) closeListener = undefined;
    await client.end().catch(() => {});
  };
  closeListener = close;
  const reconnect = (error?: unknown) => {
    if (disconnected) return;
    // A failed connection can still own a socket; release it before retrying.
    void close();
    if (!stopping) {
      scheduleRetry(error ? describeListenerError(error) : "connection ended");
    }
  };
  client.on("error", reconnect);
  client.on("end", () => reconnect("connection ended"));
  client.on("notification", notification => {
    if (notification.payload === instanceId) return;
    if (notification.channel === channel) broadcast();
    if (notification.channel === accessChannel) broadcastItsmEnabled();
  });
  try {
    await client.connect();
    if (disconnected || stopping || listener !== client) return;
    await client.query(`LISTEN ${channel}`);
    await client.query(`LISTEN ${accessChannel}`);
    if (disconnected || stopping || listener !== client) return;
    console.info(
      `[CAB events] PostgreSQL LISTEN listener ${hasConnectedBefore ? "re-established" : "connected"} ` +
      `(driver=${driver}, host=${connectionUrl.hostname}, port=${connectionUrl.port || "default"})`,
    );
    hasConnectedBefore = true;
    stableConnectionTimer = setTimeout(() => {
      stableConnectionTimer = undefined;
      const shouldLogReset = retryDelay > initialRetryDelayMs;
      retryDelay = initialRetryDelayMs;
      if (shouldLogReset) {
        console.info("[CAB events] PostgreSQL LISTEN connection stable; retry backoff reset");
      }
    }, stableConnectionWindowMs);
    stableConnectionTimer.unref();
    // Keep network paths alive and avoid server idle-session timeouts. A
    // lightweight query is valid while LISTEN is active and keeps both native
    // PostgreSQL and Neon direct sessions from silently aging out.
    listenerHeartbeatTimer = setInterval(() => {
      if (disconnected || stopping || heartbeatInFlight) return;
      heartbeatInFlight = true;
      const deadline = setTimeout(() => {
        reconnect(Object.assign(new Error("listener heartbeat timed out after 10000ms"), { code: "ETIMEDOUT" }));
      }, 10_000);
      deadline.unref();
      listenerHeartbeatTimeout = deadline;
      void client.query("SELECT 1")
        .catch(reconnect)
        .finally(() => {
          clearTimeout(deadline);
          if (listenerHeartbeatTimeout === deadline) listenerHeartbeatTimeout = undefined;
          heartbeatInFlight = false;
        });
    }, listenerHeartbeatIntervalMs);
    listenerHeartbeatTimer.unref();
    // Reconcile streams that stayed open while the shared listener was offline.
    broadcast();
    // Paused clients use a separate access stream and cannot hear the CAB
    // reconciliation. Wake them so they can recheck ITSM and session state.
    broadcastItsmEnabled();
  } catch (error) {
    reconnect(error);
  }
}

export function startCabEventListener(): void {
  if (started) return;
  stopping = false;
  started = true;
  registerShutdownTask(stopCabEventListener);
  startStreamLeaseCleanup();
  void connectListener();
}

export async function stopCabEventListener(): Promise<void> {
  stopping = true;
  started = false;
  if (retryTimer) clearTimeout(retryTimer);
  if (leaseCleanupTimer) clearInterval(leaseCleanupTimer);
  if (listenerHeartbeatTimer) clearInterval(listenerHeartbeatTimer);
  if (listenerHeartbeatTimeout) clearTimeout(listenerHeartbeatTimeout);
  if (stableConnectionTimer) clearTimeout(stableConnectionTimer);
  retryTimer = undefined;
  leaseCleanupTimer = undefined;
  listenerHeartbeatTimer = undefined;
  listenerHeartbeatTimeout = undefined;
  stableConnectionTimer = undefined;
  const streams = Array.from(subscribers);
  await Promise.all(streams.map(async subscriber => {
    await removeSubscriber(subscriber);
    subscriber.res.destroy();
  }));
  await closeListener?.();
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