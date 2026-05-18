# ADR — SabFlow Foundation (Track A, Phase 1)

**Status:** Proposed — umbrella for Track A Phase 1
**Date:** 2026-05-18
**Scope:** Real-time CRDT collab on top of an n8n-modeled SabFlow stack
**Phase branch:** `phase/a-1-foundation`

---

## 1. Goal

SabFlow ships real-time, multi-user CRDT collaboration on a workflow editor whose document model, execution semantics, and operational primitives mirror n8n (nodes / connections / settings JSON, queue-mode workers, push-style updates). The platform baseline is **Node 24 + TypeScript + Yjs + Mongo + R2 + the existing SabNode dual-auth + RBAC + plan/credit plumbing** — i.e., Vercel-native Next.js 16 with Fluid Compute. **Rust is adopted for a given component only when an in-phase benchmark proves a sustained >=30% win** on the relevant hot path (encode/decode, memory footprint, fan-out throughput, or expression evaluation). Everywhere else we stay on the n8n-style Node implementation. This ADR is the umbrella that pins that baseline, cross-references the nine sibling ADRs that detail each component, and defines the sign-off gate that closes Phase 1 and unblocks Phase 2 (persistence layer).

## 2. Cross-references — sibling ADRs

The nine sibling sub-tasks land alongside this file. Each is owned by its agent; this ADR does **not** rewrite their conclusions, only points at them.

| # | Expected filename | One-line summary |
|---|---|---|
| 1 | `docs/adr/sabflow-state-management.md` | Survey of n8n's Pinia + REST-save editor state model; decision on whether SabFlow keeps that pattern or replaces it with a CRDT-backed store as the single source of truth. |
| 2 | `docs/adr/sabflow-doc-schema.md` | Adopts n8n's `workflow.json` shape (`nodes[]`, `connections{}`, `settings{}`) as the SabFlow doc schema and documents any SabFlow-specific deltas (e.g. `sabflowMeta`). |
| 3 | `docs/adr/sabflow-ws-gateway-node.md` | Node baseline design for the WebSocket gateway, modeled on n8n's push module (SSE + WS), with room-per-doc, JWT-on-upgrade, and heartbeat. |
| 4 | `benches/sabflow-ws/` | Bench harness directory: Node WS gateway vs Rust (tokio + tungstenite) at N=2 / 10 / 50 / 200 clients/doc; emits a verdict consumed by ADRs 3 and 5. |
| 5 | `docs/adr/sabflow-crdt-lib.md` | CRDT library pick — Yjs (default); only switches to `yrs` (Rust) if ADR-4's bench beats Yjs by >=30% on encode/decode + memory. |
| 6 | `docs/adr/sabflow-persistence.md` | Persistence design mapping n8n's `workflow_entity` + `execution_entity` (TypeORM/Postgres) onto our Mongo + R2 model (`sabflow_docs` snapshot + `sabflow_oplog` append-only). |
| 7 | `docs/adr/sabflow-auth.md` | Reuse of SabNode's dual-auth (httpOnly cookie + JWT) and mapping of n8n's owner/member/viewer roles onto SabNode RBAC keys. |
| 8 | `docs/adr/sabflow-seat-model.md` | Plan-tier seat model: studies n8n cloud seat pricing and maps it onto SabNode's existing credit + plan-gate plumbing. |
| 9 | `benches/sabflow-executor/` + `docs/adr/sabflow-executor-rust-bench.md` | Bench harness + write-up for the hot expression/transform path: n8n queue-mode (Bull + Redis + Node workers) baseline vs a Rust executor; verdict consumed by Track B Phase 1. |

> **Constraint:** Sibling ADRs are owned by their agents; this umbrella ADR is intentionally independent of their final wording. If any sibling lands a conclusion that conflicts with the baseline below, the resolution path is a follow-up amendment to this file — not a silent override.

## 3. Decision baseline

Independent of how the sibling ADRs land in detail, the umbrella decision for Phase 1 is:

- **Language / runtime:** Node 24 + TypeScript, deployed on Vercel Fluid Compute (Node.js runtime). No Edge runtime for the gateway in Phase 1.
- **CRDT library:** Yjs.
- **WebSocket gateway:** Node-based, modeled on n8n's push module. **Service location locked at `services/sabflow-ws/`** (standalone Node process — `sabflow-ws-gateway-node.md` §2.1 selected Option B; the Vercel-Fluid-WS Option A was rejected for lifetime/per-instance-state/pricing/deploy-roll reasons). Rust-vs-Node language verdict still gated on the Phase 3 bench (`benches/sabflow-ws/`).
- **Persistence:** Mongo (`sabflow_docs` snapshot collection + `sabflow_oplog` append-only) for hot storage; R2 for cold-tier snapshot archival. No Postgres / TypeORM.
- **Auth:** Existing SabNode dual-auth (httpOnly server-side cookie + JWT). No new auth provider.
- **Authorization:** RBAC keys reserved in `src/lib/rbac` (registration is deferred to Phase 8 — Access control).
- **Plan / billing:** Existing SabNode plan-gate + credit metering. No new billing plumbing.
- **Queues / executor:** n8n queue-mode (Bull-style on Redis + Node workers) as baseline for Track B.
- **Rust adoption rule:** A component switches from Node to Rust **only** if its bench in this phase (sub-task #4 for WS, sub-task #9 for executor) shows a **sustained >=30% gain** on the metric that matters for that hot path (throughput, p99 latency, encode/decode time, or memory). A win on a synthetic micro-benchmark alone does **not** trigger adoption — the gain must reproduce under the N=50 / N=200 client-per-doc shape from sub-task #4 or under the expression-eval shape from sub-task #9.
- **Out of scope for Phase 1:** sync protocol details (Phase 4), client SDK (Phase 5), editor integration (Phase 6), presence beyond reservation of the existing in-memory presence store (Phase 7), full RBAC registration (Phase 8), reliability runbooks (Phase 9), perf / rollout (Phase 10).

## 4. Sign-off checklist

Phase 1 closes — and `phase/a-1-foundation` becomes eligible to merge into `main`, unblocking Phase 2 — only when **every** box below is checked.

- [ ] All 9 sibling ADRs landed on main
- [ ] Both bench harnesses parse / compile
- [ ] RBAC keys reserved in `src/lib/rbac` (or equivalent — note this is reserved, not yet registered)
- [ ] Phase-2 (persistence layer) branch created
- [ ] CI green on the integration branch `phase/a-1-foundation`

## 5. Follow-ups

- Track B Phase 1 (`docs/adr/sabflow-executor.md`) starts only after this ADR is signed off, so it inherits the Rust-vs-Node verdict from sub-task #9's bench.
- Any sibling ADR that diverges from §3 must file an amendment PR against this file; do not let the umbrella and the siblings disagree silently.
- Phase 2 inherits the persistence shape from `sabflow-persistence.md` and the doc schema from `sabflow-doc-schema.md`; Phase 3 inherits the gateway location + Rust-vs-Node verdict from `sabflow-ws-gateway-node.md` + the WS bench.
