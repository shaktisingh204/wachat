# `benches/sabflow-node-parity`

Golden-fixture parity harness that compares the SabFlow Rust executor's
output against `n8n` for the same workflow input. This is the foundational
test infrastructure that **every** Rust node implementation must clear
before it ships (Phase C.3, C.4, C.5 in `PLAN-sabflow-coverage.md`).

This directory holds the harness only. It is **not** part of CI today and
is **not** automatically wired into the Rust workspace. It is invoked
manually as a gate for Track C sub-tasks.

Companion ADR: [`docs/adr/sabflow-executor-ipc.md`](../../docs/adr/sabflow-executor-ipc.md) (the wire contract this harness speaks).
Sibling harness: [`benches/sabflow-executor/`](../sabflow-executor/) (the throughput bench, separate purpose).

---

## What it does

For a given node type (e.g. `set`):

1. Loads `fixtures/<nodeType>/input.json` — the per-node input payload.
2. POSTs it to `n8n` (running in the `docker-compose.yml` container) and
   captures the JSON output.
3. POSTs the **same** input to the SabFlow Rust executor (already running on
   the host) at the IPC endpoint settled in
   `docs/adr/sabflow-executor-ipc.md`.
4. Byte-compares the two JSON outputs after a canonicalising key sort.
5. Exits `0` on parity, non-zero on diff. Surfaces the diff to stdout so
   CI / a developer can see exactly which field disagrees.

If the fixture directory contains an `expected-output.json`, the runner
also asserts that **both** engines match it — this catches the case where
n8n and SabFlow agree on a wrong answer (regression of a known-good output
the fixture was authored against).

## Acceptance criteria

A Rust node is **parity-tested** when, **and only when**:

1. `fixtures/<nodeType>/input.json` exists.
2. `fixtures/<nodeType>/expected-output.json` exists.
3. `node runner.mjs <nodeType>` exits 0 against both n8n and the SabFlow
   Rust executor on a clean machine following only the steps in this
   README.

Phase C.3 / C.4 / C.5 sub-tasks SHOULD NOT mark a Rust node "done" until
this gate passes. The harness is the contract.

## Layout

```
benches/sabflow-node-parity/
  README.md          (this file)
  docker-compose.yml n8n + harness service
  runner.mjs         per-node parity runner (node built-ins only)
  fixtures/
    <nodeType>/
      input.json
      expected-output.json
  tools/
    sample-fixture.json   hand-rolled "Set" smoke fixture
```

## Prerequisites

- Node 24.x (matches the SabNode runtime). The runner uses only `node:http`,
  `node:fs`, `node:child_process`, `node:path`, `node:url`, and
  `node:assert` — no npm install, no new deps.
- Docker + Docker Compose (for the n8n side).
- A locally running SabFlow Rust executor exposing `POST /run`. For the v0
  smoke test this is the bench candidate at `benches/sabflow-executor/rust`
  (see "Known gap" below).

## Run procedure

### 1. Start n8n

```sh
cd benches/sabflow-node-parity
docker compose up -d n8n
```

n8n exposes:

- editor: <http://localhost:5678>
- single-node test endpoint (harness): <http://localhost:5679/test>

The harness service inside the compose stack is a thin shim around the
n8n executor that accepts:

```http
POST /test
Content-Type: application/json

{
  "nodeType": "set",
  "params":   { ... },
  "items":    [ ... ]
}
```

and returns:

```json
{ "items": [ ... ] }
```

This is the contract `runner.mjs` calls — it is **not** the upstream n8n
REST API surface. It is a deliberately tiny adapter to keep parity testing
independent of n8n's editor / workflow-save lifecycle.

### 2. Bootstrap the test credential

The first time you run the harness, n8n needs a no-op admin owner so the
container is past the welcome screen. The compose file provisions this via
the `N8N_USER_MANAGEMENT_DISABLED=true` env var — no manual click-through
needed. If you choose to enable user management later, set
`N8N_OWNER_EMAIL`, `N8N_OWNER_PASSWORD`, and re-up.

### 3. Start the SabFlow Rust executor

For the v0 smoke test:

```sh
cd benches/sabflow-executor/rust
cargo run --release -- --port 7070
```

The harness assumes `http://127.0.0.1:7070` by default. Override with
`SABFLOW_RUST_URL=http://host:port` if the executor lives elsewhere.

### 4. Run the parity check

```sh
cd benches/sabflow-node-parity
node runner.mjs set
```

Exit code 0 = parity. Non-zero = diff (with a line-by-line diff printed
to stdout, plus a summary of which engine disagreed with `expected-output`).

To run every fixture under `fixtures/`:

```sh
node runner.mjs --all
```

### 5. Tear down

```sh
docker compose down
```

## Wire contract used by the runner

The runner speaks the **same** JSON contract to both engines:

```jsonc
// request body
{
  "nodeType": "set",
  "params":   { /* node-specific options */ },
  "items":    [ /* input items */ ]
}

// response body (both engines normalise to this shape)
{
  "items": [ /* output items, single branch */ ]
}
```

This is a **per-node** contract, intentionally narrower than the full
`POST /exec` flow contract in `docs/adr/sabflow-executor-ipc.md` §4. The
flow-level contract is a superset — the same field names compose into the
flow envelope when we promote a node from parity-tested to
flow-integrated.

Two engines, one contract: any divergence is a SabFlow bug, not a wire
mismatch.

## Known gap (TODO for Phase C.2.10)

> **The Rust executor does not expose a single-node `/test` endpoint
> today.** `rust/crates/sabflow-nodes/src/lib.rs` is a library only — it
> declares the `Node` trait and a registry but no HTTP surface.
> `rust/crates/sabflow-engine-runtime/src/router.rs` exposes
> `POST /v1/sabflow/internal/execute`, which runs a **full** flow document
> (groups + edges + blocks), not a single node call.
> The bench server at `benches/sabflow-executor/rust/` does expose
> `POST /run`, but it only accepts the special-case "Set with one
> expression" workload from `docs/adr/sabflow-executor-rust-bench.md` §3 —
> it is **not** generic over node types.

Implication for C.2.1 (this sub-task): the runner has a single transport
adapter for the SabFlow side, and the v0 smoke fixture targets the
**existing** bench `POST /run` shape (Set node with
`expression: $json.<field>.toUpperCase()`). The runner's `--engine`
abstraction is built so that when **C.2.10 — Reference HTTP node /test
endpoint** lands a generic `POST /run` (or `POST /test`) on the Rust
side accepting `{ nodeType, params, items }`, the harness only needs an
env-var change (`SABFLOW_RUST_URL` → the new generic server) to start
covering arbitrary nodes. No code change in `runner.mjs` is required.

Until C.2.10 lands:

- New parity fixtures for nodes **other than `set`** cannot run their
  SabFlow leg and will be skipped with a clear `TODO C.2.10` message on
  stdout. This is **intentional** — the harness deliberately does not
  pretend the Rust side passed; a skip is reported as a non-zero exit
  unless `--allow-rust-skip` is passed.
- The n8n leg always runs (so authors can at least pin the "expected"
  output from n8n's reference behaviour).

## Why not just reuse `benches/sabflow-executor/`?

`benches/sabflow-executor/` is a **throughput** bench tied to a single
synthetic workload (10,000 items / Set node / one expression). Its purpose
is to measure if Rust is fast enough — not whether nodes are semantically
correct.

This harness is a **correctness** gate, runs one fixture at a time,
compares JSON byte-for-byte against n8n, and is the prerequisite for
shipping any Rust node. Different jobs, different harnesses.

## Adding a fixture

```sh
mkdir benches/sabflow-node-parity/fixtures/<nodeType>
```

Create `input.json`:

```json
{
  "nodeType": "<nodeType>",
  "params":   { /* node-specific options as the SabFlow descriptor expects */ },
  "items":    [ { /* one or more input items */ } ]
}
```

Create `expected-output.json`:

```json
{
  "items": [ { /* the canonical correct output for the input above */ } ]
}
```

Verify locally:

```sh
node runner.mjs <nodeType>
```

If the diff disagrees with what you wrote in `expected-output.json`, **do
not** silently update the expected file — first decide which engine is
correct (usually n8n, since SabFlow is the reimplementation), file the
divergence as a SabFlow node bug, and only after fixing the bug should
the fixture be re-recorded.

## Smoke test

`tools/sample-fixture.json` is a hand-rolled "Set" fixture documented as
the canonical example. Its content is mirrored verbatim into
`fixtures/set/` so `node runner.mjs set` is the smoke run for the harness
itself.
