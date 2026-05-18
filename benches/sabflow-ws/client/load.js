#!/usr/bin/env node
/**
 * SabFlow WS gateway — load generator.
 *
 * Track A Phase 1 bench. Spawns N WebSocket clients against a single gateway
 * (Node or Rust — same wire protocol) and records broadcast round-trip
 * latency for the configured duration. The driver script (`run.sh`) is the
 * intended entry point; this file is also usable standalone:
 *
 *   node load.js --url ws://127.0.0.1:9001 --clients 50 --duration 60 --rate 10
 *
 * On completion prints one JSON line to stdout with the run summary.
 *
 * No deps beyond `ws`. Install locally:
 *   cd benches/sabflow-ws/client && npm init -y && npm i ws
 */

'use strict';

let WebSocket;
try {
  WebSocket = require('ws');
} catch (err) {
  console.error(
    '[sabflow-ws/load] missing dep "ws". Run: npm init -y && npm i ws',
  );
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));

const FRAME_BYTES = 256;
const TS_OFFSET = 0;
const ID_OFFSET = 8;
const PAYLOAD_OFFSET = 16;
const WARMUP_MS = 5_000;

/** @type {Array<{ sent: number, received: number, latencies: number[] }>} */
const perClient = [];

/**
 * Build a 256-byte frame whose first 16 bytes are (send_ts_ns, client_id) so
 * the recipient can derive RTT just by reading the bytes back.
 *
 * @param {Buffer} buf  reusable scratch buffer, FRAME_BYTES long
 * @param {bigint} ts   monotonic ns timestamp
 * @param {bigint} cid  client id
 */
function stampFrame(buf, ts, cid) {
  buf.writeBigUInt64BE(ts, TS_OFFSET);
  buf.writeBigUInt64BE(cid, ID_OFFSET);
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowNs() {
  // process.hrtime.bigint() is monotonic and ns-precision — exactly what we
  // need for latency math. Date.now() is wall-clock and not safe here.
  return process.hrtime.bigint();
}

async function runClient(cid, startAt) {
  const stats = { sent: 0, received: 0, latencies: [] };
  perClient[cid] = stats;

  const ws = new WebSocket(args.url, { perMessageDeflate: false });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  // Pre-fill a reusable buffer with deterministic-ish junk. We re-stamp the
  // header on every send; the rest is constant per client which is fine,
  // we're not measuring entropy.
  const buf = Buffer.alloc(FRAME_BYTES);
  for (let i = PAYLOAD_OFFSET; i < FRAME_BYTES; i++) {
    buf[i] = (cid + i) & 0xff;
  }

  ws.on('message', (data) => {
    if (!(data instanceof Buffer) || data.length < ID_OFFSET + 8) return;
    const recvNs = nowNs();
    const sentNs = data.readBigUInt64BE(TS_OFFSET);
    const senderId = data.readBigUInt64BE(ID_OFFSET);
    // We only score frames that originated from *another* peer. The server
    // already filters echo-to-self, but be defensive.
    if (senderId === BigInt(cid)) return;
    const rttMs = Number(recvNs - sentNs) / 1e6;
    // Drop warmup latencies.
    if (Date.now() >= startAt + WARMUP_MS) {
      stats.received++;
      stats.latencies.push(rttMs);
    }
  });

  // 10 msg/s default → 100 ms period, jittered ±5 ms.
  const periodMs = 1000 / args.rate;
  const jitterMs = Math.min(5, periodMs * 0.1);
  const endAt = startAt + WARMUP_MS + args.durationMs;

  // Hold until the synchronized start tick so all clients run in the same
  // window. Without this, p99 gets noisy because some clients have already
  // burned 100 ms by the time the slowest one connects.
  const untilStart = startAt - Date.now();
  if (untilStart > 0) await sleep(untilStart);

  while (Date.now() < endAt) {
    stampFrame(buf, nowNs(), BigInt(cid));
    try {
      ws.send(buf, { binary: true });
      if (Date.now() >= startAt + WARMUP_MS) stats.sent++;
    } catch (_) {
      break;
    }
    const sleepMs = periodMs + (Math.random() * 2 - 1) * jitterMs;
    await sleep(sleepMs);
  }

  ws.close();
}

async function main() {
  // Stagger connect by giving everyone the same `startAt` 1 s in the future.
  const startAt = Date.now() + 1_000;

  const tasks = [];
  for (let cid = 0; cid < args.clients; cid++) {
    tasks.push(runClient(cid, startAt).catch((err) => {
      // Don't crash the whole run on a single bad client — log and keep going.
      process.stderr.write(
        `[sabflow-ws/load] client ${cid} failed: ${err.message}\n`,
      );
    }));
  }

  await Promise.all(tasks);

  // Aggregate.
  let totalSent = 0;
  let totalRecv = 0;
  /** @type {number[]} */
  const allLat = [];
  for (const s of perClient) {
    if (!s) continue;
    totalSent += s.sent;
    totalRecv += s.received;
    // Concatenate — sort once at the end is cheaper than k-way merge for
    // sizes this small.
    for (const l of s.latencies) allLat.push(l);
  }
  allLat.sort((a, b) => a - b);

  const p = (q) => {
    if (allLat.length === 0) return 0;
    const idx = Math.min(allLat.length - 1, Math.floor(q * allLat.length));
    return allLat[idx];
  };

  const wallSec = args.durationMs / 1000;
  const summary = {
    clients: args.clients,
    rate_per_client: args.rate,
    duration_s: wallSec,
    frame_bytes: FRAME_BYTES,
    msgs_sent: totalSent,
    msgs_received: totalRecv,
    broadcast_amp: totalSent === 0 ? 0 : totalRecv / totalSent,
    throughput_msgs_per_s: totalRecv / wallSec,
    latency_p50_ms: round3(p(0.5)),
    latency_p99_ms: round3(p(0.99)),
    latency_max_ms: round3(allLat[allLat.length - 1] ?? 0),
  };
  process.stdout.write(JSON.stringify(summary) + '\n');
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    url: 'ws://127.0.0.1:9001',
    clients: 10,
    durationMs: 60_000,
    rate: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--url' && v) {
      out.url = v;
      i++;
    } else if (k === '--clients' && v) {
      out.clients = Number(v);
      i++;
    } else if (k === '--duration' && v) {
      out.durationMs = Number(v) * 1000;
      i++;
    } else if (k === '--rate' && v) {
      out.rate = Number(v);
      i++;
    }
  }
  return out;
}

main().catch((err) => {
  process.stderr.write(`[sabflow-ws/load] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});
