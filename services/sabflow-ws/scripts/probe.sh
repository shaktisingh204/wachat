#!/usr/bin/env bash
# Quick smoke test for a running sabflow-ws gateway.
#
#   1. GET /health on the HTTP listener — expect 2xx.
#   2. Open a WebSocket to ws://localhost:${PORT} with a fake JWT in the
#      Sec-WebSocket-Protocol subprotocol header, and verify the auth-failure
#      path (server should close the socket / refuse the upgrade).
#
# Bash + node one-liner — no extra deps. The `ws` package ships transitively
# with sibling #1's server, so this works as soon as `npm install` has run
# in the service directory.

set -euo pipefail

PORT="${SABFLOW_WS_PORT:-4002}"
HOST="${SABFLOW_WS_HOST:-127.0.0.1}"
BASE_HTTP="http://${HOST}:${PORT}"
BASE_WS="ws://${HOST}:${PORT}"

echo "[probe] GET ${BASE_HTTP}/health"
HEALTH_STATUS="$(curl -sS -o /tmp/sabflow-ws-health.body -w '%{http_code}' "${BASE_HTTP}/health" || true)"
echo "[probe] health http=${HEALTH_STATUS}"
if [ "${HEALTH_STATUS}" != "200" ]; then
  echo "[probe] FAIL: /health did not return 200" >&2
  cat /tmp/sabflow-ws-health.body >&2 || true
  exit 1
fi
echo "[probe] OK: /health is 200"

echo "[probe] opening WS to ${BASE_WS} with a bogus JWT subprotocol ..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVC_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SVC_DIR}"

# Node one-liner — exits 0 only if the server rejects auth (close or upgrade error).
node --input-type=module -e "
import WebSocket from 'ws';
const url = '${BASE_WS}';
const ws = new WebSocket(url, ['sabflow.v1.jwt.not-a-real-token']);
let resolved = false;
const done = (code, msg) => {
  if (resolved) return;
  resolved = true;
  console.log('[probe]', msg);
  process.exit(code);
};
const timer = setTimeout(() => done(1, 'FAIL: no auth decision in 5s'), 5000);
ws.on('open', () => done(1, 'FAIL: ws unexpectedly accepted bogus JWT'));
ws.on('unexpected-response', (_req, res) => {
  clearTimeout(timer);
  done(res.statusCode >= 400 ? 0 : 1, 'OK: upgrade rejected with HTTP ' + res.statusCode);
});
ws.on('close', (code, reason) => {
  clearTimeout(timer);
  // 1000 = normal close (which would be wrong here); anything else = auth refusal.
  const ok = code !== 1000;
  done(ok ? 0 : 1, (ok ? 'OK' : 'FAIL') + ': ws closed with code=' + code + ' reason=' + (reason?.toString() || ''));
});
ws.on('error', (err) => {
  clearTimeout(timer);
  done(0, 'OK: ws errored before auth (' + err.message + ')');
});
"

echo "[probe] all checks passed"
