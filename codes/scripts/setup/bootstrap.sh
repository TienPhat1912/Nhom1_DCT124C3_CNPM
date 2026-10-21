#!/usr/bin/env bash
set -euo pipefail
cd "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ $# -gt 1 || ($# -eq 1 && "$1" != '--config-only') ]]; then
  echo 'Usage: bash scripts/setup/bootstrap.sh [--config-only]' >&2
  exit 1
fi
umask 077
if [[ ! -f .env ]]; then
  command -v openssl >/dev/null || { echo 'Install OpenSSL to generate credentials.' >&2; exit 1; }
  sql_secret="Sql!$(openssl rand -hex 18)a7"
  demo_secret="Demo!$(openssl rand -hex 12)z8"
  sed -e "s/REPLACE_WITH_A_RANDOM_STRONG_PASSWORD/$sql_secret/" \
      -e "s/REPLACE_WITH_A_RANDOM_DEMO_PASSWORD/$demo_secret/" .env.example > .env
fi
# Parse data instead of sourcing .env as shell code. Accept CRLF checkouts too.
sql_password='' demo_password=''
sql_port=14339 api_port=5280 web_port=5180 database=HospitalGuidance
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]] && continue
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || { echo 'Use KEY=value without quotes or spaces around = in .env.' >&2; exit 1; }
  key="${line%%=*}" value="${line#*=}"
  case "$key" in
    SQL_PASSWORD) sql_password="$value" ;;
    DEMO_PASSWORD) demo_password="$value" ;;
    SQL_PORT) sql_port="$value" ;;
    API_PORT) api_port="$value" ;;
    WEB_PORT) web_port="$value" ;;
    DATABASE_NAME) database="$value" ;;
  esac
done < .env
for secret in "$sql_password" "$demo_password"; do
  if [[ "$secret" == REPLACE_* || ! "$secret" =~ ^[A-Za-z0-9!@%_+=.\-]{8,128}$ ]]; then
    echo 'Set valid SQL_PASSWORD and DEMO_PASSWORD in .env (8-128 characters: letters, numbers, ! @ % _ + = . -; no quotes).' >&2
    exit 1
  fi
done
for port in "$sql_port" "$api_port" "$web_port"; do
  [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] && (( port <= 65535 )) || { echo 'Invalid port in .env.' >&2; exit 1; }
done
[[ "$sql_port" != "$api_port" && "$sql_port" != "$web_port" && "$api_port" != "$web_port" ]] || { echo 'Ports must be different.' >&2; exit 1; }
[[ "$database" =~ ^[A-Za-z][A-Za-z0-9_]{0,100}$ ]] || { echo 'Invalid DATABASE_NAME.' >&2; exit 1; }
mkdir -p .local
printf 'Demo password: %s\nUsers: patient@demo.local, reception@demo.local, doctor@demo.local, service@demo.local, cashier@demo.local, admin@demo.local, otherdoctor@demo.local\n' "$demo_password" > .local/demo-access.txt
echo 'Local configuration ready. Demo credentials: .local/demo-access.txt'
if [[ "${1:-}" != '--config-only' ]]; then
  docker compose up -d --wait --wait-timeout 180 sql
fi
