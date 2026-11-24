import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";
import { resolvePostgresDriver } from "./db-driver-selection";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const useNativePostgresForVitest =
  process.env.NODE_ENV === "test" && process.env.VITEST_NATIVE_PG === "1";
const databaseDriver = useNativePostgresForVitest
  ? "pg"
  : resolvePostgresDriver(connectionString, process.env.DB_DRIVER);

let activePool: InstanceType<typeof NeonPool> | PgPool;
let activeDatabase: ReturnType<typeof drizzlePg>;

if (databaseDriver === "pg") {
  const pool = new PgPool({ connectionString });
  activePool = pool;
  activeDatabase = drizzlePg(pool, { schema });
} else {
  const pool = new NeonPool({ connectionString });
  activePool = pool;
  activeDatabase = drizzleNeon({ client: pool, schema }) as unknown as ReturnType<typeof drizzlePg>;
}

// Standard PostgreSQL (including local and on-prem installations) uses node-postgres.
// Neon is selected only by an explicit DB_DRIVER=neon setting or a Neon endpoint URL.
// Full Vitest runs may force the native driver with VITEST_NATIVE_PG.
export const pool = activePool as unknown as PgPool;
export const db = activeDatabase;
