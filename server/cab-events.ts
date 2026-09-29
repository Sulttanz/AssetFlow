import { randomUUID } from "node:crypto";
import { Client } from "@neondatabase/serverless";
import type { Response } from "express";
import { pool } from "./db";

// Notifications contain no CAB data. The API remains the source of truth.
const channel = "cab_changes";
const instanceId = randomUUID();
const subscribers = new Set<Response>();
let listener: Client | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 1000;
let started = false;

function broadcast(): void {
  subscribers.forEach(res => {
    if (res.destroyed || res.writableEnded) {
      subscribers.delete(res);
      return;
    }
    res.write("event: cab-change\ndata: {}\n\n");
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

export function subscribeToCabEvents(res: Response): () => void {
  subscribers.add(res);
  return () => { subscribers.delete(res); };
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