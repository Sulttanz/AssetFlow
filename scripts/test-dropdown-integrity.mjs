import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// Never connects to the application database: an ephemeral local cluster only.
const root = await mkdtemp(path.join(os.tmpdir(), "dropdown-integrity-test-"));
const data = path.join(root, "data");
let started = false;
let pool;
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
}
try {
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  run("initdb", ["-D", data, "-A", "trust", "--no-locale", "-U", "lookup_test"]);
  run("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${root} -F`, "-w", "start"]);
  started = true;
  const connectionString = `postgresql://lookup_test@127.0.0.1:${port}/postgres`;
  process.env.DATABASE_URL = connectionString;
  pool = new pg.Pool({ connectionString });
  const { ensureDropdownIntegrity } = await import("../server/dropdown-integrity.ts");
  const database = drizzle(pool);
  await pool.query(`
    CREATE TABLE dropdown_options (
      id varchar PRIMARY KEY, category text NOT NULL, value text NOT NULL,
      label text NOT NULL, is_active boolean DEFAULT true, display_order integer DEFAULT 0,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    );
    INSERT INTO dropdown_options (id, category, value, label, is_active, created_at) VALUES
      ('old', ' status ', ' OPEN ', 'Original metadata', false, '2020-01-01'),
      ('keep', 'Status', 'open', 'Open', true, '2026-01-01');
    CREATE TABLE test_reference (option_id varchar REFERENCES dropdown_options(id));
    INSERT INTO test_reference VALUES ('old');
  `);
  await assert.rejects(
    () => ensureDropdownIntegrity(undefined, database),
    error => (error.cause?.code ?? error.code) === "23503",
  );
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM dropdown_options")).rows[0].count, 2, "A failed cleanup must roll back all changes");
  assert.equal((await pool.query("SELECT to_regclass('onprem_deploy.dropdown_duplicate_archive') AS table_name")).rows[0].table_name, null);
  await pool.query("DROP TABLE test_reference");
  assert.deepEqual(await ensureDropdownIntegrity(undefined, database), { deleted: 1, ids: ["old"] });
  assert.equal((await pool.query("SELECT id FROM dropdown_options")).rows[0].id, "keep");
  const archive = (await pool.query("SELECT kept_option_id, original_row FROM onprem_deploy.dropdown_duplicate_archive")).rows[0];
  assert.equal(archive.kept_option_id, "keep");
  assert.equal(archive.original_row.label, "Original metadata");
  const writes = await Promise.allSettled([
    pool.query("INSERT INTO dropdown_options (id,category,value,label) VALUES ('a','priority','P1','Critical')"),
    pool.query("INSERT INTO dropdown_options (id,category,value,label) VALUES ('b',' PRIORITY ','p1','Critical')"),
  ]);
  assert.equal(writes.filter(result => result.status === "fulfilled").length, 1);
  const rejected = writes.find(result => result.status === "rejected");
  assert.equal(rejected.reason.code, "23505");
  assert.deepEqual(await ensureDropdownIntegrity(undefined, database), { deleted: 0, ids: [] });
  console.log("Dropdown PostgreSQL regression passed: rollback, active survivor, archive preservation, concurrent uniqueness, and idempotence.");
} finally {
  if (pool) await pool.end();
  if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  await rm(root, { recursive: true, force: true });
}
