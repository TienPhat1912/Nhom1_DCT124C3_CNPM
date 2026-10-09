#!/usr/bin/env bash
set -euo pipefail
release_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$release_dir"
test -f /srv/hospital-demo/.env || { echo 'Missing pre-provisioned /srv/hospital-demo/.env' >&2; exit 1; }
test -n "${RELEASE_TAG:-}" || { echo 'Missing immutable RELEASE_TAG' >&2; exit 1; }
[[ "$RELEASE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release commit' >&2; exit 1; }
sha256sum --check SHA256SUMS
docker load --input images.tar
docker image inspect "hospital-demo-api:$RELEASE_TAG" >/dev/null
docker image inspect "hospital-demo-web:$RELEASE_TAG" >/dev/null
docker compose --project-name hospital-demo --env-file /srv/hospital-demo/.env config --quiet
mkdir -p /srv/hospital-demo/backups
if docker volume inspect hospital-demo-data >/dev/null 2>&1; then
  # Stop writes for a consistent SQLite/volume backup; never erase the persistent volume.
  docker compose --project-name hospital-demo --env-file /srv/hospital-demo/.env stop api
  docker run --rm -v hospital-demo-data:/data:ro -v /srv/hospital-demo/backups:/backup alpine:3.22 tar -czf "/backup/pre-$RELEASE_TAG.tar.gz" -C /data .
fi
docker compose --project-name hospital-demo --env-file /srv/hospital-demo/.env up --no-build -d --wait --wait-timeout 120
web_binding="$(docker compose --project-name hospital-demo --env-file /srv/hospital-demo/.env port web 80)"
python3 scripts/smoke.py "http://127.0.0.1:${web_binding##*:}"
printf '%s\n' "$RELEASE_TAG" > /srv/hospital-demo/current-release
