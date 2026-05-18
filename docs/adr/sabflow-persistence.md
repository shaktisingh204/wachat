# ADR — SabFlow Persistence Layer (Mongo + R2)

**Status:** Proposed
**Track / Phase / Sub-task:** Track A · Phase 1 · #6
**Scope:** Doc-side persistence (snapshot + oplog + RBAC). Execution-side persistence (`execution_entity` analogue) is owned by Track B and is intentionally out of scope here.
**Related:** `PLAN-sabflow-crdt-collab.md` (Track A Phase 1 step 6; Track A Phase 2 full collection set).

---

## 1. Background — n8n's TypeORM + Postgres model

SabFlow mirrors n8n's domain model but swaps the storage substrate (Postgres → Mongo for hot doc + RBAC rows, R2 for cold snapshots). The relevant n8n tables we are mapping are documented in `@n8n/db/src/entities/*` and `packages/cli/src/databases/entities/*`. Known columns (TypeORM decorators on the canonical entities, as of n8n 1.x):

### 1.1 `workflow_entity`

| Column            | Type / notes                                                  |
| ----------------- | ------------------------------------------------------------- |
| `id`              | `varchar` / `uuid`, PK                                        |
| `name`            | `varchar(128)`                                                |
| `active`          | `boolean` (trigger registration flag)                         |
| `nodes`           | `json` (array of node objects)                                |
| `connections`     | `json` (graph edges keyed by source node)                     |
| `settings`        | `json` (executionOrder, errorWorkflow, timezone, saveDataOnError, callerPolicy, ...) |
| `staticData`      | `json` (per-node persisted state across executions)           |
| `pinData`         | `json` (editor pin-data for debugging)                        |
| `versionId`       | `uuid` (optimistic-concurrency token, bumped on every save)   |
| `triggerCount`    | `int` (denormalised count, used for activation cost)          |
| `meta`            | `json` (UI meta — onboarding flags etc.)                      |
| `createdAt`       | `timestamp`                                                   |
| `updatedAt`       | `timestamp`                                                   |
| `parentFolderId`  | `varchar` (nullable, FK → `folder`)                           |

### 1.2 `execution_entity`

Out of scope for this ADR — see Track B Phase 7. Cited here for completeness:

| Column         | Type / notes                                                                          |
| -------------- | ------------------------------------------------------------------------------------- |
| `id`           | `int` autoincrement (n8n historically uses int for executions, uuid for workflows)    |
| `workflowId`   | FK → `workflow_entity`                                                                 |
| `finished`     | `boolean`                                                                              |
| `mode`         | `enum('manual','trigger','webhook','retry','integrated','cli')`                       |
| `retryOf`      | nullable FK → self                                                                     |
| `retrySuccessId` | nullable FK → self                                                                   |
| `startedAt`    | `timestamp`                                                                            |
| `stoppedAt`    | `timestamp` (nullable)                                                                 |
| `waitTill`     | `timestamp` (nullable, for `WAIT` node)                                                |
| `status`       | `enum('new','running','success','error','canceled','crashed','waiting','unknown')`    |
| `deletedAt`    | `timestamp` (soft delete, retention policy applies)                                    |
| **child:** `execution_data` | `data: text/json` (input/output snapshots), `workflowData: json`           |
| **child:** `execution_metadata` | `key`, `value` (sparse per-execution tags)                              |

### 1.3 `credentials_entity`

Out of scope here (owned by Track B Phase 5). Cited columns:

| Column   | Type / notes                                                  |
| -------- | ------------------------------------------------------------- |
| `id`     | `uuid` PK                                                     |
| `name`   | `varchar(128)`                                                |
| `data`   | `text` (AES-256-GCM encrypted blob; key from `N8N_ENCRYPTION_KEY`) |
| `type`   | `varchar(128)` (credential type id, e.g. `googleSheetsOAuth2Api`) |
| `nodesAccess` | `json` (deprecated, replaced by project sharing)         |
| `createdAt` / `updatedAt` | `timestamp`                                       |

### 1.4 `tag_entity` + `workflows_tags`

| Column | Type / notes |
| ------ | ------------ |
| `id`   | `uuid` PK    |
| `name` | `varchar(24)` unique |
| `createdAt` / `updatedAt` | `timestamp` |

Join table `workflows_tags(workflowId, tagId)` is a classic many-to-many.

### 1.5 `shared_workflow` (RBAC)

n8n's per-resource sharing row. Columns:

| Column           | Type / notes                                                  |
| ---------------- | ------------------------------------------------------------- |
| `workflowId`     | FK → `workflow_entity`, composite PK                          |
| `projectId`      | FK → `project` (every user / team gets a personal project)    |
| `role`           | `enum('workflow:owner','workflow:editor','workflow:user')`    |
| `createdAt` / `updatedAt` | `timestamp`                                          |

A workflow is reachable to a user iff their project has a `shared_workflow` row, or they are a global admin. SabFlow keeps the same join-row pattern but scopes by `workspaceId` (SabNode's tenant key) instead of n8n's `project`.

---

## 2. Mongo equivalents — SabFlow doc side

This ADR specifies **three** doc-side collections. Models / collection bootstrap belong to Phase 2 — this ADR only fixes shape, indexes, retention, and RBAC join semantics. Field names follow SabNode's camelCase convention; binary fields are stored as BSON `Binary` (subtype 0) holding raw Yjs update bytes.

### 2.1 `sabflow_docs` — snapshot collection (n8n `workflow_entity` analogue)

```
{
  _id:           ObjectId,            // SabFlow doc id (also used as Yjs room id)
  workspaceId:   ObjectId,            // tenant scope — MANDATORY on every query
  ownerId:       ObjectId,            // user id (creator; transferable via Phase 8)
  name:          string,              // display name, <=128 chars
  version:       int,                 // monotonic snapshot version (bumped on compaction)
  versionId:     string,              // uuid, bumped on every save (n8n compat — optimistic concurrency)
  snapshot:      BinData,             // Y.encodeStateAsUpdate(doc) — current baseline
  snapshotSize:  int,                 // bytes; used to trigger compaction + cold-tier move
  schemaVersion: int,                 // SabFlow doc-schema version (for migrations, see Phase 5 client SDK)
  settings:      object,              // executionOrder, errorWorkflow, timezone, ... (n8n-compat)
  meta:          object,              // UI meta — onboarding flags, last viewport, etc.
  tags:          [string],            // tag ids (denormalised; canonical list in sabflow_tags — Phase 2)
  triggerCount:  int,                 // denormalised, mirrors n8n
  active:        boolean,             // trigger registration flag
  coldTier:      {                    // null until R2 archival runs
    storage:       'r2',
    key:           string,            // sabflow/<workspaceId>/<docId>/<version>.bin
    movedAt:       Date,
    snapshotSize:  int,
  } | null,
  createdAt:     Date,
  updatedAt:     Date,
  lastEditorId:  ObjectId,            // user who applied the most recent op
  deletedAt:     Date | null,         // soft delete (n8n parity)
}
```

Notes:
- `snapshot` is the **hot** baseline. Once a doc goes cold (>30 days untouched), `snapshot` is dropped from Mongo (set to `null`) and `coldTier.key` points at the R2 object. See §4.
- `versionId` (uuid string) mirrors n8n's optimistic-concurrency token and is the field clients submit on save; `version` (int) tracks compaction generations.

### 2.2 `sabflow_oplog` — append-only CRDT updates

```
{
  _id:        ObjectId,
  docId:      ObjectId,   // FK → sabflow_docs._id
  workspaceId: ObjectId,  // duplicated for tenant-scoped queries + sharded reads
  seq:        long,       // monotonic per (docId); allocated by gateway on append
  clientId:   string,     // Yjs clientId of the originator (uint32 stringified)
  update:     BinData,    // raw Yjs update bytes (NOT a state-vector diff — the wire-format update)
  size:       int,        // bytes (for budget tracking)
  ts:         Date,       // server-assigned timestamp
  baseVersion: int,       // sabflow_docs.version this op was emitted against (helps compaction)
}
```

This is intentionally **append-only**. The compaction worker (§6) folds a window of oplog entries into a new snapshot, then a TTL job reaps the folded entries. Reads during initial sync send `snapshot + tail(oplog where seq > snapshotSeq)`.

### 2.3 `sabflow_doc_shares` — RBAC join (n8n `shared_workflow` analogue)

```
{
  _id:         ObjectId,
  docId:       ObjectId,    // FK → sabflow_docs._id
  workspaceId: ObjectId,    // tenant scope
  principal: {
    kind:  'user' | 'group' | 'link',
    id:    ObjectId | string,        // userId, groupId, or share-token id (Phase 8)
  },
  role:        'owner' | 'admin' | 'editor' | 'commenter' | 'viewer',
  grantedBy:   ObjectId,    // user id of grantor (audit)
  createdAt:   Date,
  updatedAt:   Date,
  expiresAt:   Date | null, // for share-link tokens
}
```

Role semantics mirror n8n's `workflow:owner / workflow:editor / workflow:user`, extended with `commenter` and `viewer` (planned in Track A Phase 8). The `owner` row is created at doc-create time and is non-deletable except via "Owner transfer" (Phase 8 sub-task 8).

---

## 3. Indexes & retention

Indexes are bootstrapped in Phase 2. Listed here as a contract so callers can rely on them. All indexes are **prefixed by `workspaceId`** where the query path is tenant-scoped — this is non-negotiable and protects against cross-tenant index scans.

### 3.1 `sabflow_docs`

| Index                                                | Purpose                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| `{ workspaceId: 1, updatedAt: -1 }`                  | Workspace dashboard list (recent first)          |
| `{ workspaceId: 1, ownerId: 1, updatedAt: -1 }`      | "My docs" view                                   |
| `{ workspaceId: 1, name: 1 }`                        | Name lookup / autocomplete                       |
| `{ workspaceId: 1, tags: 1 }`                        | Tag filter                                       |
| `{ workspaceId: 1, active: 1 }`                      | Active-trigger sweep (handed off to Track B)     |
| `{ deletedAt: 1 }` sparse                            | Soft-delete cleanup worker                       |
| `{ "coldTier.movedAt": 1 }` sparse                   | Cold-tier admin / repair                         |

### 3.2 `sabflow_oplog`

| Index                                            | Purpose                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `{ docId: 1, seq: 1 }` (UNIQUE)                  | Per-doc ordering — the primary read path. Uniqueness blocks dupes. |
| `{ workspaceId: 1, ts: -1 }`                     | Workspace-scoped audit windows                                     |
| `{ docId: 1, ts: 1 }`                            | Time-window queries for compaction                                 |
| `{ ts: 1 }` with `expireAfterSeconds`            | **TTL** — see retention rule below                                 |

**TTL on oplog after compaction.** The TTL index reaps entries older than the configured horizon (default: **7 days post-compaction**, configurable per-plan tier; minimum 24h to support recovery). The compaction worker (§6) marks safe-to-reap entries by updating `ts` to a "tombstone" past-timestamp once a snapshot covers them; the TTL then evicts. Hard-floor 24h means even unfolded entries still age out if compaction never runs, preventing unbounded growth from abandoned docs.

### 3.3 `sabflow_doc_shares`

| Index                                                                  | Purpose                          |
| ---------------------------------------------------------------------- | -------------------------------- |
| `{ docId: 1, "principal.kind": 1, "principal.id": 1 }` (UNIQUE)        | Single grant per principal       |
| `{ workspaceId: 1, "principal.id": 1 }`                                | "What can this user see?"        |
| `{ expiresAt: 1 }` sparse + TTL                                        | Share-link expiry                |

---

## 4. R2 cold-tier rule (SabFiles-routed)

**Rule:** A `sabflow_docs` row whose `updatedAt` is older than **30 days** AND whose `snapshotSize > 256 KB` is migrated to R2 by the cold-tier worker (Phase 2 sub-task 3 / Phase 9 archival).

**Key shape (required):**

```
sabflow/<workspaceId>/<docId>/<version>.bin
```

- `<workspaceId>` and `<docId>` are ObjectId hex strings.
- `<version>` is `sabflow_docs.version` (the compaction-generation integer). Storing every generation gives us a free version history (Phase 9 sub-task 6) without extra writes — older generations are evicted by a separate version-history retention policy, not by this rule.

**SabFiles policy applies** (per `CLAUDE.md`):
- The R2 object is registered with SabFiles, **not** written directly to a raw R2 bucket from a one-off SDK call. The cold-tier worker uses the same SabFiles upload path that any in-product file ingestion uses, scoped to a system-owned tenant folder (`__system/sabflow/...`).
- This means re-hydration (cold → hot on access) goes through the SabFiles signed-URL path; we never embed a free-text R2 URL in user-visible UI, and never expose an external-URL field for snapshot ingestion. Already enforced for all file inputs (see "SabFiles policy" in `CLAUDE.md`); the same rule extends to system-managed snapshot files.
- Lifecycle (immutability / versioning / replication) is configured at the SabFiles bucket level, not per-object from app code.

**Re-hydration path:** on `loadDoc(docId)`, the repo (§5) checks `coldTier`. If non-null, it issues a SabFiles fetch by key, decodes the Yjs update into a fresh `Y.Doc`, writes the snapshot back into `sabflow_docs.snapshot`, clears `coldTier`, and returns. This is a one-shot warm-up; subsequent reads hit Mongo. The warm-up is rate-limited per workspace to bound R2 egress.

---

## 5. Multi-tenant scoping

Every read and write touches `workspaceId`. There is no "by id only" lookup at the repo layer — `getDocById` is `getDocById(workspaceId, docId)`. This is enforced by the repo helpers below and by the index prefixes in §3.

### 5.1 Repo helper contract (specification only; implementation lands Phase 2 sub-task 7)

```
loadDoc(workspaceId, docId)              -> { snapshot, version, head: seq }
appendUpdate(workspaceId, docId, clientId, update) -> { seq }
saveSnapshot(workspaceId, docId, snapshot, fromSeq) -> { version }
listDocs(workspaceId, opts)              -> Doc[]
getDocShares(workspaceId, docId)         -> Share[]
canAccess(workspaceId, docId, userId, requiredRole) -> boolean
```

- `workspaceId` is the first positional arg in every helper — no overloads, no defaults. Static-analysis lint rule (Phase 2 sub-task 8) will reject any direct Mongo collection access from outside `repo/sabflow/*` so the workspace prefix cannot be bypassed.
- `appendUpdate` allocates `seq` via a per-doc counter (Mongo `findOneAndUpdate` with `$inc` on a `sabflow_doc_seq` counter doc, or, for the gateway-resident path, a Redis `INCR` synced periodically). The choice is Phase 3 gateway work; the contract here is "monotonic per docId".
- All cursor results pass through a "must include workspaceId" assertion in dev/test builds.

### 5.2 RBAC join

`canAccess(workspaceId, docId, userId, requiredRole)` resolves by:

1. Verify `sabflow_docs._id === docId AND workspaceId === <arg>` — else 404 (do not leak existence across tenants).
2. Lookup `sabflow_doc_shares` for `(docId, principal.kind in {'user','group'}, principal.id in {userId, ...userGroups})`.
3. Workspace admins (SabNode RBAC `workspace.admin`) get implicit `admin` role on every doc in their workspace.
4. The `requiredRole` argument is checked against the role-rank table (`viewer < commenter < editor < admin < owner`).
5. The RBAC keys registered for this layer (`sabflow.doc.read / write / share / delete`) come from Phase 1 sub-task #7 (auth) — this ADR consumes them, it does not register them.

---

## 6. Snapshot-compaction worker outline

**Goal:** keep `sabflow_oplog` bounded and `sabflow_docs.snapshot` close to current state, without blocking the WS gateway.

**Cadence:** triggered when **any** of the following is true for a given doc (whichever fires first):

- Oplog tail length `> 256 entries` since last snapshot, OR
- Oplog tail bytes `> 64 KB`, OR
- Time since last compaction `> 5 minutes` AND tail is non-empty, OR
- On-demand: `compactNow(docId)` from admin tooling or pre-archival hook.

**Execution model:** a background worker (Vercel Cron-triggered sweep + on-demand enqueue via Redis queue, mirroring n8n's worker pattern from Track B Phase 2). The worker is **separate** from the WS gateway process so a slow fold can't stall live edits.

**Algorithm:**

1. Acquire a per-doc advisory lock (`SETNX sabflow:compact:<docId>` with a short TTL).
2. Read current `snapshot` (or warm-up from R2 if cold) into a `Y.Doc`.
3. Read all `sabflow_oplog` rows for `docId` with `seq > snapshotSeq`, ordered by `seq`.
4. `Y.applyUpdate(doc, update)` for each row.
5. Encode `Y.encodeStateAsUpdate(doc)` -> new snapshot bytes.
6. Atomically: bump `version`, write new `snapshot`, set `snapshotSeq` to the last folded `seq`, update `updatedAt`, record `lastEditorId` from the final op.
7. Mark folded oplog rows' `ts` to a tombstone past-time so TTL evicts them after the safety window (default 7 days).
8. Release the lock.

**Concurrency safety:**
- The gateway always appends with a fresh `seq`; the worker only reads `seq <= snapshotSeq` at fold time. Late ops (`seq > snapshotSeq`) are picked up in the next fold pass.
- Optimistic write of the new snapshot is conditional on `version` not having advanced under us; if it did, the worker discards its result and retries.

**Risks** (covered in summary § below):
1. **Lost ops mid-fold** — mitigated by the seq-based fence and the safety window (TTL doesn't run until after a generous grace).
2. **Snapshot bloat** — large branchy edit histories produce snapshots that don't shrink (Yjs garbage collection requires `gc:true` on the Y.Doc and a tombstone sweep; we run with `gc:true` and accept slow drift). Mitigation: cold-tier rule (§4) caps unbounded growth for inactive docs.
3. **Worker starvation under load** — if compaction can't keep up, oplog grows. Mitigated by per-workspace fairness (round-robin) and plan-tier compaction priority (paid tiers fold more aggressively).

---

## Summary (≤200 words)

**Collections (this ADR, doc side only):**
1. `sabflow_docs` — snapshot baseline per doc; n8n `workflow_entity` analogue; carries `coldTier` pointer when archived to R2 via SabFiles.
2. `sabflow_oplog` — append-only Yjs updates; keyed `(docId, seq)` UNIQUE; the primary CRDT history substrate.
3. `sabflow_doc_shares` — RBAC join; n8n `shared_workflow` analogue; scoped by `workspaceId`.

**Retention rule:** TTL on `sabflow_oplog` evicts entries 7 days after the snapshot-compaction worker tombstones them (24h hard floor for unfolded). `sabflow_docs.snapshot` rows untouched for 30 days migrate to R2 under `sabflow/<workspaceId>/<docId>/<version>.bin` via SabFiles (no direct R2 SDK writes, no user-facing R2 URLs — per SabFiles policy). Re-hydration is on-demand on next load.

**Top compaction risk:** **lost ops mid-fold** — if the worker reads the oplog, applies updates, and writes a new snapshot while a concurrent gateway append lands with a `seq` the fold didn't see. Mitigated by the seq-fence (worker only folds `seq ≤ snapshotSeq` at lock time), conditional version-bump (rejects stale writes), and a safety window before TTL eviction (oplog rows survive long enough to replay if a fold is voided). Secondary risk: Yjs garbage-collection drift bloating snapshots for long-lived docs with heavy edit churn — capped by the cold-tier rule.
