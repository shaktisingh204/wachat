#!/usr/bin/env bash
  set -euo pipefail

  cd /var/www/sabnode

  git pull origin main

  CORES=$(nproc)
  USE_CORES=$((CORES - 1))

  export NEXT_TELEMETRY_DISABLED=1
  export NEXT_CPU_COUNT=$USE_CORES
  export UV_THREADPOOL_SIZE=$USE_CORES
  export NODE_OPTIONS="--max-old-space-size=240000"
  export GENERATE_SOURCEMAP=false
  export NODE_ENV=production

  # 1) Next.js production build
  npx next build

  # 2) Legacy wachat Rust workspace (sabnode-api + broadcast-worker)
  ( cd /var/www/sabnode/rust && cargo build --release )

  # 3) SabWa: install Baileys sidecar deps (idempotent — no-ops if package-lock unchanged)
  ( cd /var/www/sabnode/services/sabwa-engine/sidecar-node && npm i )

  # 4) SabWa: build Rust engine binary
  ( cd /var/www/sabnode/services/sabwa-engine && cargo build --release )

  # 5) Graceful reload of every PM2 app with fresh env + new binaries
  pm2 reload ecosystem.config.js --update-env

  # 6) Persist PM2 state
  pm2 save

  echo "✅ Deploy complete."
  pm2 status