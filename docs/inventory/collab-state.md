# SabFlow Real-time Collab — Implementation State Audit

> **Source plan:** `PLAN-sabflow-crdt-collab.md` (Track A — Phases 1–10).
> **Audit task:** Phase C.1 sub-task #7 of `PLAN-sabflow-coverage.md`.
> **Date:** 2026-05-18.
> **Auditor scope:** repo-only. No source modified.

This document records what's actually landed in the repo against the Track A
plan, classifies each phase, and maps remaining gaps onto the C.8 closeout
sub-tasks defined by the SabFlow coverage plan.

Legend for status:

| Status | Meaning |
|--------|---------|
| `closed` | All 10 sub-tasks merged + phase branch deleted or fully reflected in `main`. |
| `partial` | Phase branch merged but some sub-tasks shipped as stubs / scaffolds, or merged modules not wired into the live editor. |
| `design-only` | ADR / module spec exists but no implementation merged. |
| `not-started` | No code, no branch, no ADR module. |

---

## 1. Phase-by-phase status

### Phase A.1 — Foundation (ADRs + bench harness)

- **Status:** `closed`.
- **Evidence:**
  - `docs/adr/sabflow-foundation.md` — overall ADR (sign-off).
  - `docs/adr/sabflow-state-management.md` — CRDT vs Pinia decision.
  - `docs/adr/sabflow-doc-schema.md` — n8n-shaped doc schema.
  - `docs/adr/sabflow-ws-gateway-node.md` — Node-baseline WS gateway decision.
  - `docs/adr/sabflow-crdt-lib.md` — Yjs adoption rationale.
  - `docs/adr/sabflow-persistence.md` — Mongo + R2 mapping.
  - `docs/adr/sabflow-auth.md` — JWT/cookie + RBAC mapping.
  - `docs/adr/sabflow-seat-model.md` — plan-tier seat sizing.
  - `docs/adr/sabflow-executor-rust-bench.md` — Rust vs Node bench verdict.
  - All nine Track A ADRs accounted for. Phase-1 bench harness committed
    (`docs/adr/sabflow-executor-rust-bench.md` carries the verdict).
- **Branch:** `phase/a-1-foundation` (merged).

### Phase A.2 — Persistence layer

- **Status:** `closed`.
- **Evidence:**
  - `src/lib/sabflow/persistence/indexes.ts` — declares
    `SABFLOW_DOCS_COLLECTION = 'sabflow_docs'`,
    `SABFLOW_OPLOG_COLLECTION = 'sabflow_oplog'`,
    `SABFLOW_DOC_SHARES_COLLECTION = 'sabflow_doc_shares'` plus index +
    TTL policies.
  - `src/lib/sabflow/persistence/snapshot.ts` — snapshot row contract +
    typed Mongo handle.
  - `src/lib/sabflow/persistence/oplog.ts` — append-only Yjs update log,
    nextSeq counter, append API.
  - `src/lib/sabflow/persistence/compaction.ts` — folds oplog into snapshot.
  - `src/lib/sabflow/persistence/cold-tier.ts` — R2 cold-tier pointer.
  - `src/lib/sabflow/persistence/repo.ts` — repo facade (load / save /
    append / compact).
  - `src/lib/sabflow/persistence/guards.ts` — multi-tenant row-level
    guards via `sabflow_doc_shares`.
  - `src/lib/sabflow/persistence/audit.ts` — audit writer.
  - `docs/runbooks/sabflow-persistence-backup.md` — backup/restore.
- **Branch:** `phase/a-2-persistence` (merged).
- **Note:** The GC job runs via Vercel Cron (per repo `vercel.json`
  schedule). Snapshot compaction is wired but not exercised under load.

### Phase A.3 — WebSocket gateway

- **Status:** `closed` (gateway scaffolded + lifecycle features present).
- **Evidence:**
  - `services/sabflow-ws/package.json` — `@sabnode/sabflow-ws`, PM2 app
    name `sabflow-ws`, port 4002, `pino` + `ws` + `ioredis` + `jsonwebtoken`.
  - `services/sabflow-ws/src/index.ts`, `auth.ts` (JWT upgrade verify),
    `room.ts` (1 doc = 1 room), `connection.ts` (heartbeat),
    `reconnect.ts`, `backpressure.ts`, `seats.ts` (plan-tier reject),
    `logger.ts` (Pino), `metrics.ts` (health/metrics endpoint).
  - `services/sabflow-ws/docker-compose.yml`, `ecosystem.config.js`,
    `scripts/dev.sh`, `scripts/probe.sh` — local dev harness.
- **Branch:** `phase/a-3-ws-gateway` (merged).
- **Risk:** Service has typecheck/test scripts but no unit-test suite
  beyond `services/sabflow-ws/test/fuzz/` (Phase 4 fuzz). No CI gate
  observed for the service in `vercel.json` / repo root scripts.

### Phase A.4 — Sync protocol

- **Status:** `closed`.
- **Evidence:**
  - `services/sabflow-ws/src/sync/initial.ts` — snapshot + delta on
    connect.
  - `services/sabflow-ws/src/sync/broadcast.ts` — room fan-out.
  - `services/sabflow-ws/src/sync/awareness.ts` — awareness diff broadcast.
  - `services/sabflow-ws/src/sync/state-vector.ts` (+ unit test).
  - `services/sabflow-ws/src/sync/acks.ts` — ack/nack + idempotency.
  - `services/sabflow-ws/src/sync/framing.ts` (+ unit test) — Yjs binary
    framing.
  - `services/sabflow-ws/src/sync/compression.ts` — permessage-deflate.
  - `services/sabflow-ws/src/sync/batching.ts` — batching / debounce.
  - `docs/adr/sabflow-sync-ordering.md` — causal-ordering doc.
  - `services/sabflow-ws/test/fuzz/` — protocol fuzz harness.
- **Branch:** `phase/a-4-sync` (merged).

### Phase A.5 — Client SDK

- **Status:** `closed` (modules merged, but no production consumer wires
  them yet — see Phase A.6).
- **Evidence:**
  - `src/lib/sabflow/client/useSabFlowDoc.ts` (line 275: `export function
    useSabFlowDoc(...)`).
  - `src/lib/sabflow/client/usePresence.ts` (named the same as the
    standalone helper in `src/components/sabflow/presence/usePresence.ts`
    — see Risks).
  - `src/lib/sabflow/client/SabFlowProvider.tsx` — composes
    `useSabFlowDoc` + `usePresence` into context; SSR-safe.
  - `src/lib/sabflow/client/optimistic.ts`, `offline-queue.ts`,
    `undo-redo.ts`, `schema-migrate.ts`, `SabFlowErrorBoundary.tsx`,
    `toasts.ts`, `telemetry.ts`, `user-color.ts`, `index.ts`.
- **Branch:** `phase/a-5-client` (merged).
- **Caveat:** No app code outside `src/lib/sabflow/client/` and
  `src/components/sabflow/editor/state/*` imports `useSabFlowDoc` or
  `SabFlowProvider`. The SDK is shelf-stable but unmounted.

### Phase A.6 — Editor integration

- **Status:** `partial`.
- **Evidence (merged):** `phase/a-6-editor` branch merged (10 sub-task
  merges visible in `git log`). Per-feature state modules exist:
  - `src/components/sabflow/editor/state/crdt-nodes.ts` +
    `use-crdt-nodes.ts` (sub-task #1).
  - `src/components/sabflow/editor/state/crdt-edges.ts` +
    `use-crdt-edges.ts` (sub-task #2).
  - `src/components/sabflow/editor/state/use-crdt-position.ts` (#3).
  - `src/components/sabflow/editor/state/crdt-groups.ts` (#4).
  - `src/components/sabflow/editor/state/use-selection-awareness.ts` (#5).
  - `src/components/sabflow/editor/state/use-local-cursor-broadcast.ts` (paired
    with `RemoteCursors`).
  - `src/components/sabflow/editor/state/use-follow-mode.ts` (#6 of A.7).
  - `src/components/sabflow/editor/state/use-typing-indicator.ts` (Phase 7).
- **Gap:** `src/components/sabflow/editor/EditorPage.tsx` still owns local
  React state — `const [flow, setFlow] = useState(initialFlow)` (line 48),
  push-snapshot undo/redo over `SabFlowDoc` JSON (lines 60–93), no
  `useSabFlowDoc(flowId)` call, no `<SabFlowProvider>` wrap, no `Y.Doc`
  threaded through `GraphProvider`. `WorkflowCanvas` likewise reads from
  the GraphProvider snapshot, not from any CRDT array.
- **Verdict:** the CRDT *plumbing* shipped (per sub-task contracts), the
  *swap* didn't. Editor still runs the pre-CRDT in-memory state model.

### Phase A.7 — Presence & awareness

- **Status:** `partial`.
- **Evidence:**
  - Phase branch `phase/a-7-presence` merged 10 sub-tasks (see commits
    `9720a8df7` … `ec3e4d532`).
  - `src/lib/sabflow/presence/store.ts`, `migrate-to-yjs.ts` — legacy
    in-memory store + Yjs awareness shim (commit `27505e204`).
  - `src/components/sabflow/editor/chrome/PresenceAvatarStack.tsx` (#2),
    `PresenceSidebar.tsx` (#7), `editor/overlays/RemoteCursors.tsx` (#3),
    `editor/overlays/TypingIndicators.tsx`, plus
    `editor/overlays/SelectionHighlightLayer.tsx` (#4).
  - `src/lib/sabflow/client/use-idle-state.ts` (#8 — tri-state idle).
  - `services/sabflow-ws/src/backplane/redis-backplane.ts` (#9 —
    multi-instance fan-out).
  - `services/sabflow-ws/src/presence/audit-export.ts` (#10).
- **Gap:** Same as A.6 — none of the presence UI components are mounted
  in `EditorPage.tsx` or `WorkflowCanvas.tsx`. `grep -rn` for
  `PresenceAvatarStack | RemoteCursors | PresenceSidebar | PresenceAvatars`
  inside `src/app/**` and `EditorPage.tsx` returns zero hits. The user-
  memory note "presence shipped 2026-05-15" describes module landing,
  not UI integration.
- **Risk:** Two parallel `usePresence` hooks exist
  (`src/lib/sabflow/client/usePresence.ts` for the Yjs awareness path
  versus `src/components/sabflow/presence/usePresence.ts` for the legacy
  store). Consumers should consolidate on the client-SDK one when A.6/A.7
  is finally wired.

### Phase A.8 — Access control

- **Status:** `partial`.
- **Evidence (landed):**
  - `src/lib/sabflow/rbac-keys.ts` — sub-task #1: registers
    `sabflow.doc.read|write|delete|share|admin` + credential / workflow /
    trigger keys + `DEFAULT_SABFLOW_ROLE_GRANTS` mapping for
    `viewer | editor | admin | owner`. Confirmed exported via
    `src/lib/permission-modules.ts` (lines 137–138, 178).
  - `src/lib/sabflow/persistence/guards.ts` — workspace + share-row
    enforcement on the persistence layer (sub-task #2 viewer / editor /
    admin / owner roles materialised on `sabflow_doc_shares`).
  - `src/lib/sabflow/access/audit-log.ts` (commit `75bd7c947`) — sub-task
    #7 access-event audit log over the existing `sabflow_audit_log`
    collection.
  - `src/lib/sabflow/access/__tests__/rbac-matrix.test.ts` +
    `matrix.json` — sub-task #10 RBAC test matrix.
- **Gap (not yet merged):** No `phase/a-8-access-control` branch in
  `git branch -a`. The following sub-tasks are *unimplemented*:
  - #3 — share-link tokens + revoke.
  - #4 — plan gating (free = solo, paid tiers = multi-seat).
  - #5 — credit metering for active collab seats (telemetry event
    `sabflow.collab.seat_limit` exists in `client/telemetry.ts` but no
    server-side meter writes credits).
  - #6 — invite + email flow.
  - #8 — owner transfer (only documented in
    `src/lib/sabflow/persistence/snapshot.ts` comments).
  - #9 — workspace-admin override.
- **Verdict:** keys + matrix + audit log landed (3 of 10 sub-tasks); the
  share / invite / billing / transfer surface is not yet wired.

### Phase A.9 — Reliability & recovery

- **Status:** `design-only`.
- **Evidence:**
  - `docs/runbooks/sabflow-persistence-backup.md` exists (Phase A.2
    backup/restore runbook).
  - No `phase/a-9-reliability` branch. No `*recovery*`, `*disaster*`,
    `*repair*`, `*version-history*`, or `*chaos*` files under
    `src/lib/sabflow/`. No `services/sabflow-ws/src/recovery*`.
- **Verdict:** the only A.9 artefact is the persistence backup runbook
  from Phase 2 — A.9 has not opened.

### Phase A.10 — Perf, tests, rollout

- **Status:** `not-started`.
- **Evidence:**
  - `grep` for `sabflow.collab.enabled` / `sabflow.crdt.enabled` across
    `src/`, `vercel.json`, `vercel.ts`, `.env.example` returns zero
    matches — the feature flag (#7) is not wired.
  - No Playwright multi-client suite (`src/**/playwright/sabflow*` does
    not exist).
  - No Grafana dashboards under `docs/dashboards/` matching
    `sabflow-collab*`.
  - No phase branch.

---

## 2. What's design-only vs partially-implemented vs done

**Closed (5/10):** A.1 Foundation, A.2 Persistence, A.3 WS gateway,
A.4 Sync protocol, A.5 Client SDK.

**Partial (3/10):**

- **A.6 Editor integration** — CRDT-aware state modules merged, but
  `EditorPage.tsx` + `WorkflowCanvas.tsx` still run on the pre-CRDT
  `useState(initialFlow)` model. The swap from local React state to the
  Y.Doc-backed hooks is the missing single biggest task.
- **A.7 Presence & awareness** — every individual presence module and UI
  component merged, but none are mounted into the editor. The Redis
  backplane (sub-task #9) is in `services/sabflow-ws/src/backplane/` but
  not exercised by an integration test.
- **A.8 Access control** — RBAC keys, default role grants, RBAC test
  matrix, and access-event audit log shipped (sub-tasks #1, #2, #7, #10).
  Share-link tokens, plan-tier gating, credit metering for seats, invite
  flow, owner transfer, and workspace-admin override are not yet
  implemented.

**Design-only (1/10):** A.9 Reliability & recovery — only the Phase A.2
persistence backup runbook exists; crash recovery, WS failover, replica
sync, doc-corruption detector, repair CLI, version-history UI, branch /
fork, export/import, DR runbook, chaos plan are all unwritten.

**Not started (1/10):** A.10 Perf, tests, rollout — no load test, no
Playwright multi-client suite, no Grafana dashboards, no soak harness,
no feature flag, no rollout gate, no docs-site changelog.

**Headline takeaway:** the entire pipe is built end-to-end (DB → WS →
sync protocol → SDK → React hooks → presence components). The remaining
work is mostly *wiring* (A.6 + A.7 mount the modules into the live
editor) plus *productisation* (A.8 share/billing, A.9 recovery, A.10
load/flag/docs).

---

## 3. C.8 closeout plan

The SabFlow coverage plan reserves Phase C.8 for the "collab GA closeout"
(10 sub-tasks). The mapping below assigns each remaining gap to a C.8
slot — i.e. what each of the 10 closeout sub-tasks should land. If the
coverage plan rewrites these slot definitions, this table is the input
the human reviewer should re-key against.

| C.8 sub-task | Gap from this audit | Concrete deliverable |
|--------------|---------------------|----------------------|
| **C.8.1** | A.6 #1–#4 wiring | Swap `EditorPage.tsx` local `useState(initialFlow)` for `useSabFlowDoc(flow._id)` + wrap `<SabFlowProvider>`. Thread Y.Array<Node> / Y.Array<Edge> through `GraphProvider` so `WorkflowCanvas` reads CRDT state, not the JSON snapshot. |
| **C.8.2** | A.6 #9–#10 | Conflict-resolution toast + diff view; editor perf regression check vs `main` (use existing `src/components/sabflow/diff/*` scaffolding). |
| **C.8.3** | A.7 mount | Mount `PresenceAvatarStack`, `PresenceSidebar`, `RemoteCursors`, `TypingIndicators`, `SelectionHighlightLayer` in `EditorPage.tsx` / `WorkflowCanvas.tsx`. Consolidate the duplicate `usePresence` (legacy store vs Yjs awareness) onto the client-SDK version. |
| **C.8.4** | A.8 #3 | Share-link tokens (create / list / revoke), backed by `sabflow_doc_shares` row type. UI under `dashboard/sabflow/[id]/share/`. |
| **C.8.5** | A.8 #4–#5 | Plan-tier seat gating in WS upgrade path (already partially in `services/sabflow-ws/src/seats.ts`); credit metering hooked into the `sabflow.collab.seat_limit` telemetry event. |
| **C.8.6** | A.8 #6, #8, #9 | Invite + email flow; owner transfer endpoint; workspace-admin override. |
| **C.8.7** | A.9 #1–#5 | Crash recovery from snapshot+oplog, WS failover playbook, replica sync between WS instances, doc-corruption detector, manual repair CLI. |
| **C.8.8** | A.9 #6–#8 | Version-history UI, branch/fork doc, JSON export + n8n workflow.json import compat. |
| **C.8.9** | A.10 #1–#6 | Load test harness (N=2 / 10 / 50 / 200 clients), latency SLO with p99 budget, snapshot-size bench, Grafana dashboards, Playwright multi-client E2E suite, 24h soak. |
| **C.8.10** | A.10 #7–#10 | Feature-flag wiring `sabflow.collab.enabled` (env var + runtime check), plan-tier rollout gate, docs-site update + changelog entry, demo recording + internal announce. |

---

## 4. Risks

1. **Editor wiring is the load-bearing gap.** All upstream pieces shipped,
   but `EditorPage.tsx` still owns local state. Until C.8.1 lands, every
   downstream phase (presence visible to users, seat metering at runtime,
   load tests against the real editor) cannot be validated end-to-end.

2. **Two `usePresence` hooks** exist
   (`src/lib/sabflow/client/usePresence.ts` and
   `src/components/sabflow/presence/usePresence.ts`). They have different
   call signatures (`useSabFlowDoc`-backed vs `flowId`-only). Whichever
   ships in the editor must be the canonical one; the other should be
   deprecated to avoid divergent presence semantics.

3. **No CI wiring for `services/sabflow-ws/`** — the package has
   `typecheck` + `dev` scripts but is not referenced from the root
   `package.json` test/build chain, so regressions in the gateway won't
   block a PR. Same risk for `services/sabflow-triggers/`.

4. **Snapshot compaction is unproven under load.** The `compaction.ts`
   module exists but A.10's load test (sub-task #1) has not run, so the
   oplog growth → snapshot cycle has no real measurement. Could surface
   as a Mongo-IO regression once collab opens.

5. **Plan-tier seat gating is half-built.** The telemetry event name
   exists in the client SDK (`sabflow.collab.seat_limit`) and the WS
   gateway has a `seats.ts` module, but the credit-metering side
   (writing against the existing SabNode credit ledger) is absent. Free-
   plan users could open as many seats as the gateway allows.

6. **A.9 has no artefacts at all.** GA needs at minimum a crash-recovery
   path, a WS failover playbook, and an export/import escape hatch.
   Shipping collab without these is reputational risk: a corrupted doc
   would have no operator-side repair option.

7. **`PLAN-sabflow-coverage.md` is not in the repo.** This audit was run
   without the coverage plan visible — only `PLAN-sabflow-crdt-collab.md`
   exists at the repo root. The C.8 slot definitions in §3 above are
   inferred from the audit; if the coverage plan asserts different slot
   meanings the mapping must be re-keyed.

---

## 5. Open questions

1. **Does C.8 need to wait on Track B closeout?** Several A-Track gaps
   (seat metering, plan-tier gates) share infrastructure with the
   Track B executor's plan-tier execution budgets (B.10 #6). Closing
   them once vs. twice is a coordination decision.

2. **Is the legacy `src/components/sabflow/presence/usePresence.ts` hook
   used in production by any non-SabFlow surface (e.g. Wachat,
   SabChat)?** If yes, the consolidation in C.8.3 needs a non-breaking
   shim; if no, it can be deleted.

3. **Which Mongo collection holds the share-token revocation list?**
   `sabflow_doc_shares` holds role assignments; revoked share-link IDs
   need either a separate `sabflow_doc_share_revocations` collection or a
   tombstone flag on the share row. C.8.4 must decide.

4. **Feature-flag plumbing:** does SabNode have a runtime flag registry
   today (Vercel Edge Config? env var? Mongo `feature_flags` collection?),
   or does C.8.10 also build the flag plane? The skill registry mentions
   `vercel-plugin:flags` but no in-repo flag store was found.

5. **Should A.9's "manual repair CLI" be a `services/sabflow-ws/scripts/`
   Node script or a Rust crate under `rust/crates/sabflow-executor/`?**
   ADR `sabflow-executor-rust-bench.md` decided per-component; this one
   was not pre-decided.
