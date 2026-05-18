# SabFlow execution playback — gap audit (Phase C.1 · sub-task 5)

**Status:** Audit only — no source code modified.
**Audience:** the C.9 sub-task that builds the n8n-style frame-by-frame run inspector.
**Sources read end-to-end:**

- ADRs: `docs/adr/sabflow-execution-state.md`, `docs/adr/sabflow-executor-observability.md`, `docs/adr/sabflow-executor-ipc.md`.
- Engine: `src/lib/sabflow/engine/executeFlow.ts`, `src/lib/sabflow/engine/executeBlock.ts`, `src/lib/sabflow/engine/types.ts`.
- Trace plumbing: `src/lib/sabflow/execution/traceBus.ts`.
- Persistence: `src/lib/sabflow/db.ts` (`createExecutionHistory`, `updateExecutionHistory`, `getExecutionById`), `src/lib/sabflow/types.ts` (`ExecutionHistoryEntry`, `ExecutionHistoryNode`).
- Run entry points: `src/app/api/v1/flows/[flowId]/run/route.ts`, `src/app/api/sabflow/executions/[executionId]/rerun/route.ts`.
- Live stream: `src/app/api/sabflow/executions/[executionId]/stream/route.ts`.
- UI: `src/app/dashboard/sabflow/executions/page.tsx`, `src/app/dashboard/sabflow/executions/[executionId]/page.tsx`, `src/app/dashboard/sabflow/executions/_components/execution-replay-client.tsx`.
- Adjacent (design-only) executor state: `src/lib/sabflow/executor/state.ts`, `src/lib/sabflow/executor/history/pin-data.ts`.

---

## 1. Current state

### 1.1 What gets emitted per execution

The engine in `src/lib/sabflow/engine/executeFlow.ts` accepts an optional `executionId` and, when it is supplied, publishes events to the in-process bus in `src/lib/sabflow/execution/traceBus.ts`. Two event shapes only:

| Event `kind` | Where emitted | Payload (`TraceEvent` in `traceBus.ts`)                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `'step'`    | `executeFlow.ts` — emitted twice in `runFlowInner`: once on the OK path after `executeBlock` returns (line ~249), once on the error path inside the `catch` (line ~206). | `{ kind: 'step', executionId, step: ExecutionStep, index }`. `ExecutionStep` (defined in `engine/types.ts`) = `{ groupId, blockId, blockType, input?, output?, timestamp, startedAt?, durationMs?, status?, error? }`. `input` and `output` are **strings** — the `output` field is the joined `messages.map(m => m.content).join('\n')`. |
| `'end'`     | `executeFlow.ts` — emitted in the `try { … }`'s success tail (line ~99) and in the `catch { … }` (line ~116). | `{ kind: 'end', executionId, status: 'success' \| 'error' \| 'cancelled', error? }`.                                                                                                                                                                                                                                       |

That is the entire wire vocabulary. There is **no** `'node-start'`, **no** `'node-end'`, **no** `'item-start'`, **no** `'item-end'`. The `'step'` event already conflates start + end into one record because it is only published after the block has finished running.

### 1.2 Where the events land

There are two parallel storage paths, both currently live:

**Path A — in-process bus + SSE (the "live" path, partly wired).**

- `traceBus.publishTraceEvent` (`src/lib/sabflow/execution/traceBus.ts`) keeps a per-`executionId` `Set<Listener>` map.
- It *also* fires a best-effort Redis publish to channel `sabflow:exec:{executionId}` (lines 40 ff.).
- The SSE endpoint that the editor opens is `src/app/api/sabflow/executions/[executionId]/stream/route.ts` — but that endpoint **does not subscribe to the trace bus**. It does an initial `findOne` on `sabflow_executions`, then subscribes to the Redis channel `SABFLOW_EXEC_CHANNEL(executionId)` (imported from `src/lib/sabflow/worker/queues`) or polls Mongo every 2 s, and emits the full row each time.
- Result: the in-process listener path is dead-code at the route level (nothing in `src/app/api/...` calls `subscribeToTrace`), and the Redis fan-out from `traceBus` uses a different channel naming convention than what the SSE route subscribes to — see §5 open question.

**Path B — Mongo execution-history row (the "cold" path, the one the UI actually reads).**

- `createExecutionHistory` (`src/lib/sabflow/db.ts:542`) inserts a row in collection `sabflow_executions` (the same name the *proposed* ADR §2 reserves — but with the *current* `ExecutionHistoryEntry` shape from `src/lib/sabflow/types.ts`, not the proposed `ExecutionDoc`).
- After the run, `src/app/api/v1/flows/[flowId]/run/route.ts:122` and `src/app/api/sabflow/executions/[executionId]/rerun/route.ts:136` call `updateExecutionHistory` with a `nodes: ExecutionHistoryNode[]` array built by mapping `result.updatedSession.history` (the per-step trace that `executeFlow` accumulated).
- The `ExecutionReplayClient` reads `/api/sabflow/executions/[id]` (cold row) and `/api/sabflow/executions/[id]/stream` (live tail).

### 1.3 Per-node payload shape (cold)

From `src/lib/sabflow/types.ts:1606`:

```ts
ExecutionHistoryNode = {
  blockId, blockType,
  status: 'running'|'success'|'error'|'cancelled'|'skipped'|'waiting',
  startedAt?, finishedAt?, durationMs?,
  input?:  unknown,    // currently engine writes a string (the user reply)
  output?: unknown,    // currently engine writes joined message contents
  error?:  string
}
```

Per-node aggregates only. No per-item array, no items count, no binary references, no SabFiles pointer.

### 1.4 What the existing UI does today

`src/app/dashboard/sabflow/executions/_components/execution-replay-client.tsx` already implements:

- A left-rail timeline of nodes with status icon, type, ms.
- A right pane with status pill, duration, input JSON block, output JSON block, and an error banner.
- Keyboard nav (↑/↓/j/k), Space-to-toggle-play.
- A `TimelineScrubber` with rewind / play-pause / fast-forward / step-counter and a per-node duration-weighted bar strip. Playback speeds 0.5× / 1× / 2× / 4× / 8×.
- A "Re-run from here" button that POSTs to `/api/sabflow/executions/[id]/rerun` and navigates to the new execution.
- A live SSE merge while `execution.status === 'running'`, with auto-reconnect handling.

What it does **not** have: per-item snapshots, time-travel (replay an old run against an edited workflow), pin/un-pin of a run for TTL escape, ZIP export.

### 1.5 Caveat: the live path is not wired into the main runners

Both `executeFlow` callsites that currently run real flows (`src/app/api/v1/flows/[flowId]/run/route.ts:120` and `src/app/api/sabflow/executions/[executionId]/rerun/route.ts:134`) invoke `executeFlow(flow, session)` **without** passing the `executionId` argument. The trace bus therefore receives nothing from production runs today — the entire `publishTraceEvent` apparatus is dormant at the entry points despite the engine being instrumented. The cold row is the only signal the UI gets. This is the highest-priority pre-condition gap (see §4).

---

## 2. n8n's playback UX — target experience

n8n's run inspector treats an execution as an immutable recording the operator can scrub. Items SabFlow is missing today:

1. **Per-item input/output snapshots.** Each node records the array it consumed and the array it produced, *per item*, not just a count or a stringified summary. Selecting item *k* on node *N* highlights the produced items of node *N+1* derived from it (lineage). SabFlow today has a single `output` string per node.
2. **Frame-by-frame stepping.** Adjacent to the timeline scrubber, an "advance one item" / "advance one node" affordance that walks through the recording at item granularity. SabFlow today only steps at node granularity.
3. **Time-travel debugging (replay an old run with edits applied).** Operator opens a past execution, edits the workflow doc, then clicks "Replay" — the engine re-runs against the new graph but **re-uses the recorded trigger payload and (optionally) the recorded upstream items as pinned data** to isolate the change. SabFlow today has "Re-run from here" but that re-runs against the *current* workflow with no item pinning and no diff view.
4. **Pin / un-pin runs (skip TTL).** A run can be flagged so the TTL monitor does not evict it after the plan's retention window. n8n surfaces this as a star/pin in the executions list. SabFlow has no equivalent — the `expiresAt` TTL ADR (see `sabflow-execution-state.md` §3.1) is *proposed*, and there is no API or UI to override per-row.
5. **Export run as `.sabflow-trace.zip`.** Operator clicks Export → gets a zip containing the workflow JSON snapshot, the trigger payload, the per-node per-item I/O, the credential *types* used (never values), and a manifest. n8n offers something close ("Download execution"). SabFlow has no export route.

---

## 3. Concrete deltas — each one becomes a C.9 sub-task

> Numbered so the C.9 sub-task list can adopt them verbatim.

1. **Trace shape additions — per-item I/O.**
   Extend `ExecutionStep` (in `src/lib/sabflow/engine/types.ts`) and `ExecutionHistoryNode` (`src/lib/sabflow/types.ts:1606`) with optional `itemsIn?: unknown[]` / `itemsOut?: unknown[]` *or* an opaque pointer field. Apply the existing 256 KiB inline budget rule from `sabflow-execution-state.md` §4.3 (the same threshold already used by `pin-data.ts:PIN_DATA_MAX_BYTES`); anything larger spills to SabFiles under the key shape `__system/sabflow/executions/<workspaceId>/<executionId>/data.json` per ADR §4.2. The engine in `executeFlow.ts` already constructs the `okStep` / `errStep` objects in one place each (lines 233 and 194) — those are the single write sites that need the new fields.

2. **New collection `sabflow_execution_traces` (cold per-item store).**
   The current `sabflow_executions` row holds aggregates. Per-item payloads must NOT inflate that row (the ADR §2 reasoning about hot-path scan cost still applies). Add a sibling collection keyed by `executionId` with one document per `(executionId, blockId)` and the `itemsIn` / `itemsOut` arrays (or a SabFiles pointer when over the inline cap). Index `{ executionId: 1, blockId: 1 }`. TTL: `expireAfterSeconds: 0` on `expiresAt`, **stamped to the parent execution's `expiresAt`** so pin/un-pin (delta #4) and plan-tier retention (ADR §3.2) stay coherent. Non-pinned default = 30 d per ADR §3.2 `pro` tier.

3. **SSE endpoint `/api/sabflow/executions/[id]/replay`.**
   Distinct from today's `/stream` (which tails a *live* run). `/replay` reads the cold row + the new traces collection and emits one event per recorded `(node, item)` pair on a virtual clock, throttled by a `?speed=` query param matching the existing UI's 0.5×–8× selector. This is the wire the new frame-stepper consumes. Add `If-None-Match` / ETag against the execution's `finishedAt` so a paused user can resume mid-stream.

4. **Pinning API + RBAC.**
   `POST /api/sabflow/executions/[id]/pin` and `DELETE …/pin` flip a `pinned: boolean` on `sabflow_executions`. When `pinned = true`, `updateExecutionHistory` unsets `expiresAt` (so the TTL monitor stops evicting); when flipped off, the row's `expiresAt` is recomputed from `startedAt + planRetention`. Mirror the toggle onto every row in `sabflow_execution_traces` for the execution. RBAC keys to register: `sabflow.execution.pin` and `sabflow.execution.unpin` (audit-logged via `recordFlowAction` — the channel `executeFlow.ts` already uses for `flow.execution.started` etc., lines 65–72, 106–112, 124–134).

5. **UI components.**
   Extend `execution-replay-client.tsx` with: (a) a *frame stepper* — buttons "← item" / "item →" wired to a `selectedItemIdx` state that indexes into the new per-item arrays; (b) a *diff view* — when a time-travel replay is active, render selected node's recorded output vs. live re-run output side-by-side (reuse `src/components/sabflow/diff/`); (c) a *pin toggle* in the header next to the status pill calling delta #4. Mobile (<768 px): hide the scrubber transport, keep the timeline rail + detail pane in read-only mode (no re-run / no pin from mobile — the existing UI already has no mobile breakpoint, so this is a fresh contract).

6. **Export bundling — `GET /api/sabflow/executions/[id]/export`.**
   Streams a ZIP with: `manifest.json` (executionId, workflowId, workspaceId, version, startedAt, finishedAt, sabflowSchemaVersion), `workflow.json` (frozen snapshot per `workflowVersion` from ADR §2), `trigger.json` (from `triggerData` or its SabFiles pointer rehydrated server-side), `nodes/<blockId>.json` per per-node trace doc, `credentials.json` (types + ids only, **never values** per `sabflow-executor-observability.md` §6.3.2). Filename: `<flowSlug>-<executionId>.sabflow-trace.zip`. SabFile rule: served via signed URL — no external R2 link in the response body.

---

## 4. Pre-conditions met

- **The engine already produces a per-step trace channel.** `src/lib/sabflow/engine/executeFlow.ts:99` (success terminator), `:116` (error terminator), `:206` (per-step error emit), and `:247` (per-step OK emit) all call `publishTraceEvent` with a complete `ExecutionStep` payload. The bus interface (`src/lib/sabflow/execution/traceBus.ts:14`) is stable: `TraceEvent` is a discriminated union of `'step' | 'end'`. The frame inspector can subscribe at this seam without further engine surgery on the event-shape side.
- **A persisted execution row exists.** `createExecutionHistory` / `updateExecutionHistory` / `getExecutionById` in `src/lib/sabflow/db.ts:542–605` already give us the durable home for per-execution aggregates. The proposed `ExecutionDoc` schema in `src/lib/sabflow/executor/state.ts:141` is **design-only** today (no callers), but the *live* row this audit talks about is the `ExecutionHistoryEntry` returned by those `db.ts` helpers — and that's what the cold-row UI in `execution-replay-client.tsx:109` already loads.
- **A live SSE endpoint exists**, even if it currently tails Mongo rather than the in-process bus: `src/app/api/sabflow/executions/[executionId]/stream/route.ts:28`. The `/replay` route in delta #3 is a sibling, not a rewrite.
- **A scrubber UI already exists** at `src/app/dashboard/sabflow/executions/_components/execution-replay-client.tsx:413` (`TimelineScrubber`). Delta #5 extends it; it does not start from scratch.
- **Pin-data infrastructure exists for *workflow*-level pins** at `src/lib/sabflow/executor/history/pin-data.ts`. Delta #4 ("pin a *run*") is a different axis — pin-data is keyed `(workflowId, nodeId)`; run-pinning is keyed `executionId` — but the 256 KiB cap convention in `PIN_DATA_MAX_BYTES` is reusable for the new per-item inline budget.

---

## 5. Open questions handed to C.9

1. **Production engine entry points do not pass `executionId` to `executeFlow`.** `src/app/api/v1/flows/[flowId]/run/route.ts:120` and `src/app/api/sabflow/executions/[executionId]/rerun/route.ts:134` both call `executeFlow(flow, session)` without the third argument, so `publishTraceEvent` is never fired from real runs. **The first thing the C.9 implementation has to land** is to thread `created.id` through. Without it the `/replay` SSE has no data to stream and the per-item delta is moot. This is a one-line change at each callsite plus passing the same id into the per-step writer in delta #2.
2. **Two SSE channels with different names.** `traceBus.publishToRedis` (`traceBus.ts:82`) publishes to `sabflow:exec:${event.executionId}`; the `/stream` route (`stream/route.ts:89`) subscribes via `SABFLOW_EXEC_CHANNEL(executionId)` (imported from `worker/queues`). C.9 must reconcile: pick one channel-naming helper and use it from both sides, otherwise the new `/replay` endpoint inherits the same skew.
3. **Where the workflow snapshot for time-travel lives.** ADR §2 declares `workflowVersion: number` on the *proposed* `ExecutionDoc` but the *current* `ExecutionHistoryEntry` (`src/lib/sabflow/types.ts:1618`) has no `workflowVersion` field. Time-travel needs an immutable workflow JSON tied to the execution. C.9 either (a) adds a `workflowSnapshot` field on `ExecutionHistoryEntry` (small flows only) / `workflowSnapshotPointer` (SabFiles key for large) or (b) trusts the doc-side history collection (`docs/adr/sabflow-persistence.md`) to keep the version durable and stores only `(workflowId, version)` on the execution row. Recommendation: (b), but the C.9 owner needs to confirm the doc-side `(workflowId, version)` is content-addressable before relying on it.
4. **Plan-tier resolution for TTL re-stamping on un-pin (delta #4).** The pin/un-pin toggle must recompute `expiresAt` from the workspace's *current* plan tier when un-pinning, but the existing `createExecutionHistory` does not take a plan-tier argument — it just inserts the row. C.9 either pulls plan tier from the existing `getUserPlanTier` helper (if present at implementation time) or stamps a default 30-d window per ADR §3.2 and lets a separate sweeper re-stamp on plan upgrade. The latter matches the ADR's "plan-upgrade re-stamping" deferral (`sabflow-execution-state.md` §3.2).
5. **Mobile read-only — auth still applies.** Delta #5(c) says "mobile read-only". That is a UI affordance, not a security boundary — server-side, every pin/export endpoint must still call the same RBAC check (`recordFlowAction` + RBAC key match). Spell this out in the C.9 spec so a viewport-based feature flag doesn't masquerade as authz.
6. **Per-item granularity is currently fiction.** The Node engine's `executeBlock` (`src/lib/sabflow/engine/executeBlock.ts`) operates on a single "message" return per block, not arrays of items. n8n's per-item model assumes a node `execute()` returns `INodeExecutionData[][]` (one array per output port, each array a stream of items). The forge-block executor (line 372 onwards) is the closest path — it has a `result.outputs` map but no item array. **C.9 must decide whether per-item playback applies only to the new Rust-style executor path (`src/lib/sabflow/executor/`) or whether the legacy node-engine path also synthesizes a one-item-per-step view.** Recommendation: synthesize a degenerate 1-item array for legacy `executeBlock` outputs so the UI is uniform, and reserve real multi-item arrays for forge / executor nodes once they ship.

---

**End of audit.**
