# ADR: SabFlow editor state management — REST save vs CRDT source-of-truth

**Status:** Proposed
**Date:** 2026-05-18
**Track:** A (Real-time collab) — Phase 1, sub-task 1
**Authors:** SabFlow team
**Related:** `PLAN-sabflow-crdt-collab.md`, `docs/adr/sabflow-foundation.md` (sibling), `docs/adr/sabflow-executor.md` (Track B)

---

## Context

SabFlow is the SabNode workflow editor (n8n-inspired). Track A of the
real-time-collab plan asks whether the editor should mirror n8n's editor model
(Pinia + REST save) or migrate the editor's source-of-truth to a CRDT document
shared over WebSocket. This ADR answers that question for Phase 1.

The decision drives every downstream Track A phase: persistence (Phase 2), WS
gateway (Phase 3), sync protocol (Phase 4), client SDK (Phase 5), editor
integration (Phase 6), and presence (Phase 7).

---

## 1. How n8n's editor stores workflow state

n8n's `editor-ui` package is a Vue 3 SPA using **Pinia** as its store layer.
Citations below reference paths in the public `n8n-io/n8n` repo
(`packages/editor-ui/src/stores/...`).

### 1.1 Store layout

- **`workflows.store.ts` — `useWorkflowsStore`** is the canonical in-memory
  store for the workflow currently being edited. It holds:
  - `workflow` — a `IWorkflowDb`-shaped object (id, name, nodes, connections,
    settings, active, versionId, meta, tags, pinData, …). This mirrors the
    server's `workflow_entity` row 1:1.
  - `workflowExecutionData`, `workflowExecutionPairedItemMappings`, and a
    handful of run-time helpers for the executor side.
  - Action methods: `addNode`, `removeNode`, `updateNodeProperties`,
    `addConnection`, `removeConnection`, `setNodes`, `setConnections`,
    `setWorkflowName`, `setWorkflowSettings`, `setWorkflowVersionId`, …
  - `nodesIssuesExist`, `getCurrentWorkflow()`, getter that materialises a
    `Workflow` (the `workflow` package class) on demand for validation /
    expression evaluation.
- **`ui.store.ts`** — UI-only state: open modals, selected node panel, sidebar
  pinned, theme, etc. Never persisted to the server.
- **`ndv.store.ts`** — Node Details View: which node is open, which output run
  is active, the run-data tab, pinned data preview state.
- **`canvas.store.ts`** — viewport (zoom + pan), selection, hover. Also
  client-only.
- **`history.store.ts`** — undo/redo command stack. Records `Command`
  instances (`AddNodeCommand`, `RemoveNodeCommand`,
  `MoveNodeCommand`, …) and runs them forwards / backwards.

### 1.2 Save model — REST, debounced, "save-on-edit with dirty flag"

n8n's save is **REST**, not WebSocket:

- The workflow detail page (`packages/editor-ui/src/views/NodeView.vue`) wires
  store-level mutations to an `uiStore.stateIsDirty` flag.
- `workflowHelpers.composable.ts` exposes `saveCurrentWorkflow(...)` which
  `PATCH`es `/rest/workflows/:id` with the full workflow JSON (nodes,
  connections, settings, active, tags). The Cmd/Ctrl+S keybinding triggers
  this, and several actions (rename, toggle active, manual save button) call
  it too. There is also an "auto-save" toggle that fires on debounced changes.
- Pin-data, executions, and tags have their own dedicated endpoints but
  follow the same shape.
- After a successful save the response's `versionId` (UUID) is written back
  into the store and the dirty flag is cleared.

### 1.3 Conflict handling — last-writer-wins with `versionId` precondition

- Every workflow row carries a `versionId` (regenerated server-side on every
  update — see `WorkflowsService.update` in
  `packages/cli/src/workflows/workflows.service.ts`).
- The PATCH body includes the client's `versionId`. The server compares it
  with the row's current `versionId`; on mismatch it returns a
  `WorkflowVersionMismatchError` (HTTP 400 with a typed code).
- The editor surfaces a "Workflow was updated elsewhere" modal that offers
  **Discard / Overwrite / Reload** — there is no automatic three-way merge.
  In practice this is last-writer-wins gated by a single optimistic-lock
  check.
- Two users editing the same workflow at the same time is therefore a
  **manual-merge** experience, not real-time collaboration. n8n added a
  read-only "someone else has this workflow open" banner in 1.x but did not
  ship cell-level merging.

### 1.4 Dirty tracking + autosave

- The store wraps every mutator with a `stateIsDirty = true` side-effect.
- The browser `beforeunload` handler blocks navigation when `stateIsDirty`.
- Cloud builds expose an auto-save toggle (debounced ~2 s after the last
  mutation); self-hosted defaults to manual save.

### 1.5 Why this works for n8n

n8n is, by design, a **single-editor workflow tool**: workflows are owned by
one user (with sharing as a permission, not as a live co-editing affordance).
The Pinia + REST model is simple, debuggable, and aligns with their
TypeORM/Postgres persistence. The price is that real-time collab is not
possible without a fundamental rewrite of the source-of-truth.

---

## 2. How SabFlow's editor currently stores state

SabFlow's editor is React (Next.js 16 App Router), not Vue. The shape is
**very close to n8n's model** — local React state + server actions — with
a few SabFlow-specific deltas.

### 2.1 The canonical document lives in component state

File: `src/components/sabflow/editor/EditorPage.tsx`

- Line 52: `const [flow, setFlow] = useState(initialFlow);`
- The `flow` value is a `SabFlowDoc & { _id: string }` (see
  `src/lib/sabflow/types.ts`), shaped as `{ groups, edges, events, variables,
  theme, settings, status, ... }`. It is loaded once from the server action,
  then mutated entirely in the client.
- Every panel/handler updates the flow via `setFlow(prev => ...)`:
  - `handleFlowChange` (line 119) — partial patch of `groups | edges | events`.
  - `handleDocChange` (line 137) — full-document replace from the
    n8n-style `WorkflowCanvas` (line 404).
  - `handleNameChange` (line 152) — name patch.
  - Variables / theme / settings each have their own inline
    `setFlow` callsites in the right-rail panels (lines 416, 424, 434, 443).

### 2.2 Undo/redo is a local snapshot stack

File: `src/components/sabflow/editor/EditorPage.tsx`, lines 67–102.

- `history` is a `Array<SabFlowDoc & { _id }>` capped at `MAX_HISTORY = 50`
  (line 30).
- `historyIndex` points at the current snapshot. Mutations call
  `pushHistory(next)` which trims any redo tail and appends.
- Undo/redo (lines 84–102) swap the whole `flow` for the snapshot at the
  new index. Cmd+Z / Cmd+Shift+Z are wired at lines 213–229.
- This is **whole-document snapshot undo**, not command-pattern undo. It is
  cheap to implement but expensive in memory for large flows and impossible
  to merge meaningfully across users.

### 2.3 Persistence — Mongo via a Next.js Server Action

File: `src/app/actions/sabflow/index.ts`

- `saveSabFlow(flowId, payload)` (lines 83–114) is a `'use server'` function
  that authenticates via `getSession()`, opens the `sabflow` Mongo
  collection, and runs a single `updateOne({ _id, userId }, { $set: ... })`
  with the fields the client supplied. No version check, no oplog, no
  precondition — last writer simply wins.
- `createSabFlow`, `renameSabFlow`, `duplicateSabFlow`, `deleteSabFlow` round
  out the surface; activation/deactivation lives next to them.
- The `revalidatePath('/dashboard/sabflow/flow-builder')` call is the only
  cross-tab synchronisation: it busts the Next.js fetch cache for the list
  view, but it does **not** push a new doc to other open editor tabs.

### 2.4 Save trigger — manual + Cmd+S, no autosave

File: `src/components/sabflow/editor/EditorPage.tsx`

- `save(overrides?)` at lines 160–198 builds the payload, runs it through
  `toJsonSafe` to strip non-serialisable values (note the comment block at
  lines 175–185 about server-action serialisation), and awaits the server
  action inside a `useTransition`.
- Cmd+S (line 208) is the only keyboard trigger. There is **no debounced
  autosave** — the user must hit save or click the save button in
  `FlowEditorHeader`. Dirty-flag tracking is **implicit** (the user sees
  `lastSaved` change on success; there is no explicit unsaved banner today).
- Webhook side effects of publish (`activateSabFlow`) trigger a one-time
  banner (lines 234–255) but do not flow back into the canonical doc.

### 2.5 Other editor-side stores

- **Zustand selection store** at
  `src/components/sabflow/graph/hooks/useSelectionStore.ts` — focused
  element ids, clipboard, drag flag. Client-only; never sent to the server.
- **React Context graph store** at
  `src/components/sabflow/graph/providers/GraphProvider.tsx` — viewport
  position, in-flight connection drag, opened node id. Client-only.
- **Canvas adapter** at `src/components/sabflow/canvas/adapter.ts` translates
  the SabFlow doc into `@xyflow/react` node/edge arrays on every render and
  reverses the diff on every drag/connect (`Canvas.tsx`, line 79
  `useCanvasOperations`).
- **In-memory presence store** at `src/lib/sabflow/presence/store.ts`
  (commit `7178c9f80`) keeps a `Map<flowId, Map<userId, PresenceEntry>>`
  with a 15 s TTL (line 26). Per-process only — not real CRDT awareness.

### 2.6 Deltas vs n8n

| Concern | n8n | SabFlow today |
|---|---|---|
| Store lib | Pinia (Vue) | React `useState` + Zustand for selection |
| Persistence | TypeORM + Postgres | MongoDB via server action |
| Save transport | `PATCH /rest/workflows/:id` | Server Action |
| Optimistic lock | `versionId` mismatch error | None — last writer wins |
| Autosave | Toggleable, debounced ~2 s | None — manual save / Cmd+S only |
| Undo/redo | Command stack | Whole-doc snapshot stack (`MAX_HISTORY=50`) |
| Multi-tab live sync | Read-only banner, no merge | Nothing — silent overwrite |
| Presence | None in OSS | In-memory `presence/store.ts` (15 s TTL) |

**Bottom line:** SabFlow today is *strictly weaker* than n8n's REST model. It
matches n8n on shape but is missing the `versionId` precondition, the dirty
flag, the autosave toggle, and the conflict-resolution modal.

---

## 3. Recommendation

**Adopt CRDT as the editor's source of truth (option b).** Keep MongoDB +
server actions for *snapshot persistence and list views*, but make the
editing surface itself driven by a Yjs document synced over WebSocket.

### 3.1 Why not just match n8n (option a)

We could close the parity gap (add `versionId`, autosave, conflict modal)
in ~2 weeks. That would make SabFlow as good as n8n for *single-editor* use.
But the plan we are part of (`PLAN-sabflow-crdt-collab.md`) commits to
real-time collab as a product feature — the value bar is co-editing, not
single-editor parity.

Bolting collab onto REST means re-inventing CRDT badly: a server-side merge
function over JSON patches, hand-rolled conflict UI, custom presence
multiplexing. Every team that has tried this (Notion's pre-Yjs era, Linear's
sync engine, Figma's pre-multiplayer) has ultimately moved to either a CRDT
or an OT engine. Doing it once, in Phase 1, is cheaper than building the
REST cathedral and then tearing it down in Phase 6.

### 3.2 Why CRDT (option b)

| Criterion | REST + version-lock | CRDT doc (Yjs) |
|---|---|---|
| **Multi-user editing** | Conflict modal; one user loses | Automatic merge; no data loss |
| **Undo/redo** | Per-tab snapshot stack; foreign edits clobber it | `Y.UndoManager` — per-user undo that survives remote ops |
| **Offline support** | Save fails → user must retry, may overwrite | Local Yjs doc keeps editing; replays on reconnect |
| **Awareness/presence** | Hand-rolled (today: 15 s TTL Map) | Built-in `awareness` protocol with cursors + selection |
| **Server load** | Whole doc on every save | Binary deltas; snapshot compaction off the hot path |
| **Mongo/R2 fit** | Already there | Snapshot in Mongo, oplog appends, R2 cold tier (Phase 2) |
| **Complexity** | Lower in Phase 1, higher by Phase 6 | Higher in Phase 1, paid off by Phase 5 |
| **Failure mode** | Silent overwrites under contention | Merge spurious but lossless; need conflict-detection UX for *semantic* (not byte) conflicts |

### 3.3 Constraint check

- **Vercel-native (CLAUDE.md):** Yjs is pure JS, runs in Node and Edge. WS
  gateway either as a Node.js Function (Fluid Compute) or as the
  `services/sabflow-ws` standalone — Phase 3 sub-task 1 decides based on
  the Phase 1 bench. Either way it stays inside the SabNode-as-Vercel-project
  envelope; no third-party collab SaaS.
- **Mongo + R2 (SabNode storage stack):** Yjs `Y.Doc` serialises to a binary
  update blob; we store snapshots in `sabflow_docs` and append updates to
  `sabflow_oplog` (Phase 2 sub-tasks 1–2). R2 absorbs the cold tier.
- **n8n schema parity (Phase 1 sub-task 2):** the SabFlow doc schema still
  mirrors n8n's `{nodes, connections, settings}` shape; CRDT changes the
  *editing surface*, not the on-disk JSON.
- **No new deps (this sub-task's constraint):** this ADR proposes Yjs;
  sibling sub-task 5 actually picks the CRDT lib after benching Yjs vs `yrs`.
  We do not install anything here.

### 3.4 Risks we accept

- **Yjs learning curve** for the team — addressed in Phase 5 SDK and Phase 6
  editor work.
- **Semantic conflicts** still exist (two users wire a node into incompatible
  trigger paths) — Phase 6 sub-task 9 owns the toast-and-diff UX.
- **Plan-tier gating** — solo on free, multi-seat on paid — must wrap the WS
  handshake (Phase 3 sub-task 7, Phase 8 sub-task 4). Without this, CRDT
  could become a free upsell vector.

---

## 4. Migration path (if CRDT chosen)

This is the concrete sequence — each step maps to a phase in
`PLAN-sabflow-crdt-collab.md`.

1. **Phase 1 closeout (this phase).** Lock the doc schema (sub-task 2),
   pick Yjs as the default (sub-task 5), bench WS Node vs Rust gateway
   (sub-task 4). Decide service-location in Phase 3 sub-task 1.
2. **Phase 2 — Persistence.** Add `sabflow_docs` snapshot collection (n8n-
   shape JSON for read APIs + executor compat) and `sabflow_oplog` append-
   only Yjs updates. Snapshot compaction worker folds oplog into a fresh
   snapshot; old updates GC via Vercel Cron. Existing `sabflow` collection
   is migrated to `sabflow_docs` with a one-time backfill.
3. **Phase 3 — WS gateway.** Stand up the WebSocket service at
   **`services/sabflow-ws/`** (a standalone Node process — location locked in
   `docs/adr/sabflow-ws-gateway-node.md` §2.1, Option B; Rust-vs-Node verdict
   gated on the Track A Phase 1 §4 bench). JWT-on-upgrade with workspace claim,
   one room per doc, heartbeat, reconnect/backoff, plan-tier seat enforcement,
   OTEL traces.
4. **Phase 4 — Sync protocol.** Initial sync (snapshot + delta), update
   fan-out, awareness diff, state-vector exchange, ack/nack, fuzz tests.
5. **Phase 5 — Client SDK.** Ship `useSabFlowDoc`, `usePresence`,
   `<SabFlowProvider>`. Implement optimistic apply with rollback, offline
   queue, **CRDT-aware undo/redo via `Y.UndoManager`** (replaces the current
   `history`/`historyIndex` stack at `EditorPage.tsx` lines 67–102),
   schema-migration runner, telemetry.
6. **Phase 6 — Editor integration.** Replace the in-memory `flow` state in
   `EditorPage.tsx` with `useSabFlowDoc(flowId)`. Replace `handleFlowChange`,
   `handleDocChange`, `handleNameChange` with CRDT ops:
   - `flow.groups` → `Y.Array` of `Y.Map`s.
   - `flow.edges` → `Y.Array` of `Y.Map`s.
   - `flow.variables`, `flow.theme`, `flow.settings` → nested `Y.Map`s.
   - Node drag positions → throttled CRDT ops (avoid 60 fps update fan-out).
   The save server action becomes a **server-side observer** that compacts
   the doc on quiescence — the client no longer "saves". The Cmd+S
   shortcut becomes "force snapshot" for the audit trail.
7. **Phase 7 — Presence.** Replace `src/lib/sabflow/presence/store.ts` with
   Yjs `awareness`. Existing endpoints (`/api/sabflow/presence`) shim into
   the new awareness fan-out so we can roll out behind a flag without
   breaking the UI.
8. **Phase 8 — Access control.** Per-doc RBAC, role-based filters on the WS
   broadcast (viewer = read-only update stream), share-link tokens, credit
   metering for active collab seats, owner transfer, audit log.
9. **Phase 9 — Reliability.** Crash recovery from snapshot + oplog, WS
   failover, doc-corruption detector + manual-repair CLI, version-history UI
   built on snapshot intervals, n8n-compatible `workflow.json` import/export.
10. **Phase 10 — Perf, tests, rollout.** Load test N=2/10/50/200 clients per
    doc, p99 latency SLO, snapshot-size benchmarks, Playwright multi-client
    suite, 24 h soak, feature-flag `sabflow.crdt.enabled`, plan-tier rollout
    gate, docs + changelog.

### 4.1 Rollback

The feature flag (`sabflow.crdt.enabled`) keeps the current REST save path
alive on `EditorPage.tsx`. If Phase 10 load tests reveal a blocking issue
we ship the REST-with-`versionId`-precondition variant as the durable
single-editor mode and demote CRDT to "beta tier" without losing any data
(the oplog is still readable as JSON snapshots via the compactor).

---

## Decision

**(b) Migrate the SabFlow editor to a CRDT (Yjs) doc as source of truth.**

The current React-state + Mongo-server-action model is strictly weaker than
n8n's already-single-user-only Pinia + REST model. Closing that gap *and*
then layering collab on top would cost more total engineering than going
straight to a CRDT. The persistence story (Mongo snapshot + oplog + R2 cold
tier) fits the SabNode-on-Vercel envelope without new SaaS dependencies.

---

## References

- `src/components/sabflow/editor/EditorPage.tsx` — current editor state, save,
  and undo/redo (lines 52, 67–102, 119–198, 208).
- `src/app/actions/sabflow/index.ts` — REST-equivalent server actions
  (`saveSabFlow` lines 83–114).
- `src/lib/sabflow/types.ts` — `SabFlowDoc` schema (1682 lines).
- `src/lib/sabflow/presence/store.ts` — current in-memory presence
  (lines 14–66).
- `src/components/sabflow/graph/hooks/useSelectionStore.ts` — Zustand
  selection store.
- `src/components/sabflow/graph/providers/GraphProvider.tsx` — viewport +
  connection-drag context.
- `src/components/sabflow/canvas/WorkflowCanvas.tsx` + `Canvas.tsx` — n8n-
  style canvas that emits whole-doc replacements via `handleDocChange`.
- n8n: `packages/editor-ui/src/stores/workflows.store.ts`,
  `packages/editor-ui/src/composables/useWorkflowHelpers.ts`,
  `packages/cli/src/workflows/workflows.service.ts` — Pinia store, save
  helper, and `versionId` precondition.
- `PLAN-sabflow-crdt-collab.md` — Track A phase map (this ADR is sub-task 1
  of Phase 1).
