# ADR — SabFlow Executor IPC (Node API ⇄ Rust Worker)

**Status:** Proposed
**Date:** 2026-05-18
**Track / Phase / Sub-task:** Track B · Phase 1 · §7 ("Node <-> Rust IPC choice
… with bench")
**Companion ADRs:**
`docs/adr/sabflow-executor-rust-bench.md` (Track A §9 — executor hot-path bench
methodology, which this ADR's bench plan extends),
`docs/adr/sabflow-auth.md` (Track A §7 — short-lived JWT pattern this ADR
reuses), `docs/adr/sabflow-foundation.md` (umbrella).
**Companion harness:** `benches/sabflow-executor/`.

> Constraint: this ADR **only** decides the IPC mechanism between the Next.js
> side and the Rust executor worker. It does not modify auth code, register
> any RBAC keys, build a worker, or change the existing bench. The wire
> contract + bench-plan changes proposed here land alongside Track B Phase 1
> §10 sign-off, not here.

---

## 1. Context

Track A Phase 1 §9 settled the executor *hot path* methodology
(`docs/adr/sabflow-executor-rust-bench.md`). That bench already pins the
contract on the wire — `POST /run` over loopback HTTP/1.1, JSON bodies,
keep-alive — purely as a measurement aid (§3, Workload definition). It is
**not** a production-IPC decision; the ADR explicitly punts that to this
sub-task (§6: "It does not decide IPC shape between Node API and the worker —
Track B Phase 1 §7, separate bench, may reuse this harness").

The runtime topology constrains the choice. SabNode is a Vercel-native
project: every Next.js route, server action, and proxy runs on Fluid Compute
(Node.js runtime). Long-lived per-tenant Rust processes cannot live on Vercel
— there is no co-process surface. Long-lived workers therefore mirror the
existing standalone services (`services/sabwa-node/`, port 4001, PM2-managed;
the WS gateway's future standalone fork `services/sabflow-ws` reserved by
`docs/adr/sabflow-foundation.md:38`). The IPC link is **cross-host network
RPC**, not in-process and not a child process.

Two further fences shape this ADR:

1. **Large blobs go to R2 via SabFiles** (CLAUDE.md SabFiles policy). The
   wire never carries item attachments, file payloads, or anything user
   uploads — those are R2 URLs resolved on either end. So the IPC payload is
   bounded by graph IR + per-item JSON, which the hot-path bench already
   measures at 10,000 items / ~600 KB per request.
2. **Distributed traces must cross the boundary.** The Phase 1 plan §9
   ("Observability spec — OTEL traces per node") requires that the Rust
   worker's spans share a trace with the Next.js parent span. Whatever
   transport we pick has to carry W3C `traceparent` / `tracestate` headers
   without bespoke plumbing.

## 2. Options considered

### A. HTTP/1.1 + JSON (loopback or cross-host)

Existing bench shape (`docs/adr/sabflow-executor-rust-bench.md:84`,
`benches/sabflow-executor/rust/`). Plain `axum` server on the Rust side,
`fetch` / `undici` on the Next.js side.

- **Pros:** matches the bench harness verbatim — Track B §10 sign-off can
  consume the same numbers without rebuilding the contract. Headers carry
  `Authorization` + `traceparent` natively. Trivially debuggable (`curl`,
  Vercel function logs). Zero new deps on either side; Vercel Fluid Compute
  has `undici` built in. Works identically loopback and cross-host, so the
  same code path serves dev (Next.js dev server → local Rust worker) and
  prod (Vercel Function → PM2 host).
- **Cons:** request/response only — no native server-push for live
  per-node execution progress. Per-request connection setup is non-trivial
  cross-host (TLS + TCP handshake), though `keep-alive` + `undici` connection
  pool mitigates it. JSON encode/decode is the dominant per-call cost; the
  hot-path bench already accounts for it.

### B. HTTP/2 + JSON

Same JSON bodies, multiplexed streams.

- **Pros:** stream multiplexing reduces head-of-line blocking when one Next.js
  Function instance fans many concurrent executions at the same worker host.
  Server push supports progress streaming without a sibling endpoint.
- **Cons:** Fluid Compute's outbound HTTP/2 story is patchy across Node 24's
  `undici` releases — `fetch` negotiates h2 on a best-effort basis and
  silently downgrades, which makes load tests non-deterministic. Most of the
  multiplexing win lands at high concurrency that we do not have evidence
  the executor needs (the hot-path bench tops out at N=64). The wire is still
  JSON, so encode cost is identical to Option A.

### C. gRPC (tonic) with protobuf

`tonic` server on Rust, `@grpc/grpc-js` client on Node.

- **Pros:** schema is enforced at both ends from a single `.proto` (codegen
  shrinks the manually-typed `WorkflowGraph` / `NodeState` surface in both
  languages). Bidirectional streaming makes live progress trivial. Built-in
  deadline/cancellation propagation. `tonic` already integrates with
  `tracing-opentelemetry` for trace context. Protobuf encode/decode is
  measurably faster than JSON for the IR (the hot-path bench bottleneck).
- **Cons:** large new surface — `.proto` files, codegen for both languages, a
  second client library on the Next.js side, and a non-trivial change to the
  bench harness (which today is `node:http` + plain `axum`). `@grpc/grpc-js`
  is **not** the streaming-fluent client; HTTP/2 keep-alive tuning has caused
  Vercel Function cold-start regressions historically. Vercel Functions
  do not natively serve gRPC outward, but that's fine here — Functions are
  always the *client*. The real cost is project-wide: we'd add protobuf as a
  build-time dep to SabNode for one downstream consumer.

### D. stdin/stdout NDJSON (worker child process)

Spawn `sabflow-executor` as a child process per Next.js Function invocation,
communicate by line-delimited JSON on stdio.

- **Pros:** no socket setup, no auth — kernel handles isolation. Lowest
  per-call latency in pure microbench (no TCP, no TLS, no HTTP framing).
- **Cons:** **Vercel Fluid Compute does not let us co-host a Rust binary**.
  Fluid Compute instances run the Node.js runtime; we cannot ship a Rust
  binary inside a Function's deployment and `spawn` it. This option only
  works for dev / self-hosted runs, not production. Distributed tracing
  across stdio is bespoke (no `traceparent` header surface). Cancellation
  semantics are signal-based, not deadline-based. Eliminated by the
  topology constraint in §1.

### E. Unix domain socket + length-prefixed framing

Same in-host kernel benefit as (D), but a long-lived process listening on a
UDS.

- **Pros:** lowest-overhead cross-process channel on a single host.
- **Cons:** same Fluid Compute incompatibility as (D) — Next.js side runs on
  Vercel; the Rust worker runs on a separate host. UDS is a non-starter
  unless both ends share a filesystem, which they do not. Even on a
  self-hosted single-box dev setup it would diverge from prod. Eliminated by
  the topology constraint in §1.

## 3. Decision

**HTTP/1.1 + JSON for v0** (Option A). Revisit gRPC (Option C) **only if** a
follow-up bench shows that structured bidirectional streaming for live
execution progress materially beats Server-Sent Events on the same JSON
contract.

Rationale:

1. **Continuity with the hot-path bench.** The verdict that gates the Rust
   adoption (`docs/adr/sabflow-executor-rust-bench.md:117`) is measured on
   exactly this transport. Adopting gRPC for v0 would force re-benching and
   muddle the >=30% rule by mixing transport gains into language gains.
2. **Vercel-native, no new build deps.** Fluid Compute already has `undici`;
   the Rust worker's existing bench uses `axum`. No protobuf codegen step,
   no `.proto` review process, no `@grpc/grpc-js` cold-start work — every
   one of which would be a separate small ADR.
3. **Topology compatibility.** Options D and E are eliminated by Fluid
   Compute (no co-process). Option B's HTTP/2 win is unobserved at our
   concurrency profile. Option A serves the same code for dev (loopback)
   and prod (cross-host Vercel → PM2), matching `services/sabwa-node`'s
   shipping pattern.
4. **Reversible.** Every other option except (D)/(E) is a strict superset
   of (A) at the API boundary — the request/response shape in §4 below is
   transport-agnostic, so a future move to gRPC means generating
   `.proto` from the same shape, not redesigning the contract.
5. **Streaming has a known fallback.** Live per-node execution progress
   uses **Server-Sent Events** on a sibling endpoint (§4); this is the same
   pattern n8n's push module uses and matches `docs/adr/sabflow-ws-gateway-node.md`'s
   reasoning that SSE handles uni-directional server-to-client streaming
   cleanly without the gRPC surface area.

## 4. Wire contract

### Endpoints (Rust worker side)

```
POST   /exec                       # submit an execution; returns final state
POST   /exec/<executionId>/cancel  # cooperative cancel (matches OTEL deadline)
GET    /exec/<executionId>/stream  # SSE: live per-node state transitions
GET    /health                     # readiness probe (matches the bench harness)
```

All endpoints are HTTP/1.1, keep-alive, JSON request + response bodies
except the SSE stream (which is `text/event-stream`).

### Request / response (one-shot, `POST /exec`)

Request:

```json
{
  "executionId": "01J9...",
  "ir": {
    "nodes": [ { "id": "n1", "type": "set", "params": { /* ... */ } } ],
    "edges": [ { "from": "n1", "to": "n2" } ],
    "version": 1
  },
  "input": { /* per-trigger payload, BLOBS-BY-REF only */ },
  "ctx": {
    "workspaceId": "ws_...",
    "userId": "u_...",
    "credentials": { "byId": { /* opaque to wire — handles only */ } },
    "deadlineMs": 30000,
    "sabFiles": {
      "putBaseUrl": "https://files.sabnode.app/v1/put/...",
      "getBaseUrl": "https://files.sabnode.app/v1/get/..."
    }
  }
}
```

Response (success):

```json
{
  "executionId": "01J9...",
  "status": "succeeded",
  "nodeStates": [
    { "id": "n1", "status": "succeeded", "startedAt": "...", "endedAt": "..." }
  ],
  "output": { /* final payload, BLOBS-BY-REF only */ }
}
```

Response (failure): identical envelope, `status: "failed"`, `nodeStates`
populated up to the failing node, and a `error: { code, message, retryable }`
field whose taxonomy is settled in Track B Phase 1 §8 (`NodeApiError` /
`NodeOperationError` parity with n8n) — that ADR consumes this contract, not
the other way around.

**Blob rule (CLAUDE.md SabFiles policy).** Any field larger than ~256 KB
must be uploaded to SabFiles ahead of the call; the wire carries the SabFile
URL only. The worker uses `ctx.sabFiles.getBaseUrl` to resolve, and writes
its own outputs through `ctx.sabFiles.putBaseUrl`. The worker MUST reject
inbound payloads with raw bodies above the limit (HTTP 413).

### Streaming (`GET /exec/<id>/stream`)

`text/event-stream` events, one JSON object per `data:` line:

```
event: node-state
data: { "id": "n1", "status": "running", "at": "..." }

event: node-state
data: { "id": "n1", "status": "succeeded", "at": "..." }

event: done
data: { "status": "succeeded" }
```

Clients open the stream after `POST /exec` returns a `202 Accepted` with
`{ executionId }` (long-running mode) or skip the stream entirely when
they use `POST /exec` in one-shot mode. The stream is read-only — cancels
go to `POST /exec/<id>/cancel`, which closes the SSE with `event: cancelled`.

### Headers

| Header                  | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `Authorization: Bearer <jwt>` | Short-lived HS256 JWT, §6.                                       |
| `traceparent`           | W3C trace context — Rust side parses via `tracing-opentelemetry`.       |
| `tracestate`            | Vendor trace extensions (carried verbatim, never modified).             |
| `x-sabflow-execution-id` | Echoed on every log line for grep-ability across the boundary.         |
| `idempotency-key`       | Same value as `executionId`; retries are no-ops on the worker side.     |

## 5. Bench plan

The §7 plan item ("with bench") is satisfied by extending
`benches/sabflow-executor/` rather than building a parallel harness:

1. **Add a gRPC candidate** alongside the Node baseline and Rust HTTP
   candidate, under `benches/sabflow-executor/rust-grpc/` (separate Cargo
   project, not in the workspace, mirroring `rust/`'s exclusion in
   `docs/adr/sabflow-executor-rust-bench.md:158`).
2. **Reuse the same workload** — 10,000 items / request, single Set node,
   the `$json.foo.toUpperCase()` expression. The point of this bench is
   transport, not language, so workload parity matters more than realism.
3. **Sweep the existing N ∈ {1, 4, 16, 64}** at M=200 each.
4. **Compare three columns**: Node baseline (HTTP/JSON), Rust HTTP/JSON,
   Rust gRPC/protobuf. Headline metric is items/sec; tail latency, peak RSS,
   and error rate guardrails (`docs/adr/sabflow-executor-rust-bench.md:117`)
   are reused unchanged.
5. **Decision rule for adopting gRPC over HTTP/1.1**: gRPC throughput >= 1.30 *
   Rust HTTP throughput at every concurrency level, AND p99 no worse, AND
   peak RSS <= 1.5x. Same shape as the parent rule, applied transport-vs-transport.
6. **No CI integration.** Manual run from Track B Phase 1; result lands as
   an appendix on this ADR and in the existing decision log table at
   `docs/adr/sabflow-executor-rust-bench.md:170`.

Until step 1 lands, the v0 IPC is unambiguous: HTTP/1.1 + JSON as already
benched. The gRPC re-bench is a follow-up sub-task scheduled by Track B
Phase 1 §10, not a blocker for §7 sign-off.

## 6. Auth

Reuses the `docs/adr/sabflow-auth.md` pattern verbatim:

- The Next.js Function (caller) mints a short-lived HS256 JWT via the
  existing `src/lib/jwt-for-rust.ts` (15-min TTL, `ISSUER = 'sabnode-bff'`,
  signed with `RUST_JWT_SECRET` — **separate** from `JWT_SECRET`; the WS
  gateway token reuses `JWT_SECRET` because it's client-facing, while this
  surface is strictly server-to-server, matching the existing Rust BFF
  split).
- Token claims: `{ sub: userId, tid: workspaceId, executionId, exp, iat, jti }`.
- Caller attaches `Authorization: Bearer <jwt>` on every `POST /exec` /
  `POST /exec/.../cancel` / `GET /exec/.../stream` call.
- Worker verifies via `jsonwebtoken` (or the existing
  `rust/crates/auth` JWT helper if present in the workspace at the time of
  implementation — that crate is the same one referenced by
  `docs/adr/sabflow-auth.md:145`).
- Revocation is bounded by TTL only (the worker does not call Mongo to
  check `revoked_tokens`; that's a cookie-trust path). 15 minutes is the
  hard cap on the worst-case execution that survives a credential revoke.

The mint endpoint is internal — no client-facing route is added by this
ADR. The Function calls the helper inline before invoking the worker.

## 7. Observability across the boundary

- **Trace context.** Caller injects `traceparent` + `tracestate` headers.
  Rust worker imports them via `tracing-opentelemetry`'s
  `HeaderExtractor`; every per-node span on the worker side is a child of
  the Function span. This satisfies the Phase 1 §9 OTEL requirement
  without bespoke plumbing.
- **Structured logs.** Both sides log Pino-compatible JSON
  (Phase 1 §9 — "Pino-compat fields"). The `x-sabflow-execution-id`
  header is mirrored as a log field on both sides, so a single grep on the
  execution ID joins the trace across hosts.
- **Errors.** Non-2xx responses always carry the error envelope from §4
  (`error: { code, message, retryable }`), so the caller never has to
  guess; HTTP status is advisory.

## 8. Open items deferred elsewhere

| Item | Where it lands |
|---|---|
| Error code taxonomy + retry classes (`NodeApiError` / `NodeOperationError`) | Track B Phase 1 §8 (separate ADR) |
| Worker host topology (single host vs sharded pool) | Track B Phase 2 |
| OTEL exporter config (collector endpoint, sampler) | Track B Phase 1 §9 |
| `WorkflowGraph` IR canonical schema | Track B Phase 1 §3 (DAG model) |
| Trigger delivery channel into the worker | Track B Phase 5 |

---

## Summary (≤ 200 words)

**Chosen transport — HTTP/1.1 + JSON over cross-host TCP.** The Next.js
Function (Fluid Compute, Node.js runtime) calls the Rust executor worker
running on a PM2-managed standalone host (mirroring `services/sabwa-node`)
via `POST /exec` with `{ executionId, ir, input, ctx }` and gets back
`{ executionId, status, nodeStates[], output? }`. Live per-node progress
streams from a sibling `GET /exec/<id>/stream` Server-Sent-Events endpoint;
cooperative cancel is `POST /exec/<id>/cancel`. Large I/O blobs travel
through SabFiles (R2) by URL reference only — the wire never carries raw
payloads above ~256 KB. Auth is a 15-minute HS256 JWT minted by
`src/lib/jwt-for-rust.ts` (separate `RUST_JWT_SECRET`, same pattern as the
existing Rust BFF) and presented in `Authorization: Bearer`. Distributed
traces cross the boundary via W3C `traceparent` / `tracestate` headers.
Options D (stdin/stdout) and E (Unix socket) are ruled out by Vercel Fluid
Compute (no co-process); Option B (HTTP/2) shows no measurable win at our
concurrency profile; **Option C (gRPC) is the named upgrade path** and gets
re-benched against HTTP/1.1 in an extension of `benches/sabflow-executor/`
under the same >=30% rule before any adoption.
