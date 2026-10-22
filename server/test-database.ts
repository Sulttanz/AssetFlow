import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as applicationSchema from "../shared/schema";

export function testDatabaseUrlForSchema(connectionString: string, schemaName: string): string {
  if (!/^test_[a-z0-9_]{1,58}$/.test(schemaName)) {
    throw new Error("Test schema names must start with test_ and be at most 63 safe characters");
  }
  const url = new URL(connectionString);
  url.searchParams.set("options", `-c search_path=${schemaName}`);
  return url.toString();
}

/**
 * Build a disposable, complete application schema instead of maintaining a
 * partial copy of table definitions in individual route tests.
 *
 * The caller owns the connection and must drop this schema during teardown.
 * All DDL, foreign keys, migration data, and schema-qualified legacy SQL stay
 * inside the test namespace; public is deliberately absent from search_path.
 */
export async function initializeTestSchema(client: PoolClient, schemaName: string) {
  if (!/^test_[a-z0-9_]{1,58}$/.test(schemaName)) {
    throw new Error("Test schema names must start with test_ and be at most 63 safe characters");
  }
  const isolate = (sql: string) => sql.replace(/\bpublic\b/g, schemaName);
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(applicationSchema),
  );
  const appliedMigrations: string[] = [];

  await client.query("BEGIN");
  try {
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET LOCAL search_path TO "${schemaName}"`);
    await client.query(isolate(statements.join("\n")));

    for (const directory of ["migrations", "migrations/onprem"]) {
      const files = (await readdir(path.resolve(directory), { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
        .map(entry => entry.name)
        .sort();
      for (const file of files) {
        await client.query(isolate(await readFile(path.join(directory, file), "utf8")));
        appliedMigrations.push(`${directory}/${file}`);
      }
    }
    await client.query("COMMIT");
    return { appliedMigrations };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
