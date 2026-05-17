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
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# ── 1a) Developer-API codegen --------------------------------------------
# Regenerates the 9k+ route handlers, the OpenAPI doc, the per-endpoint
# docs pages, and the TS SDK from `tools/api-manifest/`. Must run before
# `next build` because the generated files live under `src/` and Next.js
# compiles them as part of the app.
#
# Also prunes orphan @generated route files (e.g. after a spec is
# removed) so stale paths can't reappear and clash with current ones.
step "Regenerating /api/v1 surface (api:gen)"
npm run api:gen

# ── 1b) Drift-tests + collision guard ----------------------------------
# Cheap sanity checks: every manifest endpoint has a matching file, every
# generated file maps back to a manifest entry, the OpenAPI doc is in
# sync. Fails the deploy fast if codegen is broken.
step "Running api drift tests"
npm run api:test

# Next.js 16 rejects same-name dynamic slugs in one path and ambiguous
# sibling [a]/[b] patterns. Catch both classes BEFORE next build so the
# error surfaces with context instead of a one-liner inside turbopack.
step "Sanity-checking route patterns"
python3 - <<'PY'
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
step "Stopping deprecated processes (best-effort)"
# Legacy SabWa Rust crate sidecar — replaced by services/sabwa-node.
pm2 delete sabwa-engine >/dev/null 2>&1 || true
# Legacy webhook dispatcher worker — replaced by the Vercel-style cron
# handler at /api/cron/webhook-dispatcher fired by ops cron.
pm2 delete webhook-worker >/dev/null 2>&1 || true

step "Reloading PM2 apps with fresh env + new binaries"
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

Developer-API health:
  curl -fsS http://127.0.0.1:3002/api/v1 | head
  curl -fsS http://127.0.0.1:3002/api/v1/openapi | head -c 200

If sabnode-web fails: pm2 logs sabnode-web --lines 80
If sabwa-node fails:  pm2 logs sabwa-node  --lines 80
If api:gen fails:     npm run api:gen 2>&1 | tail -40
EOF
