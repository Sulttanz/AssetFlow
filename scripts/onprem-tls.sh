#!/usr/bin/env bash
# Certificate staging shared by the root HTTPS helper and isolated OpenSSL tests.
# The caller sets TLS_SERVER_NAME, CERT, KEY, and its private WORK_DIR.
prepare_assetflow_tls() {
  TLS_PAIR_REUSED=false
  local regenerate="${TLS_REGENERATE:-false}"
  case "$regenerate" in
    true|false) ;;
    *) echo "TLS_REGENERATE must be true or false." >&2; return 1 ;;
  esac
  if [[ "$regenerate" == true && ( -n "${TLS_CERT_FILE:-}" || -n "${TLS_KEY_FILE:-}" ) ]]; then
    echo "Do not combine TLS_REGENERATE=true with operator-supplied TLS_CERT_FILE/TLS_KEY_FILE." >&2
    return 1
  fi
  if [[ -n "${TLS_CERT_FILE:-}" || -n "${TLS_KEY_FILE:-}" ]]; then
    [[ -f "${TLS_CERT_FILE:-}" && -r "${TLS_CERT_FILE:-}" && -f "${TLS_KEY_FILE:-}" && -r "${TLS_KEY_FILE:-}" ]] || {
      echo "Supply both readable TLS_CERT_FILE and TLS_KEY_FILE." >&2; return 1;
    }
    install -m 0600 "$TLS_CERT_FILE" "$WORK_DIR/server.crt"
    install -m 0600 "$TLS_KEY_FILE" "$WORK_DIR/server.key"
  elif [[ "$regenerate" != true && -f "$CERT" && -f "$KEY" ]]; then
    cp -- "$CERT" "$WORK_DIR/server.crt"
    cp -- "$KEY" "$WORK_DIR/server.key"
    chmod 0600 "$WORK_DIR/server.crt" "$WORK_DIR/server.key"
    TLS_PAIR_REUSED=true
    echo "Reusing existing TLS certificate and key; no replacement requested."
  elif [[ "$regenerate" != true && ( -e "$CERT" || -e "$KEY" ) ]]; then
    echo "Incomplete existing TLS files; supply a valid pair or explicitly set TLS_REGENERATE=true." >&2
    return 1
  else
    local subject_alt_name
    if [[ "$TLS_SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      subject_alt_name="IP:$TLS_SERVER_NAME"
    else
      subject_alt_name="DNS:$TLS_SERVER_NAME"
    fi
    openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
      -subj "/CN=${TLS_SERVER_NAME}" -addext "subjectAltName=${subject_alt_name}" \
      -keyout "$WORK_DIR/server.key" -out "$WORK_DIR/server.crt" || return 1
    chmod 0600 "$WORK_DIR/server.crt" "$WORK_DIR/server.key"
    echo "Automatically generated a self-signed TLS certificate and private key. Trust the certificate through your organization's approved process; browsers otherwise show a warning."
  fi

  openssl x509 -in "$WORK_DIR/server.crt" -noout -checkend 0 >/dev/null || return 1
  openssl x509 -in "$WORK_DIR/server.crt" -noout -ext subjectAltName | grep -qE 'DNS:|IP Address:' || {
    echo "TLS certificate must contain a Subject Alternative Name for the server." >&2; return 1;
  }
  local name_check
  if [[ "$TLS_SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    name_check="$(openssl x509 -in "$WORK_DIR/server.crt" -noout -checkip "$TLS_SERVER_NAME")" || return 1
  else
    name_check="$(openssl x509 -in "$WORK_DIR/server.crt" -noout -checkhost "$TLS_SERVER_NAME")" || return 1
  fi
  if [[ "$name_check" != *"does match certificate"* ]]; then
    echo "Existing/supplied TLS certificate does not match TLS_SERVER_NAME. Supply a matching pair or explicitly request regeneration." >&2
    return 1
  fi
  local cert_public key_public
  cert_public="$(openssl x509 -in "$WORK_DIR/server.crt" -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256)" || return 1
  key_public="$(openssl pkey -in "$WORK_DIR/server.key" -passin pass: -pubout -outform DER | openssl dgst -sha256)" || return 1
  [[ "$cert_public" == "$key_public" ]] || {
    echo "TLS certificate and private key do not match." >&2; return 1;
  }
}
