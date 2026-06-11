# SabSheet v2 — Collaboration (Superpower A, MVP)

Status: **multi-user sync foundation landed** (eventually-consistent, server-authoritative). Instant
push (SSE/WebSocket) and presence cursors are the next refinements; the data path is in place.

## Why no CRDT merge is needed

The IronCalc engine produces deterministic, replayable diffs and the server assigns every applied
batch a total-order `seq` (the `sabsheet_ops` log). So every client converges by simply replaying the
op log past the seq it has already applied — no operational-transform or CRDT merge layer. This is the
same property the offline outbox relies on; collaboration is its mirror image.

## The two halves

- **Outgoing** — `OfflineOutbox` (`offline/outbox.ts`): local edits → durable queue → `applyOps`
  (server assigns the next seq, persists, returns it). Already shipped.
- **Incoming** — `RealtimeSync` (`collab/sync.ts`): polls `opsSince(currentSeq)`, applies each remote
  diff via the engine's `applyRemoteDiffs`, advances the shared seq. **6 unit tests.**

Both share one seq line per client (via the outbox store), so they coordinate:

```
client A edits ──outbox──▶ applyOps ──▶ seq N in sabsheet_ops
                                              │
client B  RealtimeSync.poll() ─opsSince(N-1)─▶ diffs ──applyRemoteDiffs──▶ B converges to seq N
```

## Correctness guards (why it doesn't double-apply or diverge)

- `RealtimeSync.poll()` **defers while the outbox has pending edits** (`hasPending`). This closes the
  window where a client could re-fetch and re-apply *its own* just-sent op before its seq advanced.
- Only ops with `seq > currentSeq` are applied, in ascending order; the seq advances atomically after.
- A genuine conflict (a client's `applyOps` rejected because another client advanced the workbook) is
  handled by the outbox's existing re-bootstrap from the authoritative snapshot.
- Polling is reentrancy-guarded and skips while offline.

## Wiring (`SheetCanvas`)
On bootstrap (with a `workbookId`), a `RealtimeSync` is created alongside the outbox and `start()`ed
(3s poll). `fetchSince` = `opsSinceAction` (decoding base64 diffs); `applyRemote` =
`engine.applyRemoteDiffs` + repaint; `getSeq/setSeq` = the outbox's shared seq; reconnect triggers an
immediate poll. Stopped on unmount.

## Next (to reach Google-Sheets-grade multiplayer)
- **Instant push**: replace the 3s poll with an SSE stream (`GET /v1/sabsheet/ops/stream`) or the
  `services/sabsheet-collab` WebSocket gateway (clone of `services/sabflow-ws`) — the client side does
  not change, it just calls `poll()` on a push instead of a timer.
- **Presence**: live cursors / selections / who's-viewing avatars (awareness channel).
- **Permissions**: `members[]` roles + share links + `assertSabsheetAccess` (server already scopes to
  owner; extend to shared members).
- **Comments** with @mentions (extend the existing `sabsheet-comments` crate).
