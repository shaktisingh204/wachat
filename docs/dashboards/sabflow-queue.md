# Dashboard: SabFlow Queue & Dispatcher Health

**Status:** Sketch (Track B · Phase 2 · sub-task #10).
**Owner:** SabFlow / Track B.
**Companion:** `docs/adr/sabflow-executor-observability.md` (metric taxonomy + cardinality rules — `workspaceId` is **never** a label).

This file is a panel-list specification for the Grafana dashboard that goes alongside the SabFlow executor. The metrics are emitted by:

- `src/lib/sabflow/queue/metrics.ts` — Node-side gauges sampled from Redis (queue depth, oldest age).
- `rust/crates/sabflow-executor/queue/src/metrics.rs` — Rust dispatcher histograms (claim latency, job duration) and counters (jobs total).

The dashboard JSON is generated from this spec when the Phase B.10 `/metrics` endpoint lands; until then this is the single source of truth for which panels we want.

## Variables

| Variable | Type | Source | Notes |
| -------- | ---- | ------ | ----- |
| `queue` | multi-value | label_values(`sabflow_queue_wait`, `queue`) | Bounded set: `executions`, `webhooks`, `cron`. Default: all. |
| `status` | multi-value | label_values(`sabflow_dispatcher_jobs_total`, `status`) | `success`, `error`, `canceled`. |
| `interval` | interval | builtin | 30s default; the sampler polls Redis every 15 s, so anything below that aliases. |

## Row 1 — Queue depth (Node-side gauges)

1. **Wait depth per queue** — Stacked time-series.
   - `sabflow_queue_wait{queue=~"$queue"}`
   - Unit: jobs. Legend: `{{queue}}`.
2. **Active depth per queue** — Stacked time-series.
   - `sabflow_queue_active{queue=~"$queue"}`
3. **Delayed depth per queue** — Time-series.
   - `sabflow_queue_delayed{queue=~"$queue"}`
4. **Failed depth per queue** — Time-series with red threshold line at 50.
   - `sabflow_queue_failed{queue=~"$queue"}`
5. **DLQ rate (5 m delta)** — Bar gauge, red threshold at 1.
   - `increase(sabflow_queue_dlq{queue=~"$queue"}[5m])`
   - Alert candidate: any non-zero value for ≥ 10 m.

## Row 2 — Oldest-job age (Node-side gauge)

6. **Oldest waiting job age** — Time-series, per queue.
   - `sabflow_queue_oldest_age_seconds{queue=~"$queue"}`
   - Unit: seconds. Threshold lines: 60 s (yellow), 300 s (red).
   - Alert candidate: > 300 s for ≥ 5 m on the `executions` queue.

## Row 3 — Dispatcher claim latency (Rust histogram)

7. **Claim latency p50 / p95 / p99** — Time-series.
   - `histogram_quantile(0.50, sum by (le) (rate(sabflow_dispatcher_claim_latency_seconds_bucket[5m])))`
   - `histogram_quantile(0.95, sum by (le) (rate(sabflow_dispatcher_claim_latency_seconds_bucket[5m])))`
   - `histogram_quantile(0.99, sum by (le) (rate(sabflow_dispatcher_claim_latency_seconds_bucket[5m])))`
   - Unit: seconds (ms format). The dispatcher uses a BRPOPLPUSH loop, so the happy path is sub-ms; the histogram should be peaky around the lowest bucket when load is steady.

## Row 4 — Job duration (Rust histogram)

8. **Job duration p99 by status** — Time-series, one series per `status`.
   - `histogram_quantile(0.99, sum by (le, status) (rate(sabflow_dispatcher_job_duration_seconds_bucket{status=~"$status"}[5m])))`
   - Long tails on `error` are the most actionable signal here — they usually mean a node ran to its retry-budget ceiling before throwing.
9. **Job duration p50 vs p99 — success only** — Time-series.
   - `histogram_quantile(0.50, sum by (le) (rate(sabflow_dispatcher_job_duration_seconds_bucket{status="success"}[5m])))`
   - `histogram_quantile(0.99, sum by (le) (rate(sabflow_dispatcher_job_duration_seconds_bucket{status="success"}[5m])))`

## Row 5 — Throughput + status mix (Rust counter)

10. **Jobs per second by queue** — Stacked time-series.
    - `sum by (queue) (rate(sabflow_dispatcher_jobs_total{queue=~"$queue"}[1m]))`
11. **Status mix per queue (last 1 h)** — Pie chart, per-queue.
    - `sum by (status) (increase(sabflow_dispatcher_jobs_total{queue=~"$queue"}[1h]))`
12. **Error rate per queue** — Time-series with red threshold at 1 %.
    - `sum by (queue) (rate(sabflow_dispatcher_jobs_total{queue=~"$queue",status="error"}[5m])) / sum by (queue) (rate(sabflow_dispatcher_jobs_total{queue=~"$queue"}[5m]))`
    - Alert candidate: > 5 % for ≥ 10 m on the `executions` queue.

## Row 6 — Dispatcher in-flight (cross-reference Phase B.10)

13. **Dispatcher in-flight executions** — Time-series.
    - `sabflow_workers_inflight` (sourced from the executor process, NOT the queue sampler — see `docs/adr/sabflow-executor-observability.md` §5).
    - This panel lives on the dispatcher dashboard side too; cross-link from there.

## Alert summary (companion to this dashboard)

| Name | Condition | Severity |
| ---- | --------- | -------- |
| sabflow_queue_dlq_growing | `increase(sabflow_queue_dlq{queue=~"executions\|webhooks\|cron"}[10m]) > 0` for 10 m | high |
| sabflow_queue_oldest_age_high | `sabflow_queue_oldest_age_seconds{queue="executions"} > 300` for 5 m | high |
| sabflow_dispatcher_claim_latency_high | `histogram_quantile(0.99, sum by (le) (rate(sabflow_dispatcher_claim_latency_seconds_bucket[5m]))) > 0.5` for 10 m | medium |
| sabflow_dispatcher_error_rate_high | `sum(rate(sabflow_dispatcher_jobs_total{status="error"}[5m])) / sum(rate(sabflow_dispatcher_jobs_total[5m])) > 0.05` for 10 m | high |

## Cardinality discipline reminder

The ADR (`docs/adr/sabflow-executor-observability.md` §5) is explicit: `workspaceId` is **not** a metric label. Per-tenant attribution comes from logs + traces, never from time-series. If you find yourself wanting to slice this dashboard by workspace, that signal belongs in a log panel pivoted on `workspaceId`, not in a new Prometheus label.
