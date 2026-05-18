# ADR: SabFlow Executor — Observability Spec

**Status:** Proposed (Track B Phase 1, sub-task 9)
**Owner:** SabFlow / Track B
**Related plan:** `PLAN-sabflow-crdt-collab.md` — Track B Phase 1 §9.
**Companion ADRs:** `sabflow-executor-rust-bench.md`, `sabflow-foundation.md`.

## 1. Summary (<=200 words)

SabFlow's executor — whether the Node workers (n8n-style baseline) or the Rust
hot path (where bench wins) — must emit one consistent observability stream that
plugs into SabNode's existing OTel + Pino plumbing rather than introducing a
parallel stack. Every execution produces a root span `sabflow.execution` with
nested `sabflow.node.<type>` spans, plus narrow children for outbound HTTP,
credential resolution, and expression evaluation. Logs are structured JSON
(Pino-compat field shape) and **always** carry `workspaceId` so we can trace
across a multi-tenant fleet. Metrics use a fixed Prometheus/OTEL taxonomy
(`sabflow_executions_total`, `sabflow_execution_duration_seconds`,
`sabflow_node_duration_seconds`, `sabflow_node_retries_total`,
`sabflow_workers_inflight`). Trace sampling is **100% on errors, 10% on
successes**; logs are unsampled. Node parameters, credential values, and raw
input/output JSON are **never** logged — only references (item counts, redacted
keys, SabFile IDs per the SabFiles policy). This contract is the same whether a
node runs in Node.js or Rust, so dashboards, alerts, and the tail-sampling
collector config survive the Rust cutover.

## 2. Context: existing SabNode observability (reuse, do not replace)

The executor sits inside SabNode and inherits a working — if minimal — stack.
Anything new defined here MUST plug into the same wires.

### 2.1 Next.js side (TypeScript)

- **OTel API surface:** `@opentelemetry/api ^1.9.1` is the only OTel package the
  application code talks to. Heavy SDK packages
  (`@opentelemetry/sdk-node ^0.218.0`,
  `@opentelemetry/exporter-trace-otlp-http ^0.214.0`,
  `@opentelemetry/auto-instrumentations-node ^0.76.0`) are declared in
  `package.json` for a future Node-side bootstrap but are **not yet wired into
  an `instrumentation.ts`** at the repo root. The executor ADR therefore assumes
  the bootstrap lands when the executor service ships; until then traces are
  emitted into a no-op tracer and the API contract still works.
- **App-level helper:** `src/lib/ops/tracing.ts` exposes the only sanctioned
  span API for application code:
  - `withSpan(name, fn, { attributes })` — wraps a callback, records
    exceptions, sets `SpanStatusCode.ERROR` on throw, and always `end()`s.
  - `currentTraceId()` / `currentSpanId()` / `setSpanAttribute(k, v)` for
    cross-cutting helpers.
  - Default tracer name: `'sabnode/ops'`. Executor code MUST use the tracer
    name `'sabnode/sabflow-executor'` (override via the helper's `tracerName`
    option) so dashboards can filter by component.
- **Logging:** the Next.js app currently logs with `console.*`. There is no
  `pino` dependency in the root `package.json`. The executor introduces
  structured logging via the field shape below; whether the transport is Pino
  (if added to the root deps) or a thin `console.log(JSON.stringify(...))`
  wrapper is left to implementation — the **field contract** is what matters.
- **Metrics:** no metrics SDK is wired in the root package. `sdk-metrics
  ^2.6.1` is present as a transitive of `sdk-node` but no exporter is
  registered. The executor ADR defines the metric taxonomy; the exporter
  (Prometheus scrape endpoint or OTLP push) is provisioned in Track B Phase 9.

### 2.2 Node sidecar services (already Pino)

- `services/sabwa-node/src/log.ts` is the reference Pino setup we copy:

  ```ts
  export const log = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { svc: 'sabwa-node' },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: !isProduction && process.stdout.isTTY
      ? { target: 'pino-pretty', options: { /* ... */ } }
      : undefined,
  });
  ```

  - Pino version pinned: `pino ^9.3.2` (sabwa-node `package.json`).
  - JSON in prod, `pino-pretty` in TTY dev.
  - `base.svc` identifies the service. SabFlow workers MUST set
    `base.svc = 'sabflow-worker'` (Node workers) or `'sabflow-executor-rust'`
    (Rust workers).

### 2.3 Rust side (already OTel-wired)

- `rust/crates/observability/` is a workspace crate exposing
  `init_telemetry(service_name, otlp_endpoint)`:
  - `tracing 0.1` + `tracing-subscriber 0.3` with `EnvFilter`, JSON formatter
    in `SABNODE_ENV=production`, pretty in dev.
  - `tracing-opentelemetry 0.28` bridge.
  - `opentelemetry-otlp 0.27` HTTP/proto exporter, same target as the Node
    `@opentelemetry/exporter-trace-otlp-http`.
  - Resource attribute: `service.name = <service_name>` via
    `opentelemetry-semantic-conventions`.
- **Mandatory:** Rust workers call this crate at startup with
  `service_name = "sabflow-executor-rust"` and **MUST** call
  `opentelemetry::global::shutdown_tracer_provider()` on SIGTERM/SIGINT to
  flush the batch span processor (the crate doc-comment is explicit on this).

**Reuse contract:** the Node executor calls `withSpan` from
`src/lib/ops/tracing.ts`; the Rust executor calls `sabnode_observability::init_telemetry`.
Both export OTLP/HTTP to the same collector endpoint
(`OTEL_EXPORTER_OTLP_ENDPOINT`), so spans from a single execution stitch
together even when work hops the Node/Rust boundary via trace-context
propagation (W3C `traceparent`).

## 3. OTEL span tree

One execution produces this exact shape. Span names are stable identifiers
used by dashboards and tail-sampling rules.

```
sabflow.execution                                 (root)
├─ sabflow.credentials.resolve                    (per credential lookup)
├─ sabflow.node.<type>                            (one per node invocation)
│  ├─ sabflow.expression.eval                     (per expression batch)
│  ├─ sabflow.credentials.resolve                 (if node-scoped)
│  └─ sabflow.node.http_request                   (outbound HTTP only)
├─ sabflow.node.<type>
│  └─ ...
└─ ...
```

### 3.1 `sabflow.execution` (root)

| Attribute     | Type     | Notes                                              |
| ------------- | -------- | -------------------------------------------------- |
| `executionId` | string   | ULID, same value as the execution record `_id`.    |
| `workspaceId` | string   | Always present (multi-tenant invariant).           |
| `workflowId`  | string   | ULID of the workflow definition.                   |
| `mode`        | string   | `manual` \| `trigger` \| `webhook` \| `retry` \| `cli`. |
| `status`      | string   | `running` \| `success` \| `error` \| `canceled`. Set on `end()`. |

### 3.2 `sabflow.node.<type>` (child per node)

Span name is dynamic: `sabflow.node.httpRequest`, `sabflow.node.set`, etc.
The `<type>` segment uses the **camelCase n8n type id** so it stays grep-able
across the n8n-compat contract.

| Attribute        | Type    | Notes                                                |
| ---------------- | ------- | ---------------------------------------------------- |
| `nodeId`         | string  | Unique within the workflow (DAG node id).            |
| `typeVersion`    | number  | n8n node `typeVersion`, e.g. `1`, `2.1`.             |
| `tries`          | number  | 1-based; final value at `end()` reflects retries.    |
| `itemsIn`        | number  | Length of input item array.                          |
| `itemsOut`       | number  | Length of output item array (0 on error).            |
| `error`          | string? | Error class name only when `status=error` (e.g. `NodeApiError`); never the message body if it might contain user data — see §6. |

Inherits `executionId`, `workspaceId`, `workflowId` via span context (do not
re-set; collectors will pick them up from the parent).

### 3.3 `sabflow.node.http_request` (child of node)

Only for outbound HTTP. Attributes follow OTel HTTP semantic conventions
(`http.request.method`, `http.response.status_code`, `url.full` with query
string **stripped**, `server.address`). Do **not** record request or response
bodies (§6).

### 3.4 `sabflow.credentials.resolve`

Wraps a credential lookup (decrypt + inject). Attributes:
`credential.type` (e.g. `httpBasicAuth`), `credential.id` (ULID, opaque).
**Never** records the credential value, scope, or secret length.

### 3.5 `sabflow.expression.eval`

Wraps the evaluation pass for one node's expressions (batched, not per item).
Attributes: `expression.count` (number of distinct expressions),
`expression.itemsEvaluated` (total item × expression evaluations). The
**expression source string is not recorded** because it can contain
hard-coded secrets in user workflows.

## 4. Log fields (Pino-compat)

All executor log lines are JSON objects with this exact field shape, mirrored
by both the Node worker (Pino) and the Rust worker (`tracing` JSON formatter):

| Field         | Required | Notes                                              |
| ------------- | -------- | -------------------------------------------------- |
| `workspaceId` | **yes**  | Always; failing this check is a release blocker. Logs without it cannot be tenant-scoped. |
| `executionId` | when in an execution | ULID.                                  |
| `nodeId`      | when in a node span  | DAG node id.                           |
| `nodeType`    | when in a node span  | n8n type id, e.g. `httpRequest`.       |
| `level`       | **yes**  | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`. |
| `msg`         | **yes**  | Short human string. Never interpolate user data here. |
| `err`         | when level=`error` | Serialized `{ name, message, stack }` — see §6 for redaction. |
| `time`        | **yes**  | ISO-8601 (`pino.stdTimeFunctions.isoTime`).        |
| `svc`         | **yes**  | `sabflow-worker` \| `sabflow-executor-rust`.       |
| `traceId`     | when active | From `currentTraceId()` / `tracing-opentelemetry`. Enables log-to-trace pivot. |

Pino logger setup MUST mirror `services/sabwa-node/src/log.ts` (JSON in prod,
`pino-pretty` only when stdout is a TTY in dev). Rust workers reuse
`sabnode-observability::init_telemetry` as-is.

**Sampling:** all log lines are emitted (no log-level sampling at the
producer). Volume control is done by `LOG_LEVEL` env var (default `info`) and
by retention policy in the log sink — not by dropping lines in the worker.

## 5. Metrics taxonomy

Prometheus + OTEL names (Prometheus naming style with units suffixed; OTEL
exporter rewrites to dotted style automatically). All metrics carry an implicit
`service.name` resource attribute; do not duplicate it as a label.

| Metric                              | Type      | Labels                | Purpose                                              |
| ----------------------------------- | --------- | --------------------- | ---------------------------------------------------- |
| `sabflow_executions_total`          | Counter   | `status`, `mode`      | One increment per finished execution.                |
| `sabflow_execution_duration_seconds`| Histogram | `status`              | End-to-end wall-clock per execution.                 |
| `sabflow_node_duration_seconds`     | Histogram | `type`                | Wall-clock per node invocation.                      |
| `sabflow_node_retries_total`        | Counter   | `type`, `reason`      | One increment per retried attempt (n8n `continueOnFail` / `retryOnFail`). `reason` ∈ `network`, `rate_limit`, `node_error`, `timeout`, `other`. |
| `sabflow_workers_inflight`          | Gauge     | (none)                | Process-local in-flight execution count.             |

**Label hygiene:**

- `workspaceId` is **NOT** a metric label (high-cardinality blowup). Use logs
  + traces for per-tenant attribution.
- `type` uses the n8n type id, same value as the `<type>` segment of the node
  span name.
- Histogram buckets: default OTel exponential buckets are fine; we tune in
  Track B Phase 9 once we have real production curves.

## 6. Sampling & privacy

### 6.1 Trace sampling

Apply tail-based sampling at the collector (not head-based at the SDK), so we
get the routing decision **after** the root span sees `status`:

- **100%** of executions with `status=error` or any child span with
  `SpanStatusCode.ERROR`.
- **10%** of executions with `status=success`.
- Executions with `status=canceled` follow the success rate.

This is implemented in the OTel Collector's `tail_sampling` processor; the
SDK ships every span. Producers must NOT pre-sample.

### 6.2 Log sampling

**Logs are not sampled.** Every line is shipped. Cost control is via
`LOG_LEVEL` (production default: `info`; bumped to `debug` per-workspace via a
feature flag during incident response).

### 6.3 Privacy (release-blocker rules)

What is **never** allowed in spans, logs, or metric labels:

1. **Node parameters.** A node's user-configured parameters object — including
   URLs with embedded credentials, header names that hint at API keys, custom
   JS expressions, SQL fragments, prompt strings. Spans record only `nodeType`
   and counts.
2. **Credential values.** No secret, no token, no decrypted material. The
   `sabflow.credentials.resolve` span records only `credential.id` and
   `credential.type`. If a logger sees a field name matching
   `/secret|token|password|api[_-]?key|authorization/i`, it MUST be redacted
   to `'[REDACTED]'` before serialization.
3. **Input / output JSON.** Item arrays are summarized as counts (`itemsIn`,
   `itemsOut`). Never log the items themselves, not even at `debug`. If a
   future feature needs per-item replay, it goes to the encrypted execution
   record (Track B Phase 7), not to traces or logs.
4. **Error message bodies that may carry user data.** `err.message` is logged
   only when the worker is confident the message came from the
   executor/runtime (e.g. timeout, validation). Errors from third-party HTTP
   responses log `err.name` + status code only; the body goes to the
   execution record where it is access-controlled.
5. **Webhook headers and query strings.** Spans record method, host, and
   stripped path; never the full URL with query, never `Authorization` /
   `Cookie` headers.

### 6.4 File references (SabFiles policy)

Per `CLAUDE.md`'s SabFiles policy, every file in SabNode lives in SabFiles —
never an external URL. When a node parameter is a file, the executor sees a
**SabFile ID** (e.g. `sf_01J...`). That ID is safe to record in spans and
logs as `sabfile.id`. The R2 object URL is never embedded. If a node
parameter ever contains a raw `https://` URL pointing at user-uploaded
content, that is a **bug in the picker plumbing** (the file input should have
forced a `<SabFilePicker>` / `<SabFileUrlInput>` flow) — log it at `warn`
with `msg: "non-sabfile url in node parameter"` and the `nodeId`, but
**never** the URL itself.

## 7. Consequences

- Dashboards built against this taxonomy keep working whether the worker is
  Node or Rust, so Phase 9's Rust-vs-Node decision per node type does not
  break observability.
- The collector tail-sampler is the only component that needs to know about
  the 100%-error / 10%-success rule; producers stay simple.
- `workspaceId`-as-required-log-field is enforced by lint (a TypeScript
  helper that takes a typed logger) and by a release-blocker check that
  greps shipped log lines for missing `workspaceId` in CI smoke tests.
- The privacy ruleset is the contract for the Track B Phase 7 execution
  record schema: anything *forbidden* in observability is what *belongs* in
  the encrypted, access-controlled execution record instead.

## 8. Open questions (deferred, not blockers for Phase 1)

- Histogram bucket tuning — owned by Track B Phase 9 once real traffic exists.
- Whether to ship a Pino transport that auto-fans logs into the OTel logs
  pipeline (so we have one collector) — revisit when OTel logs GA stabilizes.
- Prometheus exporter vs OTLP push for metrics — defer to Phase 9 ops review.
