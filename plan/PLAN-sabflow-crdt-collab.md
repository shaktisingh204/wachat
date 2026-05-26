# SabFlow — Real-time Collab + Rust Executor Plan

**Goal:** ship two coordinated tracks for SabFlow:

- **Track A — Real-time collab:** WebSocket CRDT editing on top of an n8n-modeled foundation.
- **Track B — Rust executor:** an n8n-compatible workflow execution engine, written in Rust where benchmarks justify it, otherwise mirroring n8n's Node worker model.

Use Rust only for components where a benchmark proves a meaningful win (>=30% sustained); everywhere else, mirror n8n's stack (TypeScript / Node / Bull-style queues / Mongo+R2 in place of Postgres).

## Execution model

- **20 phases total** (Track A: 10, Track B: 10).
- Tracks may run **in parallel**; phases within a track run **sequentially**.
- Each phase dispatches **10 agents in parallel** (one per sub-task).
- A phase closes only when all 10 sub-tasks land green (CI + review).
- Each phase merges into a `phase/<track>-N-<name>` branch before the next phase in that track opens.
- Track A and Track B share Phase 1 ADR + bench harness; do Track B Phase 1 second so it inherits the Rust-vs-Node verdict.

---

## Track A — Phase 1 — Foundation (n8n-modeled; Rust where it wins)

Baseline: **mirror n8n** (TypeScript, Node 24, Yjs, Bull/Redis queues, Mongo+R2 instead of n8n's Postgres). Switch to Rust **only** when a benchmark in this phase shows >=30% sustained gain on a hot path.

1. Survey n8n editor state-management (Pinia + REST save); decide whether SabFlow keeps that model or replaces with CRDT doc.
2. Adopt n8n workflow JSON schema shape (nodes / connections / settings) for the SabFlow doc schema; document deltas.
3. Survey n8n's push module (server-sent + WS); design SabFlow WS gateway as Node baseline.
4. Bench harness: Node WS gateway vs Rust (tokio + tungstenite) at N=2 / 10 / 50 / 200 clients/doc. Pick winner per metric.
5. CRDT lib pick: Yjs (default). Only switch to `yrs` (Rust) if step 4 bench beats Yjs by >=30% on encode/decode + memory.
6. Persistence design: n8n uses TypeORM+Postgres; we keep Mongo+R2. Map n8n's `workflow_entity` and `execution_entity` to our collections.
7. Auth: reuse SabNode dual-auth (httpOnly cookie + JWT); map n8n's owner/member roles to SabNode RBAC keys.
8. Plan-tier seat model: study n8n cloud seat pricing; map to SabNode credit + plan-gate plumbing.
9. Executor decision: n8n queue-mode (Bull + Redis + Node workers) is the baseline. Bench a Rust executor for the hot expression/transform path; adopt Rust only if it wins.
10. ADR write-up + bench harness checked in at `docs/adr/sabflow-foundation.md` + sign-off.

## Track A — Phase 2 — Persistence layer

1. Mongo `sabflow_docs` snapshot collection (n8n-style `workflow_entity` shape).
2. Mongo `sabflow_oplog` append-only changes (CRDT updates).
3. R2 cold-storage snapshot tier for >30-day docs.
4. Indexes + TTL policies.
5. Snapshot compaction worker (folds oplog into snapshot).
6. Old-update GC job (Vercel Cron).
7. Repo layer (`load / save / append / compact`).
8. Multi-tenant row-level guards (workspaceId + RBAC).
9. Audit-trail writer (n8n `audit_log` equivalent).
10. Backup / restore runbook.

## Track A — Phase 3 — WebSocket gateway

1. Service location decision (Next.js route handler vs `services/sabflow-ws` standalone, decision driven by Phase 1 bench).
2. JWT auth + workspace claim verify on upgrade.
3. Room model (1 doc = 1 room).
4. Connection lifecycle + heartbeat.
5. Reconnect / backoff protocol.
6. Backpressure + per-connection rate limit.
7. Plan-tier seat enforcement (reject N+1 connection).
8. Pino logging + OTEL spans.
9. Health + metrics endpoint.
10. Local dev harness + Docker compose entry.

## Track A — Phase 4 — Sync protocol

1. Initial sync (snapshot + delta).
2. Update broadcast fan-out (room subscribers).
3. Awareness diff broadcast.
4. Vector-clock / state-vector exchange.
5. Ack / nack + idempotency keys.
6. Message framing + binary encoding (Yjs update format).
7. Compression (`permessage-deflate`).
8. Batching + debounce policy.
9. Ordering + causal guarantees doc.
10. Protocol fuzz tests.

## Track A — Phase 5 — Client SDK

1. `useSabFlowDoc` hook.
2. `usePresence` hook.
3. `<SabFlowProvider>` wrapper.
4. Optimistic apply + rollback.
5. Offline queue + replay.
6. Undo / redo manager (CRDT-aware).
7. Schema-migration runner.
8. Error boundary + toast surfacing.
9. Telemetry hooks.
10. Public type exports + docs.

## Track A — Phase 6 — Editor integration

1. Replace local node state with CRDT array.
2. Replace edge state.
3. Position drag -> CRDT op (throttled).
4. Group / lock -> CRDT ops.
5. Multi-select awareness.
6. Remote cursor rendering.
7. User-color assignment (deterministic from userId).
8. Focused-node highlights.
9. Conflict-resolution UX (toast + diff view).
10. Editor perf regression check vs main.

## Track A — Phase 7 — Presence & awareness

1. Extend existing in-memory presence store (commit `7178c9f80`) into the Yjs awareness protocol.
2. User avatars in canvas chrome.
3. Live cursor positions.
4. Selection highlights.
5. Typing / edit indicators.
6. Follow-user mode.
7. Presence sidebar list.
8. Idle / away detection.
9. Redis pub/sub fan-out for multi-instance.
10. Presence audit / export.

## Track A — Phase 8 — Access control

1. Per-doc RBAC keys registered in SabNode RBAC registry.
2. Viewer / commenter / editor / admin roles.
3. Share-link tokens + revoke.
4. Plan gating (free = solo, paid tiers = multi-seat).
5. Credit metering for active collab seats.
6. Invite + email flow.
7. Access audit log.
8. Owner transfer.
9. Workspace-admin override.
10. RBAC test matrix.

## Track A — Phase 9 — Reliability & recovery

1. Crash recovery from snapshot + oplog.
2. WS server failover playbook.
3. Replica sync between WS instances.
4. Doc-corruption detector.
5. Manual repair CLI.
6. Version-history UI.
7. Branch / fork doc.
8. Export (JSON) + import (n8n workflow.json compat).
9. Disaster-recovery runbook.
10. Chaos test plan.

## Track A — Phase 10 — Perf, tests, rollout

1. Load test (N=2 / 10 / 50 / 200 clients per doc).
2. Latency SLO + p99 budget.
3. Snapshot-size benchmarks.
4. Grafana dashboards.
5. Playwright multi-client E2E suite.
6. Soak test (24h).
7. Feature-flag wiring (`sabflow.crdt.enabled`).
8. Plan-tier rollout gate.
9. Docs-site update + changelog entry.
10. Demo recording + internal announce.

---

# Track B — Rust executor (n8n-compatible)

Baseline: **mirror n8n queue-mode** (Bull-style queue on Redis, worker processes, per-node execution contract, expression engine, credential store). Implement workers in Rust where Track A Phase 1 bench (or each phase's own bench) shows a clear win; otherwise stay in Node.

## Track B — Phase 1 — Foundation & contract

1. Survey n8n's executor (queue-mode, Bull, worker process model, `WorkflowExecute` lifecycle).
2. Define node-execution contract: `inputs`, `outputs`, `credentials`, `parameters`, `error`, `continueOnFail`.
3. Define workflow IR: DAG with branches, loops, sub-workflows, error trigger.
4. Define execution-state schema: `new / running / waiting / success / error / canceled` + per-node status.
5. Pick Rust runtime stack (tokio + axum or tonic).
6. Crate layout under `rust/crates/sabflow-executor/` (core, nodes, queue, expression).
7. Node <-> Rust IPC choice (HTTP, gRPC, or stdin/stdout NDJSON) with bench.
8. Error taxonomy + retry semantics (n8n-compat: `NodeApiError`, `NodeOperationError`).
9. Observability spec (OTEL traces per node, structured logs, Pino-compat fields).
10. ADR + bench harness at `docs/adr/sabflow-executor.md` + sign-off.

## Track B — Phase 2 — Queue & dispatcher

1. Redis queue model (Bull-compat schema so n8n tooling can inspect).
2. Job enqueue API on Node side (`enqueueExecution(workflowId, triggerData)`).
3. Rust dispatcher worker loop (poll + claim + heartbeat).
4. Priority + per-workspace concurrency limits.
5. Retry policy + exponential backoff.
6. Dead-letter queue + alerting.
7. Rate limiting per workspace + per plan tier.
8. Graceful shutdown (drain in-flight jobs).
9. Job cancellation (cooperative + hard kill).
10. Queue metrics (depth, age, claim latency) -> Grafana.

## Track B — Phase 3 — Built-in nodes (core set)

1. HTTP Request node (n8n-parity options).
2. Webhook trigger node.
3. Cron / Schedule trigger node (Vercel Cron bridge).
4. Set / Transform node (expression eval).
5. IF / Switch node.
6. Loop Over Items / Merge node.
7. Wait / Delay node.
8. Function node (sandboxed JS via QuickJS or Deno core).
9. Code node (multi-line, sandboxed).
10. Error Trigger / Catch node.

## Track B — Phase 4 — Expression engine

1. Expression syntax compat with n8n (`{{ $json.foo }}`, `$node["X"]`, `$now`, etc.).
2. Tokenizer.
3. Parser (AST).
4. Evaluator with `$` context binding.
5. Built-in helpers (`$json`, `$node`, `$now`, `$workflow`, `$execution`, `DateTime`, `JMESPath`).
6. Sandbox / safety (no `eval`, no fs, no net).
7. Type coercion rules matching n8n.
8. Error reporting (location, hovered value, surrounding context).
9. Performance bench vs n8n's tournament expression evaluator.
10. Fuzz tests + n8n expression test corpus replay.

## Track B — Phase 5 — Credentials & secrets

1. Credential schema (n8n-compat; importable).
2. Encrypted storage (AES-256-GCM, key from Vercel env / KMS).
3. KMS / key-rotation design.
4. Credential injection into node runtime.
5. OAuth2 token refresh worker.
6. Per-workspace credential scoping.
7. Audit log of credential read / use.
8. Credential "test connection" endpoint per integration.
9. Bulk import from n8n `credentials.json` export.
10. RBAC keys for credential CRUD + share.

## Track B — Phase 6 — Triggers & schedules

1. Webhook receiver (Next.js route -> Rust dispatcher).
2. Cron trigger registration backed by Vercel Cron.
3. Email trigger (IMAP IDLE worker).
4. Chat / message triggers (Slack, SabWa / WhatsApp, Telegram).
5. Database / change-stream triggers (Mongo change streams).
6. Manual trigger (editor "Execute workflow" button).
7. Polling trigger framework (interval + dedupe key).
8. Trigger debouncing + coalescing.
9. Trigger health + last-fire monitoring.
10. Trigger replay / backfill tool.

## Track B — Phase 7 — Execution state & history

1. Execution record schema (n8n `execution_entity` shape).
2. Live execution stream over WS push to editor (shared with Track A gateway).
3. Per-node input / output capture with size limit.
4. Replay execution from history.
5. Pin data per node (n8n testing aid).
6. Retry from failed node (partial re-execution).
7. Execution comparison / diff view.
8. Storage retention by plan tier.
9. R2 archival of executions older than retention window.
10. Export single execution as JSON.

## Track B — Phase 8 — Integrations (third-party nodes)

1. Node SDK contract (Rust trait or WASM ABI) + versioning.
2. WASM plugin loader for community nodes (sandboxed).
3. First-party: Google Sheets node.
4. First-party: Postgres / MySQL / Mongo nodes.
5. First-party: Slack node.
6. First-party: Webhook-Respond node.
7. First-party: OpenAI / Vercel AI Gateway node.
8. First-party: SabFiles node.
9. First-party: SabWa (WhatsApp via `services/sabwa-node/`) node.
10. Internal node marketplace registry + install flow.

## Track B — Phase 9 — Reliability & scale

1. Worker pool autoscaling (signal: queue depth + claim latency).
2. Crash recovery (resume from last checkpoint per node).
3. Idempotency for webhook deliveries.
4. At-least-once vs exactly-once semantics doc + tests.
5. Sub-workflow execution + parent/child linkage.
6. Transaction boundaries (which side effects are retried).
7. Memory limits per execution (cgroup or rlimit).
8. Timeout enforcement per node + per workflow.
9. Resource isolation per tenant (CPU, mem, queue).
10. Chaos tests (kill worker mid-execution; restart; verify resume).

## Track B — Phase 10 — Perf, security, rollout

1. Throughput bench (executions/sec/worker) vs n8n on the same workload.
2. Latency p50 / p99 per node type.
3. Memory footprint vs n8n.
4. Security review (sandbox escape, SSRF, expression injection, secret leak).
5. Cost model per execution (Active CPU + invocations on Fluid Compute).
6. Plan-tier execution budgets + overage handling.
7. Feature-flag rollout (`sabflow.executor.rust.enabled`).
8. Migration tool: import n8n `workflow.json` -> SabFlow doc.
9. Docs + node reference site.
10. Demo + internal announce + customer pilot list.

---

## Open questions

1. Confirmed scope: **both tracks**. Track A (CRDT collab) and Track B (Rust executor) run in parallel.
2. Each phase's 10 agents share a `phase/<track>-N-<name>` branch; sub-tasks land as separate commits, then the phase branch merges to `main` on green CI + review.
3. Phase transitions gated on: all 10 sub-tasks merged + CI green + one human review on the phase branch.
4. Hard rule: any Rust adoption (gateway, executor core, expression engine, individual nodes) requires the bench in its phase to beat the Node baseline by >=30%. Otherwise stay on the n8n-style Node implementation.
5. Track B Phase 1 starts after Track A Phase 1 so it inherits the Rust-vs-Node bench harness and verdict.
