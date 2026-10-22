import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const useNativePostgresForVitest =
  process.env.NODE_ENV === "test" && process.env.VITEST_NATIVE_PG === "1";

let activePool: InstanceType<typeof NeonPool> | PgPool;
let activeDatabase: ReturnType<typeof drizzlePg>;

if (useNativePostgresForVitest) {
  const pool = new PgPool({ connectionString });
  activePool = pool;
  activeDatabase = drizzlePg(pool, { schema });
} else {
  const pool = new NeonPool({ connectionString });
  activePool = pool;
  activeDatabase = drizzleNeon({ client: pool, schema }) as unknown as ReturnType<typeof drizzlePg>;
}

// The app uses Neon in normal operation. Full Vitest runs use a disposable local
// PostgreSQL cluster and the native driver, never the app's Neon connection.
export const pool = activePool as unknown as PgPool;
export const db = activeDatabase;
