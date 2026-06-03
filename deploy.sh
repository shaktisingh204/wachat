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

# 3d. Next.js application (Turbopack). Raise the heap cap to avoid OOM kills.
echo "🛠️  Building the Next.js application (heap: ${NODE_BUILD_MEMORY}MB)..."
NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEMORY}" npm run build

# ---------------------------------------------------------------------------
# 4. Restart everything via the PM2 ecosystem file (single source of truth).
#    startOrReload starts any new apps and zero-downtime-reloads running ones;
#    --update-env reloads env vars. `pm2 save` persists the process list so it
#    survives a server reboot.
# ---------------------------------------------------------------------------
echo "🔄 (Re)starting all services via ecosystem.config.js..."
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "✅ Deployment finished successfully!"
pm2 status
