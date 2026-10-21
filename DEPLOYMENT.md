# Production Deployment Guide

This application runs as a Node.js service backed by PostgreSQL. The web client is built with Vite and served by the Express server in production.

## Database and file-storage prerequisites

The current database adapter in `server/db.ts` is `@neondatabase/serverless` over WebSockets. Use a compatible hosted endpoint. A conventional on-premises PostgreSQL TCP URL alone is **not** sufficient with this adapter; provide a compatible WebSocket proxy or validate a `pg`/Drizzle adapter migration before installing against plain PostgreSQL.

Current attachment handlers write to `server/uploads`. Replit production filesystems are not persistent across publishes, and local files are not shared between Autoscale instances. Before relying on uploads in cloud production, move these handlers to durable shared object storage. On-premises installations must mount and back up `server/uploads` on persistent storage with write access for the service account.

## Required environment

Set these values in the hosting platform's secret/environment-variable manager. Do not commit credentials to the repository.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the application, session store, and startup migrations. |
| `SESSION_SECRET` | Yes | Secret used to sign session cookies. Use a long, randomly generated value and keep it private. |
| `NODE_ENV` | Production | Set to `production` for deployment. |
| `PORT` | No | Listening port; defaults to `5000`. The hosting platform may provide this value. |
| `HOST` | No | Bind address; defaults to `0.0.0.0`. |
| `ONPREM_MIGRATIONS_DIR` | No | Override for the additive SQL migration directory; defaults to `migrations/onprem`. |
| `CAB_EVENTS_DATABASE_URL` | No | Optional separate PostgreSQL connection for CAB event coordination. If omitted, `DATABASE_URL` is used. |
| `UPDATE_AVAILABLE_VERSION` | No | Optional version shown by the application update-status endpoint. |

The optional `VITEST_TEST_DATABASE_URL` and `CAB_SCHEMA_SYNC_TEST_DATABASE_URL` variables are for isolated test databases only. Never point them at production data.

## Cloud deployment (Replit)

1. Provision PostgreSQL and set `DATABASE_URL` and `SESSION_SECRET` using Replit Secrets.
2. Keep the deployment build and run commands:

   ```sh
   npm run build
   npm run start
   ```

3. The build runs the high-severity dependency audit gate before compiling the client and server. The production server listens on `PORT` (default `5000`) and `0.0.0.0`.
4. At startup, the service runs the additive SQL migrations in `migrations/onprem` before accepting requests. Ensure the database role can create the migration ledger schema/table and apply the migration statements.

Replit's deployment configuration currently targets Autoscale. Set production-only secrets in Publishing settings rather than relying on development secrets. Keep `SESSION_SECRET` consistent across application instances.

## On-premises deployment

Requirements: Node.js 20, npm, PostgreSQL 16 (or a compatible supported version), and the WebSocket-compatible database transport described above. Provide a database user permitted to create the migration ledger and apply schema changes.

1. Install the release and its dependencies:

   ```sh
   npm ci
   ```

2. Configure `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production` in the service manager's protected environment. Set `PORT` and `HOST` only when they differ from their defaults.
3. For a **new, empty database only**, provision the complete baseline schema from the release after testing it in staging:

   ```sh
   npm run db:push
   ```

   Review Drizzle's plan before accepting changes. For an existing production database, use reviewed incremental migrations instead; do not run schema push as an upgrade shortcut.

4. Create or mount persistent `server/uploads` storage, then build and start:

   ```sh
   npm run build
   npm run start
   ```

5. Allow outbound database connectivity from the application host. The service creates its session table if missing and applies startup SQL migrations before serving traffic.
6. Put the service behind an HTTPS reverse proxy. Production session cookies are `Secure`, and the application trusts one proxy hop. Do not expose an untrusted proxy path that can spoof forwarding headers.

Do not start the application against a new database until its baseline Drizzle schema has been provisioned. In development, `npm run db:push` can synchronize `shared/schema.ts` to the configured development database.

## Migration behavior

- Runtime SQL migrations are stored in `migrations/onprem` and applied in filename order at startup.
- The runner records applied filenames and SHA-256 checksums in `onprem_deploy.sql_migrations`, using a PostgreSQL advisory lock to avoid concurrent migration runs.
- Applied migration files are immutable. Add a new file for each schema change.
- The startup runner permits additive `CREATE ... IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and idempotent inserts. It rejects destructive or unsupported statements.
- Startup migrations are separate from Drizzle's development migration history. Review and test a new migration against an isolated PostgreSQL database before deploying it.

## Release checks

Run these commands from the release checkout before deployment:

```sh
npm run audit:security
npm run check
npm test
npm run build
```

PostgreSQL integration tests require an isolated `VITEST_TEST_DATABASE_URL`. Without it, the regular unit suite runs but database-backed integration tests are skipped.

Spreadsheet table reports are generated by the authenticated server export endpoint rather than bundling ExcelJS in the browser. The endpoint accepts up to 10 MB of selected report data, 100,000 rows, and 200 columns, with a limit of 10 exports per minute per client IP.
