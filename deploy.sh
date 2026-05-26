#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/var/www/sabnode"
cd "$REPO_DIR"

SUDO="sudo -E"

# Detect total CPU cores
if command -v nproc >/dev/null 2>&1; then
  CORES=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
  CORES=$(sysctl -n hw.ncpu)
else
  CORES=4
fi

# ─────────────────────────────────────────────
# LIMIT SERVER USAGE TO 80%
# ─────────────────────────────────────────────

# CPU limit
USE_CORES=$(( CORES * 80 / 100 ))

# Minimum 1 core
if [ "$USE_CORES" -lt 1 ]; then
  USE_CORES=1
fi

# Build workers
BUILD_CORES="${BUILD_CORES:-$USE_CORES}"

# Never exceed allowed cores
if [ "$BUILD_CORES" -gt "$USE_CORES" ]; then
  BUILD_CORES=$USE_CORES
fi

# Minimum 1 worker
if [ "$BUILD_CORES" -lt 1 ]; then
  BUILD_CORES=1
fi

# Detect total RAM in MB
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')

# Allow only 80% RAM for Node heap
BUILD_HEAP_MB="${BUILD_HEAP_MB:-$(( TOTAL_RAM_MB * 80 / 100 ))}"

# Safety minimum
if [ "$BUILD_HEAP_MB" -lt 1024 ]; then
  BUILD_HEAP_MB=1024
fi

echo "────────────────────────────────────"
echo "Total CPU Cores : $CORES"
echo "Using CPU Cores : $USE_CORES"
echo "Total RAM (MB)  : $TOTAL_RAM_MB"
echo "Heap Limit (MB) : $BUILD_HEAP_MB"
echo "────────────────────────────────────"

# ─────────────────────────────────────────────
# NODE + NEXT SETTINGS
# ─────────────────────────────────────────────

export NEXT_TELEMETRY_DISABLED=1
export NEXT_CPU_COUNT=$BUILD_CORES
export UV_THREADPOOL_SIZE=$USE_CORES
export NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB}"
export GENERATE_SOURCEMAP=false

unset NODE_ENV

step() {
  printf "\n\033[1;36m▶ %s\033[0m\n" "$*"
}

require_bin() {
  local name=$1

  if [ ! -x "node_modules/.bin/$name" ]; then
    echo "✖ Missing build tool: node_modules/.bin/$name" >&2
    exit 1
  fi
}

# ─────────────────────────────────────────────
# CLEAN OLD NEXT BUILD PROCESSES
# ─────────────────────────────────────────────

step "Cleaning old next build workers"

$SUDO pkill -9 -f "node_modules/.bin/next build" 2>/dev/null || true
$SUDO pkill -9 -f "next/dist/build/index" 2>/dev/null || true

sleep 1

# ─────────────────────────────────────────────
# ENSURE SWAP EXISTS
# ─────────────────────────────────────────────

step "Checking swap"

if [ "$(free -m | awk '/^Swap:/ {print $2}')" -lt 1024 ] && [ ! -f /swapfile ]; then
  echo "Creating 4GB swap..."

  $SUDO fallocate -l 4G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile

  grep -q '^/swapfile' /etc/fstab || \
    echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

free -h | head -3

# ─────────────────────────────────────────────
# GIT PULL
# ─────────────────────────────────────────────

step "Pulling latest code"

$SUDO git pull origin main

# ─────────────────────────────────────────────
# INSTALL DEPENDENCIES
# ─────────────────────────────────────────────

step "Installing dependencies"

if [ -f package-lock.json ]; then
  $SUDO npm ci --no-audit --no-fund --include=dev
else
  $SUDO npm install --no-audit --no-fund --include=dev
fi

require_bin tsx
require_bin next

# ─────────────────────────────────────────────
# API GENERATION
# ─────────────────────────────────────────────

step "Generating API"

$SUDO npm run api:gen

step "Running API tests"

$SUDO npm run api:test

# ─────────────────────────────────────────────
# NEXT BUILD
# ─────────────────────────────────────────────

step "Building Next.js"

set +e

$SUDO env \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NEXT_CPU_COUNT="$BUILD_CORES" \
  NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB}" \
  GENERATE_SOURCEMAP=false \
  npx next build

build_rc=$?

set -e

if [ "$build_rc" -ne 0 ]; then
  echo ""
  echo "✖ next build failed"

  if dmesg 2>/dev/null | tail -50 | grep -qi 'killed process.*node\|Out of memory.*node'; then
    echo "OOM detected"
  fi

  exit "$build_rc"
fi

# ─────────────────────────────────────────────
# RUST BUILD
# ─────────────────────────────────────────────

step "Building Rust"

(
  cd "$REPO_DIR/rust"

  cargo build --release --jobs "$USE_CORES"
)

# ─────────────────────────────────────────────
# SABWA NODE BUILD
# ─────────────────────────────────────────────

step "Building SabWa Node"

(
  cd "$REPO_DIR/services/sabwa-node"

  if [ -f package-lock.json ]; then
    $SUDO npm ci --no-audit --no-fund --include=dev
  else
    $SUDO npm install --no-audit --no-fund --include=dev
  fi

  $SUDO env NODE_ENV=production npm run build
)

# ─────────────────────────────────────────────
# PM2 RELOAD
# ─────────────────────────────────────────────

step "Reloading PM2"

$SUDO pm2 startOrReload ecosystem.config.js --update-env

$SUDO pm2 save

printf "\n\033[1;32m✅ Deploy complete.\033[0m\n"

$SUDO pm2 status