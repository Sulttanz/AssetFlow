import { mkdir, writeFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../shared/schema";

// Build-time only: production needs pg and this SQL file, never drizzle-kit or
// a live schema push. The runner executes this only against an empty schema.
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
await mkdir("dist", { recursive: true });
await writeFile("dist/onprem-bootstrap.sql", statements.join("\n") + "\n");
console.log(`Generated fresh-install PostgreSQL baseline (${statements.length} statements).`);
