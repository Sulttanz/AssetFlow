# Future on-premises deployment: Docker + Nginx/ModSecurity + OWASP CRS

## Status and scope

The application remains on Replit today. These files are saved for the later on-premises migration; they do not change Replit workflows, publish an app, install Docker here, or activate a live WAF. Container builds, `nginx -t`, and real CRS enforcement must be validated on the target host or CI before migration.

Two supported configuration paths are supplied:

- **Containers:** this directory builds the existing application and puts the official Nginx/ModSecurity/CRS image in front of it. `compose.json` is JSON-formatted Docker Compose configuration, accepted by Compose's YAML parser; use the explicit `-f` commands below.
- **Existing host-managed Nginx:** use [`../owasp-crs/README.md`](../owasp-crs/README.md) and its native ModSecurity examples. Do not copy their distribution-specific include paths into the official container image.

Traffic is `client → TLS Nginx/ModSecurity/CRS → app:5000 → existing compatible database`. Only the WAF publishes host ports 80/443. The application runs non-root, has a read-only root filesystem, and writes uploads to a persistent bind mount. Its Docker network permits outbound database connectivity; it is intentionally not an `internal: true` network.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage application build, existing dependency-audit gate, non-root runtime, health check. |
| `compose.json` | Private app service and official CRS ingress; persistent uploads/logs and read-only TLS mounts. |
| `nginx/default.conf.template` | HTTP redirect, HTTPS proxy, trusted forwarding headers, SSE-friendly buffering/timeouts, 30 MB ingress ceiling. |
| `nginx/logging.conf.template` | JSON access logs without query strings, Referer, cookies or authorization headers. |
| `deployment.env.example` | Non-secret deployment settings and host paths; copy outside the repository. |
| `app.env.example` | Empty secret/configuration placeholders, not actual credentials. |
| `../owasp-crs/app-crs-exclusions.conf` | Initially empty, reviewed CRS exclusions loaded before the main rules. |

The runtime intentionally retains the audited build dependency tree. The current bundled server statically imports Vite and its plugin configuration even in production. **Do not use `npm prune --omit=dev` or swap in production-only node_modules** until that import graph is separated and a production cold start is verified.

## 1. Prepare the target host and immutable images

Use a supported Linux Docker Engine and Docker Compose v2 with `--wait` and bind `create_host_path` support. Reserve ports 80/443, configure the production DNS name, and obtain an organization-approved TLS certificate/full chain and key. Apply the host firewall and Docker network policy so no alternate route exposes the app.

Choose a maintained official **Nginx** CRS image from the [upstream project](https://github.com/coreruleset/modsecurity-crs-docker). Pin `CRS_IMAGE` to its approved digest, not a floating tag. Also pin `NODE_IMAGE` to an approved Node 22 Debian image digest for production; the example tag is only a build starting point. Review the image's engine/CRS versions, compatibility, advisories, and health check before promotion.

The official image currently generates Nginx configuration from `/etc/nginx/templates/`; this bundle mounts templates rather than files that its entrypoint would overwrite. Its unprivileged listener ports are 8080/8443, mapped to host 80/443. It loads `/etc/modsecurity.d/setup.conf` itself. Confirm these paths and behavior against the **pinned** release when upgrading.

## 2. Provision paths, permissions, TLS, and secrets

Copy `deployment.env.example` to a protected path such as `/srv/it-governance/deployment.env`, and `app.env.example` to `/srv/it-governance/secrets/app.env`. Populate them through the organization's secret manager. Never commit real files, include credentials in image build arguments, or print rendered Compose configuration into logs.

- `DATABASE_URL`: the current **normal runtime uses `@neondatabase/serverless` over WebSockets**. A plain on-premises PostgreSQL TCP URL is not sufficient. Retain a compatible hosted endpoint or provision and validate a compatible WebSocket database gateway. A native `pg` adapter migration is separate application work; this bundle does not silently switch the database.
- `SESSION_SECRET`: a long random secret; preserve it across replicas/releases when retaining sessions. Do not reuse example values.
- `APP_ALLOWED_ORIGINS`: normally empty because the UI and API share one HTTPS origin. If needed, specify only explicit approved origins.
- `SERVER_NAME`: the real public DNS hostname, without scheme or port.
- `UPLOADS_DIR`, `WAF_LOG_DIR`, TLS file paths: existing absolute host paths.

Create and back up the directories before starting. The app's Node user is UID/GID 1000; uploads must be writable by that identity. Determine the WAF user/group from the chosen image, for example with `docker run --rm --entrypoint id "$CRS_IMAGE"` on the target host. Give it read access to the TLS chain/key and write access to the restricted WAF log directory. Keep the private key non-world-readable and environment files mode 0600 or equivalent ACLs. Do not use `chmod 777`. The manifest refuses to create missing bind paths automatically.

The container app must bind `0.0.0.0` on its private network; this is **different** from the host-managed Nginx example, where Node binds `127.0.0.1`. Neither path should publish a direct app port.

## 3. Database baseline, migration, and backups

Before cutover, take a consistent database backup and an uploads backup. Preserve users, roles, configuration, business history, and the `onprem_deploy.sql_migrations` filename/checksum ledger. Restore a copy to staging and verify it before touching the live installation. The Data Migration Center's business-record imports are not a substitute for a full database migration.

- **Restored/existing database:** do not run `db:push` as an upgrade shortcut. Startup applies only the reviewed additive `migrations/onprem` files and checks their ledger.
- **New empty database only:** provision the full Drizzle baseline in staging first. The optional build stage contains the schema tooling:

  ```sh
  # Run from the repository root, on the target host/CI.
  docker build --target build -f deployment/onprem/Dockerfile \
    --build-arg NODE_IMAGE="$NODE_IMAGE" -t it-governance-schema-tools .
  # Only against the explicitly selected NEW EMPTY database:
  docker run --rm -it --env-file /srv/it-governance/secrets/app.env \
    it-governance-schema-tools npm run db:push
  ```

Review Drizzle's plan interactively; do not add `--force` or automate a baseline against an existing database. The database role needs the migration permissions described in [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md). No PostgreSQL service or destructive initialization job is included in Compose.

## 4. Build and preflight on the target host

Run from the repository root. Replace the protected environment file path if needed:

```sh
docker compose --env-file /srv/it-governance/deployment.env \
  -f deployment/onprem/compose.json config --quiet
docker compose --env-file /srv/it-governance/deployment.env \
  -f deployment/onprem/compose.json build app
docker compose --env-file /srv/it-governance/deployment.env \
  -f deployment/onprem/compose.json up -d --wait app
docker compose --env-file /srv/it-governance/deployment.env \
  -f deployment/onprem/compose.json run --rm --no-deps waf nginx -t
docker compose --env-file /srv/it-governance/deployment.env \
  -f deployment/onprem/compose.json up -d --wait
```

Use `config --quiet`, not plain `config`, because rendering configuration can expose environment-file secrets. Never bypass the application's build-time dependency security gate.

Start in an isolated staging environment. Temporarily set `WAF_RULE_ENGINE=DetectionOnly` **there** to review false positives from technical ticket text, KB content, uploads, imports and exports. Production must use `On`; `Off` is not an acceptable release setting. The template defaults to `On` with CRS paranoia level 1. Scope any exclusions to specific rule IDs/paths and document the business reason; do not exempt all `/api` traffic.

## 5. Release acceptance checks

- `docker compose ... exec waf nginx -t` succeeds after startup, both services are healthy, TLS validates without `curl -k`, and HTTP redirects to the approved HTTPS hostname.
- Public clients can reach only ingress ports; app port 5000 is not published.
- A normal sign-in/logout cycle, role restrictions, API writes, file upload/download, migration preview/import in staging, spreadsheet export, and CAB event streaming work through the WAF.
- Verify CSP, framing protection, `nosniff`, referrer policy and HSTS on the public HTTPS response. Inspect cookie **attributes only**: production should deliver HttpOnly/Secure/Strict. The Replit preview path was observed to change cookie attributes, so source configuration is not proof of the final public response.
- A controlled CRS test corpus on the owned **staging** endpoint is blocked by the actual edge engine with recorded rule IDs. App-only Origin rejection is not proof of CRS activity.
- Test the 20 MB attachment and 10 MB report-JSON contracts; the WAF's total request-body ceiling is 30 MB. Keep the existing smaller endpoint-specific limits.
- Confirm DB migrations/checksums, restored record counts, historical files and authorization after cutover. Keep the old deployment available until acceptance.

## 6. Logs, retention, and central audit integration

Access logs use escaped JSON with IP, timestamp, method, path, status, request ID and user agent; they omit query strings and sensitive headers. Docker stdout logs rotate at 10 MB × 5 files per service. **Bind-mounted WAF audit/error files require separate host retention/rotation** before production.

`AHZ` reduces audit exposure by omitting request/response headers and bodies, but ModSecurity/CRS **matched-rule messages can still contain matched input**. Treat raw WAF audit/error files as restricted sensitive evidence. Apply tested field redaction before forwarding them to a central audit system; do not ship raw lines into an employee-visible UI or claim they are guaranteed credential-free. Keep debug logging at 0.

The application logs its own blocked API requests. Requests rejected at Nginx never reach Express. Their appearance in System Audit Logs needs an approved authenticated, replay-resistant log-ingestion pipeline; that pipeline is not implemented or enabled by these deployment templates.

## 7. Upgrade, recovery, and remaining validation

Promote immutable source/image versions, snapshot the database and uploads together, and review migrations before every upgrade. Preserve mounted uploads, secrets, TLS material, and restricted logs across container replacement. Do not delete data directories or run destructive reset operations as a deployment step. Reverting an image is not a database rollback; use the approved matching backup/restore plan if data/schema compatibility requires it.

No Docker daemon or target Nginx/CRS runtime was used in Replit for this bundle. Repository validation checks configuration structure and application type safety only. A real image build, complete Nginx validation, staged CRS corpus, restore rehearsal, and operator sign-off remain mandatory on the eventual host.
