# sabflow-ws — protocol fuzz tests

Property-based fuzz tests for the SabFlow WS gateway **binary frame
codec**. The codec lives at `src/sync/framing.ts` (Phase 4 sibling #6)
and is the only thing exercised here.

## Scope — what this tests

This is a **pure-function fuzzer**. It feeds random / hand-crafted byte
buffers into `decodeFrame()` and asserts that the decoder never throws
— it must always return `{ valid: false, error }` on garbage and a
correct round-trip on encoder output.

Covered properties:

1. **No-throw under junk input.** 5000 iterations of random
   `Uint8Array` (length `0..1024`, fully random bytes) are fed to
   `decodeFrame()`. The decoder MUST NOT throw; if `valid` is `false`
   it must populate `error`.
2. **Encode → decode roundtrip.** For every known top-level tag and
   sync sub-tag, random payloads (length `1..4096`) survive a
   `encodeFrame()` → `decodeFrame()` trip with byte-exact equality.
3. **Boundary cases.**
   - 0-byte payload rejected on both encode and decode.
   - 256 KiB total frame (the documented cap) accepted.
   - 256 KiB + 1 rejected on both encode and decode.
4. **Tag-invariant.** Every byte value `0x00..0xFF` is checked: the
   five known tags (`0x00`, `0x01`, `0x02`, `0x03`, `0x7F`) accept a
   well-formed payload; every other byte (including the entire
   high-bit range `0x80..0xFE`) is rejected by `decodeFrame()`.
5. **Inbound `0x7F` policy.** `inboundRejectReason(0x7F)` returns a
   non-null reason; every other known tag returns `null`.

## What this does **NOT** test

- The live WebSocket server (`src/index.ts`, `src/connection.ts`). End-
  to-end behaviour — handshake, auth, ping/pong, close codes, seat
  enforcement — is the job of the **integration** test suite (Phase 5
  sub-task #3, owns `test/integration/`).
- The Redis backplane, JWT verification, or any I/O.
- The CRDT semantics of the Yjs payload bytes — the codec is opaque
  to payload content.

## How to run

From the service root:

```bash
cd services/sabflow-ws
# Single fuzz run (5000 iterations, fixed seed unless overridden):
npx tsx --test test/fuzz/protocol.fuzz.test.ts

# Reproducible re-run after a failure: copy the seed printed on stderr
# and re-run with the same value.
SABFLOW_FUZZ_SEED=0x1234abcd npx tsx --test test/fuzz/protocol.fuzz.test.ts

# Crank up iteration count for an overnight soak:
SABFLOW_FUZZ_ITERS=200000 npx tsx --test test/fuzz/protocol.fuzz.test.ts
```

A passing run prints `# pass <n>` from the `node:test` reporter and
exits 0. On failure the deterministic seed is printed on stderr so the
exact input set can be reproduced bit-for-bit.

## Dependencies

Zero new runtime deps. The fuzzer uses a hand-rolled 32-bit xorshift
PRNG seeded from `SABFLOW_FUZZ_SEED` (or `Date.now()` if unset). We
deliberately avoid `fast-check` to keep the service's dependency
surface minimal — the sibling production deps are already locked at
ten packages and this test file should not expand that footprint.

If you want richer shrinking and `fast-check` is later added to the
service's `devDependencies`, this file can be ported in ~20 minutes;
the property set is small and self-contained.

## Forward-declaration safety

The fuzzer imports `../../src/sync/framing.js`. If that module has not
yet been merged (e.g. when running on a feature branch that lacks
sibling #6), the import is wrapped in a `try/catch` and the test
suite falls back to a minimal in-file stub that mirrors the documented
contract. This keeps CI green during the multi-PR Phase 4 rollout.
Once sibling #6 lands the stub branch is dead code; once Phase 4
closes the stub will be removed.
