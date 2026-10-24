#!/usr/bin/env bash
set -euo pipefail
export DEMO_PASSWORD="Demo$(openssl rand -hex 16)A1"
export SQL_PASSWORD="Sql$(openssl rand -hex 16)A1"
printf 'DEMO_PASSWORD=%s\nSQL_PASSWORD=%s\nSQL_PORT=14339\nAPI_PORT=5280\nWEB_PORT=5180\n' "$DEMO_PASSWORD" "$SQL_PASSWORD" > .env
docker compose up -d --wait sql
export ACCEPTANCE_DB="HospitalAcceptance_$(date +%s)"
export ConnectionStrings__Hospital="Server=127.0.0.1,14339;Database=$ACCEPTANCE_DB;User Id=sa;Password=$SQL_PASSWORD;TrustServerCertificate=true"
export Demo__Enabled=true Demo__Password="$DEMO_PASSWORD" ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_URLS=http://127.0.0.1:5280 Web__Origin=http://localhost:5180 API_URL=http://127.0.0.1:5280 WEB_URL=http://localhost:5180
mkdir -p artifacts
root="$PWD"
dll="$root/backend/Hospital.Api/bin/Release/net10.0/Hospital.Api.dll"
(cd backend/Hospital.Api && dotnet "$dll" --seed-performance)
api_pid='' web_pid=''
cleanup() { [[ -z "$api_pid" ]] || kill "$api_pid" 2>/dev/null || true; [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true; }
trap cleanup EXIT
start_api() {
  (cd backend/Hospital.Api && exec dotnet "$dll" --no-migrate) > artifacts/api-server.log 2>&1 & api_pid=$!
  for i in $(seq 1 45); do if curl -fsS "$API_URL/health" > /dev/null 2>&1; then return; fi; sleep 1; done
  cat artifacts/api-server.log; return 1
}
start_api
node --test --test-concurrency=1 tests/api/api.test.mjs | tee artifacts/api-acceptance.log
node tests/api/performance.mjs
(cd apps/web && exec node ../../node_modules/vite/bin/vite.js --host 127.0.0.1) > artifacts/web-server.log 2>&1 & web_pid=$!
for i in $(seq 1 30); do if curl -fsS http://localhost:5180 > /dev/null 2>&1; then break; fi; sleep 1; done
npx playwright test
kill "$api_pid"; wait "$api_pid" || true; api_pid=''
for mode in Timeout Unavailable; do
  export Providers__FailureMode="$mode" Providers__TimeoutSeconds=1 PROVIDER_FAILURE="$mode"
  start_api
  node tests/api/provider-failure.mjs | tee -a artifacts/api-acceptance.log
  kill "$api_pid"; wait "$api_pid" || true; api_pid=''
done
