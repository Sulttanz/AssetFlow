# Production Deployment Guide

This application runs as a Node.js service backed by PostgreSQL. The web client is built with Vite and served by the Express server in production.

## Database and file-storage prerequisites

The current database adapter in `server/db.ts` is `@neondatabase/serverless` over WebSockets. Use a compatible hosted endpoint. A conventional on-premises PostgreSQL TCP URL alone is **not** sufficient with this adapter; provide a compatible WebSocket proxy or validate a `pg`/Drizzle adapter migration before installing against plain PostgreSQL.

Current attachment handlers write to `server/uploads`. Replit production filesystems are not persistent across publishes, and local files are not shared between Autoscale instances. Before relying on uploads in cloud production, move these handlers to durable shared object storage. On-premises installations must mount and back up `server/uploads` on persistent storage with write access for the service account.

## Diagnosing API errors

Unexpected route failures are logged server-side with the original exception and a
reference ID. Error responses include `message`, `code`, and `requestId`; use the
reference ID to find the corresponding server log. SQL statements, database
connection details, and stack traces are not returned to the browser.

Employee number/email conflicts return HTTP 409 with `DUPLICATE_EMPLOYEE_ID` or
`DUPLICATE_EMPLOYEE_EMAIL`. Invalid employee payloads return HTTP 400 with
field-level `errors`. Database outages/timeouts return HTTP 503; schema mismatches
return `DATABASE_SCHEMA_ERROR` and require administrator investigation. Do not
remove uniqueness constraints or delete employee records to work around a conflict.

## Required environment

Set these values in the hosting platform's secret/environment-variable manager. Do not commit credentials to the repository.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the application, session store, and startup migrations. |
| `SESSION_SECRET` | Yes | Secret used to sign session cookies. Use a long, randomly generated value of at least 32 characters and keep it private; startup fails if it is missing or shorter. |
| `NODE_ENV` | Production | Set to `production` for deployment. |
| `APP_ALLOWED_ORIGINS` | No | Comma-separated exact browser origins trusted for cross-origin API writes. Same-origin requests need no entry. |
| `PORT` | No | Listening port; defaults to `5000`. The hosting platform may provide this value. |
| `HOST` | No | Bind address; defaults to `0.0.0.0`. |
| `ONPREM_MIGRATIONS_DIR` | No | Override for the additive SQL migration directory; defaults to `migrations/onprem`. |
| `CAB_EVENTS_DATABASE_URL` | No | Optional separate PostgreSQL connection for CAB event coordination. If omitted, `DATABASE_URL` is used. |
| `UPDATE_AVAILABLE_VERSION` | No | Optional explicit update-version override. Takes precedence over GitHub checks. |
| `GITHUB_RELEASE_API_URL` | No | Optional HTTPS GitHub REST API URL for a latest release, e.g. `/repos/OWNER/REPO/releases/latest`. |
| `RELEASE_REPO_URL` | No | Optional public GitHub repository URL; used to check its latest Git tag when no API URL or override is set. |
| `SELF_HOSTED_UPDATE_BACKUP_CHECK_SCRIPT` | No | Absolute executable that creates and verifies the pre-update backup. |
| `SELF_HOSTED_UPDATE_SCRIPT` | No | Trusted executable that fetches/stages the selected tag and installs/builds it without restarting the service. |
| `SELF_HOSTED_UPDATE_RESTART_SCRIPT` | No | Trusted executable that activates the staged release and triggers a detached service restart. |

The optional `VITEST_TEST_DATABASE_URL` and `CAB_SCHEMA_SYNC_TEST_DATABASE_URL` variables are for isolated test databases only. Never point them at production data.

## Update checks and release publishing

The administrator-only `GET /api/system/update-check` endpoint checks sources in this
order: `UPDATE_AVAILABLE_VERSION`, `GITHUB_RELEASE_API_URL`, then `RELEASE_REPO_URL`.
GitHub requests are made server-side with a short timeout. Unset, invalid, offline, or
unreachable sources return a safe `source: "none"` status and do not interrupt startup.
The response includes only current/latest versions, comparison result, source kind,
timestamp, and a general status message—not configured repository URLs or credentials.
GitHub release checks currently use public releases/tags.

On Replit, the GitHub check does not fetch source code or deploy it. Republish builds the
current project; after startup, that installed version is recorded in `app_release_history`.
For on-premises releases, use the operator workflow in [DEPLOY_ONPREM.md](DEPLOY_ONPREM.md).

On an empty installation, visit `/initialize` and create the first administrator account with a unique username and a strong password. The server validates the credentials, hashes the password, rate-limits attempts, and disables first-run initialization as soon as an account exists. No preset administrator credentials are used or displayed.

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

To publish a release, bump `version` in `package.json`, commit and tag it in Git as
`vX.Y.Z`, then click **Republish**. Republish builds the deployed bundle; the new instance
records the installed version in `app_release_history`.

The admin-only **Apply Update** action detects `REPLIT_DEPLOYMENT=1` and returns
`republish_required` when a newer version is available. It does not run local update scripts
or claim that the published deployment changed. A Replit workspace is also prevented from
using self-hosted scripts.

For self-hosted production, Apply Update runs only when all three script paths above point
to absolute executable files that are not group/world writable. The backup-check adapter
must create and verify a fresh backup and exit successfully. The release adapter receives
the checked tag as its only argument and in `UPDATE_TARGET_VERSION`; it must fetch/checkout
and stage that version, install/build it, and not restart the running service. Then the
restart adapter is launched detached to activate the staged release and restart systemd,
PM2, or the container service. Startup migrations run before the new server accepts
traffic, and the installed version is recorded in `app_release_history`. Use deployment-
specific scripts reviewed by operations; arbitrary shell strings, repository URLs, script
paths, and credentials are never supplied by or returned to the client.

Apply attempts and transitions are audited, concurrent runs are blocked by a database lock,
and status is persisted in `system_update_jobs`. `GET /api/system/update/status` is
administrator-only. Clear All System Data preserves this update-status history.

## On-premises deployment

For the future Docker-based Nginx/ModSecurity migration, use the complete [on-premises deployment bundle](deployment/onprem/README.md). These saved files do not change the current Replit deployment.

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

## OWASP CRS, application defenses, and edge WAF

The application adds a production Content-Security-Policy, same-origin framing and MIME-sniffing protections, a strict referrer policy, and HSTS for secure production requests. Development CSP permits Vite's inline React Refresh preamble and Replit workspace framing; these exceptions are not present in the production policy. Mutating `/api` requests are checked against their browser `Origin` (or `Referer` fallback); session cookies are HttpOnly and already use `SameSite=Strict`. Login attempts are limited to 10 per 15 minutes per IP. Data migration routes are limited to 30 requests per 15 minutes, and the destructive clear-data route to 2 requests per 15 minutes. Security denials and rate limits are recorded in `audit_logs` with a rule ID, time, actor when signed in, IP, user agent, method, and path; request bodies, credentials, cookies, and query strings are not copied into these records or application request logs. Repeated events from the same IP/rule are coalesced for one minute, with bounded in-memory keys, to prevent the audit sink itself becoming a denial-of-service target.

The server uses parameterized Drizzle queries for database input, React's escaped text rendering, bounded JSON/form bodies, upload-size and extension checks, server-generated upload names, and resolved-path checks before downloads. Its stored-content paths should continue to avoid raw HTML rendering and shell execution.

In development verification, a direct loopback login emitted `HttpOnly; SameSite=Strict` without `Secure`, while the public preview path emitted `HttpOnly; Secure; SameSite=None`. The browser stored the public response's attributes. This demonstrates a preview-path difference, not a different cookie setting in the application; the exact intermediary was not identified. Do not infer deployed cookie flags solely from source configuration. Verify the published HTTPS response independently and retain the API origin checks even when the application configures Strict cookies.

**Important deployment boundary:** OWASP CRS is a ruleset for a compatible ModSecurity/Coraza web application firewall; it is not an Express middleware package. No CRS-capable engine or provider integration is configured or verifiable from this workspace. This audit does not establish what protections the hosting platform may independently provide. The Express audit log cannot see requests rejected before they reach the application, so application middleware is defense-in-depth, **not proof that CRS is active**.

For an on-premises deployment, install a supported ModSecurity v3 Nginx connector and a maintained OWASP CRS release at the HTTPS ingress. Start with the provided `deployment/owasp-crs/modsecurity-crs.conf` and `deployment/owasp-crs/nginx-location.conf`, adjusting installed CRS paths and proxy/TLS settings for the host. Set `HOST=127.0.0.1` so the app is reachable only through the local WAF. Use the same trusted proxy hop assumed by Express; do not expose the Node port directly.

Test in staging with the actual application workflows and CRS in detection mode before switching to blocking mode. Tune only documented, narrow false-positive exclusions, then verify the running edge reports blocking mode and records CRS rule IDs. Keep WAF log retention/access controlled and keep bodies, cookies, authorization headers, and query strings out of request audit logs. Forward edge blocks through the organization's approved log pipeline if they must also appear in the application audit view. For Replit or another managed deployment, a separate, externally managed edge WAF must be configured and verified; no CRS enforcement at that edge is enabled by these application changes.
