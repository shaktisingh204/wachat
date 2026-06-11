# SabSheet v2 — Offline-first

The engine runs entirely client-side in WASM, so **almost everything works with no internet**. Only
the cloud round-trip is deferred, and a few server-only features are hidden until you reconnect.

## Works fully offline (no network at all)
Open a workbook, then lose connectivity — you keep:
- typing values + formulas, live recalculation (the whole IronCalc engine is local);
- formatting (bold/italic/underline, number formats), undo/redo;
- copy / cut / paste, the fill handle, sort, find & replace;
- selection, navigation, scrolling, multiple edits.

Every edit is applied to the local engine instantly **and** written to a durable on-device queue, so a
refresh or crash mid-offline does not lose work.

## Deferred until reconnect (queued, never lost)
- **Cloud save.** Each edit is queued in an IndexedDB **outbox** and synced to `/v1/sabsheet/ops` when
  the network returns. The status bar shows *Offline — saved on this device* → *Saving…* → *All changes
  saved*. The browser `online` event triggers an automatic flush, in order.

## Unavailable offline (need the server; degrade gracefully)
- **Export / import `.xlsx`** — the Download-xlsx button is hidden while offline.
- (Future) AI-in-cells, live data connections, and multi-user collaboration — all server-backed.

## How it works

`src/lib/sabsheet/offline/`
- **`outbox.ts`** — `OfflineOutbox`: storage-agnostic queue + local-snapshot cache. `record(commands,
  snapshot)` durably enqueues *before* any network attempt; `flush()` drains in order when online;
  network failure mid-drain keeps the rest queued; a server `rejected` (a real multi-writer conflict)
  surfaces a `conflict` state instead of silently dropping edits. `MemoryOutboxStore` backs the unit
  tests (**5 tests**).
- **`idb-store.ts`** — `IdbOutboxStore`: IndexedDB persistence (survives reloads/crashes), with an
  in-memory fallback when IndexedDB is unavailable (SSR / private mode).

`SheetCanvas`
- **Bootstrap**: online → authoritative server snapshot (and drain any queue from a prior offline
  session); offline or server-unreachable → the locally cached snapshot; brand-new → fresh + seed.
- **Edit path**: `applyLocal` always applies to the local engine and repaints, then hands the batch +
  fresh snapshot to the outbox. No `workbookId` (the `/v2` preview) ⇒ pure in-memory, no network.
- **Connectivity**: listens to `online`/`offline`; flushes on reconnect; re-bootstraps from the server
  on a genuine conflict.

`Workbench` shows an **Offline** chip and offline-aware save labels, and hides the xlsx export button
while offline.

## Conflict semantics (honest)
The common single-user / single-device offline→online flow is lossless. A *genuine* concurrent edit
from another device while you were offline is detected (the server rejects the stale `baseSeq`) and the
server wins — the workbook re-bootstraps from the authoritative snapshot. Field-level offline merge
(CRDT) is the job of Superpower A (collaboration), which the engine's built-in diff transport already
sets up; until then, conflict = server-authoritative re-sync.
