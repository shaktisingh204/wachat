#!/usr/bin/env bash
# SabFlow WS bench driver — Track A Phase 1.
#
# Usage:
#   ./run.sh <node|rust> <N>
#
# Starts the chosen server, samples its RSS every second, runs the load
# generator with N clients @ 10 msg/s for 60 s, then prints a single JSON
# summary line that merges client-side metrics with server-side memory/CPU.
#
# Intentionally pure bash + standard POSIX tools (plus `node`, `cargo`) — no
# extra deps, no root package.json mutation.

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <node|rust> <N>" >&2
  exit 2
fi

IMPL="$1"
CLIENTS="$2"
PORT="${PORT:-9001}"
DURATION="${DURATION:-60}"
RATE="${RATE:-10}"

# All paths resolved relative to this script so it works from any cwd.
HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_DIR="$HERE/node"
RUST_DIR="$HERE/rust"
CLIENT_DIR="$HERE/client"

# --- preflight ----------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  echo "[run.sh] node not on PATH" >&2
  exit 3
fi

if [ ! -d "$CLIENT_DIR/node_modules/ws" ]; then
  echo "[run.sh] missing client dep: run 'cd $CLIENT_DIR && npm init -y && npm i ws'" >&2
  exit 3
fi

case "$IMPL" in
  node)
    if [ ! -d "$NODE_DIR/node_modules/ws" ]; then
      echo "[run.sh] missing server dep: run 'cd $NODE_DIR && npm init -y && npm i ws'" >&2
      exit 3
    fi
    SERVER_CMD=(node "$NODE_DIR/server.js" --port "$PORT")
    ;;
  rust)
    if ! command -v cargo >/dev/null 2>&1; then
      echo "[run.sh] cargo not on PATH" >&2
      exit 3
    fi
    BIN="$RUST_DIR/target/release/sabflow-ws-bench"
    if [ ! -x "$BIN" ]; then
      echo "[run.sh] building rust server (release)..." >&2
      (cd "$RUST_DIR" && cargo build --release >&2)
    fi
    SERVER_CMD=("$BIN" --port "$PORT")
    ;;
  *)
    echo "usage: $0 <node|rust> <N>" >&2
    exit 2
    ;;
esac

# --- run ----------------------------------------------------------------------

# Start the server in the background, capture pid for teardown + rss sampling.
LOG_DIR="$(mktemp -d -t sabflow-ws-bench.XXXXXX)"
trap 'rm -rf "$LOG_DIR"; kill "$SERVER_PID" 2>/dev/null || true; kill "$SAMPLER_PID" 2>/dev/null || true' EXIT

SERVER_LOG="$LOG_DIR/server.log"
RSS_LOG="$LOG_DIR/rss.ndjson"

"${SERVER_CMD[@]}" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Wait for the "listening on ..." banner. Bound the wait so a broken build
# fails fast instead of hanging for 60 s.
for _ in $(seq 1 50); do
  if grep -q "listening on " "$SERVER_LOG" 2>/dev/null; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[run.sh] server died before listening:" >&2
    cat "$SERVER_LOG" >&2
    exit 4
  fi
  sleep 0.1
done

# RSS sampler — `ps` is portable enough for macOS + Linux. Reports KB.
(
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    RSS_KB="$(ps -o rss= -p "$SERVER_PID" 2>/dev/null | tr -d ' ' || true)"
    if [ -n "$RSS_KB" ]; then
      printf '{"t":%d,"rss_kb":%s}\n' "$(date +%s)" "$RSS_KB" >>"$RSS_LOG"
    fi
    sleep 1
  done
) &
SAMPLER_PID=$!

# Run the load generator and capture its JSON summary line.
CLIENT_JSON="$(
  node "$CLIENT_DIR/load.js" \
    --url "ws://127.0.0.1:$PORT" \
    --clients "$CLIENTS" \
    --duration "$DURATION" \
    --rate "$RATE"
)"

# Tear down server before sampler so the last RSS reading is valid.
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
kill "$SAMPLER_PID" 2>/dev/null || true
wait "$SAMPLER_PID" 2>/dev/null || true

# Reduce RSS samples to a peak in MB. awk is everywhere; no jq dep.
RSS_PEAK_MB="$(
  awk -F'[,:}]' '
    /"rss_kb"/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /"rss_kb"/) { v = $(i+1) + 0; if (v > max) max = v }
      }
    }
    END { if (max > 0) printf "%.2f", max / 1024; else printf "0" }
  ' "$RSS_LOG" 2>/dev/null || echo 0
)"

# Merge client summary + server-side rss into a single line. Done in awk so
# we keep the zero-deps promise (no jq).
printf '%s\n' "$CLIENT_JSON" | awk -v impl="$IMPL" -v rss="$RSS_PEAK_MB" '
  {
    sub(/}$/, ",\"impl\":\"" impl "\",\"rss_peak_mb\":" rss "}")
    print
  }
'
