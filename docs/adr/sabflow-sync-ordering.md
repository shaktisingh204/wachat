# ADR: SabFlow Sync Protocol — Ordering & Causal-Consistency Guarantees

Status: Accepted
Track: A / Phase 4 (#9 of 10)
Sibling: `#10` — fuzz tests for the guarantees described here.

## Summary

SabFlow's collaborative flow editor uses a Yjs-backed sync protocol over WebSocket.
Each connection carries two logical channels — **sync** (CRDT updates) and **awareness**
(presence, cursors) — multiplexed via single-byte frame tags. The sync channel runs
the standard Yjs 3-step handshake (`SyncStep1` → `SyncStep2` → `Update`) and then
streams incremental `Update` frames in both directions. Every client-originated
update carries a stable `updateId` so the server can ack/nack idempotently. The
protocol guarantees **per-client causal order** and **CRDT-level eventual
convergence across clients**, but does **not** guarantee total order, bounded
latency, or cross-channel ordering. Multi-instance fan-out (Phase 7 #9) uses Redis
pub/sub, which preserves convergence but not frame-level order. Duplicates from
retries or instance fan-out are absorbed either by the server-side idempotency
cache (warm path) or by Yjs's structural update hash on the client (cold path).
This ADR exists so reviewers, fuzz tests, and on-call engineers share one mental
model of what the wire actually promises. (≤200 words.)

---

## 1. Wire protocol

### 1.1 Frame tags

Every frame is a length-prefixed binary message whose first byte selects a
sub-protocol:

| Tag  | Channel    | Meaning                                              |
|------|------------|------------------------------------------------------|
| `0x00` | sync       | `SyncStep1` — client → server state vector            |
| `0x01` | sync       | `SyncStep2` — server → client missing updates         |
| `0x02` | sync       | `Update` — incremental Yjs update (either direction)  |
| `0x03` | sync-ack   | `Ack { updateId }` — server → client                  |
| `0x04` | sync-nack  | `Nack { updateId, reason }` — server → client         |
| `0x05` | awareness  | Awareness state delta (presence, cursor, selection)   |
| `0x06` | control    | Heartbeat / ping                                     |

Frames with unknown tags MUST be ignored (forward compatibility).

### 1.2 3-step sync handshake

1. On connect, the client sends `SyncStep1` carrying its current state vector.
2. The server replies with `SyncStep2` containing every update the client is
   missing, then immediately sends its own `SyncStep1`.
3. The client replies with `SyncStep2` covering what the server lacks. From this
   point, both sides stream `Update` frames as edits occur.

After step 3, the document is considered **synced**; the client UI exits the
"loading" state. Updates received before sync completes are buffered and applied
in arrival order — Yjs's CRDT semantics make this safe.

### 1.3 Awareness channel

Awareness frames (`0x05`) are *separate* from sync. They carry ephemeral state
(presence, cursor position, selection range) keyed by `clientId`. Awareness is
**not persisted** and is **not ordered with respect to sync frames**. A client
may observe a remote cursor move before the update that created the node the
cursor points at — UIs MUST tolerate this.

---

## 2. Guarantees

### 2.1 Per-client: causal order preserved

For a single client `C`:

- Updates `C` submits are sent over a single WebSocket in submission order.
- The server applies and broadcasts them in receive order (which equals submission
  order modulo network).
- When the server replays history (e.g. another client's `SyncStep2`), updates
  authored by `C` appear in the same order `C` submitted them.

Concretely: if `C` types `"a"` then `"b"`, every other client and every replay
will see `"a"` strictly before `"b"`. This is what "causal order" means here —
**a client's own causal chain is preserved**.

### 2.2 Across clients: NOT a total order

There is **no** global total order of edits. Two clients editing concurrently
will see each other's updates interleaved differently depending on network
timing. This is **fine**: Yjs is a CRDT, so any interleaving produces the same
final document state. Convergence is the contract, not serialization.

Consequence: do not write application logic that depends on "which client edited
first" across clients. Use Yjs awareness or an explicit server-stamped event log
for that.

### 2.3 At-least-once delivery

Every client `Update` frame includes a client-generated `updateId`
(`${clientId}:${monotonicCounter}`). The server:

1. Looks up `updateId` in an in-memory idempotency cache (TTL ~60s).
2. If present, replies with the cached `Ack` and drops the frame.
3. If absent, applies the update, persists it, caches the ack, and broadcasts.

The client retries un-acked updates on reconnect. This yields **at-least-once**
delivery. Duplicates that slip past the idempotency cache (cache miss after
crash, cross-instance fan-out, etc.) are absorbed on the client by Yjs: each
update has a structural hash, and applying the same update twice is a no-op at
the CRDT layer.

---

## 3. Edge cases

### 3.1 Reconnect mid-update

Sequence:

1. Client sends `Update { updateId: U }`.
2. Server receives, applies, caches ack — but the socket dies before the ack is
   flushed.
3. Client reconnects, retries `Update { updateId: U }`.
4. Server hits the idempotency cache and returns the cached `Ack`. No double-apply.

### 3.2 Server crash mid-persist

Sequence:

1. Client sends `Update { updateId: U }`.
2. Server crashes. The update may or may not have landed in durable storage.
3. Client reconnects (possibly to a different instance). Its `SyncStep1` reveals
   whether `U`'s state vector entry is on the server.
4. If the server lost `U`, the client's retry lands it again. Idempotency cache
   is gone, so the update *is re-applied* — but Yjs detects the structural hash
   and converges. No corruption, no duplication at the document level.
5. If the server has `U`, the retry is still safe (idempotency cache misses, but
   Yjs again no-ops the duplicate).

### 3.3 Multi-instance fan-out (Phase 7 #9)

When SabFlow runs behind >1 WebSocket instance, cross-instance broadcast goes
over Redis pub/sub:

- An instance that accepts an update publishes it on a per-document channel.
- Peers subscribe and rebroadcast to their local clients.
- Redis pub/sub provides **no ordering guarantee across publishers**. Two updates
  authored on different instances may be observed by a third instance in either
  order.
- This is acceptable because the CRDT layer handles arbitrary interleaving.
  Frame-level ordering across instances is **not** guaranteed; **CRDT
  convergence** is.

A subtle consequence: a client's "own update echo" may arrive via Redis before
its server ack. Clients MUST treat ack and echo as independent signals.

---

## 4. What we explicitly do NOT guarantee

- **No total order across clients.** Two clients' edits interleave however the
  network and Redis decide. Convergence — not serialization — is the contract.
- **No bounded latency.** The protocol is best-effort. A slow client may lag
  arbitrarily; reconnect-and-resync is always the recovery path.
- **No ordering between sync and awareness channels.** Awareness frames may
  arrive before, after, or interleaved with the sync frames that justify them.
  UIs MUST be defensive (e.g. ignore cursors pointing at missing nodes).
- **No exactly-once delivery.** The contract is at-least-once with CRDT-level
  absorption.
- **No durability promise pre-ack.** An unacked update is not persisted; clients
  must retain it for retry on reconnect.

---

## 5. Test plan

Verification of the guarantees in §2 and §3 lives in sibling sub-task **#10**:
a fuzz/property-test suite that simulates concurrent clients, dropped frames,
mid-update reconnects, server crashes, and multi-instance fan-out, then asserts:

- All clients converge to the same Yjs document state.
- Each client's own update sequence appears in submission order in every replay.
- Duplicates injected via the idempotency-cache-miss path do not perturb the
  final document.
- Awareness reordering does not violate any sync invariant.

See `#10` for the fuzz harness, seed corpus, and CI integration.

---

## References

- Yjs sync protocol: https://github.com/yjs/y-protocols
- SabFlow presence store: commit `7178c9f80` (in-memory presence for flow editor)
- Multi-instance fan-out: Track A Phase 7 #9 (Redis pub/sub broadcast)
- Sibling: Track A Phase 4 #10 (fuzz tests for this ADR)
