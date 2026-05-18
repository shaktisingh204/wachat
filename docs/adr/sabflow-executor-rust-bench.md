# ADR: SabFlow Executor — Rust vs Node Bench Methodology

**Status:** Proposed (Track A Phase 1, sub-task 9)
**Owner:** SabFlow / Track B Phase 1 (downstream consumer)
**Related plan:** `PLAN-sabflow-crdt-collab.md` — Track A Phase 1 §9 and Track B Phase 1 §10.
**Companion harness:** `benches/sabflow-executor/`.

## 1. Context

SabFlow's executor (Track B) inherits its baseline shape from n8n: a queue-mode
worker model (Bull + Redis + Node workers) where each workflow execution walks a
DAG, runs per-node logic, and evaluates `{{ $json.foo }}`-style expressions
against per-item payloads.

The Rust-vs-Node decision rule is fixed by the parent plan:

> Hard rule: any Rust adoption (gateway, executor core, expression engine,
> individual nodes) requires the bench in its phase to beat the Node baseline
> by **>=30%**. Otherwise stay on the n8n-style Node implementation.

This ADR defines **how we measure** the executor's hot path so Track B Phase 1
can apply that rule without re-litigating methodology.

Out of scope for this ADR: queue dispatch, credential injection, trigger
delivery, third-party integrations, full DAG traversal, sandboxed code nodes.
Those phases get their own benches (Track B §2, §4, §5, §6, §8).

## 2. What the executor "hot path" is

In n8n, the dominant cost on real workflows is not DAG bookkeeping. It is:

1. **Item iteration** — a node receives an array of items; each item is a JSON
   object.
2. **Expression evaluation** — for each item, evaluate one or more expressions
   that read fields off `$json` and produce derived fields.
3. **Transform / shape** — write the result back into the outgoing item array.

So the bench targets exactly this loop. A single "Set / Transform" node that
receives **10,000 items** and applies a small expression to each item is a
faithful proxy for the bottleneck path in n8n's executor. If Rust can't beat
Node on this loop, it won't earn its operational complexity anywhere else in
the executor.

## 3. Workload definition

Both the Node baseline and the Rust candidate expose **the same HTTP contract**:

- `POST /run`
- Request body:
  ```json
  {
    "workflow": {
      "node": "set",
      "expression": "$json.foo.toUpperCase()",
      "outputField": "fooUpper"
    },
    "items": [
      { "foo": "abc", "n": 1 },
      { "foo": "def", "n": 2 }
    ]
  }
  ```
- Response body:
  ```json
  {
    "items": [
      { "foo": "abc", "n": 1, "fooUpper": "ABC" },
      { "foo": "def", "n": 2, "fooUpper": "DEF" }
    ],
    "elapsedMs": 4.21
  }
  ```

**Fixed parameters for the v1 bench:**

| Parameter            | Value                                            |
| -------------------- | ------------------------------------------------ |
| Items per request    | 10,000                                           |
| Item shape           | `{ foo: string(8 chars), n: number }`            |
| Expression           | `$json.foo.toUpperCase()` written to `fooUpper`  |
| Concurrency (`N`)    | Sweep: 1, 4, 16, 64                              |
| Total runs (`M`)     | 200 per concurrency level                        |
| Warmup runs          | 20 (discarded)                                   |
| Endpoint binding     | `127.0.0.1:<port>` (loopback only)               |
| Body encoding        | JSON over HTTP/1.1, keep-alive                   |
| Hardware             | Single machine, same box for client + server     |
| Node version pin     | Node 24.x LTS                                    |
| Rust version pin     | stable channel at bench time                     |

Expression scope for v1 is intentionally narrow (`$json.<field>.toUpperCase()`).
This is **not** the full n8n expression grammar — that lives in Track B Phase 4
and gets its own bench. The point here is to isolate executor + expression
dispatch overhead, not language-completeness.

## 4. Metrics

The load driver records, per concurrency level:

1. **Throughput** — `items/sec` = (`M` * 10,000) / total wall time.
   This is the headline number.
2. **Latency per request** — wall time from `fetch` start to body parsed.
   Report `p50`, `p95`, `p99`, `max`.
3. **Per-item amortized latency** — request latency / 10,000.
   Useful for back-of-envelope SLO budgets.
4. **Peak RSS** — sampled from `/proc/self/status` (Linux) or `ps -o rss`
   (macOS) every 100ms during the run; report max.
5. **CPU time** — `process.cpuUsage()` (Node) / `getrusage` (Rust) delta over
   the run. Reported as user + sys ms.
6. **Error rate** — non-2xx responses or JSON parse failures. Any error rate
   above 0.1% invalidates the run.

All metrics are written as a single JSON line to stdout so the driver can be
piped into a results file.

## 5. Decision rule

Track B Phase 1 §10 adopts Rust for the executor hot path **iff all** of:

1. **Throughput:** Rust `items/sec` >= 1.30 * Node `items/sec` at **every**
   concurrency level (1, 4, 16, 64). A win that only shows up at one
   concurrency point is not "sustained".
2. **Tail latency:** Rust `p99` per-request latency <= Node `p99` (no
   regression). A throughput win that worsens p99 is not adopted.
3. **Memory:** Rust peak RSS <= 1.5x Node peak RSS. (We do not require Rust to
   win on memory — many Rust HTTP stacks pre-allocate buffers — but we cap the
   regression.)
4. **Error rate:** both implementations stay below 0.1%.

If any of (1)–(4) fail, the executor stays in Node and mirrors n8n's
queue-mode worker model. The Rust crate scaffolding under `rust/crates/` is
**not** created for the executor until this bench passes.

A re-bench is allowed when: (a) the expression workload changes materially
(Track B Phase 4 adds the full grammar), (b) the IPC contract changes (Track B
Phase 1 §7), or (c) a Rust runtime upgrade (tokio major) lands. Each re-bench
records its result here as an appendix; the rule itself does not change.

## 6. What this ADR does NOT decide

- It does **not** decide whether SabFlow uses Rust for the WebSocket gateway
  (Track A Phase 1 §4 — separate bench).
- It does **not** decide CRDT lib (Track A Phase 1 §5 — separate bench).
- It does **not** decide IPC shape between Node API and the worker
  (Track B Phase 1 §7 — separate bench, may reuse this harness).
- It does **not** prescribe the production deployment shape. On Vercel, the
  Node baseline maps to a Function (Fluid Compute, Node.js runtime); the Rust
  candidate, if adopted, runs as a separate worker service the Function calls
  over HTTP. Deployment shape is settled in Track B Phase 2.

## 7. Reproducibility

The harness under `benches/sabflow-executor/` is intentionally
dependency-light:

- Node baseline uses only Node built-ins (`node:http`). No `npm install`
  required to read the code; a `npm i` step is documented for any future deps
  but the v1 server has zero runtime deps.
- Rust candidate is a **standalone** Cargo project. It is deliberately **not**
  a member of the `rust/` workspace — adding it there would force a workspace
  resolve every build and pull bench-only deps into the main Rust graph. It
  builds independently with `cargo build --release` from
  `benches/sabflow-executor/rust/`.
- The load driver is plain Node, uses only `node:http` and `node:perf_hooks`.

See `benches/sabflow-executor/README.md` for the run procedure.

## 8. Decision log

| Date       | Result                    | Notes                                                                                                                                                              |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-18 | Methodology accepted      | Workload, harness, and >=30% rule frozen for Track B Phase 1 §10. Bench code lives at `benches/sabflow-executor/`; baseline + candidate share `POST /run` contract. |
| _next run_ | _captured at adoption PR_ | First numeric result is recorded on the Track B Phase 1 §10 closeout PR. Pass → Rust executor core opt-in; fail → stay on Node. No interim partial-adopt rows.     |

Subsequent entries land **only** when a fresh hot path is benched (expression
engine — Track B Phase 4 §10; credential decrypt path — Phase 5 §11; node sandbox
— Phase 6 §8). Each new row carries the bench commit SHA so the result is
re-runnable.
