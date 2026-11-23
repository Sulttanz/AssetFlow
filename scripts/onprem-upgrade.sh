#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_DIR="${RELEASE_DIR:-$PWD}"
BACKUP_DIR="${BACKUP_DIR:-$RELEASE_DIR/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT:-5000}/api/health}"
SERVICE_MANAGER="${SERVICE_MANAGER:-systemd}"

for command_name in pg_dump npm curl date; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Required command not found: $command_name" >&2
    exit 1
  }
done
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL must be configured in the service environment." >&2; exit 1; }
[[ -f "$RELEASE_DIR/package.json" && -f "$RELEASE_DIR/dist/index.js" ]] || {
  echo "Run this script from a staged release directory containing package.json and dist/index.js." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/pre-upgrade-${timestamp}.dump"
echo "Creating PostgreSQL backup: $backup_file"
pg_dump --format=custom --file="$backup_file" "$DATABASE_URL"

cd "$RELEASE_DIR"
echo "Installing locked production dependencies..."
npm ci --omit=dev

case "$SERVICE_MANAGER" in
  systemd)
    : "${SYSTEMD_SERVICE:?Set SYSTEMD_SERVICE to the installed systemd unit name}"
    command -v systemctl >/dev/null 2>&1 || { echo "systemctl not found." >&2; exit 1; }
    sudo systemctl restart "$SYSTEMD_SERVICE"
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
  *)
    echo "Unsupported SERVICE_MANAGER '$SERVICE_MANAGER'. Choose systemd, pm2, or docker." >&2
    exit 1
    ;;
esac

echo "Waiting for the service to apply startup migrations and become healthy..."
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Upgrade completed; health endpoint is responding: $HEALTH_URL"
    exit 0
  fi
  sleep 2
done

echo "Health check failed after restart. Backup retained at: $backup_file" >&2
case "$SERVICE_MANAGER" in
  systemd) sudo systemctl status "$SYSTEMD_SERVICE" --no-pager || true ;;
  pm2) pm2 logs "$PM2_APP" --lines 100 --nostream || true ;;
  docker) docker logs --tail 100 "$DOCKER_CONTAINER" || true ;;
esac
exit 1
