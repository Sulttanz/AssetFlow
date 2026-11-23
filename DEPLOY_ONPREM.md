# On-Premises Upgrade Runbook

This runbook upgrades a staged, built release on a Linux host. The application applies its
allowlisted, additive SQL migrations during startup, before it accepts application traffic.
The upgrade script takes a PostgreSQL backup, installs the release's locked production
dependencies, restarts the selected process manager, and waits for the database-backed
`GET /api/health` readiness check.

## Prerequisites

- PostgreSQL client utilities (`pg_dump`) compatible with the database server.
- Node.js/npm versions supported by this release, `curl`, and an installed process manager.
- The release artifact staged in its final directory, including `package.json`,
  `package-lock.json`, `dist/index.js`, static assets, `migrations/onprem/`, and
  `docs/system-manual/`.
- A service environment file or secrets manager that provides `DATABASE_URL` and a
  `SESSION_SECRET` of at least 32 characters. Do not put secrets in this repository or
  shell command arguments.
- PostgreSQL credentials must permit reading the database for backup and applying the
  application's additive migrations.

## Upgrade

1. Stage the release artifact and verify it corresponds to the intended release.
2. Set `RELEASE_DIR`, `BACKUP_DIR`, and the service-manager settings below. Provide
   `DATABASE_URL` to the upgrade process from the organization's secret manager or a
   restricted operator environment; the running service separately receives
   `DATABASE_URL`, `SESSION_SECRET`, and other production settings from its secure service
   configuration. The script writes a mode-600 temporary PostgreSQL service file for
   `pg_dump` so the connection password is not placed in the `pg_dump` command line.
3. Run `scripts/onprem-upgrade.sh` as an operator authorized to create database backups
   and restart the application service. The script:
   - creates a UTC-timestamped custom-format `pg_dump` backup with owner-only file
     permissions before changing dependencies or restarting;
   - runs `npm ci --omit=dev` from the staged release;
   - restarts the chosen systemd, PM2, or Docker process;
   - waits up to 60 seconds for `/api/health` to confirm the application connected to
     PostgreSQL and completed startup migrations.
4. If health checks fail, inspect service logs and leave the backup in place. Restore a
   backup only under the organization's approved recovery procedure; restoring overwrites
   database changes made after the backup.

### systemd (default)

```sh
export RELEASE_DIR=/opt/it-platform/current
export BACKUP_DIR=/var/backups/it-platform
export SERVICE_MANAGER=systemd
export SYSTEMD_SERVICE=it-platform.service
scripts/onprem-upgrade.sh
```

Run the script as the deployment operator with write access to the release and backup
directories plus narrowly scoped `sudo` permission to restart/check the unit. The service
unit should load secrets using `EnvironmentFile=` or a systemd credentials mechanism. Do
not place secret values in command arguments.

### PM2

```sh
export RELEASE_DIR=/opt/it-platform/current
export BACKUP_DIR=/var/backups/it-platform
export SERVICE_MANAGER=pm2
export PM2_APP=it-platform
scripts/onprem-upgrade.sh
```

Configure the PM2 ecosystem/service environment securely so the app receives its
database and session settings after `--update-env`.

### Docker

For a pre-created container running the staged release (for example, with the release
directory bind-mounted into the container):

```sh
export RELEASE_DIR=/opt/it-platform/current
export BACKUP_DIR=/var/backups/it-platform
export SERVICE_MANAGER=docker
export DOCKER_CONTAINER=it-platform
scripts/onprem-upgrade.sh
```

For Compose-managed deployments, build/stage the new image and update the Compose release
first, then use the Compose restart mode so the new image is recreated:

```sh
export RELEASE_DIR=/opt/it-platform/current
export BACKUP_DIR=/var/backups/it-platform
export SERVICE_MANAGER=docker-compose
export DOCKER_COMPOSE_SERVICE=app
scripts/onprem-upgrade.sh
```

Persist PostgreSQL backups outside ephemeral containers and configure application secrets
through the deployment secret store.

## Migration and seed safety

- Startup migrations use the `onprem_deploy.sql_migrations` ledger, verify migration
  checksums, serialize concurrent instances, and reject unsupported/destructive SQL.
- Default catalog synchronization inserts missing built-in records but does not replace
  tenant records. System Manual synchronization uses stable source slugs, versions changed
  repository content, and leaves unchanged guides untouched.
- Permission/role synchronization adds missing standard permission mappings; it does not
  overwrite users or user-role assignments. This upgrade process does not run sample-data
  seeders or a data-clear/reset operation.
- The readiness endpoint returns only a health status and HTTP 503 when the database is
  unavailable; it does not disclose connection details.

The administrator-only in-app **Check for Updates** action checks
`UPDATE_AVAILABLE_VERSION` first, then a configured `GITHUB_RELEASE_API_URL` or
`RELEASE_REPO_URL`. It reports version status only; it does not download or install code.
After reviewing a release, the on-premises operator stages and applies it with this
runbook. GitHub checks use public release/tag information and never return the configured
repository URL or credentials to the client.
