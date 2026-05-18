#!/usr/bin/env bash
# Bring up the sabflow-ws local dev stack:
#   1. Start the Redis container (127.0.0.1:6380) if not already running.
#   2. Wait for the healthcheck to report healthy.
#   3. Run `npm run dev` (tsx watcher provided by sibling #1).
#
# Idempotent: safe to re-run; an already-running Redis is left alone.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${SVC_DIR}"

# --- pick a docker compose binary -----------------------------------------
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "error: neither 'docker compose' nor 'docker-compose' is available on PATH" >&2
  exit 1
fi

echo "[sabflow-ws/dev] starting redis (127.0.0.1:6380) ..."
"${COMPOSE[@]}" up -d redis

# --- wait for healthcheck -------------------------------------------------
echo "[sabflow-ws/dev] waiting for redis to become healthy ..."
ATTEMPTS=30
until [ "$("${COMPOSE[@]}" ps --format json redis 2>/dev/null | grep -o '"Health":"healthy"' || true)" ]; do
  ATTEMPTS=$((ATTEMPTS - 1))
  if [ "${ATTEMPTS}" -le 0 ]; then
    echo "[sabflow-ws/dev] redis did not become healthy in time; continuing anyway" >&2
    break
  fi
  sleep 1
done

# --- ensure .env exists ---------------------------------------------------
if [ ! -f "${SVC_DIR}/.env" ]; then
  echo "[sabflow-ws/dev] no .env found — copying .env.example -> .env"
  cp "${SVC_DIR}/.env.example" "${SVC_DIR}/.env"
fi

# --- run the tsx watcher --------------------------------------------------
echo "[sabflow-ws/dev] launching 'npm run dev' ..."
exec npm run dev
