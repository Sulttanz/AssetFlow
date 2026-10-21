# Production Deployment Guide

This application runs as a Node.js service backed by PostgreSQL. The web client is built with Vite and served by the Express server in production.

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

Replit's deployment configuration currently targets Autoscale. Set production-only secrets in the deployment environment rather than relying on development secrets.

## On-premises deployment

Requirements: Node.js 20, npm, and PostgreSQL 16 (or a compatible supported PostgreSQL version). Provide a database and a database user permitted to create the migration ledger and apply schema changes.

1. Install the release and its dependencies:

   ```sh
   npm ci
   ```

2. Configure `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production` in the service manager's protected environment. Set `PORT` and `HOST` only when they differ from their defaults.
3. Build and start:

   ```sh
   npm run build
   npm run start
   ```

4. Allow outbound database connectivity from the application host. The service creates its session table if missing and applies startup SQL migrations before serving traffic.

Do not run the application against a production database until its baseline Drizzle schema has been provisioned. In development, `npm run db:push` can synchronize `shared/schema.ts` to the configured development database; do not use it as an ad hoc production migration command.

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
