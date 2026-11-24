#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_DIR="${RELEASE_DIR:-$PWD}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/assetflow}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT:-5000}/api/health}"
SERVICE_MANAGER="${SERVICE_MANAGER:-systemd}"

for command_name in pg_dump npm curl date; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Required command not found: $command_name" >&2
    exit 1
  }
done
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL must be configured in the service environment." >&2; exit 1; }
[[ -f "$RELEASE_DIR/package.json" && -f "$RELEASE_DIR/dist/index.js" && -f "$RELEASE_DIR/dist/onprem-bootstrap.sql" && -d "$RELEASE_DIR/docs/system-manual" ]] || {
  echo "Run this script from a complete built release containing package.json, dist/index.js, dist/onprem-bootstrap.sql, and docs/system-manual/." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(realpath -- "$BACKUP_DIR")"
RELEASE_DIR="$(realpath -- "$RELEASE_DIR")"
if [[ "$BACKUP_DIR" == "$RELEASE_DIR" || "$BACKUP_DIR" == "$RELEASE_DIR/"* ]]; then
  echo "BACKUP_DIR must be outside the release directory on persistent storage." >&2; exit 1
fi
chmod 700 "$BACKUP_DIR"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
# Reserve an exclusively created, private directory. Even concurrent runs in
# the same second cannot select/overwrite the same dump.
backup_run="$(mktemp -d "$BACKUP_DIR/pre-upgrade-${timestamp}-$$-XXXXXXXX")"
backup_file="$backup_run/database.dump"
[[ ! -e "$backup_file" ]] || { echo "Backup already exists; refusing overwrite." >&2; exit 1; }
service_file="$(mktemp "$BACKUP_DIR/.pgservice-${timestamp}-XXXXXX")"
trap 'rm -f "$service_file"' EXIT
echo "Creating PostgreSQL backup: $backup_file"
node --input-type=module - "$service_file" <<'NODE'
import { writeFileSync } from "node:fs";
const url = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol)) {
  throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
}
const quote = value => `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const host = url.hostname.replace(/^\[|\]$/g, "");
const fields = {
  host,
  port: url.port || "5432",
  dbname: decodeURIComponent(url.pathname.replace(/^\//, "")),
  user: decodeURIComponent(url.username),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  ...Object.fromEntries(["sslmode", "sslrootcert", "sslcert", "sslkey", "application_name"]
    .flatMap(key => url.searchParams.get(key) ? [[key, url.searchParams.get(key)]] : [])),
};
const body = ["[pre_upgrade_backup]", ...Object.entries(fields).map(([key, value]) => `${key}=${quote(value)}`)].join("\n") + "\n";
writeFileSync(process.argv[2], body, { mode: 0o600 });
NODE
( set -o noclobber
  PGSERVICEFILE="$service_file" PGSERVICE=pre_upgrade_backup \
    pg_dump --format=custom > "$backup_file"
)

cd "$RELEASE_DIR"
echo "Installing locked production dependencies..."
npm ci --omit=dev

case "$SERVICE_MANAGER" in
  systemd)
    : "${SYSTEMD_SERVICE:?Set SYSTEMD_SERVICE to the installed systemd unit name}"
    command -v systemctl >/dev/null 2>&1 || { echo "systemctl not found." >&2; exit 1; }
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      systemctl restart "$SYSTEMD_SERVICE"
    else
      sudo systemctl restart "$SYSTEMD_SERVICE"
    fi
    ;;
  pm2)
    : "${PM2_APP:?Set PM2_APP to the configured PM2 process name}"
    command -v pm2 >/dev/null 2>&1 || { echo "pm2 not found." >&2; exit 1; }
    pm2 restart "$PM2_APP" --update-env
    ;;
  docker)
    : "${DOCKER_CONTAINER:?Set DOCKER_CONTAINER to the running application container}"
    command -v docker >/dev/null 2>&1 || { echo "docker not found." >&2; exit 1; }
    docker restart "$DOCKER_CONTAINER"
    ;;
  docker-compose)
    : "${DOCKER_COMPOSE_SERVICE:?Set DOCKER_COMPOSE_SERVICE to the Compose application service name}"
    command -v docker >/dev/null 2>&1 || { echo "docker not found." >&2; exit 1; }
    docker compose up -d --force-recreate --no-deps "$DOCKER_COMPOSE_SERVICE"
    ;;
  *)
    echo "Unsupported SERVICE_MANAGER '$SERVICE_MANAGER'. Choose systemd, pm2, docker, or docker-compose." >&2
    exit 1
    ;;
esac

echo "Waiting for the service to apply startup migrations and become healthy..."
HEALTH_DEADLINE=$((SECONDS + 60))
while (( SECONDS < HEALTH_DEADLINE )); do
  remaining=$((HEALTH_DEADLINE - SECONDS))
  poll_timeout=$((remaining < 5 ? remaining : 5))
  if curl --fail --silent --show-error --connect-timeout 2 --max-time "$poll_timeout" "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Upgrade completed; health endpoint is responding: $HEALTH_URL"
    exit 0
  fi
  (( SECONDS >= HEALTH_DEADLINE )) || sleep 1
done

echo "Health check failed after restart. Backup retained at: $backup_file" >&2
case "$SERVICE_MANAGER" in
  systemd)
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      systemctl status "$SYSTEMD_SERVICE" --no-pager || true
    else
      sudo systemctl status "$SYSTEMD_SERVICE" --no-pager || true
    fi
    ;;
  pm2) pm2 logs "$PM2_APP" --lines 100 --nostream || true ;;
  docker) docker logs --tail 100 "$DOCKER_CONTAINER" || true ;;
  docker-compose) docker compose logs --tail 100 "$DOCKER_COMPOSE_SERVICE" || true ;;
esac
exit 1
