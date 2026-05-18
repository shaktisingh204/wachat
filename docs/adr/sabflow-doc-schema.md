# ADR — SabFlow Doc Schema (n8n alignment)

> Track A — Phase 1 — Sub-task #2
> Status: **Proposed**
> Date: 2026-05-18
> Owners: SabFlow platform
> Scope: read-only inventory + mapping; **no code changes** in this PR.

## Context

Track A introduces a CRDT-backed collaborative editor on top of SabFlow's
existing flow document. Phase 1 sub-task #1 already evaluated n8n's editor
state model; this ADR captures the **document schema** shape we adopt as the
canonical authoring format the CRDT will mutate and the executor (Track B)
will run.

Goal: align with n8n's `workflow.json` shape as much as is practical so that
(a) Track B can be n8n-execution-compatible, (b) we can keep
`interop/n8nImport.ts` + `n8nExport.ts` lossless on round-trip, and (c) the
schema has a documented evolution path that does not break saved docs.

---

## 1. n8n workflow JSON structure

Reference: n8n editor "Download" export (workflow.json). Subset captured in
the project's own typings at
[`src/lib/sabflow/interop/n8nImport.ts:35-62`](../../src/lib/sabflow/interop/n8nImport.ts)
(`N8nNode`, `N8nConnections`, `N8nWorkflowJson`) and in the richer adapter
types under [`src/lib/sabflow/n8n/interfaces.ts`](../../src/lib/sabflow/n8n/interfaces.ts).

### 1.1 Top-level fields

| Field         | Type                                | Notes                                                          |
|---------------|-------------------------------------|----------------------------------------------------------------|
| `name`        | `string`                            | Display name.                                                  |
| `id`          | `string`                            | Workflow id (uuid / cuid in n8n cloud).                        |
| `nodes`       | `INode[]`                           | Authoring graph nodes.                                         |
| `connections` | `IConnections`                      | Source-indexed adjacency map.                                  |
| `active`      | `boolean`                           | Whether the workflow is live for triggers.                     |
| `settings`    | `IWorkflowSettings` (optional)      | Timezone, error workflow id, save settings, exec order.        |
| `staticData`  | `Record<string, unknown>`           | Cross-execution persistent state (e.g. cursor for polling).    |
| `pinData`     | `Record<nodeName, INodeExecData[]>` | Editor-only: pinned sample outputs per node.                   |
| `meta`        | `{ templateId?, instanceId? }`      | Provenance fields.                                             |
| `versionId`   | `string` (uuid)                     | Optimistic-locking handle on save.                             |
| `tags`        | `string[]` / tag refs               | Workspace organisation.                                        |

### 1.2 Node shape (`INode`)

| Field         | Type                                | Notes                                                                |
|---------------|-------------------------------------|----------------------------------------------------------------------|
| `id`          | `string`                            | Stable id.                                                           |
| `name`        | `string`                            | Unique within the workflow — used as the key in `connections`.       |
| `type`        | `string`                            | Namespaced type, e.g. `n8n-nodes-base.httpRequest`.                  |
| `typeVersion` | `number`                            | Per-type schema version; enables in-place node migrations.           |
| `position`    | `[number, number]`                  | Canvas coordinates.                                                  |
| `parameters`  | `INodeParameters` (`Record<string, unknown>`) | Per-type config object.                                  |
| `credentials` | `Record<credName, { id, name }>`    | Reference to stored credentials.                                     |
| `disabled`    | `boolean` (optional)                | Skip during execution.                                               |
| `notes`       | `string` (optional)                 | Free-text annotation visible in the inspector.                       |
| `continueOnFail`     | `boolean` (optional)         | Legacy error-handling toggle.                                        |
| `onError`     | `'stopWorkflow'\|'continueRegularOutput'\|'continueErrorOutput'` | Newer error strategy.    |
| `retryOnFail`/`maxTries`/`waitBetweenTries` | `boolean`/`number`/`number` | Retry config on the node.                       |
| `webhookId`   | `string` (optional)                 | For webhook-trigger nodes.                                           |
| `executeOnce` | `boolean` (optional)                | Run once even if upstream emits N items.                             |

### 1.3 Connection shape (`IConnections`)

```ts
type IConnections = {
  [sourceNodeName: string]: {
    [outputType in 'main' | 'ai_tool' | 'ai_languageModel' | …]: Array<Array<{
      node: string;   // target node name
      type: string;   // input type on the target (matches outputType)
      index: number;  // input index on the target
    }>>
  }
}
```

Indexing semantics: `connections[src][type][outputIndex]` is the list of
`{ node, type, index }` entries fanned out from that handle. Source-indexed
(not edge-indexed), so deletes/renames on the source are cheap.

---

## 2. SabFlow's current doc shape

Canonical type: `SabFlowDoc` in
[`src/lib/sabflow/types.ts:1407-1442`](../../src/lib/sabflow/types.ts).

```ts
// src/lib/sabflow/types.ts:1407
export type SabFlowDoc = {
  _id?: ObjectId;
  userId: string;
  projectId?: string;
  name: string;
  events: SabFlowEvent[];        // triggers (see line 1106)
  groups: Group[];               // grouped ordered blocks (see line 1035)
  edges: Edge[];                 // explicit edge list (see line 1166)
  variables: Variable[];         // workflow-level vars (see line 1179)
  annotations?: Annotation[];    // canvas sticky notes (see line 1390)
  theme: SabFlowTheme;           // chat-widget theming (see line 1264)
  settings: FlowSettings;        // see line 1313
  publicId?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  tags?: string[];
  folderId?: string;
  version?: number;              // optimistic-locking counter — types.ts:1439
  createdAt: Date;
  updatedAt: Date;
};
```

Supporting shapes used by the mapping below (all in
`src/lib/sabflow/types.ts`):

- **`Group`** (line 1035): `{ id, title, graphCoordinates, blocks: Block[] }`.
  Groups are a typebot-style construct — vertical lanes that contain an
  ordered list of `Block`s. n8n has no equivalent: every n8n node is its own
  graph node.
- **`Block`** (line 887): `{ id, type, groupId, options, items?, outgoingEdgeId?,
  inputPorts?, outputPorts?, outputPins?, retry?, onError?, pinData?,
  graphCoordinates? }`. `Block.type` is a closed SabFlow-specific union
  (`BlockType`, line 105) — bubbles + inputs + logic + integrations + forge
  blocks.
- **`SabFlowEvent`** (line 1106): `{ id, type, graphCoordinates, outgoingEdgeId?,
  options?, appEvent? }`. The "trigger" half of a workflow — n8n folds these
  into `nodes` with a trigger `type`. SabFlow keeps them in a separate
  top-level array.
- **`Edge`** (line 1166): `{ id, from: EdgeFrom, to: EdgeTo, sourceHandle?,
  targetHandle?, status? }`. An **edge-indexed** list, not source-indexed.
  `EdgeFrom` discriminates over `{eventId} | {groupId} | {groupId, blockId} |
  {groupId, blockId, itemId}` (line 1156).
- **`NodePort`** (line 1132) + handle id convention `outputs/main/0` already
  mirror n8n.
- **`NodeRetryConfig`** (line 919) + **`NodeErrorStrategy`** (line 934) already
  mirror n8n's `retryOnFail` + `onError` semantics, just with different
  field names.
- **`pinData`** lives **per-Block** (`Block.pinData` line 905), not at the
  document root — opposite of n8n.

Persistence and interop touch-points:

- DB load/save: [`src/lib/sabflow/db.ts`](../../src/lib/sabflow/db.ts) (collection
  `sabflows`); revisions in `sabflow_versions` (line 117) capped at 20 snapshots.
- n8n import: [`src/lib/sabflow/interop/n8nImport.ts`](../../src/lib/sabflow/interop/n8nImport.ts).
- n8n export: [`src/lib/sabflow/interop/n8nExport.ts`](../../src/lib/sabflow/interop/n8nExport.ts).
- Runtime adapter (sabflow → n8n IR for the expression engine):
  [`src/lib/sabflow/n8n/adapter.ts`](../../src/lib/sabflow/n8n/adapter.ts).

---

## 3. Mapping table — n8n field ↔ SabFlow field

Status legend: **identical** (same shape), **renamed** (same semantics,
different name), **shaped** (same intent, different structure), **missing**
(needs adding to SabFlow), **extra** (SabFlow-only, no n8n equivalent).

### 3.1 Top-level

| n8n                     | SabFlow                          | Status     | Notes |
|-------------------------|----------------------------------|------------|-------|
| `name`                  | `name`                           | identical  | |
| `id`                    | `_id` (ObjectId)                 | renamed    | Mongo ObjectId vs n8n uuid. |
| `nodes` (triggers+blocks combined) | `events` + `groups[].blocks` | shaped | n8n flattens; SabFlow splits triggers out and wraps blocks in groups. |
| `connections` (source-indexed map) | `edges` (flat array) | shaped | See §4 — switch internal model to source-indexed, keep `edges[]` derivable for the UI. |
| `active`                | `status === 'PUBLISHED'`         | renamed    | n8n boolean vs SabFlow enum (`DRAFT`/`PUBLISHED`/`ARCHIVED`). Keep enum, derive `active`. |
| `settings`              | `settings` (`FlowSettings`)      | shaped     | SabFlow's `FlowSettings` covers SEO/theme/embed; n8n's `IWorkflowSettings` covers exec config. Both should be present — see §4. |
| `staticData`            | `variables` (`Variable[]`) + execution state | shaped | `n8nExport.ts:161` already converts variables → staticData. |
| `pinData` (doc root)    | `Block.pinData` (per block, line 905) | shaped | n8n keys by node name; SabFlow stores on the block. |
| `meta.templateId` / `meta.instanceId` | —                  | missing    | Add `meta` for n8n round-trip + telemetry. |
| `versionId` (uuid)      | `version` (number, line 1439)    | renamed    | SabFlow uses a monotonically-increasing counter for optimistic locking; n8n uses a uuid. Keep the counter. |
| `tags`                  | `tags` (line 1427)               | identical  | |
| —                       | `userId`, `projectId`, `folderId`, `publicId`, `annotations`, `theme`, `createdAt`, `updatedAt` | extra | SabFlow multi-tenancy, chat-widget theming, sticky notes. |

### 3.2 Node (n8n `INode`) ↔ Block / Event

| n8n `INode`                           | SabFlow                          | Status     | Notes |
|---------------------------------------|----------------------------------|------------|-------|
| `id`                                  | `Block.id` / `SabFlowEvent.id`   | identical  | |
| `name` (unique key in `connections`)  | —                                | missing    | SabFlow keys by `id` everywhere; we need to add a `name` (or always synthesise one on export, as `n8nExport.ts:84` already does) to be lossless. |
| `type` (namespaced string)            | `Block.type` (closed union)      | shaped     | SabFlow uses bare slugs (`webhook`, `condition`); `interop/n8nImport.ts:66` already maintains the bidirectional map. |
| `typeVersion`                         | —                                | missing    | **Required** for per-node migrations — see §4. Add `Block.typeVersion?: number`. |
| `position` `[x, y]`                   | `Block.graphCoordinates` `{x, y}` | renamed   | Trivial converter. |
| `parameters`                          | `Block.options`                  | renamed    | Spread-compat: `BlockOptions & Record<string, unknown>` already accepts arbitrary kv. |
| `credentials`                         | `Block.options.credentialsId` / `WebhookOptions.authentication.credentialId` | shaped | SabFlow scatters credential refs across option types; n8n centralises. Plan to add `Block.credentials?: Record<string, { id, name }>`. |
| `disabled`                            | —                                | missing    | Add `Block.disabled?: boolean`. |
| `notes`                               | `Annotation` (line 1390)         | shaped     | n8n attaches notes to nodes; SabFlow uses free-floating sticky notes. Add `Block.notes?: string` for parity. |
| `onError`                             | `Block.onError` (line 903)       | identical  | Same string union. |
| `retryOnFail` / `maxTries` / `waitBetweenTries` | `Block.retry` (line 902, `NodeRetryConfig`) | shaped | Same semantics, grouped under one object. Keep SabFlow's grouped shape; convert at export. |
| `continueOnFail` (legacy)             | `LoopOptions.continueOnFail`     | shaped     | n8n had it per-node; SabFlow has it on the loop block only. Promote to `Block.continueOnFail?: boolean`. |
| `executeOnce`                         | —                                | missing    | Add `Block.executeOnce?: boolean`. |
| `webhookId`                           | `SabFlowWebhook.webhookId` (line 1665, separate collection) | shaped | Persisted in a sibling Mongo collection rather than inline. |

### 3.3 Trigger nodes ↔ `SabFlowEvent`

| n8n trigger node `type`              | SabFlow `SabFlowEvent.type` | Status |
|--------------------------------------|------------------------------|--------|
| `n8n-nodes-base.start`               | `start`                      | renamed |
| `n8n-nodes-base.manualTrigger`       | `manual`                     | renamed |
| `n8n-nodes-base.webhook`             | `webhook`                    | renamed |
| `n8n-nodes-base.scheduleTrigger`     | `schedule`                   | renamed |
| `n8n-nodes-base.errorTrigger`        | `error`                      | renamed |

Already mapped both directions in `interop/n8nImport.ts:86` (TRIGGER_MAP) and
`interop/n8nExport.ts:36` (TRIGGER_REVERSE_MAP).

### 3.4 Connections ↔ `Edge[]`

| n8n `IConnections`                                                    | SabFlow `Edge`                       | Status |
|-----------------------------------------------------------------------|--------------------------------------|--------|
| `connections[src][type][outIdx][N].node`                              | `edge.to.blockId` / `to.groupId`     | shaped |
| `connections[src][type][outIdx][N].type` (input type on target)       | parsed from `edge.targetHandle`      | shaped |
| `connections[src][type][outIdx][N].index`                             | parsed from `edge.targetHandle`      | shaped |
| (implicit) source key                                                 | `edge.from.{eventId\|groupId\|blockId\|itemId}` | shaped |
| (implicit) output index                                               | parsed from `edge.sourceHandle` (`outputs/main/0`) | identical-by-convention |

SabFlow's `sourceHandle` / `targetHandle` strings (line 1170-1173) already
follow n8n's `outputs/main/0` convention.

---

## 4. Versioning strategy

We need three independent version axes, because they evolve on different
schedules:

1. **Doc-level schema version** — the shape of `SabFlowDoc` itself.
2. **Per-node-type version** (n8n's `typeVersion`) — the shape of one
   `Block.options` for one `Block.type`.
3. **Optimistic-locking revision** — the existing `SabFlowDoc.version`
   counter (line 1439). Unchanged by this ADR.

### 4.1 Doc-level schema version

- Add `SabFlowDoc.schemaVersion?: number` with a default of `1`. Documents
  without the field are treated as `schemaVersion: 1`.
- Bump on any breaking change to the top-level shape (renames, removed
  fields, new required fields).
- Additive optional fields do **not** bump `schemaVersion`.

### 4.2 Per-node-type version

- Add `Block.typeVersion?: number` (default `1`) to mirror n8n's `typeVersion`.
- A node migrator (§4.3) is keyed by `(blockType, fromVersion → toVersion)`.
- Allows us to evolve `WebhookOptions`, `SetVariableOptions`, etc. without
  touching unrelated blocks.

### 4.3 Migrators directory

Create `src/lib/sabflow/migrations/` with this layout:

```
src/lib/sabflow/migrations/
├── README.md                  # convention + how to add a migration
├── index.ts                   # registers + applies migrations
├── doc/                       # doc-level migrators
│   ├── v1-to-v2.ts            # example: rename `theme.chat.input` → …
│   └── …
└── nodes/                     # per-node-type migrators
    ├── webhook/
    │   ├── v1-to-v2.ts        # example: split `body` string → WebhookBody object
    │   └── …
    ├── set_variable/
    └── …
```

Contract for every migrator:

```ts
export const migrate: NodeMigration<BlockType, /*from*/ 1, /*to*/ 2> = {
  blockType: 'webhook',
  from: 1,
  to: 2,
  up: (options: WebhookOptionsV1) => WebhookOptionsV2,
  down: (options: WebhookOptionsV2) => WebhookOptionsV1,
};
```

Runtime behaviour:

1. On document load, walk every block. If `block.typeVersion < latest`,
   apply migrations in order, set the new `typeVersion`, mark the doc
   dirty.
2. On document load, if `doc.schemaVersion < latest`, apply doc-level
   migrations in order.
3. Save persists the migrated shape. The optimistic-lock counter
   (`SabFlowDoc.version`) bumps as usual.
4. Migrations are **pure functions** — no I/O — so they can run in the
   client-side CRDT runtime as well as in the API route.

### 4.4 Snapshot of saved docs

The existing `sabflow_versions` snapshot collection
([`src/lib/sabflow/db.ts:117`](../../src/lib/sabflow/db.ts)) is the safety
net: snapshots are written **post-migration** so we never persist a half-
migrated state. Snapshots older than the active schema are migrated
lazily on read.

---

## 5. Compatibility — can SabFlow import/export n8n `workflow.json` verbatim?

**Decision: bidirectional but lossy by design — round-trip MUST be lossless
for the supported subset, lossy-with-stub for the rest.**

What we keep verbatim:

- Triggers (5 mapped types, see §3.3) — round-trip lossless.
- 17 built-in node types already mapped in
  `interop/n8nImport.ts:66` ↔ `interop/n8nExport.ts:18`.
- `position`, `name`, `id`, `parameters`, `typeVersion` (once added),
  `disabled` (once added), `notes` (once added) — direct field copies.
- `connections` — translated to/from `edges[]` via the handle-string
  convention.
- `staticData` ↔ `variables` (already handled — `n8nExport.ts:161`).

What we cannot keep verbatim:

- SabFlow-native blocks (bubbles, inputs, choice, forge_*) export as
  `n8n-nodes-base.set` with a `_sabflowOriginalType` marker so re-import
  reconstructs the original block. Documented in
  [`interop/n8nExport.ts:6-11`](../../src/lib/sabflow/interop/n8nExport.ts).
- n8n nodes outside the explicit map import as `typebot_link` annotated
  with the original type, surfaced in the editor as "Unknown node — swap to
  a real block" (documented in
  [`interop/n8nImport.ts:14-19`](../../src/lib/sabflow/interop/n8nImport.ts)).
- `meta`, `pinData` (doc-level), `credentials` (centralised form) — not
  emitted today; gated on the field additions in §4.2.

Round-trip property test we will add in Phase 1 sub-task #10's bench harness:
**for every workflow that uses only the supported subset, `import(export(x)) ≡
x` after field-level normalisation**. Anything else is a SabFlow bug.

---

## 6. Decision summary

- **Mirror n8n shape** for the executable graph (`nodes` + `connections`)
  at the wire level (import/export) and at the internal IR
  ([`src/lib/sabflow/n8n/adapter.ts`](../../src/lib/sabflow/n8n/adapter.ts)).
- **Diverge** on the authoring shape: keep groups + edges + events
  separate from blocks. They are the typebot-style affordance SabFlow's
  chat-flow editor depends on, and they have no n8n analogue.
- **Add three small fields** to close the biggest deltas:
  `Block.typeVersion`, `Block.disabled`, `Block.notes` — and one
  doc-level field `SabFlowDoc.schemaVersion`. All additive and
  back-compat.
- **Add a migrators directory** at `src/lib/sabflow/migrations/` keyed by
  `(blockType, fromVersion → toVersion)` and `(docSchema fromVersion →
  toVersion)`. Pure functions, applied on load, before snapshot write.
- **Round-trip n8n workflow.json** stays lossy-by-design for SabFlow-only
  blocks (bubbles, inputs, choice, forge_*) and lossless for the 17
  mapped executor nodes + 5 trigger types.

## 7. Out of scope

- Implementation of the migrators directory — separate ADR / PR.
- Schema additions (`typeVersion`, `disabled`, `notes`, `schemaVersion`) —
  separate PR after this ADR lands.
- CRDT-update encoding of the schema — owned by sub-task #4 (bench
  harness) and sub-task #5 (CRDT lib pick).

## 8. References

- [`src/lib/sabflow/types.ts`](../../src/lib/sabflow/types.ts) — `SabFlowDoc`, `Block`, `Group`, `Edge`, `SabFlowEvent`.
- [`src/lib/sabflow/interop/n8nImport.ts`](../../src/lib/sabflow/interop/n8nImport.ts) — `N8nWorkflowJson` type + type map.
- [`src/lib/sabflow/interop/n8nExport.ts`](../../src/lib/sabflow/interop/n8nExport.ts) — reverse map + emitter.
- [`src/lib/sabflow/n8n/adapter.ts`](../../src/lib/sabflow/n8n/adapter.ts) — runtime IR adapter.
- [`src/lib/sabflow/db.ts`](../../src/lib/sabflow/db.ts) — persistence layer + `sabflow_versions` snapshots.
- [`PLAN-sabflow-crdt-collab.md`](../../PLAN-sabflow-crdt-collab.md) — Track A / Track B execution plan.
