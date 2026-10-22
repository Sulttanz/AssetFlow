import { Pool } from "pg";
import { initializeTestSchema } from "../server/test-database";

const connectionString = process.env.DATABASE_URL;
const schemaName = process.env.VITEST_SCHEMA_NAME;

if (!connectionString || !schemaName) {
  throw new Error("The disposable Vitest database URL and schema name are required.");
}

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  const { appliedMigrations } = await initializeTestSchema(client, schemaName);
  console.log(`Initialized isolated Vitest schema with ${appliedMigrations.length} migration files.`);
} finally {
  client.release();
  await pool.end();
}
