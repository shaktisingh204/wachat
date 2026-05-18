#!/usr/bin/env node
/**
 * SabFlow WS gateway — Node baseline.
 *
 * Track A Phase 1 bench. Mirrors what n8n's push module would look like for
 * collab: a single room registry, fan-out on receive. No Yjs awareness —
 * frames are opaque binary blobs.
 *
 * Stub only. To run for real:
 *   cd benches/sabflow-ws/node && npm init -y && npm i ws
 *   node server.js --port 9001
 *
 * Intentionally has no deps beyond `ws`. Do NOT add this to the root
 * package.json — the bench is self-contained.
 */

'use strict';

// `ws` is installed locally inside benches/sabflow-ws/node/.
// We `require` lazily so this file still parses on machines that haven't run
// the one-time setup yet (the bench driver checks for it before invoking).
let WebSocketServer;
try {
  ({ WebSocketServer } = require('ws'));
} catch (err) {
  console.error(
    '[sabflow-ws/node] missing dep "ws". Run: npm init -y && npm i ws',
  );
  process.exit(2);
}

/** @type {{ port: number, room: string }} */
const args = parseArgs(process.argv.slice(2));

/**
 * Room registry. For the bench we only ever use one room ("default"), but the
 * shape is generic so it can be re-pointed at the real gateway later.
 *
 * @type {Map<string, Set<import('ws').WebSocket>>}
 */
const rooms = new Map();

function joinRoom(roomId, ws) {
  let peers = rooms.get(roomId);
  if (!peers) {
    peers = new Set();
    rooms.set(roomId, peers);
  }
  peers.add(ws);
  return peers;
}

function leaveRoom(roomId, ws) {
  const peers = rooms.get(roomId);
  if (!peers) return;
  peers.delete(ws);
  if (peers.size === 0) rooms.delete(roomId);
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: args.port });

wss.on('connection', (ws) => {
  // The bench load generator always joins the same room. A real gateway would
  // read the room id from the URL or the first frame; we keep it constant
  // here to avoid measuring router cost.
  const roomId = args.room;
  const peers = joinRoom(roomId, ws);

  ws.on('message', (data, isBinary) => {
    // Fan out to every *other* peer in the room. Echo-to-self is excluded so
    // the latency math on the client matches a real broadcast model.
    for (const peer of peers) {
      if (peer === ws) continue;
      if (peer.readyState !== peer.OPEN) continue;
      peer.send(data, { binary: isBinary });
    }
  });

  ws.on('close', () => leaveRoom(roomId, ws));
  ws.on('error', () => leaveRoom(roomId, ws));
});

wss.on('listening', () => {
  // The driver script greps for this exact line to know the server is up.
  process.stdout.write(`[sabflow-ws/node] listening on 127.0.0.1:${args.port}\n`);
});

// Clean shutdown on SIGINT / SIGTERM so the driver can reclaim the port.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    wss.close(() => process.exit(0));
  });
}

/**
 * @param {string[]} argv
 * @returns {{ port: number, room: string }}
 */
function parseArgs(argv) {
  const out = { port: 9001, room: 'default' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--port' && v) {
      out.port = Number(v);
      i++;
    } else if (k === '--room' && v) {
      out.room = v;
      i++;
    }
  }
  return out;
}
