#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_URL="https://github.com/Sulttanz/AssetFlow.git"
APP_DIR="${APP_DIR:-/opt/assetflow}"
APP_DB_NAME="${APP_DB_NAME:-}"
APP_DB_USER="${APP_DB_USER:-}"
APP_PORT="${PORT:-}"
ENABLE_HTTPS="${ENABLE_HTTPS:-false}"
case "$ENABLE_HTTPS" in
  true|false) ;;
  *) echo "ENABLE_HTTPS must be true or false." >&2; exit 1 ;;
esac
SYSTEMD_UNIT="/etc/systemd/system/assetflow.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root, for example: curl ... | sudo bash" >&2
  exit 1
fi
if [[ "$APP_DIR" != /* || "$APP_DIR" == *[[:space:]]* ]]; then
  echo "APP_DIR must be an absolute path without whitespace." >&2
  exit 1
fi
# Resolve before any root-owned recursive operation. Reject symlinks in every
# existing path component unless the operator explicitly opts into resolution.
RAW_APP_DIR="$APP_DIR"
APP_DIR="$(realpath -m -- "$APP_DIR")"
case "$APP_DIR" in
  /opt/?*|/srv/?*) ;;
  *) echo "APP_DIR must be a dedicated directory below /opt or /srv, never a system root." >&2; exit 1 ;;
esac
if [[ ! "$APP_DIR" =~ ^/[a-zA-Z0-9_./-]+$ ]]; then
  echo "APP_DIR contains unsupported path characters." >&2; exit 1
fi
if [[ "${ALLOW_SYMLINK_APP_DIR:-0}" != "1" ]]; then
  path_component="$RAW_APP_DIR"
  while [[ "$path_component" != "/" && "$path_component" != "." ]]; do
    if [[ -L "$path_component" ]]; then
      echo "Symlinked APP_DIR components are not allowed; use the canonical path or explicitly set ALLOW_SYMLINK_APP_DIR=1." >&2
      exit 1
    fi
    path_component="$(dirname -- "$path_component")"
  done
fi
ENV_FILE="${APP_DIR}/.env"
if [[ ! -r /etc/os-release ]]; then
  echo "Cannot identify the operating system; this installer supports Ubuntu and Debian." >&2
  exit 1
fi
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
  echo "Unsupported operating system: ${ID:-unknown}. Use Ubuntu or Debian." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
# Remove stale NodeSource entries before apt-get update: a broken legacy source
# can make apt fail before the installer gets a chance to repair it.
rm -f \
  /etc/apt/sources.list.d/nodesource*.list \
  /etc/apt/sources.list.d/nodesource*.sources \
  /etc/apt/keyrings/nodesource*.gpg \
  /usr/share/keyrings/nodesource*.gpg
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git build-essential postgresql postgresql-contrib \
  openssl sudo iproute2

# Keep an already-installed supported Node.js LTS. Otherwise configure the
# signed NodeSource Node 22 repository and install/upgrade nodejs from it.
NODE_LTS_INSTALLED=false
if command -v node >/dev/null 2>&1; then
  INSTALLED_NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
  INSTALLED_NODE_LTS="$(node -p 'process.release.lts || ""')"
  if [[ "$INSTALLED_NODE_MAJOR" -ge 22 && -n "$INSTALLED_NODE_LTS" ]]; then
    NODE_LTS_INSTALLED=true
  fi
fi

if [[ "$NODE_LTS_INSTALLED" == "true" ]]; then
  echo "Keeping installed Node.js LTS $(node --version); skipping NodeSource setup."
else
  # Ensure no stale list/keyring remains before the supported setup script runs.
  rm -f \
    /etc/apt/sources.list.d/nodesource*.list \
    /etc/apt/sources.list.d/nodesource*.sources \
    /etc/apt/keyrings/nodesource*.gpg \
    /usr/share/keyrings/nodesource*.gpg
  curl --fail --silent --show-error --location https://deb.nodesource.com/setup_22.x \
    | bash -
  apt-get update
  apt-get install -y --no-install-recommends nodejs
fi

for tool in git curl psql openssl node npm systemctl runuser; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Required command is unavailable after package installation: $tool" >&2
    exit 1
  }
done

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
NODE_LTS="$(node -p 'process.release.lts || ""')"
if [[ "$NODE_MAJOR" -lt 22 || -z "$NODE_LTS" ]]; then
  echo "A supported Node.js LTS version 22 or newer is required; found $(node --version)." >&2
  exit 1
fi

systemctl enable --now postgresql
if ! id assetflow >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/assetflow --create-home \
    --shell /usr/sbin/nologin assetflow
else
  getent group assetflow >/dev/null 2>&1 || groupadd --system assetflow
  usermod --home /var/lib/assetflow --gid assetflow --shell /usr/sbin/nologin assetflow
fi
install -d -o assetflow -g assetflow -m 0750 /var/lib/assetflow

if [[ -d "$APP_DIR/.git" ]]; then
  CURRENT_ORIGIN="$(git -C "$APP_DIR" remote get-url origin)"
  case "$CURRENT_ORIGIN" in
    https://github.com/Sulttanz/AssetFlow|https://github.com/Sulttanz/AssetFlow.git|git@github.com:Sulttanz/AssetFlow.git)
      ;;
    *)
      echo "Refusing to update $APP_DIR: origin is not the expected AssetFlow repository." >&2
      exit 1
      ;;
  esac

  LOCAL_CHANGES="$(git -C "$APP_DIR" status --porcelain --untracked-files=all \
    | awk '$2 != ".env" && $2 !~ /^\.env\./ { print }')"
  if [[ -n "$LOCAL_CHANGES" ]]; then
    echo "Refusing to pull over local changes in $APP_DIR. Save or remove them first." >&2
    exit 1
  fi
  git -C "$APP_DIR" fetch --tags origin
  git -C "$APP_DIR" remote set-head origin --auto >/dev/null 2>&1 || true
  DEFAULT_BRANCH="$(git -C "$APP_DIR" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)"
  DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
  if git -C "$APP_DIR" show-ref --verify --quiet "refs/heads/$DEFAULT_BRANCH"; then
    git -C "$APP_DIR" checkout "$DEFAULT_BRANCH"
  else
    git -C "$APP_DIR" checkout --track -b "$DEFAULT_BRANCH" "origin/$DEFAULT_BRANCH"
  fi
  git -C "$APP_DIR" pull --ff-only origin "$DEFAULT_BRANCH"
elif [[ -e "$APP_DIR" && -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  echo "$APP_DIR exists but is not an AssetFlow Git checkout; refusing to overwrite it." >&2
  exit 1
else
  install -d -o assetflow -g assetflow -m 0755 "$APP_DIR"
  git clone "$REPOSITORY_URL" "$APP_DIR"
fi

# Keep the running process from using files while the deployment is rebuilt.
systemctl stop assetflow.service >/dev/null 2>&1 || true

if [[ -L "$ENV_FILE" ]]; then
  echo "Refusing to use a symlinked .env file." >&2
  exit 1
fi
chown root:assetflow "$APP_DIR"
chmod 0750 "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.env*' -exec chown -R root:assetflow {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type d -exec chmod 0750 {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type f -perm /111 -exec chmod 0750 {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type f ! -perm /111 -exec chmod 0640 {} +
if [[ -f "$ENV_FILE" ]]; then
  chown root:root "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
fi

read_env_value() {
  local key="$1"
  if [[ -f "$ENV_FILE" ]]; then
    node "$APP_DIR/scripts/onprem-env.mjs" read "$ENV_FILE" "$key"
  fi
}

APP_DB_NAME="${APP_DB_NAME:-$(read_env_value ASSETFLOW_DB_NAME)}"
APP_DB_NAME="${APP_DB_NAME:-assetflow}"
APP_DB_USER="${APP_DB_USER:-$(read_env_value ASSETFLOW_DB_USER)}"
APP_DB_USER="${APP_DB_USER:-assetflow_app}"
APP_PORT="${APP_PORT:-$(read_env_value PORT)}"
APP_PORT="${APP_PORT:-5000}"
APP_TRUST_PROXY="${TRUST_PROXY:-$(read_env_value TRUST_PROXY)}"
APP_TRUST_PROXY="${APP_TRUST_PROXY:-loopback}"
APP_COOKIE_SECURE="${COOKIE_SECURE:-$(read_env_value COOKIE_SECURE)}"
APP_COOKIE_SECURE="${APP_COOKIE_SECURE:-auto}"
APP_COOKIE_SECURE="${APP_COOKIE_SECURE,,}"
if [[ "$ENABLE_HTTPS" == "true" ]]; then
  APP_HOST="${HOST:-127.0.0.1}"
  if [[ "$APP_HOST" != "127.0.0.1" && "$APP_HOST" != "0.0.0.0" ]]; then
    echo "The host-native HTTPS proxy requires HOST=127.0.0.1 or HOST=0.0.0.0." >&2; exit 1
  fi
else
  APP_HOST="${HOST:-$(read_env_value HOST)}"
  APP_HOST="${APP_HOST:-0.0.0.0}"
fi
if [[ ! "$APP_TRUST_PROXY" =~ ^[a-zA-Z0-9.,:/[:space:]-]+$ || "$APP_TRUST_PROXY" == *$'\n'* || "$APP_TRUST_PROXY" == *$'\r'* ]]; then
  echo "TRUST_PROXY must be a boolean, hop count, or comma-separated IP/CIDR list." >&2; exit 1
fi
case "$APP_COOKIE_SECURE" in
  auto|true|false) ;;
  *) echo "COOKIE_SECURE must be auto, true, or false." >&2; exit 1 ;;
esac
if [[ ! "$APP_HOST" =~ ^[a-zA-Z0-9.:-]+$ ]]; then
  echo "HOST must be a valid single hostname/IP binding." >&2; exit 1
fi
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

DB_PASSWORD="$(read_env_value ASSETFLOW_DB_PASSWORD)"
GENERATED_DB_PASSWORD=false
if [[ -z "$DB_PASSWORD" ]]; then
  if [[ -n "$(read_env_value DATABASE_URL)" ]]; then
    echo "Existing DATABASE_URL has no ASSETFLOW_DB_PASSWORD; refusing to replace database credentials. Restore the installer-managed values first." >&2
    exit 1
  fi
  DB_PASSWORD="$(openssl rand -hex 32)"
  GENERATED_DB_PASSWORD=true
fi
SESSION_SECRET="$(read_env_value SESSION_SECRET)"
if [[ -z "$SESSION_SECRET" ]]; then
  SESSION_SECRET="$(openssl rand -hex 48)"
elif [[ "${#SESSION_SECRET}" -lt 32 ]]; then
  echo "Existing SESSION_SECRET is too short; correct it explicitly instead of silently rotating sessions." >&2
  exit 1
fi
if [[ "$SESSION_SECRET" == *$'\n'* || "$SESSION_SECRET" == *$'\r'* ]]; then
  echo "SESSION_SECRET must be a single-line value." >&2
  exit 1
fi
SESSION_SECRET_ENV="${SESSION_SECRET//\\/\\\\}"
SESSION_SECRET_ENV="${SESSION_SECRET_ENV//\"/\\\"}"

if [[ ! "$DB_PASSWORD" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo "ASSETFLOW_DB_PASSWORD in $ENV_FILE must be a 64-character hexadecimal secret." >&2
  exit 1
fi
if [[ ! "$APP_DB_NAME" =~ ^[a-z][a-z0-9_]{0,62}$ || ! "$APP_DB_USER" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; then
  echo "Database and user names must be lowercase PostgreSQL identifiers." >&2
  exit 1
fi
if [[ ! "$APP_PORT" =~ ^[0-9]{1,5}$ ]] || (( APP_PORT < 1 || APP_PORT > 65535 )); then
  echo "PORT must be a valid TCP port number." >&2
  exit 1
fi
if [[ "$GENERATED_DB_PASSWORD" == "true" ]] && \
  [[ "$(sudo -u postgres psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
      --command="SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER}'")" == "1" ]]; then
  echo "Database role already exists but its managed password is missing. Restore .env; refusing unexpected credential rotation." >&2
  exit 1
fi

# Keep the generated password out of the psql command line; SQL is sent over stdin.
sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 <<SQL
DO \$assetflow_role\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER}') THEN
    EXECUTE format('CREATE ROLE ${APP_DB_USER} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', '${DB_PASSWORD}');
  ELSE
    EXECUTE format('ALTER ROLE ${APP_DB_USER} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', '${DB_PASSWORD}');
  END IF;
END;
\$assetflow_role\$;
SELECT format('CREATE DATABASE ${APP_DB_NAME} OWNER ${APP_DB_USER}')
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname = '${APP_DB_NAME}')\\gexec
ALTER DATABASE ${APP_DB_NAME} OWNER TO ${APP_DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${APP_DB_NAME} TO ${APP_DB_USER};
SQL

sudo -u postgres psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$APP_DB_NAME" <<SQL
ALTER SCHEMA public OWNER TO ${APP_DB_USER};
GRANT ALL ON SCHEMA public TO ${APP_DB_USER};
SQL

ENV_TEMP="$(mktemp "${APP_DIR}/.env.XXXXXX")"
trap 'rm -f "${ENV_TEMP:-}" "${BOOTSTRAP_FILE:-}"' EXIT
chmod 0600 "$ENV_TEMP"
if [[ -f "$ENV_FILE" ]]; then
  # Preserve optional operator settings while replacing installer-managed values.
  node "$APP_DIR/scripts/onprem-env.mjs" unmanaged "$ENV_FILE" > "$ENV_TEMP"
fi
cat >> "$ENV_TEMP" <<EOF
ASSETFLOW_DB_NAME=${APP_DB_NAME}
ASSETFLOW_DB_USER=${APP_DB_USER}
ASSETFLOW_DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://${APP_DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${APP_DB_NAME}
SESSION_SECRET="${SESSION_SECRET_ENV}"
NODE_ENV=production
PORT=${APP_PORT}
HOST=${APP_HOST}
TRUST_PROXY="${APP_TRUST_PROXY}"
COOKIE_SECURE=${APP_COOKIE_SECURE}
EOF
chown root:root "$ENV_TEMP"
chmod 0600 "$ENV_TEMP"
mv -f "$ENV_TEMP" "$ENV_FILE"

echo "Installing dependencies and building the production application..."
rm -rf -- "$APP_DIR/node_modules" "$APP_DIR/dist"
install -d -o assetflow -g assetflow -m 0750 "$APP_DIR/node_modules" "$APP_DIR/dist"
unset npm_config_registry npm_config_proxy npm_config_http_proxy npm_config_https_proxy
unset NPM_CONFIG_PROXY NPM_CONFIG_HTTP_PROXY NPM_CONFIG_HTTPS_PROXY
unset npm_config_userconfig NPM_CONFIG_USERCONFIG
unset YARN_REGISTRY YARN_NPM_REGISTRY_SERVER
unset REPLIT_NPM_REGISTRY REPLIT_NPM_PROXY REPLIT_PACKAGE_PROXY
unset REPLIT_HTTP_PROXY REPLIT_HTTPS_PROXY REPLIT_PROXY
export NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"
export npm_config_registry="$NPM_CONFIG_REGISTRY"
# A production shell makes npm ci omit devDependencies by default. The
# dedicated build script explicitly includes them (vite, esbuild, tsx, etc.);
# the systemd runtime still loads NODE_ENV=production from the protected .env.
runuser -u assetflow -- bash -c \
  'cd "$1" && NPM_CONFIG_REGISTRY="https://registry.npmjs.org/" npm run build:onprem' \
  _ "$APP_DIR"

# Make application code and dependencies read-only to the service account. Only
# the explicit upload directories and its private home remain writable at runtime.
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.env*' -exec chown -R root:assetflow {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type d -exec chmod 0750 {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type f -perm /111 -exec chmod 0750 {} +
find "$APP_DIR" -path "$ENV_FILE" -prune -o -type f ! -perm /111 -exec chmod 0640 {} +
chown root:root "$ENV_FILE"
chmod 0600 "$ENV_FILE"
install -d -o assetflow -g assetflow -m 0750 \
  "$APP_DIR/server/uploads" \
  "$APP_DIR/server/uploads/project-documents" \
  "$APP_DIR/server/uploads/backup-evidence"
chown -R assetflow:assetflow "$APP_DIR/server/uploads"

NODE_BIN="$(command -v node)"
cat > "$SYSTEMD_UNIT" <<EOF
[Unit]
Description=AssetFlow IT Asset and Service Management
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=assetflow
Group=assetflow
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${APP_DIR}/dist/index.js
Restart=on-failure
RestartSec=5
TimeoutStartSec=180
TimeoutStopSec=30
UMask=0027
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SYSTEMD_UNIT"
systemctl daemon-reload
systemctl enable assetflow.service
systemctl start assetflow.service

echo "Waiting for database migrations and application health..."
healthy=false
HEALTH_DEADLINE=$((SECONDS + 180))
while (( SECONDS < HEALTH_DEADLINE )); do
  remaining=$((HEALTH_DEADLINE - SECONDS))
  poll_timeout=$((remaining < 5 ? remaining : 5))
  if curl --fail --silent --connect-timeout 2 --max-time "$poll_timeout" "$HEALTH_URL" >/dev/null; then
    healthy=true
    break
  fi
  (( SECONDS >= HEALTH_DEADLINE )) || sleep 1
done
if [[ "$healthy" != "true" ]]; then
  systemctl status assetflow.service --no-pager || true
  journalctl -u assetflow.service -n 100 --no-pager || true
  echo "AssetFlow did not become healthy. Review the systemd logs before retrying." >&2
  exit 1
fi

PRIMARY_IPV4="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{ for (i=1; i<=NF; i++) if ($i == "src") { print $(i+1); exit } }' || true)"
PRIMARY_IPV4="${PRIMARY_IPV4:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
PRIMARY_IPV4="${PRIMARY_IPV4:-127.0.0.1}"
OPEN_URL="http://${PRIMARY_IPV4}:${APP_PORT}"
if [[ "$ENABLE_HTTPS" == "true" ]]; then
  TLS_SERVER_NAME="${TLS_SERVER_NAME:-$PRIMARY_IPV4}"
  TLS_SERVER_NAME="$TLS_SERVER_NAME" APP_PORT="$APP_PORT" \
    bash "$APP_DIR/scripts/onprem-https.sh"
  OPEN_URL="https://${TLS_SERVER_NAME}"
fi

SYSTEM_STATUS="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 10 "http://127.0.0.1:${APP_PORT}/api/system/status")"
NEEDS_SETUP="$(node -e 'const status = JSON.parse(process.argv[1]); process.stdout.write(status.needsSetup ? "yes" : "no")' "$SYSTEM_STATUS")"
ADMIN_PASSWORD=""
if [[ "$NEEDS_SETUP" == "yes" ]]; then
  # Extra random bytes provide ample entropy; the suffix guarantees all password
  # character classes required by the first-run setup endpoint.
  ADMIN_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(36).toString("base64url") + "Aa1!")')"
  BOOTSTRAP_FILE="$(mktemp /run/assetflow-admin-bootstrap.XXXXXX)"
  chmod 0600 "$BOOTSTRAP_FILE"
  printf '{"username":"admin","email":"admin@assetflow.example.com","firstName":"System","lastName":"Administrator","password":"%s"}\n' \
    "$ADMIN_PASSWORD" > "$BOOTSTRAP_FILE"
  if ! curl --fail --silent --show-error --connect-timeout 2 --max-time 30 \
    --header "Content-Type: application/json" \
    --data-binary "@${BOOTSTRAP_FILE}" \
    "http://127.0.0.1:${APP_PORT}/api/system/seed-data" >/dev/null; then
    echo "Secure first-administrator setup failed. No generated password is being displayed." >&2
    exit 1
  fi
  rm -f "$BOOTSTRAP_FILE"
  unset BOOTSTRAP_FILE
else
  echo "An account already exists; preserving current user accounts and passwords."
fi

echo
echo "============================================================"
echo "AssetFlow installation is healthy."
echo "Open:     ${OPEN_URL}"
echo "Username: admin"
if [[ -n "$ADMIN_PASSWORD" ]]; then
  echo "Password: ${ADMIN_PASSWORD}"
  echo "Save this password now; it is not stored in plaintext."
else
  echo "Password: unchanged (this was not a fresh database install)."
fi
echo "Service:  systemctl status assetflow"
echo "Secrets:  ${ENV_FILE} (root-only, mode 600)"
echo "============================================================"
