#!/bin/bash

# Exit on error, undefined var, or any failure in a pipeline.
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via env, e.g. `PROJECT_DIR=/srv/sabnode ./deploy.sh`)
# ---------------------------------------------------------------------------
# Where the project lives on the server.
PROJECT_DIR="${PROJECT_DIR:-/var/www/sabnode}"
# Heap cap (MB) for the Next.js / Turbopack build. Bump if the build OOM-kills.
NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-8192}"
# Set BUILD_RUST=0 to skip the cargo builds (e.g. when only JS/TS changed).
BUILD_RUST="${BUILD_RUST:-1}"
# Set DEPLOY_GIT_RESET=0 to deploy the current working tree instead of
# hard-resetting to origin/main (useful for hotfix/manual deploys).
DEPLOY_GIT_RESET="${DEPLOY_GIT_RESET:-1}"
# TCP ports the services bind to (sabnode-web, sabwa-node, sabsms-engine,
# sabsites-postgrest, sabnode-api). Freed before restart to clear
# stale/orphaned listeners.
SERVICE_PORTS="${SERVICE_PORTS:-3002 4001 4002 4006 ${SABNODE_PORT:-8080}}"
# Set BUILD_SABSITES=0 to skip the SabSites (vendored Webstudio) build.
BUILD_SABSITES="${BUILD_SABSITES:-1}"
# FORCE_RESTART=1 → hard restart (delete PM2 apps + kill the ports + fresh
# start). Default does a zero-downtime `pm2 startOrReload` but still frees
# any orphaned ports first.
FORCE_RESTART="${FORCE_RESTART:-0}"
# Run the idempotent Postgres identity-schema migration (auth → PG). Auto-skips
# when SABNODE_PG_URL isn't set in .env. Non-fatal: auth defaults to Mongo.
RUN_DB_MIGRATIONS="${RUN_DB_MIGRATIONS:-1}"
# Run the one-time Mongo→Postgres auth backfill + reconcile (idempotent). Default
# off — once AUTH_PG_WRITE=dual, logins keep PG current. Set 1 for the initial
# migration window.
RUN_AUTH_BACKFILL="${RUN_AUTH_BACKFILL:-0}"

# Kill whatever is still listening on the service ports (orphans left behind
# by a crashed process are the usual cause of EADDRINUSE on restart).
free_ports() {
  local port
  for port in $SERVICE_PORTS; do
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "${port}/tcp" 2>/dev/null || true
    elif command -v lsof >/dev/null 2>&1; then
      lsof -ti "tcp:${port}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
    fi
  done
}

echo "🚀 Starting deployment..."
cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# 1. Sync code
# ---------------------------------------------------------------------------
if [ "$DEPLOY_GIT_RESET" = "1" ]; then
  echo "🔄 Pulling latest changes from origin/main..."
  git fetch origin main
  git reset --hard origin/main
else
  echo "⏭️  Skipping git reset (DEPLOY_GIT_RESET=0) — building current tree."
fi

# ---------------------------------------------------------------------------
# 2. Install root dependencies (Next.js app + workers)
# ---------------------------------------------------------------------------
echo "📦 Installing root dependencies..."
npm install

# ---------------------------------------------------------------------------
# 3. Build everything (all builds must succeed before anything restarts)
# ---------------------------------------------------------------------------

# 3a. Rust workspace → ./rust/target/release/{sabnode-api,broadcast-worker}
if [ "$BUILD_RUST" = "1" ]; then
  # rustup installs cargo to ~/.cargo/bin, which a non-login `sudo` shell
  # usually drops from PATH. Source the rustup env from the likely homes.
  if ! command -v cargo >/dev/null 2>&1; then
    for cargo_env in "$HOME/.cargo/env" /root/.cargo/env /home/*/.cargo/env; do
      # shellcheck disable=SC1090
      [ -f "$cargo_env" ] && . "$cargo_env" && break
    done
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    echo "❌ cargo not found. Install Rust (https://rustup.rs) or run with BUILD_RUST=0." >&2
    exit 1
  fi

  echo "🦀 Building Rust workspace (sabnode-api, broadcast-worker, sabcrm/*)..."
  ( cd rust && cargo build --release )

  # 3b. SabSMS engine — standalone Rust crate with its own target dir.
  if [ -f services/sabsms-engine/Cargo.toml ]; then
    echo "🦀 Building SabSMS engine..."
    ( cd services/sabsms-engine && cargo build --release )
  fi
else
  echo "⏭️  Skipping Rust builds (BUILD_RUST=0)."
fi

# 3c. SabWa Node engine (Baileys / personal WhatsApp) → dist/index.js
if [ -f services/sabwa-node/package.json ]; then
  echo "📦 Building SabWa Node engine..."
  ( cd services/sabwa-node && npm install && npm run build )
fi

# 3c.5 SabSheet engine → wasm (public/sabsheet-engine/<hash>/ + manifest.json).
# The wasm artifacts are gitignored, so they must be (re)built on every deploy or
# the SabSheet v2 grid can't load its engine. Needs cargo + the wasm32 target +
# wasm-pack; best-effort so a wasm toolchain hiccup can't block the whole app.
if [ "$BUILD_RUST" = "1" ]; then
  echo "📐 Building SabSheet engine (wasm)..."
  if ! rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
    rustup target add wasm32-unknown-unknown || true
  fi
  if ! command -v wasm-pack >/dev/null 2>&1; then
    echo "   wasm-pack not found — installing…"
    curl -sSf https://rustwasm.github.io/wasm-pack/installer/init.sh 2>/dev/null | sh || true
  fi
  if command -v wasm-pack >/dev/null 2>&1; then
    npm run sabsheet:wasm || echo "⚠️  SabSheet wasm build failed — the /dashboard/sabsheet/v2 grid won't load until it's rebuilt (npm run sabsheet:wasm)."
  else
    echo "⚠️  wasm-pack unavailable — skipping SabSheet wasm build (grid won't load until built)."
  fi
else
  echo "⏭️  Skipping SabSheet wasm build (BUILD_RUST=0)."
fi

# 3c.6 SabSites — the vendored Webstudio builder (vendor/webstudio), compiled
# into the app at /sites. Build artifacts are gitignored, so every deploy must
# rebuild them: server bundle stays in vendor/, client assets land in
# public/sites/. Needs Node >= 22 semantics via corepack pnpm. Best-effort so
# a toolchain hiccup can't block the whole app — but /sites won't load until
# it's rebuilt (npm run build:sabsites). See docs/sabsites/README.md.
if [ "$BUILD_SABSITES" = "1" ] && [ -f vendor/webstudio/package.json ]; then
  echo "🌐 Building SabSites (vendored Webstudio)..."
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  if ! command -v corepack >/dev/null 2>&1; then
    npm install -g corepack || true
  fi
  if ( cd vendor/webstudio && corepack pnpm install --frozen-lockfile ); then
    # Postgres schema for the sabsites DB (idempotent journal-based runner).
    SABSITES_DB_URL="$(grep -E '^SABSITES_DATABASE_URL=.+' .env 2>/dev/null | tail -1 | cut -d= -f2- || true)"
    if [ -n "${SABSITES_DB_URL:-}" ]; then
      echo "🗄️  Applying SabSites Postgres migrations..."
      ( cd vendor/webstudio \
        && DATABASE_URL="$SABSITES_DB_URL" DIRECT_URL="$SABSITES_DB_URL" \
           corepack pnpm --filter=./packages/prisma-client migrations migrate --cwd ../../apps/builder ) \
        || echo "⚠️  SabSites migrations failed — /sites may misbehave until they run."
    else
      echo "⏭️  SABSITES_DATABASE_URL not set in .env — skipping SabSites migrations."
    fi
    npm run build:sabsites \
      || echo "⚠️  SabSites build failed — /sites won't load until it's rebuilt (npm run build:sabsites)."
  else
    echo "⚠️  SabSites pnpm install failed — /sites won't load until it's built (npm run build:sabsites)."
  fi
else
  echo "⏭️  Skipping SabSites build (BUILD_SABSITES=$BUILD_SABSITES)."
fi

# 3d. Next.js application (Turbopack). Raise the heap cap to avoid OOM kills.
echo "🛠️  Building the Next.js application (heap: ${NODE_BUILD_MEMORY}MB)..."
NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEMORY}" npm run build

# ---------------------------------------------------------------------------
# 3e. Database migrations — Postgres identity schema (Mongo→Postgres auth).
#     Idempotent (CREATE/ALTER IF NOT EXISTS). Runs BEFORE restart so the new
#     code + schema are aligned. Non-fatal + auto-skipped without SABNODE_PG_URL,
#     so a server without Postgres (or a transient PG outage) never blocks the
#     deploy — auth stays on Mongo while AUTH_PG_* are unset.
#     See docs/twenty-clone/AUTH-CUTOVER-RUNBOOK.md for the flag ladder.
# ---------------------------------------------------------------------------
if [ "$RUN_DB_MIGRATIONS" = "1" ] && grep -qE '^SABNODE_PG_URL=.+' .env 2>/dev/null; then
  echo "🗄️  Applying Postgres identity schema (sabnode_identity)..."
  npm run db:identity:migrate || echo "⚠️  identity-schema migration failed (auth still runs on Mongo)."

  if [ "$RUN_AUTH_BACKFILL" = "1" ]; then
    echo "🗄️  Backfilling Mongo → Postgres users/plans/2FA..."
    node --env-file=.env scripts/db/backfill-users.mjs || echo "⚠️  auth backfill failed."
    echo "🔎 Reconciling Postgres ↔ Mongo users..."
    node --env-file=.env scripts/db/reconcile-users.mjs || echo "⚠️  reconcile reported drift — review before flipping AUTH_PG_READ."
  fi
else
  echo "⏭️  Skipping DB migrations (RUN_DB_MIGRATIONS=$RUN_DB_MIGRATIONS / SABNODE_PG_URL unset)."
fi

# ---------------------------------------------------------------------------
# 4. Restart everything via the PM2 ecosystem file (single source of truth).
#    `pm2 save` persists the process list so it survives a server reboot.
# ---------------------------------------------------------------------------
if [ "$FORCE_RESTART" = "1" ]; then
  # Hard restart: drop PM2's process list so it can't respawn while we kill
  # the ports, free the ports, then start fresh from the ecosystem file.
  echo "🔪 Hard restart: deleting PM2 apps and freeing ports ($SERVICE_PORTS)..."
  pm2 delete all 2>/dev/null || true
  free_ports
  echo "🔄 Starting all services via ecosystem.config.js..."
  pm2 start ecosystem.config.js --update-env
else
  # Normal path: free any orphaned ports, then zero-downtime reload (starts
  # new apps, reloads running ones, refreshes env via --update-env).
  echo "🧹 Freeing orphaned ports ($SERVICE_PORTS)..."
  free_ports
  echo "🔄 (Re)starting all services via ecosystem.config.js..."
  pm2 startOrReload ecosystem.config.js --update-env
fi
pm2 save

echo "✅ Deployment finished successfully!"
pm2 status
