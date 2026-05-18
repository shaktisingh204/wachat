# ADR — SabFlow Executor Foundation (Track B, Phase 1)

**Status:** Proposed — umbrella for Track B Phase 1
**Date:** 2026-05-18
**Scope:** n8n-compatible workflow execution engine for SabFlow
**Phase branch:** `phase/b-1-foundation`

---

## 1. Goal

SabFlow ships an **n8n-compatible workflow executor** that mirrors n8n's queue-mode topology (Bull-style queue on Redis + worker processes + per-node execution contract + expression engine + credential store) so existing n8n workflows, tooling, and operator mental models port directly. The platform baseline is **Node 24 + TypeScript + Bull + Redis on Vercel Fluid Compute**, identical in shape to n8n queue-mode. **Rust workers replace a hot path only when an in-phase benchmark under `benches/sabflow-executor/` proves a sustained >=30% win** on the metric that matters for that path (throughput, p99 latency, expression-eval time, or memory). Everywhere else we stay on the n8n-style Node worker. This ADR is the umbrella that pins that baseline, cross-references the nine sibling deliverables that detail each component of the contract / IR / state / stack / IPC / errors / observability, and defines the sign-off gate that closes Phase 1 and unblocks Phase B.2 (queue & dispatcher). It inherits the Rust-vs-Node verdict shape from Track A Phase 1's `benches/sabflow-executor/` harness.

## 2. Cross-references — sibling deliverables

The nine sibling sub-tasks land alongside this file. Each is owned by its agent; this ADR does **not** rewrite their conclusions, only points at them.

| # | Expected filename | One-line summary |
|---|---|---|
| 1 | `docs/adr/sabflow-executor-n8n-survey.md` | Survey of n8n's executor internals — queue-mode, Bull, worker process model, and `WorkflowExecute` lifecycle — as the compatibility target for every downstream sub-task. |
| 2 | `src/lib/sabflow/executor/contract.ts` | TypeScript node-execution contract — `inputs`, `outputs`, `credentials`, `parameters`, `error`, `continueOnFail` — n8n-shaped, shared across Node and Rust workers. |
| 3 | `src/lib/sabflow/executor/ir.ts` | Workflow intermediate representation: DAG with branches, loops, sub-workflows, and error-trigger semantics, encoded as the canonical input to any worker. |
| 4 | `src/lib/sabflow/executor/state.ts` + `docs/adr/sabflow-execution-state.md` | Execution-state schema (`new / running / waiting / success / error / canceled` + per-node status) and the ADR that fixes its lifecycle transitions. |
| 5 | `docs/adr/sabflow-executor-rust-stack.md` | Rust runtime stack pick (tokio + axum baseline, tonic considered) for the worker process, gated by the >=30% bench rule. |
| 6 | `rust/crates/sabflow-executor/{core,nodes,queue,expression,errors}/` | Crate layout for the Rust executor: `core` (lifecycle), `nodes` (built-ins), `queue` (Bull-compat client), `expression` (eval), `errors` (taxonomy). |
| 7 | `docs/adr/sabflow-executor-ipc.md` | Node <-> Rust IPC choice (HTTP vs gRPC vs stdin/stdout NDJSON) with a bench-driven verdict consumed by sub-tasks 5 and 6. |
| 8 | `src/lib/sabflow/executor/errors.ts` | Error taxonomy + retry semantics, n8n-compatible (`NodeApiError`, `NodeOperationError`), shared by Node fallback and Rust workers. |
| 9 | `docs/adr/sabflow-executor-observability.md` | Observability spec — OTEL span names per node, structured logs, Pino-compatible fields — registered before Phase B.2 lands. |

> **Constraint:** Sibling deliverables are owned by their agents; this umbrella ADR is intentionally independent of their final wording. If any sibling lands a conclusion that conflicts with the baseline below, the resolution path is a follow-up amendment to this file — not a silent override.

## 3. Decision baseline

Independent of how the sibling deliverables land in detail, the umbrella decision for Track B Phase 1 is:

- **Language / runtime (default):** Node 24 + TypeScript workers, deployed on Vercel Fluid Compute (Node.js runtime). This is the unconditional fallback.
- **Queue:** Bull on Redis, Bull-compatible job schema so existing n8n tooling can inspect queues.
- **Executor topology:** n8n queue-mode — Node API enqueues, worker processes claim and execute. No in-process execution in the API path.
- **Rust worker stack (when adopted):** tokio + axum (HTTP IPC) as the baseline pick; tonic / gRPC reserved for the IPC ADR's verdict.
- **Crate home:** `rust/crates/sabflow-executor/` with sub-crates `core / nodes / queue / expression / errors`.
- **Feature flag:** Rust workers ship behind `sabflow.executor.rust.enabled`. Default OFF. Toggled per-workspace and per-node-type so we can roll out one hot path at a time.
- **Node contract / IR / state / errors:** Defined in TypeScript first (sub-tasks 2, 3, 4, 8); Rust crates consume the same shapes via codegen or hand-mirrored structs. The TS files are the source of truth.
- **Auth / RBAC / plan-gate / credits:** Reuse SabNode dual-auth + RBAC keys + plan-gate + credit metering. No new auth or billing primitives.
- **Persistence:** Inherits Track A Phase 1's Mongo (`sabflow_docs` + `sabflow_oplog`) + R2 cold-tier; execution state lands in a separate `sabflow_executions` collection defined by sub-task #4.
- **Rust adoption rule:** A hot path switches from Node to Rust **only** if its bench under `benches/sabflow-executor/` shows a **sustained >=30% gain** on the metric that matters for that path (throughput, p99 latency, expression-eval time, or memory). Synthetic micro-benchmark wins do **not** trigger adoption — the gain must reproduce under the realistic workload shape from Track A Phase 1 sub-task #9's harness.
- **Out of scope for Phase 1:** queue dispatcher implementation (Phase B.2), built-in nodes (Phase B.3), expression engine internals (Phase B.4), credentials store (Phase B.5), triggers & schedules (Phase B.6), execution history UI (Phase B.7), third-party node SDK (Phase B.8), reliability runbooks (Phase B.9), perf / security / rollout (Phase B.10).

## 4. Sign-off checklist

Phase 1 closes — and `phase/b-1-foundation` becomes eligible to merge into `main`, unblocking Phase B.2 — only when **every** box below is checked.

- [ ] All 9 sibling files landed on main
- [ ] `cargo check` on all `sabflow-executor-*` crates passes
- [ ] TypeScript compile passes on `src/lib/sabflow/executor/*`
- [ ] OTEL span names registered in observability spec
- [ ] Phase B.2 (queue + dispatcher) branch created
- [ ] CI green on `phase/b-1-foundation`

## 5. Conflict resolution

Any disagreement between a sibling deliverable and this umbrella ADR is resolved via an **amendment PR against this file**. The umbrella and the siblings must never be allowed to disagree silently — if a sibling's final wording diverges from §3, the sibling agent (or whoever discovers the divergence) files an amendment PR that either:

1. updates §3 to match the sibling's verdict (when the sibling's evidence is stronger — e.g. a bench result), **or**
2. updates the sibling to match §3 (when §3's baseline holds and the sibling overreached).

Either way, the amendment lands on `main` before Phase B.2 starts. No "we'll reconcile later" — the conflict is closed inside Phase 1.

## 6. Follow-ups

- Phase B.2 (queue & dispatcher) inherits the queue schema from sub-task #1's survey and the worker contract from sub-tasks #2 / #3 / #4.
- Phase B.4 (expression engine) inherits the Rust-vs-Node verdict from `benches/sabflow-executor/` plus the IPC choice from sub-task #7.
- Phase B.10 (rollout) flips `sabflow.executor.rust.enabled` per workspace / per node-type only after each adopted hot path has cleared its >=30% bench gate on production-shaped workloads.
