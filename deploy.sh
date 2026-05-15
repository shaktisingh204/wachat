#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SabNode production deploy.
#
# Builds and reloads all three runtimes:
#   1. Next.js web app                  → `sabnode-web` (PM2)
#   2. Rust workspace                   → `sabnode-api`, `sabnode-broadcast-worker` (PM2)
#   3. SabWa Node.js engine             → `sabwa-node` (PM2)
#
# Run on the server after `git pull` (the script also pulls).
#
# Idempotent — safe to re-run. Any failed step aborts the deploy
# (`set -euo pipefail`) so PM2 never reloads against a broken binary.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/var/www/sabnode"
cd "$REPO_DIR"

# ── env -----------------------------------------------------------------
CORES=$(nproc)
USE_CORES=$((CORES - 1))
if [ "$USE_CORES" -lt 1 ]; then USE_CORES=1; fi

export NEXT_TELEMETRY_DISABLED=1
export NEXT_CPU_COUNT=$USE_CORES
export UV_THREADPOOL_SIZE=$USE_CORES
export NODE_OPTIONS="--max-old-space-size=240000"
export GENERATE_SOURCEMAP=false
export NODE_ENV=production

step() {
  printf "\n\033[1;36m▶ %s\033[0m\n" "$*"
}

# ── 0) Sync source ------------------------------------------------------
step "Pulling latest from main"
git pull origin main

# ── 1) Next.js web -----------------------------------------------------
step "Installing root deps (npm ci)"
# Use ci when lockfile exists for reproducible builds; fall back to install otherwise.
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

step "Building Next.js app (sabnode-web)"
npx next build

# ── 2) Rust workspace --------------------------------------------------
step "Building Rust workspace (sabnode-api + sabnode-broadcast-worker)"
(
  cd "$REPO_DIR/rust"
  cargo build --release --jobs "$USE_CORES"
)

# Sanity-check the produced binaries so PM2 doesn't reload onto missing
# artefacts.
for bin in sabnode-api broadcast-worker; do
  if [ ! -x "$REPO_DIR/rust/target/release/$bin" ]; then
    echo "✖ Missing Rust binary: rust/target/release/$bin" >&2
    exit 1
  fi
done

# ── 3) SabWa Node engine ----------------------------------------------
step "Building SabWa Node.js engine (sabwa-node)"
(
  cd "$REPO_DIR/services/sabwa-node"

  # Use npm — pnpm isn't guaranteed on PATH in production.
  # Use ci when a lockfile is present, fall back to install otherwise.
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi

  npm run build

  if [ ! -f dist/index.js ]; then
    echo "✖ sabwa-node build did not produce dist/index.js" >&2
    exit 1
  fi
)

# ── 4) PM2 reload ------------------------------------------------------
# `delete sabwa-engine` is best-effort — silently ignored if the legacy
# app isn't registered (e.g. on a fresh box or after the first run).
step "Stopping deprecated sabwa-engine (if present)"
pm2 delete sabwa-engine >/dev/null 2>&1 || true

step "Reloading PM2 apps with fresh env + new binaries"
# Use `startOrReload` semantics — if an app isn't running it'll be
# started; if it is, it'll be reloaded (zero-downtime where possible).
pm2 startOrReload ecosystem.config.js --update-env

step "Persisting PM2 state"
pm2 save

# ── 5) Done ------------------------------------------------------------
printf "\n\033[1;32m✅ Deploy complete.\033[0m\n"
pm2 status

cat <<'EOF'

Quick health checks (run these on the box):
  curl -fsS http://127.0.0.1:3002 >/dev/null && echo "sabnode-web ✓"
  curl -fsS http://127.0.0.1:8080/health >/dev/null && echo "sabnode-api ✓"
  curl -fsS http://127.0.0.1:4001/health >/dev/null && echo "sabwa-node  ✓"

If sabwa-node fails: pm2 logs sabwa-node --lines 80
EOF
