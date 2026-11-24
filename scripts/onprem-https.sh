#!/usr/bin/env bash
set -euo pipefail
umask 077

# Optional Ubuntu/Debian host-native TLS proxy. No .env sourcing, app/database
# credential changes, firewall changes, or root execution of application code.
[[ "${EUID}" -eq 0 ]] || { echo "Run this HTTPS helper as root." >&2; exit 1; }
: "${TLS_SERVER_NAME:?Set TLS_SERVER_NAME to the server IPv4 address or DNS hostname}"
APP_PORT="${APP_PORT:-5000}"
TLS_REGENERATE="${TLS_REGENERATE:-false}"
case "$TLS_REGENERATE" in
  true|false) ;;
  *) echo "TLS_REGENERATE must be true or false." >&2; exit 1 ;;
esac
if [[ "$TLS_REGENERATE" == true && ( -n "${TLS_CERT_FILE:-}" || -n "${TLS_KEY_FILE:-}" ) ]]; then
  echo "Do not combine TLS_REGENERATE=true with supplied certificate paths." >&2; exit 1
fi
if [[ ! "$TLS_SERVER_NAME" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ || ${#TLS_SERVER_NAME} -gt 253 ]]; then
  echo "TLS_SERVER_NAME must be one IPv4 address or DNS hostname, without URL, port, or whitespace." >&2; exit 1
fi
if [[ ! "$APP_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$APP_PORT < 1 || 10#$APP_PORT > 65535 )); then
  echo "APP_PORT must be a valid TCP port." >&2; exit 1
fi
APP_PORT="$((10#$APP_PORT))"
if [[ -n "${TLS_CERT_FILE:-}" || -n "${TLS_KEY_FILE:-}" ]]; then
  [[ -f "${TLS_CERT_FILE:-}" && -r "${TLS_CERT_FILE:-}" && -f "${TLS_KEY_FILE:-}" && -r "${TLS_KEY_FILE:-}" ]] || {
    echo "Supply both readable TLS_CERT_FILE (PEM full chain) and TLS_KEY_FILE (unencrypted PEM key)." >&2; exit 1;
  }
fi

source /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || { echo "HTTPS helper supports Ubuntu/Debian." >&2; exit 1; }
if ! command -v nginx >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends nginx openssl
fi
command -v openssl >/dev/null
install -d -o root -g root -m 0700 /etc/assetflow/tls
TLS_DIR="/etc/assetflow/tls"
WORK_DIR="$(mktemp -d "$TLS_DIR/.configure-XXXXXXXX")"
trap 'rm -rf -- "$WORK_DIR"' EXIT
CERT="$TLS_DIR/server.crt"
KEY="$TLS_DIR/server.key"

# The full installer forwards optional certificate paths/regeneration explicitly.
# Omitted paths mean generate a new pair only if no existing pair is present.
source "$(dirname -- "${BASH_SOURCE[0]}")/onprem-tls.sh"
prepare_assetflow_tls

CONFIG="/etc/nginx/sites-available/assetflow-https.conf"
LINK="/etc/nginx/sites-enabled/assetflow-https.conf"
if [[ -e "$CONFIG" ]] && ! grep -q '^# AssetFlow managed HTTPS proxy$' "$CONFIG"; then
  echo "Refusing to overwrite an unmanaged Nginx configuration at $CONFIG." >&2; exit 1
fi
if [[ -e "$LINK" || -L "$LINK" ]]; then
  [[ -L "$LINK" && "$(readlink -f -- "$LINK")" == "$CONFIG" ]] || {
    echo "Refusing to replace an existing unrelated Nginx site link." >&2; exit 1;
  }
fi
[[ ! -e "$CONFIG" ]] || cp -- "$CONFIG" "$WORK_DIR/previous.conf"
[[ ! -e "$CERT" ]] || cp -- "$CERT" "$WORK_DIR/previous.crt"
[[ ! -e "$KEY" ]] || cp -- "$KEY" "$WORK_DIR/previous.key"
HAD_LINK=false
[[ ! -L "$LINK" ]] || HAD_LINK=true

cat > "$WORK_DIR/site.conf" <<EOF
# AssetFlow managed HTTPS proxy
server {
    listen 80;
    server_name ${TLS_SERVER_NAME};
    return 308 https://${TLS_SERVER_NAME}\$request_uri;
}
server {
    listen 443 ssl;
    server_name ${TLS_SERVER_NAME};
    server_tokens off;
    ssl_certificate ${CERT};
    ssl_certificate_key ${KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_tickets off;
    client_max_body_size 30m;
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Replace, never append, client-supplied forwarding chains.
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Host "";
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
if [[ "$TLS_PAIR_REUSED" != true ]]; then
  install -o root -g root -m 0644 "$WORK_DIR/server.crt" "$CERT"
  install -o root -g root -m 0600 "$WORK_DIR/server.key" "$KEY"
else
  # Preserve existing bytes, inode and mtime on reruns; repair permissions only.
  chown root:root "$CERT" "$KEY"
  chmod 0644 "$CERT"
  chmod 0600 "$KEY"
fi
install -o root -g root -m 0644 "$WORK_DIR/site.conf" "$CONFIG"
ln -sfn -- "$CONFIG" "$LINK"
if ! nginx -t; then
  restore_entries=("previous.conf:$CONFIG")
  if [[ "$TLS_PAIR_REUSED" != true ]]; then
    restore_entries+=("previous.crt:$CERT" "previous.key:$KEY")
  fi
  for entry in "${restore_entries[@]}"; do
    previous="${entry%%:*}"
    target="${entry#*:}"
    if [[ -f "$WORK_DIR/$previous" ]]; then cp -- "$WORK_DIR/$previous" "$target"; else rm -f -- "$target"; fi
  done
  [[ "$HAD_LINK" == true ]] || rm -f -- "$LINK"
  echo "Nginx validation failed; prior AssetFlow TLS configuration restored." >&2
  exit 1
fi
systemctl enable nginx
if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
echo "HTTPS proxy configured: https://${TLS_SERVER_NAME}"
echo "Use TRUST_PROXY=loopback and COOKIE_SECURE=auto (or true for HTTPS-only). Keep port ${APP_PORT} private."
