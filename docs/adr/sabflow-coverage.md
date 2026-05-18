# ADR — SabFlow Coverage (Track C, Phase C.1)

**Status:** Proposed — umbrella for Track C (Phases C.1 through C.10)
**Date:** 2026-05-18
**Scope:** Closing the five remaining n8n-parity gaps — Rust stub backfill, missing integrations, real-time collab GA, execution playback, marketplace content library
**Phase branch:** `phase/c-1-inventory`

---

## 1. Goal

SabFlow closes the five product gaps that block full n8n parity: (1) ~150 Rust stub executors still emitting `stub: true`, (2) ~570 missing n8n integrations, (3) real-time multi-user collab (ADRs landed in Track A; needs implementation), (4) recording-style execution playback (server-side per-item trace streaming), and (5) a marketplace that ships as a real content library rather than a 10-template shelf. The work is structured as **10 sequential phases (C.1 through C.10)**, each phase made of 10 parallel sub-tasks dispatched as worktree agents — same execution model as `PLAN-sabflow-crdt-collab.md`. Phase C.1 produces machine-readable inventories so every subsequent phase is prioritised by data, not opinion. Phases C.2 through C.5 close the Rust stubs (harness + author SDK first, then S/A-band backfill, then long-tail). Phases C.6 and C.7 ship integrations. Phase C.8 executes the Track A collab plan. Phase C.9 builds playback. Phase C.10 ships the marketplace library. **Success criteria:** zero `stub:true` rows by C.5 close; integration coverage >=44% of n8n's published 570 by C.7 close; collab GA shipped by C.8; playback live for any captured run by C.9; marketplace at >=65 published templates by C.10.

## 2. Cross-references — sibling deliverables

The ten phases land sequentially. Each phase has its own per-phase ADR and ten sub-task deliverables; this umbrella does **not** rewrite their conclusions, only points at them.

| # | Phase | Owner sub-task / ADR | Inventory or deliverable |
|---|---|---|---|
| C.1 | Inventory & taxonomy | This ADR (`docs/adr/sabflow-coverage.md`, sub-task 1.10) | `docs/inventory/rust-stubs.json`, `forge-fallback-map.json`, `n8n-missing.json`, `priority-bands.json`, `playback-gap.md`, `marketplace-state.md`, `collab-state.md`, dashboard at `/dashboard/internal/sabflow-coverage`, CI drift gate |
| C.2 | Rust node harness & author SDK | `docs/adr/sabflow-executor-rust-errors.md` + `docs/adr/sabflow-binary-data.md` + `rust/crates/sabflow-nodes/AUTHORING.md` | `benches/sabflow-node-parity/`, `sabflow-node-derive` crate, HTTP Request reference node |
| C.3 | Top-30 Rust stub backfill (S-band) | Per-node parity test under `benches/sabflow-node-parity/` | 30 stubs flipped to `stub:false` in `docs/inventory/rust-stubs.json` |
| C.4 | Mid-tier Rust stubs (A-band, 60) | Per-node parity test | 60 additional stubs flipped; cumulative 90 unmasked |
| C.5 | Long-tail Rust stubs (~60) | `docs/adr/sabflow-stub-coverage-summary.md` | Zero `stub:true` rows remain; smoke-only acceptance documented per node |
| C.6 | Top-50 missing integrations (S-band) | Per-integration node + credential type + parity test + node-reference doc | 50 new credential types registered against the Phase B.5 schema; 50 new nodes |
| C.7 | Mid-tier integrations (B-band, 200) | Per-integration delivery; auto-generated docs from SDK descriptor | Integration count crosses 250 (33 + 50 + 200); dashboard shows >=44% of n8n's 570 |
| C.8 | Real-time collab GA (Track A closeout) | Track A Phases A.3 through A.10 sub-task deliverables | Yjs gateway live at `services/sabflow-ws/`; editor backed by `useSabFlowDoc`; presence + share-link + runbooks shipped |
| C.9 | Execution playback | `docs/adr/sabflow-playback-trace-shape.md` + `<PlaybackInspector>` component + `/api/sabflow/executions/[id]/replay` SSE | Per-item trace shape in `sabflow_execution_traces`; pinning API; export-as-zip |
| C.10 | Marketplace content library | `docs/partners/marketplace-contributing.md` + template-authoring CLI + verification pipeline | >=65 published templates; partner program live; install/run telemetry on C.1.8 dashboard |

> **Constraint:** Per-phase ADRs and sub-task deliverables are owned by their agents; this umbrella ADR is intentionally independent of their final wording. If any per-phase deliverable lands a conclusion that conflicts with §3 below, the resolution path is a follow-up amendment to this file (§5) — not a silent override. The inventory JSON files referenced above are **forward references**; the C.1 sub-tasks own them and they do not yet exist on `main`.

## 3. Decision baseline

Independent of how each per-phase ADR lands in detail, the umbrella decision for Track C is:

- **Priority-band classification is canonical.** The `docs/inventory/priority-bands.json` produced by C.1.4 is the single source of ranking for every subsequent phase. Bands are fixed at S (top 30), A (next 50/60), B (next 200), and C (long tail). **Phase C.3 ships S-band stubs; Phase C.4 ships A-band; Phase C.5 ships B+C-band (the niche tail); Phase C.6 ships S-band integrations (top 50); Phase C.7 ships B-band integrations (next 200).** Any later re-ranking must amend this ADR before the affected phase opens.
- **Parity bar.** Every Rust stub backfill must pass the **C.2 golden-fixture harness** (`benches/sabflow-node-parity/`) against an n8n Docker container — byte-for-byte JSON match — before its `stub:true` flag flips. **Exception:** Phase C.5's long tail (niche transforms, legacy / deprecated-in-n8n nodes, one-method SaaS endpoints) may ship with smoke-only acceptance — but every smoke-only relaxation must be documented per node in `docs/adr/sabflow-stub-coverage-summary.md` and re-checked by review before merge. No silent quality drops.
- **RBAC keys.** **No new RBAC keys are registered globally inside any Track C phase.** Registration is owned by Phase B.8 §1 (the access-control phase), mirroring the `sabflow-credentials-rbac.md` ADR pattern. Track C phases may *reserve* keys in `src/lib/rbac` for their features (per-doc collab access in C.8, playback pin/export in C.9, marketplace publish/review in C.10) but **never** register them in the central registry — registration happens via a single B.8 PR per closed phase.
- **No new npm deps.** No Track C phase adds a runtime dependency to `package.json` unless an amendment PR against this ADR explicitly justifies it (with bundle-size impact + alternative-already-in-tree consideration). Rust dev-dependencies in `rust/crates/` follow the same rule — each addition needs a per-phase ADR amendment.
- **Vercel-native rule.** Any new infrastructure picked by a per-phase ADR must be **Vercel Marketplace first**. C.8 may onboard a managed Redis (Upstash or equivalent Marketplace tile); C.9 reuses the existing SabFiles R2 path for snapshot pointers; C.10's review-queue storage reuses the existing Mongo + R2 plumbing. Self-hosted alternatives are only acceptable when the Marketplace has no match — and that "no match" must be cited in the per-phase ADR.
- **CI inventory-drift gate.** The drift gate stood up by C.1.9 is **load-bearing for every later phase**. Any PR that touches `rust/crates/sabflow-nodes/` or `src/lib/sabflow/forge/blocks/n8n/` without updating the relevant inventory JSON fails CI. This is the mechanism that keeps the C.1.8 dashboard honest as C.3 through C.7 ship. No bypass without an amendment to this ADR.
- **Phase-close requires dashboard movement.** A phase C.N closes only when all 10 sub-tasks land + CI green + **the C.1.8 dashboard counter relevant to that phase has visibly moved** (stub coverage % for C.3/C.4/C.5; integration coverage % for C.6/C.7; collab-state badges for C.8; playback-availability % for C.9; published-template count for C.10). Closing a phase without dashboard movement is treated as a regression and reverted.
- **Long-tail rollover.** Integrations beyond C.7's 250 and templates beyond C.10's ~200 move to a rolling backlog after Track C closes. They are **not** phases. The rolling backlog is owned by whichever team picks it up post-GA; this ADR does not pre-allocate it.
- **Out of scope for Track C:** redesign of the doc schema (locked by `sabflow-doc-schema.md`); redesign of the execution-state lifecycle (locked by `sabflow-execution-state.md`); redesign of the credentials envelope (locked by Phase B.5 ADRs); any change to dual-auth, plan-gate, or credit metering. Track C consumes those primitives; it does not redefine them.

## 4. Sign-off checklist

Each phase C.N closes — and `phase/c-N-<name>` becomes eligible to merge into `main`, unblocking phase C.(N+1) — only when **every** box for that phase is checked.

- [ ] **C.1 — Inventory & taxonomy.** All 10 sub-tasks landed; `docs/inventory/*.json` and `*.md` reviewed by product; dashboard at `/dashboard/internal/sabflow-coverage` live and RBAC-gated; CI drift gate active.
- [ ] **C.2 — Rust node harness & SDK.** Golden-fixture harness reproduces all 73 already-working forge nodes byte-for-byte against n8n; `sabflow-node-derive` macro shipped; HTTP Request reference node merged.
- [ ] **C.3 — Top-30 Rust stub backfill.** All 30 S-band nodes pass golden-fixture parity tests; `stub:true` banner stops showing for any of them; `docs/inventory/rust-stubs.json` updated.
- [ ] **C.4 — Mid-tier Rust stubs (60).** All 60 A-band nodes pass parity tests; `docs/inventory/rust-stubs.json` shows cumulative unmasked count 90.
- [ ] **C.5 — Long-tail Rust stubs (~60).** Zero `stub:true` rows remain in `docs/inventory/rust-stubs.json`; `docs/adr/sabflow-stub-coverage-summary.md` documents per-node smoke-only relaxations.
- [ ] **C.6 — Top-50 integrations (S-band).** 50 new credential types registered; 50 new node types runnable against real test accounts; parity tests green; node-reference docs shipped.
- [ ] **C.7 — Mid-tier integrations (B-band, 200).** Integration count crosses 250; C.1.8 dashboard shows integration-coverage % >=44% of n8n's 570; every new credential type round-trips via Phase B.5 §9 import-n8n.
- [ ] **C.8 — Real-time collab GA.** Every Track A box (Phases A.3 through A.10) checked; one paying-tier customer pilot running; zero P1 bugs for 7 consecutive days post-launch.
- [ ] **C.9 — Execution playback.** Playback works for any execution captured under the new trace shape; old executions degrade gracefully to snapshot-only mode; `<PlaybackInspector>` shipped; SSE replay endpoint live.
- [ ] **C.10 — Marketplace content library.** >=65 published templates live; partner program documented; verification pipeline green for every published template; install/run telemetry wired to dashboard.

## 5. Conflict resolution

Any disagreement between a per-phase ADR (or its sub-task deliverables) and this umbrella ADR is resolved via an **amendment PR against this file**. The umbrella and the per-phase deliverables must never be allowed to disagree silently — if a per-phase ADR's final wording diverges from §3, the per-phase agent (or whoever discovers the divergence) files an amendment PR that either:

1. updates §3 to match the per-phase verdict (when the per-phase evidence is stronger — e.g. a bench result, a telemetry data point, an updated priority-band ranking based on new customer-ask data), **or**
2. updates the per-phase deliverable to match §3 (when §3's baseline holds and the per-phase work overreached).

Either way, the amendment lands on `main` **before the next phase opens**. No "we'll reconcile later" — the conflict is closed inside the current phase. This is the same pattern documented in `sabflow-foundation.md` §5 and `sabflow-executor-foundation.md` §5.

## 6. Follow-ups

Each phase hands off concrete artefacts to the next. The umbrella locks the handoffs so per-phase agents know what they inherit:

- **C.1 → C.2:** C.2 inherits the priority-band JSON (`docs/inventory/priority-bands.json`) as the canonical S/A/B/C ranking and the stub inventory (`rust-stubs.json`) as the work queue. C.2 also inherits the CI drift gate — any harness PR that touches a stub must update the inventory.
- **C.2 → C.3:** C.3 inherits the golden-fixture harness (`benches/sabflow-node-parity/`), the `sabflow-node-derive` macro, and the HTTP Request reference node as the template every C.3 agent copies.
- **C.3 → C.4:** C.4 inherits the same harness + SDK; the only delta is the priority-band slice (A-band instead of S).
- **C.4 → C.5:** C.5 inherits the harness + SDK; the smoke-only acceptance relaxation documented in §3 lands as a `docs/adr/sabflow-stub-coverage-summary.md` ADR co-authored by C.5 agents.
- **C.5 → C.6:** C.6 inherits the same SDK plus the Phase B.5 §8 credential-test-op registry. The C.5-closing dashboard read is the first "stub-coverage % = 100" checkpoint; C.6 starts under that guarantee.
- **C.6 → C.7:** C.7 inherits the credential-type pattern from C.6, plus the Phase B.5 §9 import-n8n round-trip as the credential-injection bar.
- **C.7 → C.8:** C.8 starts only after the integration-coverage dashboard crosses 44%. C.8 inherits no new artefacts from C.7 — it switches tracks to consume `PLAN-sabflow-crdt-collab.md` Track A Phases 3–10 directly.
- **C.8 → C.9:** C.9 inherits the WebSocket gateway from C.8 (the same `services/sabflow-ws/` channel can carry trace replay topics) and the trace channel design from `sabflow-executor-observability.md` §3. The per-item trace shape ADR (`sabflow-playback-trace-shape.md`) is the first new artefact.
- **C.9 → C.10:** C.10 inherits the verification-pipeline pattern from C.9's playback harness (run a template inside a sandbox, capture trace, assert success) — the template-verification harness reuses the same execution-trace infrastructure.
- **C.10 → post-Track-C:** Long-tail integrations and marketplace templates beyond Track C's targets move to a rolling backlog. Track C does not pre-allocate that backlog's owner; the choice is made at GA.
