# ADR — SabFlow Execution-State Schema

**Status:** Proposed
**Track / Phase / Sub-task:** Track B · Phase 1 · #4
**Scope:** Mongo-side schema for in-flight and completed workflow executions (n8n `execution_entity` analogue).
**Related:** `PLAN-sabflow-crdt-collab.md` (Track B Phase 1 #4; consumed by Phase 2 queue, Phase 7 history). Doc-side persistence (`workflow_entity` analogue) is owned by Track A's `docs/adr/sabflow-persistence.md` and is intentionally out of scope here.

---

## 1. Background — n8n's `execution_entity`

n8n's executor records every run in three tables:

| Table                | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `execution_entity`   | One row per run — status, mode, timing, FK to workflow.      |
| `execution_data`     | Child row holding the (often large) `data` blob: per-node I/O snapshots + the workflow JSON used at run time. Split out because Postgres `text/json` columns this big slow down every read of the parent row. |
| `execution_metadata` | Sparse key/value tags attached to a run (e.g. correlation ids). |

Key n8n columns on `execution_entity` (as of 1.x):

| Column           | Type / notes                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| `id`             | `int` autoincrement (n8n historically uses int for executions, uuid for workflows)    |
| `workflowId`     | FK → `workflow_entity`                                                                |
| `finished`       | `boolean`                                                                             |
| `mode`           | `enum('manual','trigger','webhook','retry','integrated','cli')`                       |
| `retryOf`        | nullable FK → self                                                                    |
| `retrySuccessId` | nullable FK → self                                                                    |
| `startedAt`      | `timestamp`                                                                           |
| `stoppedAt`      | `timestamp` (nullable)                                                                |
| `waitTill`       | `timestamp` (nullable, for `WAIT` node)                                               |
| `status`         | `enum('new','running','success','error','canceled','crashed','waiting','unknown')`    |
| `deletedAt`      | `timestamp` (soft delete, retention policy applies)                                   |

SabFlow keeps the same status/mode lexicon (with two collapses, see §2) but stores everything on a single Mongo doc — Mongo's BSON read cost doesn't penalise embedded sub-docs the way Postgres rows do — and pushes large payloads to R2 via SabFiles through a pointer indirection (see §3).

---

## 2. Shape — `ExecutionDoc`

Collection: **`sabflow_executions`**.
TS source of truth: `src/lib/sabflow/executor/state.ts` (`ExecutionDoc`, `NodeRunState`, `ExecutionStatus`, `ExecutionMode`, `NodeError`).

```ts
{
  _id:                ObjectId,                  // SabFlow execution id
  workspaceId:        ObjectId,                  // tenant scope — MANDATORY
  workflowId:         ObjectId,                  // FK → sabflows._id
  workflowVersion:    int,                       // snapshot generation at launch
  mode:               ExecutionMode,
  status:             ExecutionStatus,
  startedAt:          Date,
  finishedAt?:        Date,                      // terminal-state transition
  triggerData?:       Record<string, unknown>,   // inline only when small (<= ~16 KB)
  dataPointer?:       string,                    // SabFiles key for per-node I/O
  errorPointer?:      string,                    // SabFiles key for error envelope
  nodeStates:         Record<string, NodeRunState>,
  parentExecutionId?: ObjectId,                  // set when run as sub-workflow
  retryOfExecutionId?: ObjectId,                 // set on retries
  expiresAt:          Date,                      // TTL anchor — see §3
}
```

`NodeRunState` (per entry in `nodeStates`):

```ts
{
  nodeId:     string,
  status:     'pending'|'running'|'success'|'error'|'skipped',
  startedAt?: Date,
  finishedAt?: Date,
  error?:     NodeError,        // forward-declared; owned by sibling #8
  itemsIn?:   int,              // cheap counter for UI; full I/O lives in R2
  itemsOut?:  int,
  tries:      int,              // attempt counter; 1 on first run
}
```

### 2.1 Enum mappings to n8n

| n8n value     | SabFlow value     | Notes                                                              |
| ------------- | ----------------- | ------------------------------------------------------------------ |
| `unknown`     | (dropped)         | Never written — terminal status is always one of the seven values. |
| `integrated`  | `subworkflow`     | "Called by another workflow." Renamed to match the parent/child field. |
| `cli`         | `subworkflow` *or* `manual` | SabFlow has no CLI invocation path; admin re-runs land as `manual`, programmatic invocations from another flow land as `subworkflow`. |
| `finished` bool | derived          | `status in {success, error, canceled, crashed}` ⇒ finished.        |
| `waitTill`    | (dropped)         | Replaced by `status='waiting'` + a separate `sabflow_executions_waits` row in Phase 2 (Wait/Webhook-response timer queue). Keeping it off the hot doc avoids the rewrite-on-every-poll pattern n8n suffers from. |
| `retrySuccessId` | (deferred)     | The forward pointer "a later run rescued me" is derivable by querying `retryOfExecutionId = <self>`. Materialise only if perf demands it (Phase 7 sub-task #6). |

### 2.2 NodeError indirection

`NodeError` is forward-declared inline in `state.ts`. Sibling sub-task #8
(Track B · Phase 1) owns the canonical taxonomy — once it lands in
`executor/errors.ts`, the inline declaration in `state.ts` is replaced by a
re-export. See `state.ts` header for the migration note.

---

## 3. Indexes & retention

All workspace-scoped indexes are **prefixed by `workspaceId`** — cross-tenant
scans must be structurally impossible. Bootstrapped on first collection
access by `getExecutionCollection()` in `state.ts`.

### 3.1 Indexes

| Index                                          | Purpose                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `{ workspaceId: 1, startedAt: -1 }`            | Workspace dashboard list (recent first). Primary tenant-scoped path.   |
| `{ status: 1, startedAt: -1 }`                 | "Failed runs in this window" / status filters across workspaces (admin / cron sweeps). Status cardinality is small (7) but combined with `startedAt` gives a covered range. |
| `{ workflowId: 1, startedAt: -1 }`             | Per-workflow execution history (editor "Executions" tab).              |
| `{ parentExecutionId: 1 }` sparse              | Sub-workflow lineage traversal (parent → children).                    |
| `{ retryOfExecutionId: 1 }` sparse             | Retry chains.                                                          |
| `{ expiresAt: 1 }` with `expireAfterSeconds: 0` | **TTL** — eviction time stored per-row in `expiresAt`. See §3.2.       |

### 3.2 Retention by plan tier

Eviction is driven by the Mongo TTL monitor reading `expiresAt`. The value
is **stamped at insert** by `createExecution()` and re-stamped when a plan
upgrade extends retention (handled by a Phase 7 sub-task — out of scope
here).

| Plan tier   | Retention | Rationale                                                               |
| ----------- | --------- | ----------------------------------------------------------------------- |
| free        | 7 days    | Smoke-test history only; keeps storage cost trivial on the free tier.   |
| pro         | 30 days   | One sprint of debugging headroom. Matches `DEFAULT_RETENTION_DAYS`.     |
| business    | 90 days   | One fiscal quarter — common audit window for B2B customers.             |
| enterprise  | 365 days  | One year — typical contractual log-retention floor for regulated buyers.|

Plans that exceed 365 days fall under the Phase 9 "R2 archival" sub-task (Track B Phase 7 #9): the executor row is moved to a SabFiles-backed cold tier with the row reduced to a tombstone pointer. That archival path is intentionally out of scope for this ADR.

The default chosen by `createExecution()` when no `retentionDays` is passed is a **generous 30 days**, matching `pro`. Plan-tier-aware callers (the queue dispatcher, Phase 2 sub-task #2) MUST resolve the actual plan tier and override.

### 3.3 Why no soft-delete column

n8n carries `deletedAt` for a per-user "Hide from history" gesture. SabFlow
defers that to the UI layer: hides are a per-user preference (stored on the
`workspace_members` profile, not on the execution row) so a hide by one
admin doesn't leak across tenants and so the TTL monitor remains the single
source of truth for "row exists or not". If product demand for a true soft
delete emerges, add a sparse `deletedAt` index — but do not change the TTL
contract.

---

## 4. Pointer indirection — large I/O lives in R2 via SabFiles

Per `CLAUDE.md` SabFiles policy and the doc-side persistence ADR §4, large
payloads NEVER go into Mongo and NEVER touch raw R2 SDK calls from app code.
They are written through the SabFiles ingest path and referenced by key.

### 4.1 What lives where

| Payload                               | Inline on `ExecutionDoc`?  | Where it lives at scale                                 |
| ------------------------------------- | -------------------------- | ------------------------------------------------------- |
| Status / mode / timing / nodeId list  | ✅ Always inline.          | —                                                       |
| Per-node `status / startedAt / tries / itemsIn / itemsOut` | ✅ Always inline. | —                                                       |
| `triggerData`                         | ✅ Iff ≤ 16 KB.            | Else: `dataPointer` (SabFiles key, key shape below).    |
| Per-node input/output items           | ❌ Never inline.           | `dataPointer` → SabFiles object (JSON or BSON map keyed by `nodeId`). |
| Error stack / request-response dumps  | ❌ Never inline.           | `errorPointer` → SabFiles object (JSON envelope).       |
| Pinned data (testing aid)             | ❌ Not on the execution doc. | Lives on the workflow doc, not here (Phase 7 sub-task #5). |

### 4.2 SabFiles key shape

```
__system/sabflow/executions/<workspaceId>/<executionId>/data.json
__system/sabflow/executions/<workspaceId>/<executionId>/error.json
```

- `<workspaceId>` / `<executionId>` are ObjectId hex strings.
- The `__system` prefix is the convention used by the doc-side ADR (§4) for
  system-owned tenant folders. Users never see these in their SabFiles
  library; access goes through signed URLs the executor / editor mint on
  demand.
- Re-hydration on view (editor "Run details") issues a SabFiles fetch by key
  — never embed a raw R2 URL in the doc and never expose an external-URL
  field for execution payload ingestion (per `CLAUDE.md`).

### 4.3 Inline-vs-pointer threshold

The 16 KB inline budget for `triggerData` is conservative. It tracks
Mongo's per-document working-set economy more than the 16 MB hard cap —
docs that bloat past ~64 KB start to dominate every workspace-list page
fetch even when the caller doesn't need the trigger body. The Phase 2
queue dispatcher (sub-task #2) is the single writer of `triggerData` and
is responsible for the spill decision.

---

## 5. Model facade — why no Mongoose

The codebase uses the native `mongodb` driver everywhere; introducing
Mongoose for one collection would split the dual-ORM cost without payback.
`SabFlowExecutionModel` in `state.ts` exposes the same surface a Mongoose
model would (typed collection accessor, schema-equivalent TS types, index
bootstrap, default retention) over the native driver. If a future ADR
adopts Mongoose project-wide, the migration is a structural rename — the
exported symbol name is already model-shaped.

---

## Summary (≤200 words)

**Collection (this ADR):** `sabflow_executions` — one Mongo doc per
workflow run, mirroring n8n's `execution_entity` lexicon. TS schema lives
in `src/lib/sabflow/executor/state.ts` (`ExecutionDoc`, `NodeRunState`,
`ExecutionStatus`, `ExecutionMode`); `NodeError` is forward-declared and
will be re-exported from `errors.ts` once Phase-1 sub-task #8 lands.

**Indexes:** `(workspaceId, startedAt desc)`, `(status, startedAt desc)`,
`(workflowId, startedAt desc)`, plus sparse `parentExecutionId` /
`retryOfExecutionId` for lineage, and a TTL on `expiresAt`
(`expireAfterSeconds: 0` — eviction time stamped per row).

**Retention by plan tier:** free = 7d, pro = 30d, business = 90d,
enterprise = 365d. `createExecution` stamps `expiresAt` at insert; plan
upgrades re-stamp. Default helper retention is a generous 30d (pro).

**Pointer indirection:** large per-node I/O and error envelopes live in
R2 via SabFiles under `__system/sabflow/executions/<workspaceId>/<executionId>/`,
referenced by `dataPointer` / `errorPointer`. The execution doc itself
stays small (status, timing, per-node counters) so the workspace
dashboard's tenant-scoped scan stays cheap.
