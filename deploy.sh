#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SabNode production deploy with HARD CPU/RAM limits
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="/var/www/sabnode"
cd "$REPO_DIR"

SUDO="sudo -E"

# ─────────────────────────────────────────────
# DETECT CPU CORES
# ─────────────────────────────────────────────

if command -v nproc >/dev/null 2>&1; then
  CORES=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
  CORES=$(sysctl -n hw.ncpu)
else
  CORES=4
fi

# ─────────────────────────────────────────────
# HARD RESOURCE LIMITS
# ─────────────────────────────────────────────

# Use only 80% CPU
CPU_LIMIT=$(( CORES * 80 / 100 ))

if [ "$CPU_LIMIT" -lt 1 ]; then
  CPU_LIMIT=1
fi

# Total RAM
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')

# Use only 80% RAM
RAM_LIMIT_MB=$(( TOTAL_RAM_MB * 80 / 100 ))

# Hard node heap
NODE_HEAP_MB=4096

echo "────────────────────────────────────"
echo "Total CPU Cores : $CORES"
echo "CPU Limit       : $CPU_LIMIT"
echo "Total RAM (MB)  : $TOTAL_RAM_MB"
echo "RAM Limit (MB)  : $RAM_LIMIT_MB"
echo "Node Heap (MB)  : $NODE_HEAP_MB"
echo "────────────────────────────────────"

# ─────────────────────────────────────────────
# NODE SETTINGS
# ─────────────────────────────────────────────

export NEXT_TELEMETRY_DISABLED=1
export NEXT_DISABLE_ESLINT=1
export CI=1
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"
export GENERATE_SOURCEMAP=false

# @carbon/icons-react (and other IBM packages) ship a postinstall
# telemetry collector that spawns long-lived background-process.js
# workers — those have been observed holding 19GB+ RSS and ~70% CPU
# each, *after* install completes. Disable globally.
export IBM_TELEMETRY_DISABLED=true

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

$SUDO pkill -9 -f "next build" 2>/dev/null || true
$SUDO pkill -9 -f "next/dist/build" 2>/dev/null || true

# IBM telemetry postinstall ghosts (from @carbon/icons-react etc.) —
# leak across deploys, each holding ~19GB RSS / ~70% CPU. Kill them
# before the build claims the box's RAM.
$SUDO pkill -9 -f "@ibm/telemetry-js" 2>/dev/null || true

sleep 2

# ─────────────────────────────────────────────
# ENSURE SWAP IS LARGE ENOUGH
# ─────────────────────────────────────────────
#
# `next build` on this app peaks at ~122 GB anon-RSS (Turbopack's
# Rust-side module graph + source maps — V8 heap caps don't constrain
# it). On a 125 GB host with <10 GB swap, the kernel OOM-killer fires
# before paging can save the build. Keep at least 32 GB of swap so the
# kernel can page out cold heap and let the build complete.

step "Checking swap"

SWAP_TARGET_GB=32
CURRENT_SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
TARGET_SWAP_MB=$(( SWAP_TARGET_GB * 1024 ))

if [ "$CURRENT_SWAP_MB" -lt "$TARGET_SWAP_MB" ]; then
  AVAIL_GB=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  NEEDED_GB=$(( SWAP_TARGET_GB + 5 ))

  if [ "$AVAIL_GB" -lt "$NEEDED_GB" ]; then
    echo "✖ Need at least ${NEEDED_GB}GB free on / for a ${SWAP_TARGET_GB}GB swapfile; only ${AVAIL_GB}GB available."
    echo "  Free disk space or reduce SWAP_TARGET_GB at the top of this section."
    exit 1
  fi

  echo "Resizing swap: have ${CURRENT_SWAP_MB}MB, target ${TARGET_SWAP_MB}MB"

  if [ -f /swapfile ]; then
    $SUDO swapoff /swapfile 2>/dev/null || true
    $SUDO rm -f /swapfile
  fi

  $SUDO fallocate -l "${SWAP_TARGET_GB}G" /swapfile
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
# INSTALL ROOT DEPENDENCIES
# ─────────────────────────────────────────────

step "Installing root dependencies"

# `npm ci` tries to delete the existing node_modules before installing.
# If a previous deploy was killed mid-install (OOM, manual cancel, …),
# the tree is half-extracted and rmdir fails with ENOTEMPTY on stray
# dirs like lodash-es, leaving an unusable node_modules. Retry once
# after a hard wipe so deploys are self-healing.
install_deps() {
  if [ -f package-lock.json ]; then
    $SUDO npm ci --no-audit --no-fund --include=dev
  else
    $SUDO npm install --no-audit --no-fund --include=dev
  fi
}

if ! install_deps; then
  echo "npm install failed — wiping node_modules and retrying once"
  $SUDO rm -rf node_modules
  install_deps
fi

# Defensive check — if a critical bin is missing even after `npm ci`
# returned 0 (which has happened when tar entries failed silently),
# wipe and reinstall.
if [ ! -x "node_modules/.bin/tsx" ] || [ ! -x "node_modules/.bin/next" ]; then
  echo "Critical bin missing after install — wiping node_modules and reinstalling"
  $SUDO rm -rf node_modules
  install_deps
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
# NEXT BUILD WITH HARD LIMITS
# ─────────────────────────────────────────────

step "Building Next.js with HARD resource limits"

set +e

$SUDO env \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  NEXT_DISABLE_ESLINT=1 \
  IBM_TELEMETRY_DISABLED=true \
  CI=1 \
  NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}" \
  npx next build &

BUILD_PID=$!

echo "Build PID: $BUILD_PID"

# CPU HARD LIMIT
#
# `cpulimit -l` is expressed as "percent of ONE core" (100 = 1 core fully
# loaded). On a multi-core box `-l 80` would cap the entire build to 80%
# of a single core. Scale by core count so we actually use 80% of total
# CPU.
CPU_LIMIT_PCT=$(( CORES * 80 ))
$SUDO cpulimit -p $BUILD_PID -l "$CPU_LIMIT_PCT" >/dev/null 2>&1 &

# NOTE: We used to spawn a "memory watcher" here that polled
# `ps -o rss= -p $BUILD_PID` every 2s and killed the build over a
# threshold. It was broken: $BUILD_PID points at the npm/sudo wrapper
# (a few hundred KB RSS), not the heavy node child that actually grows
# to ~120GB. The watcher always printed "Current RAM Usage: 6MB" and
# never fired, while the kernel OOM-killer reaped the real process.
# Rely on the OOM-killer + a properly-sized swapfile (see swap section
# above) instead.

wait $BUILD_PID
build_rc=$?

set -e

if [ "$build_rc" -ne 0 ]; then
  echo ""
  echo "✖ next build failed (exit $build_rc)"

  # Pull the most recent OOM-killer lines, if any — these are the
  # signature of a memory-killed build and the most useful clue.
  if dmesg 2>/dev/null | tail -200 | grep -E -i "out of memory|oom-kill|killed process" >/dev/null; then
    echo ""
    echo "─── kernel OOM activity (most recent) ───"
    dmesg 2>/dev/null | grep -E -i "out of memory|oom-kill|killed process" | tail -10
    echo "────────────────────────────────────────"
    echo "The build was OOM-killed. Either bump SWAP_TARGET_GB in this"
    echo "script (currently ${SWAP_TARGET_GB}GB) or move to a larger box."
  else
    dmesg 2>/dev/null | tail -30 || true
  fi

  exit "$build_rc"
fi

# ─────────────────────────────────────────────
# BUILD RUST
# ─────────────────────────────────────────────

step "Building Rust workspace"

ROOT_HOME=$($SUDO sh -c 'echo "$HOME"')

CARGO_BIN=""

for candidate in \
  "$ROOT_HOME/.cargo/bin/cargo" \
  "$HOME/.cargo/bin/cargo" \
  "/usr/local/cargo/bin/cargo" \
  "/usr/local/bin/cargo" \
  "/usr/bin/cargo"; do

  if $SUDO test -x "$candidate"; then
    CARGO_BIN="$candidate"
    break
  fi
done

if [ -z "$CARGO_BIN" ]; then
  echo "✖ cargo not found"
  exit 1
fi

echo "Using cargo: $CARGO_BIN"

(
  cd "$REPO_DIR/rust"

  $SUDO "$CARGO_BIN" build --release --jobs "$CPU_LIMIT"
)

# ─────────────────────────────────────────────
# VERIFY RUST BINARIES
# ─────────────────────────────────────────────

for bin in sabnode-api broadcast-worker; do
  if ! $SUDO test -x "$REPO_DIR/rust/target/release/$bin"; then
    echo "✖ Missing Rust binary: $bin"
    exit 1
  fi
done

# ─────────────────────────────────────────────
# BUILD SABSMS ENGINE (standalone Rust crate)
# ─────────────────────────────────────────────
#
# sabsms-engine lives outside rust/ workspace — its own Cargo.toml at
# services/sabsms-engine/. PM2 starts it from
# services/sabsms-engine/target/release/sabsms-engine, so build it here
# or PM2 startup will fail with "Script not found".

step "Building SabSMS engine"

(
  cd "$REPO_DIR/services/sabsms-engine"

  $SUDO "$CARGO_BIN" build --release --jobs "$CPU_LIMIT"

  if ! $SUDO test -x "$REPO_DIR/services/sabsms-engine/target/release/sabsms-engine"; then
    echo "✖ Missing Rust binary: sabsms-engine"
    exit 1
  fi
)

# ─────────────────────────────────────────────
# BUILD SABWA NODE
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

  if ! $SUDO test -f dist/index.js; then
    echo "✖ dist/index.js missing"
    exit 1
  fi
)

# ─────────────────────────────────────────────
# PM2 RELOAD
# ─────────────────────────────────────────────

step "Stopping old processes"

$SUDO pm2 delete sabwa-engine >/dev/null 2>&1 || true
$SUDO pm2 delete webhook-worker >/dev/null 2>&1 || true

step "Reloading PM2"

$SUDO pm2 startOrReload ecosystem.config.js --update-env

step "Saving PM2"

$SUDO pm2 save

# ─────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────

printf "\n\033[1;32m✅ Deploy complete.\033[0m\n"

$SUDO pm2 status

cat <<EOF

Health checks:

curl -fsS http://127.0.0.1:3002 >/dev/null && echo "sabnode-web ✓"

curl -fsS http://127.0.0.1:8080/health >/dev/null && echo "sabnode-api ✓"

curl -fsS http://127.0.0.1:4001/health >/dev/null && echo "sabwa-node ✓"

EOF