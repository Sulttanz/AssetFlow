#!/usr/bin/env bash
set -euo pipefail
umask 077

# Optional Ubuntu/Debian host-native TLS proxy. No .env sourcing, app/database
# credential changes, firewall changes, or root execution of application code.
[[ "${EUID}" -eq 0 ]] || { echo "Run this HTTPS helper as root." >&2; exit 1; }
: "${TLS_SERVER_NAME:?Set TLS_SERVER_NAME to the server IPv4 address or DNS hostname}"
APP_PORT="${APP_PORT:-5000}"
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

if [[ -n "${TLS_CERT_FILE:-}" ]]; then
  install -m 0600 "$TLS_CERT_FILE" "$WORK_DIR/server.crt"
  install -m 0600 "$TLS_KEY_FILE" "$WORK_DIR/server.key"
elif [[ -f "$CERT" && -f "$KEY" ]]; then
  cp -- "$CERT" "$WORK_DIR/server.crt"
  cp -- "$KEY" "$WORK_DIR/server.key"
elif [[ -e "$CERT" || -e "$KEY" ]]; then
  echo "Incomplete existing TLS files; supply a valid certificate/key pair rather than overwriting them." >&2
  exit 1
else
  if [[ "$TLS_SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SUBJECT_ALT_NAME="IP:$TLS_SERVER_NAME"
  else
    SUBJECT_ALT_NAME="DNS:$TLS_SERVER_NAME"
  fi
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
    -subj "/CN=${TLS_SERVER_NAME}" -addext "subjectAltName=${SUBJECT_ALT_NAME}" \
    -keyout "$WORK_DIR/server.key" -out "$WORK_DIR/server.crt"
  echo "Generated a self-signed certificate. Distribute/trust it through your organization's approved process; browsers otherwise show a certificate warning."
fi
openssl x509 -in "$WORK_DIR/server.crt" -noout -checkend 0 >/dev/null
openssl x509 -in "$WORK_DIR/server.crt" -noout -ext subjectAltName | grep -qE 'DNS:|IP Address:' || {
  echo "TLS certificate must contain a Subject Alternative Name for the server." >&2; exit 1;
}
if [[ "$TLS_SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  openssl x509 -in "$WORK_DIR/server.crt" -noout -checkip "$TLS_SERVER_NAME" | grep -q 'does match certificate'
else
  openssl x509 -in "$WORK_DIR/server.crt" -noout -checkhost "$TLS_SERVER_NAME" | grep -q 'does match certificate'
fi
CERT_PUBLIC="$(openssl x509 -in "$WORK_DIR/server.crt" -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256)"
KEY_PUBLIC="$(openssl pkey -in "$WORK_DIR/server.key" -passin pass: -pubout -outform DER | openssl dgst -sha256)"
[[ "$CERT_PUBLIC" == "$KEY_PUBLIC" ]] || { echo "TLS certificate and private key do not match." >&2; exit 1; }

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
install -o root -g root -m 0644 "$WORK_DIR/server.crt" "$CERT"
install -o root -g root -m 0600 "$WORK_DIR/server.key" "$KEY"
install -o root -g root -m 0644 "$WORK_DIR/site.conf" "$CONFIG"
ln -sfn -- "$CONFIG" "$LINK"
if ! nginx -t; then
  for entry in "previous.conf:$CONFIG" "previous.crt:$CERT" "previous.key:$KEY"; do
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
