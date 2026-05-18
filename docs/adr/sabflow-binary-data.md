# ADR — SabFlow binary data references

> Status: Accepted · Phase C.2 sub-task #7 · 2026-05-18

## 1. Decision

SabFlow nodes exchange binary payloads as **lightweight references**, not
inline bytes. The Rust type is `BinaryDataRef`
(`rust/crates/sabflow-nodes/src/binary.rs`) and its on-the-wire shape mirrors
n8n's *filesystem-mode* `IBinaryData`:

```json
{ "id": "sf_…", "mimeType": "image/png", "fileName": "logo.png",
  "fileExtension": "png", "fileSize": 9001 }
```

**Why not inline base64 (`data: "AAAA…"`):**

- *Memory*: every queue message, audit row, and persisted execution state
  would balloon with the full payload. A 10 MB upload becomes ~13 MB after
  base64 plus a copy per hop — death by a thousand multiplications.
- *Bundle/log size*: serialised executions are surfaced to the UI and
  written to MongoDB. Inline bytes would make both unusable for any
  non-trivial file.
- *Audit/redaction*: secret-scanning, GDPR deletion, and right-to-be-forgotten
  flows can't reason about opaque base64 blobs scattered across our data.

**Why SabFiles is the backing store:** `CLAUDE.md` is explicit — *"every
file in SabNode lives in SabFiles"*. There is no second blob store,
no "executor's own R2 bucket". A `BinaryDataRef` carries a SabFiles id;
the SabFiles BFF is the only thing that ever touches R2.

**Lazy-load contract:** nodes call `BinaryDataRef::load(ctx)` (or
`load_with(store, ctx)`) only when they actually need bytes. Until the
SabFiles BFF crate registers a real `BinaryStore`, the default
`UnconfiguredBinaryStore` returns `NodeError::NotImplemented` — failing
loudly rather than silently producing empty buffers.

## 2. Non-goals

- **No raw R2 URLs in the API or wire format.** `BinaryDataRef` exposes
  no `url`, `presignedUrl`, `downloadUrl`, or `r2Url` field. UI code uses
  the existing `<SabFilePicker>` / `<SabFileUrlInput>` family; node code
  uses `load()`. Anything that needs to hand a browser a download URL
  goes through the existing `/api/sabfiles/share` flow, never through a
  node.
- **No streaming API in v1.** The trait returns `Vec<u8>`. We will add a
  streaming variant when the first node hits memory pressure; today the
  306 catalog nodes all need full buffers anyway.
- **No client-side caching in the trait.** Caching belongs in the BFF
  implementation (mirroring `executor/credentials/resolver.ts`), not in
  the public surface.

## 3. Implementation

| Piece | Location |
| --- | --- |
| `BinaryDataRef` struct | `rust/crates/sabflow-nodes/src/binary.rs` |
| `BinaryStore` trait + `UnconfiguredBinaryStore` default | same file |
| `InMemoryBinaryStore` test fake | same file |
| Process-wide `default_binary_store()` registration | same file |
| Integration tests with a mocked BFF | `rust/crates/sabflow-nodes/tests/binary.rs` |

The trait is intentionally narrow (`async fn load`). It deliberately omits
any "give me a URL" method — adding one would let nodes leak raw bucket
URLs and break the SabFiles policy.

`BinaryFetchContext` carries `workspace_id` + `execution_id` + optional
`node_id`. The BFF crate uses these to:

1. Enforce workspace ownership (cross-workspace ⇒ `AuthError`), exactly
   like `executor/credentials/resolver.ts`.
2. Sign its outbound request to the SabFiles BFF with the existing JWT
   pattern (`SABNODE_INTERNAL_JWT_SECRET`).
3. Emit `file.read` audit rows tagged with the execution.

## 4. JSON wire shape — strict allowlist

The five fields in §1 are the **only** keys that may appear in a
serialised ref. The integration test
`json_wire_shape_never_contains_inline_bytes_or_urls` enforces this with
an allowlist + a forbidden-key denylist. The JS-side type guard
(`src/lib/sabflow/n8n/type-guards.ts → isBinaryValue`) recognises the same
shape, so refs flow transparently across the Node ↔ Rust boundary.

## 5. Migration / compatibility

- Nodes that previously emitted inline base64 (none today in the Rust
  workspace; a handful in vendored n8n source) will be ported as they're
  rewritten — they upload to SabFiles, then emit a `BinaryDataRef`.
- The JS-side `IBinaryData` interface keeps its optional `data` field for
  read-side compatibility with vendored n8n nodes; the engine strips it
  before persisting execution state (covered by Phase C.2 sub-task #8).

## 6. Open questions / follow-ups

- **Streaming reads** — defer until a node actually needs them.
- **Multipart upload from a node** — Phase C.3 introduces a writer trait
  alongside `BinaryStore`.
- **Cross-workspace shares** — node-side reads of shared files will go
  through SabFiles' existing share-token API, not the binary store.
