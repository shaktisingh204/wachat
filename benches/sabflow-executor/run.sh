#!/usr/bin/env bash
# SabFlow executor bench driver.
#
# Usage: ./run.sh node|rust [N] [M]
#   N — concurrency (default 16; ADR sweep is 1, 4, 16, 64)
#   M — total requests (default 200; ADR warmup is 20 of these)
#
# Workload + decision rule: docs/adr/sabflow-executor-rust-bench.md.
#
# The script:
#   1) Starts the chosen server on 127.0.0.1:7070.
#   2) Waits for /health to return 200.
#   3) Runs client/load.js with the configured N / M.
#   4) Prints the JSON result line to stdout.
#   5) Stops the server.

set -euo pipefail

IMPL="${1:-}"
N="${2:-16}"
M="${3:-200}"
PORT="${BENCH_PORT:-7070}"
ITEMS="${BENCH_ITEMS:-10000}"
WARMUP="${BENCH_WARMUP:-20}"

if [[ -z "${IMPL}" ]] || { [[ "${IMPL}" != "node" ]] && [[ "${IMPL}" != "rust" ]]; }; then
    echo "usage: $0 node|rust [N] [M]" >&2
    echo "  N = concurrency (default 16)" >&2
    echo "  M = total requests (default 200)" >&2
    exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

SERVER_PID=""
cleanup() {
    if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
        kill "${SERVER_PID}" 2>/dev/null || true
        # Give it a moment to drain, then SIGKILL if still around.
        for _ in 1 2 3 4 5; do
            if ! kill -0 "${SERVER_PID}" 2>/dev/null; then break; fi
            sleep 0.2
        done
        if kill -0 "${SERVER_PID}" 2>/dev/null; then
            kill -9 "${SERVER_PID}" 2>/dev/null || true
        fi
    fi
}
trap cleanup EXIT INT TERM

start_node() {
    node "${SCRIPT_DIR}/node/server.js" --port "${PORT}" >&2 &
    SERVER_PID=$!
}

start_rust() {
    local bin="${SCRIPT_DIR}/rust/target/release/sabflow-bench-rust"
    if [[ ! -x "${bin}" ]]; then
        echo "building rust candidate (release)..." >&2
        (cd "${SCRIPT_DIR}/rust" && cargo build --release) >&2
    fi
    "${bin}" --port "${PORT}" >&2 &
    SERVER_PID=$!
}

case "${IMPL}" in
    node) start_node ;;
    rust) start_rust ;;
esac

# load.js polls /health before firing requests, so we don't need to sleep here.
node "${SCRIPT_DIR}/client/load.js" \
    --impl "${IMPL}" \
    --host 127.0.0.1 \
    --port "${PORT}" \
    --concurrency "${N}" \
    --requests "${M}" \
    --items "${ITEMS}" \
    --warmup "${WARMUP}"
