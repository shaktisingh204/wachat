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
#
# Every external command is invoked through `sudo -E` so the script
# can be run by a non-root operator on a server where the source tree,
# PM2 daemon, and toolchain are root-owned. `-E` preserves the env
# vars exported below (NODE_OPTIONS, NEXT_TELEMETRY_DISABLED, etc.).
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/var/www/sabnode"
cd "$REPO_DIR"

# Single knob for the sudo invocation; swap to "" to run as the current
# user, or to "doas -E" / "sudo -EH" to tweak behavior in one place.
SUDO="sudo -E"

if command -v nproc >/dev/null 2>&1; then
  CORES=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
  CORES=$(sysctl -n hw.ncpu)
else
  CORES=4
fi
USE_CORES=$CORES
if [ "$USE_CORES" -lt 1 ]; then USE_CORES=1; fi

# Cap the Next.js build worker pool. Turbopack spawns one worker per
# NEXT_CPU_COUNT and each worker's V8 heap can grow to several GB, so
# on a 32-core box "all cores" produces ~30 workers and saturates RAM
# (every observed OOM kill on this server traced back to that).
# 8 is a comfortable upper bound — slower than 32 workers but reliable.
BUILD_CORES=$USE_CORES
if [ "$BUILD_CORES" -gt 8 ]; then BUILD_CORES=8; fi

export NEXT_TELEMETRY_DISABLED=1
export NEXT_CPU_COUNT=$BUILD_CORES
export UV_THREADPOOL_SIZE=$USE_CORES
# Per-worker V8 heap ceiling. 4 GiB × BUILD_CORES workers keeps total
# build memory bounded (≤32 GiB at BUILD_CORES=8). Setting it absurdly
# high (e.g. 240 GiB) does NOT speed builds and removes the natural
# back-pressure that prevents the OOM killer from firing.
export NODE_OPTIONS="--max-old-space-size=4096"
export GENERATE_SOURCEMAP=false
# NOTE: do NOT export NODE_ENV=production at the top of the script.
# npm@8+ skips devDependencies whenever NODE_ENV=production, which strips
# tsx / typescript / @types/* and breaks api:gen, api:test and next build.
# We pass `--include=dev` to npm explicitly so build tools always install,
# and PM2 itself sets NODE_ENV=production for the running processes.
unset NODE_ENV

step() {
  printf "\n\033[1;36m▶ %s\033[0m\n" "$*"
}

# Helper: confirm a binary exists in node_modules/.bin before we try to run it,
# so a missing build tool fails the deploy with a clear message instead of
# `sh: 1: <tool>: not found` halfway through.
require_bin() {
  local name=$1
  if [ ! -x "node_modules/.bin/$name" ]; then
    echo "✖ Missing build tool: node_modules/.bin/$name" >&2
    echo "  devDependencies did not install — check NODE_ENV / npm flags." >&2
    exit 1
  fi
}

# ── 0) Sync source ------------------------------------------------------
step "Pulling latest from main"
$SUDO git pull origin main

# ── 1) Next.js web -----------------------------------------------------
# `--include=dev` is load-bearing: tsx / typescript / @types/* are in
# devDependencies and are required by api:gen, api:test and next build.
step "Installing root deps (npm ci, incl. dev)"
if [ -f package-lock.json ]; then
  $SUDO npm ci --no-audit --no-fund --include=dev
else
  $SUDO npm install --no-audit --no-fund --include=dev
fi

require_bin tsx
require_bin next

# ── 1a) Developer-API codegen --------------------------------------------
# Regenerates the 9k+ route handlers, the OpenAPI doc, the per-endpoint
# docs pages, and the TS SDK from `tools/api-manifest/`. Must run before
# `next build` because the generated files live under `src/` and Next.js
# compiles them as part of the app.
#
# Also prunes orphan @generated route files (e.g. after a spec is
# removed) so stale paths can't reappear and clash with current ones.
step "Regenerating /api/v1 surface (api:gen)"
$SUDO npm run api:gen

# ── 1b) Drift-tests + collision guard ----------------------------------
# Cheap sanity checks: every manifest endpoint has a matching file, every
# generated file maps back to a manifest entry, the OpenAPI doc is in
# sync. Fails the deploy fast if codegen is broken.
step "Running api drift tests"
$SUDO npm run api:test

# Next.js 16 rejects same-name dynamic slugs in one path and ambiguous
# sibling [a]/[b] patterns. Catch both classes BEFORE next build so the
# error surfaces with context instead of a one-liner inside turbopack.
step "Sanity-checking route patterns"
$SUDO python3 - <<'PY'
import os, sys
from collections import defaultdict

root = "src/app"
problems = []

# A) repeated slug inside one path (e.g. /tags/[tagId]/tags/[tagId])
for dirpath, _, _ in os.walk(root):
    parts = dirpath.split(os.sep)
    ids = [p for p in parts if p.startswith("[") and p.endswith("]")]
    if len(ids) != len(set(ids)):
        problems.append(("repeat", dirpath))

# B) two different dynamic siblings under the same parent
#    (e.g. /flows/[id] and /flows/[flowId])
by_parent = defaultdict(set)
for dirpath, _, _ in os.walk(root):
    parts = dirpath.split(os.sep)
    for i, p in enumerate(parts):
        if p.startswith("[") and p.endswith("]"):
            by_parent[os.sep.join(parts[:i])].add(p)
for parent, ids in by_parent.items():
    if len(ids) > 1:
        problems.append(("ambiguous", f"{parent} -> {sorted(ids)}"))

if problems:
    print(f"✖ Found {len(problems)} route pattern problem(s):", file=sys.stderr)
    for kind, msg in problems[:20]:
        print(f"  [{kind}] {msg}", file=sys.stderr)
    sys.exit(1)
print("✓ No route-pattern conflicts.")
PY

# ── 1c) Build the Next.js app ------------------------------------------
# Set NODE_ENV only for the build itself so Next produces a prod bundle,
# but devDependencies stay on disk for any post-build scripts.
step "Building Next.js app (sabnode-web)"
$SUDO env NODE_ENV=production npx next build

# ── 2) Rust workspace --------------------------------------------------
step "Building Rust workspace (sabnode-api + sabnode-broadcast-worker)"
# `sudo -E` preserves most env vars but `sudoers` typically resets PATH
# via `secure_path`, so we can't rely on PATH propagating through sudo.
# Instead, resolve the absolute path to cargo in the parent shell (which
# we control) and invoke it absolutely under sudo.
#
# rustup installs into ~/.cargo/bin for whichever account ran the
# installer. On this box the installer was run via sudo so the toolchain
# lives under root's HOME — but we also check the operator's HOME and
# /usr/local for completeness.
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
  echo "✖ cargo not found in any standard location." >&2
  echo "  Searched: $ROOT_HOME/.cargo/bin, $HOME/.cargo/bin, /usr/local/cargo/bin, /usr/local/bin, /usr/bin" >&2
  echo "  Install Rust with: sudo curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sudo sh -s -- -y" >&2
  exit 1
fi

echo "  using cargo at: $CARGO_BIN"

(
  cd "$REPO_DIR/rust"
  $SUDO "$CARGO_BIN" build --release --jobs "$USE_CORES"
)

# Sanity-check the produced binaries so PM2 doesn't reload onto missing
# artefacts.
for bin in sabnode-api broadcast-worker; do
  if ! $SUDO test -x "$REPO_DIR/rust/target/release/$bin"; then
    echo "✖ Missing Rust binary: rust/target/release/$bin" >&2
    exit 1
  fi
done

# ── 3) SabWa Node engine ----------------------------------------------
step "Building SabWa Node.js engine (sabwa-node)"
(
  cd "$REPO_DIR/services/sabwa-node"

  # Use npm — pnpm isn't guaranteed on PATH in production.
  # `--include=dev` so tsc / type defs are present for `npm run build`.
  if [ -f package-lock.json ]; then
    $SUDO npm ci --no-audit --no-fund --include=dev
  else
    $SUDO npm install --no-audit --no-fund --include=dev
  fi

  $SUDO env NODE_ENV=production npm run build

  if ! $SUDO test -f dist/index.js; then
    echo "✖ sabwa-node build did not produce dist/index.js" >&2
    exit 1
  fi
)

# ── 4) PM2 reload ------------------------------------------------------
step "Stopping deprecated processes (best-effort)"
# Legacy SabWa Rust crate sidecar — replaced by services/sabwa-node.
$SUDO pm2 delete sabwa-engine >/dev/null 2>&1 || true
# Legacy webhook dispatcher worker — replaced by the Vercel-style cron
# handler at /api/cron/webhook-dispatcher fired by ops cron.
$SUDO pm2 delete webhook-worker >/dev/null 2>&1 || true

step "Reloading PM2 apps with fresh env + new binaries"
$SUDO pm2 startOrReload ecosystem.config.js --update-env

step "Persisting PM2 state"
$SUDO pm2 save

# ── 5) Done ------------------------------------------------------------
printf "\n\033[1;32m✅ Deploy complete.\033[0m\n"
$SUDO pm2 status

cat <<'EOF'

Quick health checks (run these on the box):
  curl -fsS http://127.0.0.1:3002 >/dev/null && echo "sabnode-web ✓"
  curl -fsS http://127.0.0.1:8080/health >/dev/null && echo "sabnode-api ✓"
  curl -fsS http://127.0.0.1:4001/health >/dev/null && echo "sabwa-node  ✓"

Developer-API health:
  curl -fsS http://127.0.0.1:3002/api/v1 | head
  curl -fsS http://127.0.0.1:3002/api/v1/openapi | head -c 200

If sabnode-web fails: pm2 logs sabnode-web --lines 80
If sabwa-node fails:  pm2 logs sabwa-node  --lines 80
If api:gen fails:     npm run api:gen 2>&1 | tail -40
EOF
