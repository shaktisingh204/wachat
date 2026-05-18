# ADR — SabFlow Execution Playback: Trace Shape

**Status:** Accepted
**Date:** 2026-05-19
**Owner:** Phase C.9
**Phase branch:** `phase/c-9-execution-traces`

---

## 1. Problem

SabFlow's in-process `execution/traceBus.ts` pub/sub (C.9.1) is ephemeral: it
only survives the lifetime of the Node process that ran the execution. The SSE
stream endpoint (`/api/sabflow/executions/[id]/stream`) consumes it live, but
once the process exits — or the browser tab was closed before the run completed
— the trace data is gone.

Faithful playback requires answering:

- **What ran?** — which node, in what order, over which data items.
- **How long did it take?** — wall-clock timestamps and per-node duration.
- **What went in / out?** — representative samples of the actual payloads for
  debugging, not just the node names.
- **Did it succeed?** — structured error envelope when a node faulted.
- **What phase was captured?** — start / end boundary so the UI can reconstruct
  the timeline without gaps.

A trace event must capture all of the above in a compact, serialisable form that
survives process death, supports random-access replay, and does not duplicate
large binary payloads into the trace store.

---

## 2. Schema Decision — TraceEvent Shape

### 2.1 Canonical fields

Each persisted event has the following shape (TypeScript notation; all fields
that are not `?`-marked are required):

```typescript
interface TraceEvent {
  /** Free-string discriminator. Canonical set:
   *   node_start | node_end | inline_payload | payload_offloaded | error | end */
  kind: string;

  /** Execution this event belongs to (ObjectId as hex string). */
  executionId: string;

  /** Node (block) within the flow that fired this event. */
  nodeId: string;

  /** Row index within the upstream / output item array.
   *  Absent on lifecycle events that are not item-scoped (node_start, end). */
  itemIndex?: number;

  /** 'in' = input payload, 'out' = output payload.
   *  Absent on non-payload events. */
  phase: 'start' | 'end' | 'error' | 'payload';

  /** Server-wall-clock timestamp when the event was recorded. */
  ts: Date;

  /** Duration in milliseconds from the corresponding node_start event.
   *  Present on node_end and error events. */
  durationMs?: number;

  /** Up-to-512-byte serialised representation of the input item. */
  inputSample?: string;

  /** Up-to-512-byte serialised representation of the output item. */
  outputSample?: string;

  /** Structured error when kind === 'error' or when node_end carries a fault. */
  error?: {
    message: string;
    code?: string;
    /** Stack limited to first 512 chars in production. */
    stack?: string;
  };

  /** --- Payload-offload fields (inherited from C.9.2 TraceEvent) --- */

  /** Byte size of the payload this event references. */
  sizeBytes?: number;

  /** True = payload captured inline (inputSample / outputSample holds it).
   *  False = too large; see sabFileId. */
  inline?: boolean;

  /** SabFiles ID when the payload was off-loaded (never a raw URL — see
   *  SabFiles policy in CLAUDE.md). */
  sabFileId?: string;
}
```

### 2.2 Relationship to the in-process `traceBus.ts` union

`traceBus.ts` (C.9.1) exposes a narrower two-variant union:

```
| { kind: 'step'; executionId; step: ExecutionStep; index }
| { kind: 'end';  executionId; status; error? }
```

The persisted `TraceEvent` is a strict superset: the persistence layer
(C.9.2 `executionTraces.ts`) projects the engine's `ExecutionStep` + `index`
onto the richer shape above. The engine does not import the persistence type;
the writer (`appendTraceEvent`) is responsible for the projection. This keeps a
hard build-time decoupling between the in-memory bus and the Mongo persistence
module.

---

## 3. Storage Decision

### 3.1 Collection

Collection: **`sabflow_execution_traces`**

One document per execution (`executionId` is a unique index). Events are
appended to the `events[]` array via `$push`. This keeps the "fetch full trace
for replay" path to a single `findOne` and avoids per-event document overhead.

Document shape (abbreviated):

```typescript
interface ExecutionTraceDoc {
  _id:         ObjectId;
  executionId: ObjectId;   // unique
  workspaceId: ObjectId;   // tenant fence on every read path
  events:      TraceEvent[];
  pinned:      boolean;
  expiresAt:   Date | null; // null when pinned (TTL skips null per Mongo semantics)
  createdAt:   Date;
  updatedAt:   Date;
}
```

### 3.2 Indexes

| Name | Keys | Purpose |
|---|---|---|
| `executionId_1_unique` | `{ executionId: 1 }` (unique) | Primary lookup; guarantees concurrent `appendTraceEvent` upserts land on the same row. |
| `workspaceId_1_pinned_1_expiresAt_1` | `{ workspaceId, pinned, expiresAt }` | Workspace-scoped scans by pin state and retention window; used by admin tooling and the "expiring soon" UI affordance. |
| `expiresAt_1_ttl` | `{ expiresAt: 1 }`, `expireAfterSeconds: 0` | TTL eviction at the absolute timestamp stored in `expiresAt`; rows with `expiresAt: null` are skipped by the TTL monitor. |

### 3.3 TTL — default 30 days

Non-pinned trace docs carry `expiresAt = createdAt + 30 days`. The TTL monitor
evicts them at that absolute timestamp. Pinned docs have `expiresAt: null` and
are invisible to the TTL monitor until a user unpins them, at which point
`expiresAt` is re-anchored to `now + 30 days`.

The 30-day default is exposed as the exported constant
`TRACE_DEFAULT_RETENTION_DAYS` and overridable per-call via
`appendTraceEvent(..., { retentionDays })`.

---

## 4. Sampling Decision

### 4.1 Size cap — 512 bytes per sample

`inputSample` and `outputSample` are capped at **512 bytes** after serialisation
(`JSON.stringify` + UTF-8 truncation). The writer truncates before storing; the
cap is not enforced by a schema validator after the fact.

Rationale: 512 bytes is enough to show the shape and first few fields of a
typical workflow item (a JSON object with string/number scalar values) in the
timeline UI without ballooning the `events[]` array. Executions with wide items
(e.g. full HTML bodies, large JSON arrays) need the off-load path (§4.2).

### 4.2 Binary and large payloads — BinaryDataRef only

When `sizeBytes > 512` or when the payload is binary (Buffer, Blob, image), the
trace event stores:

- `inline: false`
- `sabFileId: <SabFiles file id>`

and **never** inlines a base64 string. This is consistent with the project-wide
SabFiles policy: file content is referenced by SabFiles ID, not by a raw URL or
a base64 blob.

The `inline: true` + `inputSample` / `outputSample` path is reserved for
payloads that are already below 512 bytes after serialisation.

### 4.3 Payload projection on read

`getTrace` supports a `limitEvents` + `slice` option that uses MongoDB's
`$slice` projection, so the timeline UI fetches only the most recent N events on
initial load, avoiding transferring the full `events[]` array for long runs.

---

## 5. Replay Fidelity Contract

Replay of a SabFlow execution from its trace is **best-effort**:

- **Gaps are expected.** If a trace doc was evicted before the replay request
  arrives, or if the engine crashed before the `end` event was written, the
  replay will be partial. Partial replays do not constitute data loss — the
  authoritative execution result is stored in the execution record
  (`sabflow_executions`), not in the trace.
- **Samples are summaries.** `inputSample` / `outputSample` are truncated
  representations; they cannot be used to reconstruct full item payloads for
  re-execution. Use the off-loaded SabFiles reference for that.
- **Clock drift.** `ts` fields reflect the server wall clock at the moment the
  event was appended to Mongo, which may differ slightly from the wall clock at
  the moment the engine emitted the event to `traceBus.ts`. `durationMs` is
  computed inside the engine and is therefore accurate relative to the node's
  own clock.
- **Missing item indexes.** Lifecycle events (`node_start`, `end`) do not carry
  `itemIndex`; the replay UI should treat their absence as "applies to the whole
  node" rather than as a data error.

Consumers of the trace must tolerate any combination of missing optional fields
without crashing.

---

## 6. Retention Policy

| Scenario | Behaviour |
|---|---|
| Default (non-pinned) | `expiresAt = createdAt + 30d`; TTL monitor evicts the doc automatically. |
| Pinned | `pinned: true`, `expiresAt: null`; TTL monitor skips the row indefinitely. |
| Unpin | Re-anchors `expiresAt = now + 30d`; TTL resumes. |
| Export | A ZIP export packages the full `events[]` array as newline-delimited JSON + any off-loaded SabFiles payloads. Exported ZIPs are the only mechanism for permanent archival — the Mongo collection is not a long-term store. |

The pin API is exposed as `pinTrace` / `unpinTrace` in
`src/lib/sabflow/persistence/executionTraces.ts`. The export ZIP feature is
out of scope for C.9 and will be addressed in a dedicated sub-task.

---

## 7. Security

### 7.1 Encryption at rest

Trace documents follow the same AES-256-GCM envelope used for execution outputs
throughout SabFlow:

- Each trace document (or each `TraceEvent` in the `events[]` array for
  field-level encryption) is encrypted before being written to Mongo.
- The encryption key is a data-encryption key (DEK) wrapped by a key-encryption
  key (KEK) sourced from the environment variable `SABFLOW_KEK_<id>`, where
  `<id>` is the KEK version identifier stored alongside the ciphertext.
- KEK rotation: introducing a new `SABFLOW_KEK_<id>` env var re-wraps new DEKs;
  existing trace docs continue to decrypt with the old KEK until they expire or
  are explicitly re-wrapped.

This is consistent with `docs/adr/sabflow-credentials-crypto.md` and
`docs/adr/sabflow-credentials-kms.md`.

### 7.2 Tenant isolation

Every read path in `getTrace` accepts an optional `workspaceId` fence:

```typescript
getTrace(executionId, { workspaceId })
```

A mismatch returns `null` without leaking whether the doc exists. All HTTP
endpoints that expose trace data **must** pass the authenticated workspace's ID
as the fence. Omitting the fence is permitted only for internal admin tooling
that has already validated RBAC access out-of-band.

### 7.3 Off-loaded payload access

`sabFileId` values stored on trace events reference SabFiles entries that are
themselves access-controlled by workspace. A client that obtains a `sabFileId`
from a trace event must still pass a valid SabFiles read check to fetch the
payload — the reference alone does not grant access.

---

## 8. Alternatives Considered

### 8.1 One document per event

Rejected. Replay requires fetching the full event sequence for an execution.
One-doc-per-event adds a collection scan or an `executionId` index scan followed
by N document fetches. The single-doc-with-array pattern (§3.1) reduces this to
one `findOne`.

### 8.2 Inline base64 for binary payloads

Rejected. Base64 bloats binary payloads by ~33% and would push many trace docs
past the 16 MB BSON document limit for image-heavy flows. The SabFiles off-load
path (§4.2) is the correct mechanism.

### 8.3 Separate `events` sub-collection

Considered for very long runs (>10 000 events). Deferred: the 512-byte sample
cap and the SSE stream's real-time consumption mean that persisted `events[]`
arrays will rarely exceed a few hundred entries in practice. If a flow produces
extremely wide `events[]` arrays, the `limitEvents` projection in `getTrace`
keeps the read path manageable without a schema migration.

### 8.4 Redis-only trace store

Rejected. Redis is volatile and does not support the retention / pin / export
model required for audit and replay. Redis pub/sub remains the cross-instance
fan-out layer for the live SSE stream (§2.1 of `traceBus.ts`) but is not the
system of record.

---

## 9. Open Questions

- **Export ZIP format:** The exact ZIP layout (file naming, manifest schema) is
  deferred to the export sub-task.
- **Field-level vs document-level encryption:** The current implementation
  encrypts at the application layer before writing to Mongo. Whether to use
  MongoDB's native CSFLE for field-level encryption instead is deferred to the
  credentials-kms ADR follow-up.
- **Event schema versioning:** `TraceEvent.kind` is a free string today. A
  formal version field (e.g. `schemaVersion: 1`) should be introduced before
  a breaking schema change to allow the replay UI to detect and handle old
  event shapes.
