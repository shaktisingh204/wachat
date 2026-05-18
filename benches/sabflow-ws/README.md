# SabFlow WS Gateway Bench: Node vs Rust

Track A — Phase 1 sub-task #4. Goal: decide whether SabFlow's real-time
collab WebSocket gateway should be Node (baseline, mirrors n8n's stack) or
Rust (tokio + tokio-tungstenite). Per the plan:

> **Rust is adopted ONLY if it beats Node by >=30% sustained on the hot path.**

Anything less and we stay on Node to keep the stack uniform with n8n / SabNode's
existing Next.js + worker fleet.

---

## Scope

This harness measures **fan-out throughput** and **end-to-end latency** of a
minimal "join room, broadcast Yjs-update-shaped frames" gateway. We do **not**
benchmark a real Y.js sync protocol here — that lives in Phase 3/4. What we
need today is the raw cost of:

- accept N WS clients,
- assign them to one room,
- receive a binary frame from a client,
- broadcast that frame to every other client in the room.

That ratio (CPU + memory + tail latency at fan-out) is what decides whether
Rust earns its place on this hot path.

---

## Workload

- **Frame shape:** binary, 256 bytes.
  - First 8 bytes: monotonic client-side `send_ts_ns` (u64, big-endian) used by
    the load generator to compute round-trip latency on echo / broadcast.
  - Next 8 bytes: client id (u64, big-endian).
  - Remaining 240 bytes: random payload (filled once per client and reused) —
    this mimics the size class of a typical small Yjs update (insert / format
    op) without modelling the CRDT itself.
- **Send rate:** 10 msg/s per client (100 ms inter-message interval, jittered
  by ±5 ms to avoid lockstep).
- **Duration:** 60 s steady-state per run, after a 5 s warmup that is
  discarded from the metrics.
- **Room topology:** all N clients join the **same** room — worst case for
  fan-out (every inbound frame triggers N-1 outbound frames). This is the
  configuration that most punishes the Node single-threaded event loop and
  most favours Rust's multi-core tokio runtime, so it's the one that decides
  the 30% rule.

### Client counts

`N ∈ {2, 10, 50, 200}` per room. Each value is a separate run.

---

## Metrics

Per run we record:

| Metric           | How                                                                 |
| ---------------- | ------------------------------------------------------------------- |
| `msgs_sent`      | Aggregated across all clients (load generator).                     |
| `msgs_received`  | Aggregated across all clients (load generator).                     |
| `broadcast_amp`  | `msgs_received / msgs_sent` — should approach N-1.                  |
| `throughput`     | `msgs_received / wall_seconds` — server-side fan-out msg/s.         |
| `latency_p50_ms` | Median round-trip: own message arriving back from the broadcast.   |
| `latency_p99_ms` | 99th percentile of the same distribution.                           |
| `rss_peak_mb`    | Server-side peak resident set size (sampled at 1 Hz).               |
| `cpu_user_s`     | Server-side `getrusage` user CPU time over the measurement window.  |

The driver script prints all of these as a single JSON line so the runs can
be diffed mechanically.

---

## How to run

> The harness is intentionally **self-contained**. It does **not** add deps to
> the SabNode root `package.json` or to any workspace. Install per side, in
> place, before the first run.

### One-time setup

```bash
# Node side (server + load generator share the same dep).
cd benches/sabflow-ws/node && npm init -y >/dev/null && npm i ws
cd ../client && npm init -y >/dev/null && npm i ws

# Rust side.
cd ../rust && cargo build --release
```

### Run a single configuration

```bash
# Usage: ./run.sh <node|rust> <N>
./run.sh node 10
./run.sh rust 200
```

The driver:

1. Starts the chosen server on `127.0.0.1:9001`.
2. Samples its RSS every second in the background.
3. Spawns the Node load generator with `N` clients (10 msg/s × 60 s).
4. On completion, kills the server and prints one JSON summary line.

### Sweep all configurations

```bash
for impl in node rust; do
  for n in 2 10 50 200; do
    ./run.sh "$impl" "$n"
  done
done | tee results.ndjson
```

---

## Decision rule

For each `N`, compute the Rust-vs-Node ratio on `throughput`, `latency_p99_ms`,
and `rss_peak_mb`. **Rust wins iff** for every `N ∈ {10, 50, 200}` (we ignore
N=2, it's noise floor):

- `throughput_rust  >= 1.30 * throughput_node`, **and**
- `latency_p99_rust <= 0.70 * latency_p99_node`, **and**
- `rss_peak_rust    <= rss_peak_node`.

If any one of those fails on any one `N`, the gateway stays on Node.

---

## Caveats

- Single-host bench (server + clients on the same loopback). Network is **not**
  the bottleneck here — that's intentional; this measures the gateway's own
  cost. A second pass over a real LAN would be needed before a production
  decision, but the 30% rule is meant to surface a runtime-level win, not a
  network-level one.
- Frame size is fixed at 256 B. Yjs updates in practice vary by 1-2 orders of
  magnitude; we'll re-run with a 4 KiB profile in Phase 3 once a real protocol
  exists.
- Both servers run with default Node / tokio worker counts. Tuning is
  out-of-scope for the gating decision — if Rust needs hand-tuning to clear
  30%, it doesn't clear 30%.
