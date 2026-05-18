# ADR — SabFlow CRDT library choice (Yjs vs yrs)

- **Status:** Accepted (initial)
- **Date:** 2026-05-18
- **Track / Phase:** Track A — Phase 1 — sub-task #5
- **Related plan:** `PLAN-sabflow-crdt-collab.md`
- **Related ADRs:** `docs/adr/sabflow-foundation.md` (parent), bench harness from sub-task #4
- **Hard rule:** per the plan, Rust replaces Node/JS in a hot path **only** when a phase-local bench shows a sustained **>=30%** win on the relevant metrics. The same rule applies here for `yrs`.

---

## 1. Context

SabFlow needs a CRDT runtime to back the new real-time editor: nodes, edges, position drag, group/lock ops, presence, undo/redo, offline replay, snapshot/oplog persistence (see Phase 2/4/5/6/7). The candidates are:

- **Yjs** — the reference Conflict-free Replicated Data Types implementation in TypeScript, by Kevin Jahns. The plan calls it out as the default (Track A Phase 1, sub-task #5).
- **yrs** (a.k.a. `y-crdt` / `yrs`) — a Rust port of Yjs maintained as a community/Y-CRDT effort, with bindings for several languages.

Both wire-compatible with the same update format, in principle. The question is which one SabFlow's client + WS gateway + persistence layer should standardize on **now**, and under what conditions we'd revisit.

---

## 2. Yjs overview

### 2.1 Data types

Yjs ships a small set of shared CRDT types, all composable inside a root `Y.Doc`:

- **`Y.Map`** — keyed map, last-writer-wins per key with vector-clock causality. Good fit for node parameter objects, workflow `settings`, and per-node metadata (mirrors n8n's `parameters` blob).
- **`Y.Array`** — ordered list, position-stable under concurrent insert/delete. Fits the SabFlow nodes/edges arrays once we replace local React state (Phase 6, sub-task #1–#2).
- **`Y.Text`** — rich-text rope with attribute spans. Useful for comment threads, in-canvas text nodes, and Code/Function node bodies.
- **`Y.XmlFragment` / `Y.XmlElement` / `Y.XmlText`** — hierarchical XML-shaped CRDT, the backbone of Prosemirror/Tiptap bindings. Likely overkill for the workflow canvas itself, but useful if we later add rich-text comments.
- **Sub-documents** — `Y.Doc` can embed other docs, useful for sub-workflows (Track B Phase 9, sub-task #5).

### 2.2 Update encoding

Yjs serializes updates and state vectors with a compact variable-length binary format (`lib0` encoder). Two main shapes:

- **Update message** (`Y.encodeStateAsUpdate` / `Y.encodeStateAsUpdateV2`) — full state or diff against a remote state-vector, used for both initial sync and ongoing broadcast. Maps directly onto Phase 4 sub-tasks #1, #2, #6.
- **State vector** (`Y.encodeStateVector`) — compact summary of "what I have", used for the two-step sync handshake (Phase 4, sub-task #4).

V2 encoding (the default in modern Yjs) gives smaller updates and faster decode for typical workloads. Updates are commutative + idempotent, which makes the ack/nack + idempotency design in Phase 4 sub-task #5 nearly free.

### 2.3 Awareness protocol

Awareness (presence) is a **separate** lightweight protocol bundled with Yjs via `y-protocols/awareness`. It is an ephemeral keyed map (per-client) carrying cursor position, selection, user color, etc., with TTL-based eviction on disconnect. This is exactly what SabFlow needs for Phase 7 sub-tasks #1–#5 (cursors, selections, typing indicators, follow-mode) and integrates with the in-memory presence store added in commit `7178c9f80`.

Awareness updates are independent of the document CRDT update stream — they fan out on a parallel channel with their own diff encoding, which lets the gateway throttle/batch them separately (Phase 4 sub-task #8).

### 2.4 Ecosystem

The Yjs ecosystem is the deciding factor. Available off-the-shelf:

- **`y-websocket`** — reference WS provider, client + server. Matches the Phase 3 gateway design as a Node baseline (Phase 1 sub-task #3) and gives us a reference implementation to bench against in sub-task #4.
- **`y-protocols`** — wire protocols for sync, awareness, auth challenges. Standardized framing we can re-use rather than invent.
- **`y-indexeddb`** — browser-side persistence provider. Critical for the offline queue + replay story in Phase 5 sub-task #5, and gives us "open the doc instantly while the WS handshake runs" out of the box.
- **`y-redis`** — multi-instance pub/sub fan-out, directly applicable to Phase 7 sub-task #9.
- **Editor bindings** — Prosemirror, Tiptap, CodeMirror, Monaco, Slate, Quill. Not load-bearing for the canvas itself but unblocks future rich-text features.
- **Undo manager** — `Y.UndoManager`, a CRDT-aware undo/redo stack scoped to an origin tag. Direct match for Phase 5 sub-task #6.

### 2.5 Maturity and license

- **Maturity** — Yjs has shipped in production at Notion-tier scale (Linear, JupyterLab Real-Time Collab, Evernote, Room.sh, …) for years. Wire format is stable; v2 encoding is the current default but v1 is still understood.
- **License** — MIT. Compatible with SabNode's commercial use, no copyleft concerns.
- **Maintenance** — single primary maintainer (Kevin Jahns) is a real risk worth naming, but the protocol is well-documented and multiple independent reimplementations exist (yrs being the most prominent), which de-risks lock-in.

---

## 3. yrs overview

`yrs` is the Rust port of Yjs, part of the Y-CRDT umbrella.

### 3.1 Parity status with Yjs

As of writing, yrs covers the core types and update protocol:

- **`Map`, `Array`, `Text`, `XmlFragment` / `XmlElement` / `XmlText`** — implemented; wire-compatible with Yjs updates (v1; v2 is more recent and has had encoder gaps historically — verify in the bench).
- **State vector + update encode/decode** — yes; this is the part that benchmarks well.
- **Awareness protocol** — implemented as a sibling crate (`y-sync` / `yrs-warp` style), not always in lockstep with `y-protocols` JS releases.
- **Sub-documents** — supported but has historically lagged Yjs feature additions.
- **`UndoManager`** — present but with caveats around origin tracking parity.

In short: the **document CRDT** half of yrs is solid and wire-compatible; the **ecosystem half** (awareness, persistence providers, editor bindings) is thinner and version-skewed relative to Yjs.

### 3.2 Language bindings

yrs exposes bindings to other runtimes via:

- **Rust** native crate.
- **C FFI** (`yffi`).
- **WebAssembly** (`y-wasm` / `ywasm`) for the browser — usable as a drop-in core under a JS-facing wrapper, but loses the JIT-friendliness of native Yjs for typical small-update workloads.
- **Python**, **Ruby**, **Swift**, **Kotlin** — community-maintained, varying levels of upkeep.

For SabFlow specifically the relevant bindings are: native Rust (for a hypothetical Rust WS gateway, Phase 3 sub-task #1) and ywasm (for the browser client). Note that picking yrs on the server while keeping Yjs in the browser is allowed because both speak the same wire format — but it doubles the maintenance surface.

### 3.3 License

yrs is **MIT** (same as Yjs). No license blockers.

### 3.4 Ecosystem gaps

Worth naming explicitly before any switch:

- **No first-party `y-indexeddb` analog** — browser persistence on yrs/ywasm is still best handled by the Yjs JS providers, which means even on a yrs server we'd still ship Yjs (or a wrapper) to the browser.
- **Awareness implementations diverge** — different Rust WS servers (`yrs-warp`, `y-sync`) have slightly different awareness semantics. Picking one is itself a sub-decision.
- **Editor bindings** — Prosemirror / Tiptap / CodeMirror bindings target Yjs APIs, not yrs APIs.
- **Smaller community + slower release cadence** than Yjs.
- **No `y-redis` analog of equivalent maturity** — fan-out for Phase 7 sub-task #9 would need a hand-roll.

---

## 4. Why Yjs wins by default

Even ignoring raw performance:

1. **Ecosystem completeness** — `y-websocket`, `y-protocols`, `y-indexeddb`, `y-redis`, `Y.UndoManager`, editor bindings. Every one of these maps to a Phase 2–7 sub-task. yrs has analogs for some, gaps in others.
2. **Awareness protocol is first-class** — `y-protocols/awareness` is the canonical implementation; Rust servers re-implement it with subtle drift.
3. **Browser IndexedDB persistence** — `y-indexeddb` gives us the offline/replay story (Phase 5 sub-task #5) for free; yrs has no production-grade equivalent in the browser.
4. **Editor / future rich-text bindings** — every Prosemirror/Tiptap/CodeMirror binding speaks Yjs, not yrs.
5. **n8n-mirroring baseline** — Phase 1's stated baseline is the Node/TypeScript stack. Yjs slots in without introducing a Rust dependency before a bench has justified it. This satisfies the hard rule in the plan (Open Q #4).
6. **Single source of truth on client + server** — using Yjs on both sides avoids a wasm-on-client / native-rust-on-server split that doubles maintenance.
7. **Lower coordination cost across the 20 phases** — every sibling sub-task in Phases 2/4/5/7 assumes JS APIs (`Y.Doc`, `Y.encodeStateAsUpdate`, `Awareness`). Picking yrs now forces a wrapper layer before any of those can land.

---

## 5. Bench plan for the Rust path

We only switch to yrs if a bench beats Yjs by **>=30% sustained** on the metrics below. This bench is **deferred** — it runs once sub-task #4's harness (Node vs Rust WS gateway) lands or as a dedicated CRDT-only micro-bench, whichever is sooner.

### 5.1 Workload

Three workloads, each run on identical seed docs (1 small ~50-node, 1 medium ~500-node, 1 large ~5,000-node SabFlow workflow document):

1. **Apply 10,000 ops** — mixed insert / delete / update across `Y.Map` (node parameters), `Y.Array` (nodes + edges), `Y.Text` (function-node body). Measures hot-path CRDT mutation cost.
2. **Snapshot encode + decode** — full `encodeStateAsUpdate` then `applyUpdate` into a fresh doc. Measures the cold-start / persistence path (Phase 2 sub-tasks #1, #5, #7).
3. **Awareness diff** — 50 simulated clients emitting cursor + selection updates at 30 Hz for 60 seconds; measure server-side diff + broadcast cost.

### 5.2 Metrics

For each workload:

- **μs/op** — wall-clock per operation (apply, encode, decode, awareness diff), median + p99.
- **Allocated bytes** — peak + total allocations during the run (Node: `process.memoryUsage().heapUsed` + `--inspect` allocation profile; Rust: `dhat` or `jemalloc` stats).
- **RSS** — resident set size at steady state (after 30s warmup).
- **Snapshot size** — bytes on the wire for `encodeStateAsUpdate`, to confirm yrs/Yjs produce byte-equivalent output (sanity check on wire-compat).

### 5.3 Threshold gate

yrs is adopted on the SabFlow server **only if** it beats Yjs by **>=30%** on **at least two of**: μs/op (apply), μs/op (encode+decode), allocated bytes — **and** does not regress RSS or awareness throughput by more than 10%.

Browser client stays on Yjs regardless until ywasm matches `y-indexeddb` + editor-binding parity, which is a separate ADR.

### 5.4 Where the bench lives

Same harness directory as sub-task #4's WS bench (`bench/sabflow-foundation/` or wherever sub-task #4 lands it). The CRDT micro-bench is a sibling target so it can run independently of the WS layer.

---

## 6. Recommendation

**Adopt Yjs now**, on both client and server, for all of SabFlow's Phase 1–10 sub-tasks. Standardize on:

- `Y.Doc` as the document root
- `Y.Array` for nodes + edges
- `Y.Map` for per-node parameters and workflow settings
- `Y.Text` for code / function bodies and comment threads
- `y-protocols/awareness` for presence
- `y-websocket` (or a SabFlow-flavored equivalent built on `y-protocols`) for the gateway baseline in sub-task #4
- `y-indexeddb` for browser persistence
- `Y.UndoManager` for Phase 5 undo/redo

**Revisit yrs** only after sub-task #4's harness (or a dedicated CRDT bench using the same harness) produces numbers, AND those numbers clear the >=30% threshold defined in §5.3, AND the ywasm-vs-Yjs browser story can be reconciled without losing `y-indexeddb` and editor bindings. Failing any of those, stay on Yjs.

---

## 7. Consequences

- Phase 2 persistence (snapshot + oplog) encodes/decodes via Yjs APIs. Mongo `sabflow_oplog` stores Yjs binary updates as `BinData`.
- Phase 3 WS gateway implements the `y-protocols` sync + awareness framing.
- Phase 4 sync protocol piggybacks on Yjs update + state-vector encoding rather than inventing one.
- Phase 5 client SDK exposes `Y.Doc`-backed hooks (`useSabFlowDoc`, `usePresence`) — the public surface is SabFlow's, the implementation is Yjs.
- Phase 7 awareness extends the in-memory presence store (commit `7178c9f80`) into the Yjs `Awareness` protocol — no new wire format.
- Any future migration to yrs is wire-compatible, so we can swap the server later without a doc rewrite.
- We accept a single-maintainer risk on Yjs; mitigated by yrs being a viable port-target if Yjs ever stalls.

---

## 8. Summary (<=200 words)

**Pick: Yjs.** It is the plan's stated default, MIT-licensed, production-proven, and its ecosystem — `y-websocket`, `y-protocols/awareness`, `y-indexeddb`, `y-redis`, `Y.UndoManager`, and editor bindings — maps one-to-one onto SabFlow's Phase 2–7 sub-tasks. yrs is wire-compatible and credible as a Rust core, but its ecosystem (browser persistence, awareness servers, editor bindings) is thinner and version-skewed, and adopting it now would force a wrapper layer before sibling sub-tasks could even begin. Picking Yjs also satisfies the plan's hard rule (Open Q #4): no Rust adoption without a benchmark that beats Node by >=30%.

**Switch conditions.** Replace Yjs on the server with yrs only when **all** of the following hold: (1) sub-task #4's harness or a dedicated CRDT micro-bench shows yrs beating Yjs by >=30% sustained on apply μs/op, encode+decode μs/op, or allocated bytes (at least two of three); (2) RSS and awareness throughput do not regress by more than 10%; (3) the browser side keeps `y-indexeddb` and editor bindings — i.e. either via wire-compatible Yjs client or ywasm parity. Until then: Yjs everywhere.
