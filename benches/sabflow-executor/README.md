# `benches/sabflow-executor`

Decides whether SabFlow's executor hot path (Track B) should be implemented in
Rust or stay on Node (n8n-style). The methodology, workload, metrics, and the
**>=30% sustained throughput rule** all live in
[`docs/adr/sabflow-executor-rust-bench.md`](../../docs/adr/sabflow-executor-rust-bench.md).
Read that first.

This directory holds the harness only. It does not run automatically and is
not part of CI. It is invoked manually by Track B Phase 1.

## Layout

```
benches/sabflow-executor/
  README.md          (this file)
  run.sh             driver: ./run.sh node|rust [N] [M]
  node/
    server.js        Node baseline executor (HTTP /run)
  rust/
    Cargo.toml       standalone crate (NOT in rust/ workspace)
    src/main.rs      Rust candidate executor (HTTP /run, tokio + axum)
  client/
    load.js          load driver: POST N parallel runs of M items each
```

## Prerequisites

- Node 24.x (matches SabNode runtime). The Node baseline and the load driver
  use only Node built-ins, so no `npm install` is required.
- Rust stable + Cargo. The Rust candidate is a standalone Cargo project — it
  is **deliberately not** a member of `rust/Cargo.toml` workspace.

If we later add deps to the bench, install them locally:

```sh
# only if/when the bench grows deps — none at v1
cd benches/sabflow-executor/node && npm i
```

## Running

The Node baseline:

```sh
./run.sh node 16 200
```

The Rust candidate:

```sh
./run.sh rust 16 200
```

Arguments:

- `N` — concurrent in-flight requests (default 16). The ADR sweep is
  `1, 4, 16, 64`.
- `M` — total requests per concurrency level (default 200). 20 of these are
  warmup and discarded.

Each invocation:

1. Starts the chosen server bound to `127.0.0.1:7070`.
2. Waits for it to accept connections.
3. Runs `client/load.js`, which POSTs `{ workflow, items }` with
   `items.length == 10_000`.
4. Prints a single JSON line of results to stdout.
5. Stops the server.

## Workload

Fixed by the ADR:

- 10,000 items per request, item shape `{ foo: <8-char string>, n: <number> }`.
- Workflow: a single Set/Transform node applying
  `$json.foo.toUpperCase()` and writing the result to `outputField`
  (default `fooUpper`).
- Loopback HTTP/1.1, JSON bodies, keep-alive.

The HTTP contract is identical for both implementations — see the ADR §3 for
the request/response shape.

## Reading the result

The load driver emits one JSON line:

```json
{
  "impl": "node",
  "concurrency": 16,
  "totalRequests": 200,
  "warmupRequests": 20,
  "itemsPerRequest": 10000,
  "totalItems": 1800000,
  "elapsedMs": 1234.5,
  "throughputItemsPerSec": 1458701,
  "latencyMs": { "p50": 9.8, "p95": 14.2, "p99": 18.1, "max": 22.4 },
  "perItemNs": { "p50": 980, "p99": 1810 },
  "peakRssMb": 87.3,
  "cpuMs": { "user": 980, "sys": 120 },
  "errorRate": 0.0
}
```

Compare side-by-side at each concurrency level. The decision rule in the ADR
fires only when **all** of throughput (>= 1.30x at every N), tail latency
(no p99 regression), memory (<= 1.5x), and error rate (< 0.1%) hold for Rust.

## Status

Harness only. No bench has been run. Result table in the ADR is empty until
Track B Phase 1 §10 records the first run.
