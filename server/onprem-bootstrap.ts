export type StartupClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows?: any[] }>;
};

/**
 * Called under the startup migration advisory lock. Never reconcile a populated
 * schema with a schema push: incomplete existing installs require operator repair.
 */
export async function bootstrapFreshDatabase(client: StartupClient, readSql: () => Promise<string>) {
  const { rows = [] } = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  `);
  if (rows.length) {
    const existing = new Set(rows.map(row => row.table_name));
    const missing = ["users", "settings", "roles", "permissions", "employees", "assets", "incidents"]
      .filter(name => !existing.has(name));
    if (missing.length) {
      throw new Error(`Database schema is not empty but lacks core tables: ${missing.join(", ")}. Restore/repair the existing schema; automatic bootstrap was refused.`);
    }
    return false;
  }
  const sql = await readSql();
  if (!sql.trim()) throw new Error("Fresh-install baseline SQL is empty; rebuild the release.");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
  console.log("Fresh database: complete Drizzle base schema initialized.");
  return true;
}

// Preserve the checksum of the already-deployed 20261213 migration. This
// preflight runs in that migration's transaction, only when it is not recorded.
export async function repairLegacyRiskNumbers(client: StartupClient) {
  await client.query(`
    CREATE SEQUENCE IF NOT EXISTS risk_register_number_seq START WITH 1;
    ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS risk_number text;
    LOCK TABLE risk_register IN ACCESS EXCLUSIVE MODE;
    CREATE TABLE IF NOT EXISTS onprem_deploy.risk_number_repairs (
      risk_id text NOT NULL, previous_number text, replacement_number text NOT NULL,
      repaired_at timestamptz NOT NULL DEFAULT now()
    );
    DO $repair_risk_numbers$
    DECLARE item record; replacement text; highest bigint;
    BEGIN
      SELECT max(substring(risk_number FROM '^IT-RSK-([0-9]{1,18})$')::bigint)
        INTO highest FROM risk_register;
      IF highest IS NOT NULL THEN
        PERFORM setval('risk_register_number_seq',
          greatest(highest, (SELECT last_value FROM risk_register_number_seq)), true);
      END IF;
      FOR item IN
        SELECT id, risk_number FROM (
          SELECT id, risk_number,
            row_number() OVER (PARTITION BY risk_number ORDER BY id) AS ordinal
          FROM risk_register
        ) numbered
        WHERE risk_number IS NULL OR btrim(risk_number) = '' OR ordinal > 1
        ORDER BY id
      LOOP
        LOOP
          replacement := 'IT-RSK-' || regexp_replace('00' || nextval('risk_register_number_seq')::text, '^0+(?=[0-9]{3})', '');
          EXIT WHEN NOT EXISTS (SELECT 1 FROM risk_register WHERE risk_number = replacement);
        END LOOP;
        INSERT INTO onprem_deploy.risk_number_repairs(risk_id, previous_number, replacement_number)
          VALUES(item.id::text, item.risk_number, replacement);
        UPDATE risk_register SET risk_number = replacement WHERE id = item.id;
      END LOOP;
    END $repair_risk_numbers$;
  `);
}
