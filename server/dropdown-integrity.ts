import { db } from "./db";
import { dropdownOptions } from "@shared/schema";
import { findDuplicateDropdowns, normalizeLookupKey } from "@shared/dropdown-utils";
import { eq, sql } from "drizzle-orm";

/**
 * Run before serving requests. Archive redundant configuration rows before
 * deleting them; domain records use values, not dropdown-option IDs.
 */
export async function ensureDropdownIntegrity(category?: string, database = db) {
  return database.transaction(async tx => {
    await tx.execute(sql`LOCK TABLE dropdown_options IN SHARE ROW EXCLUSIVE MODE`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS onprem_deploy`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS onprem_deploy.dropdown_duplicate_archive (
      option_id varchar PRIMARY KEY,
      kept_option_id varchar NOT NULL,
      original_row jsonb NOT NULL,
      archived_at timestamptz NOT NULL DEFAULT now()
    )`);
    const rows = await tx.select().from(dropdownOptions);
    const scoped = category ? rows.filter(row => normalizeLookupKey(row.category) === normalizeLookupKey(category)) : rows;
    const duplicates = findDuplicateDropdowns(scoped);
    for (const { duplicate, keptId } of duplicates) {
      await tx.execute(sql`INSERT INTO onprem_deploy.dropdown_duplicate_archive
        (option_id, kept_option_id, original_row)
        VALUES (${duplicate.id}, ${keptId}, ${JSON.stringify(duplicate)}::jsonb)
        ON CONFLICT (option_id) DO NOTHING`);
      await tx.delete(dropdownOptions).where(eq(dropdownOptions.id, duplicate.id));
    }
    if (!category) {
      await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS dropdown_options_category_value_ci_unique
        ON dropdown_options (lower(btrim(category)), lower(btrim(value)))`);
    }
    return { deleted: duplicates.length, ids: duplicates.map(row => row.duplicate.id) };
  });
}
