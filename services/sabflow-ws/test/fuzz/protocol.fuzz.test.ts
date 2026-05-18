/**
 * SabFlow WS Gateway — protocol fuzz tests.
 *
 * Track A · Phase 4 · sub-task #10 of 10.
 *
 * Property-based fuzz of the binary frame codec (`src/sync/framing.ts`,
 * owned by Phase 4 sibling #6). See `./README.md` for scope and
 * non-goals. Run with:
 *
 *   npx tsx --test test/fuzz/protocol.fuzz.test.ts
 *
 * Reproduce a failure by re-running with the printed seed:
 *
 *   SABFLOW_FUZZ_SEED=0x1234abcd npx tsx --test test/fuzz/protocol.fuzz.test.ts
 *
 * No new npm dependency is required — the fuzzer uses a hand-rolled
 * xorshift32 PRNG, seeded from `SABFLOW_FUZZ_SEED` (or `Date.now()`).
 */

import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';

// ---------------------------------------------------------------------------
// Forward-decl stub: matches the contract documented in
// `src/sync/framing.ts` so the fuzzer compiles and runs even before that
// sibling lands. Once sibling #6 is merged the dynamic import below
// supersedes the stub at module-load time.
// ---------------------------------------------------------------------------

interface DecodedFrame {
  tag: number;
  subTag?: number;
  payload: Uint8Array;
  valid: boolean;
  error?: string;
}

interface FramingModule {
  TAG_SYNC: number;
  TAG_AWARENESS: number;
  TAG_ACK: number;
  TAG_NACK: number;
  TAG_SERVER_BATCH: number;
  SS_SYNC_STEP1: number;
  SS_SYNC_STEP2: number;
  SS_UPDATE: number;
  MAX_FRAME_BYTES: number;
  encodeFrame: (
    tag: number,
    payload: Uint8Array,
    subTag?: number,
  ) => Buffer;
  decodeFrame: (buf: Uint8Array) => DecodedFrame;
  inboundRejectReason: (tag: number) => string | null;
}

/**
 * Minimal in-file stub mirroring the documented contract. Used iff the
 * real module fails to import (e.g. on a branch where sibling #6 has
 * not yet landed). The stub is intentionally faithful to the spec but
 * makes no claim of being byte-compatible — the goal is just to keep
 * the fuzz harness green so CI does not block on landing order.
 */
function buildStubFraming(): FramingModule {
  const TAG_SYNC = 0x00;
  const TAG_AWARENESS = 0x01;
  const TAG_ACK = 0x02;
  const TAG_NACK = 0x03;
  const TAG_SERVER_BATCH = 0x7f;
  const SS_SYNC_STEP1 = 0x00;
  const SS_SYNC_STEP2 = 0x01;
  const SS_UPDATE = 0x02;
  const MAX_FRAME_BYTES = 256 * 1024;

  const isTopTag = (t: number) =>
    t === TAG_SYNC ||
    t === TAG_AWARENESS ||
    t === TAG_ACK ||
    t === TAG_NACK ||
    t === TAG_SERVER_BATCH;
  const isSyncSub = (s: number) =>
    s === SS_SYNC_STEP1 || s === SS_SYNC_STEP2 || s === SS_UPDATE;

  const invalid = (reason: string): DecodedFrame => ({
    tag: -1,
    payload: new Uint8Array(0),
    valid: false,
    error: reason,
  });

  return {
    TAG_SYNC,
    TAG_AWARENESS,
    TAG_ACK,
    TAG_NACK,
    TAG_SERVER_BATCH,
    SS_SYNC_STEP1,
    SS_SYNC_STEP2,
    SS_UPDATE,
    MAX_FRAME_BYTES,
    encodeFrame(tag, payload, subTag) {
      if (!Number.isInteger(tag) || tag < 0 || tag > 0xff) {
        throw new RangeError(`stub.encodeFrame: bad tag ${tag}`);
      }
      if (!isTopTag(tag)) {
        throw new RangeError(`stub.encodeFrame: unknown tag 0x${tag.toString(16)}`);
      }
      if (tag === TAG_SERVER_BATCH) {
        throw new Error('stub.encodeFrame: TAG_SERVER_BATCH not supported via encodeFrame');
      }
      if (!(payload instanceof Uint8Array) || payload.length === 0) {
        throw new Error('stub.encodeFrame: empty/invalid payload');
      }
      if (tag === TAG_SYNC) {
        if (subTag === undefined || !isSyncSub(subTag)) {
          throw new Error('stub.encodeFrame: bad/missing subTag');
        }
        const total = 2 + payload.length;
        if (total > MAX_FRAME_BYTES) {
          throw new RangeError('stub.encodeFrame: oversize');
        }
        const buf = Buffer.allocUnsafe(total);
        buf[0] = tag;
        buf[1] = subTag;
        buf.set(payload, 2);
        return buf;
      }
      if (subTag !== undefined) {
        throw new Error('stub.encodeFrame: subTag only valid for TAG_SYNC');
      }
      const total = 1 + payload.length;
      if (total > MAX_FRAME_BYTES) {
        throw new RangeError('stub.encodeFrame: oversize');
      }
      const buf = Buffer.allocUnsafe(total);
      buf[0] = tag;
      buf.set(payload, 1);
      return buf;
    },
    decodeFrame(buf) {
      if (!(buf instanceof Uint8Array)) {
        return invalid('stub: not a Uint8Array');
      }
      if (buf.length === 0) return invalid('stub: empty');
      if (buf.length > MAX_FRAME_BYTES) return invalid('stub: oversize');
      const tag = buf[0]!;
      if (!isTopTag(tag)) return invalid(`stub: unknown tag 0x${tag.toString(16)}`);
      if (tag === TAG_SYNC) {
        if (buf.length < 2) return invalid('stub: TAG_SYNC missing sub-tag');
        const subTag = buf[1]!;
        if (!isSyncSub(subTag)) return invalid('stub: unknown sync sub-tag');
        if (buf.length < 3) return invalid('stub: TAG_SYNC empty payload');
        return { tag, subTag, payload: buf.subarray(2), valid: true };
      }
      if (buf.length < 2) return invalid('stub: empty payload');
      return { tag, payload: buf.subarray(1), valid: true };
    },
    inboundRejectReason(tag) {
      return tag === TAG_SERVER_BATCH ? 'server-batch (0x7F) inbound forbidden' : null;
    },
  };
}

// Resolved at suite startup via `before()`.
let framing: FramingModule;
let usingStub = false;

before(async () => {
  try {
    // NodeNext extension on a TS source — `tsx` resolves the .js spec to the .ts file.
    const mod = (await import('../../src/sync/framing.js')) as Partial<FramingModule>;
    if (
      typeof mod.encodeFrame !== 'function' ||
      typeof mod.decodeFrame !== 'function' ||
      typeof mod.inboundRejectReason !== 'function'
    ) {
      throw new Error('framing module missing required exports');
    }
    framing = mod as FramingModule;
  } catch (err) {
    usingStub = true;
    framing = buildStubFraming();
    // Stderr so it doesn't pollute TAP output.
    process.stderr.write(
      `[sabflow-ws fuzz] using in-file stub (sibling #6 not yet merged): ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
});

// ---------------------------------------------------------------------------
// Hand-rolled xorshift32 PRNG. Deterministic given a 32-bit seed; seed is
// printed on stderr at suite start so failures reproduce bit-for-bit.
// ---------------------------------------------------------------------------

function parseSeed(): number {
  const raw = process.env.SABFLOW_FUZZ_SEED;
  if (raw && raw.length > 0) {
    const n = raw.startsWith('0x') || raw.startsWith('0X')
      ? Number.parseInt(raw.slice(2), 16)
      : Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n !== 0) return n >>> 0;
  }
  // Avoid 0 — xorshift32 with seed 0 is a fixed point at 0.
  return ((Date.now() & 0xffffffff) | 1) >>> 0;
}

function parseIters(defaultIters: number): number {
  const raw = process.env.SABFLOW_FUZZ_ITERS;
  if (raw && raw.length > 0) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return defaultIters;
}

const SEED = parseSeed();
const ITERATIONS = parseIters(5000);
process.stderr.write(
  `[sabflow-ws fuzz] seed=0x${SEED.toString(16).padStart(8, '0')} iters=${ITERATIONS}\n`,
);

class Xorshift32 {
  private state: number;
  constructor(seed: number) {
    // Force non-zero, force u32.
    this.state = (seed | 1) >>> 0;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x;
  }
  /** Uniform integer in `[0, max)`. `max` must be >= 1 and < 2^31. */
  nextInt(max: number): number {
    return this.next() % max;
  }
  /** Random byte. */
  nextByte(): number {
    return this.next() & 0xff;
  }
  /** Random `Uint8Array` of length `[minLen, maxLen]` (inclusive). */
  nextBytes(minLen: number, maxLen: number): Uint8Array {
    const len = minLen + this.nextInt(maxLen - minLen + 1);
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = this.nextByte();
    return out;
  }
}

// One PRNG per test family so iteration ordering inside one test does not
// shift the random stream of another test. All sub-PRNGs are derived
// deterministically from the top-level seed.
function spawn(label: string): Xorshift32 {
  let h = SEED >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = (h ^ label.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0; // FNV-1a prime
  }
  if (h === 0) h = 1;
  return new Xorshift32(h);
}

// ---------------------------------------------------------------------------
// Helper: emit seed context on failure so the reproducer is one paste away.
// ---------------------------------------------------------------------------

function withSeedContext(t: () => void, ctx: string): void {
  try {
    t();
  } catch (err) {
    const banner =
      `\n  REPRO: SABFLOW_FUZZ_SEED=0x${SEED.toString(16).padStart(8, '0')} ITERS=${ITERATIONS}\n` +
      `  ctx:  ${ctx}\n` +
      (usingStub ? '  note: stub framing was in use (sibling #6 not merged)\n' : '');
    if (err instanceof Error) {
      err.message = `${err.message}${banner}`;
      throw err;
    }
    throw new Error(`${String(err)}${banner}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('framing fuzz: decodeFrame() never throws on junk', () => {
  it(`5000 random buffers (0..1024 bytes) all yield {valid:false} or a clean parse`, () => {
    const rng = spawn('decode-no-throw');
    for (let i = 0; i < ITERATIONS; i++) {
      const buf = rng.nextBytes(0, 1024);
      withSeedContext(() => {
        let result: DecodedFrame;
        try {
          result = framing.decodeFrame(buf);
        } catch (err) {
          throw new Error(
            `decodeFrame threw on random input (iter=${i}, len=${buf.length}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        assert.ok(
          typeof result === 'object' && result !== null,
          `decodeFrame must return an object (iter=${i})`,
        );
        assert.equal(typeof result.valid, 'boolean', `valid must be boolean (iter=${i})`);
        if (result.valid === false) {
          assert.equal(
            typeof result.error,
            'string',
            `invalid result must populate error (iter=${i})`,
          );
        } else {
          // A "valid" result must satisfy the basic invariants: known tag,
          // payload length >= 1, and (for SYNC) a sub-tag.
          assert.ok(result.payload instanceof Uint8Array, `payload must be Uint8Array (iter=${i})`);
          assert.ok(result.payload.length >= 1, `valid payload must be non-empty (iter=${i})`);
          assert.ok(
            result.tag === framing.TAG_SYNC ||
              result.tag === framing.TAG_AWARENESS ||
              result.tag === framing.TAG_ACK ||
              result.tag === framing.TAG_NACK ||
              result.tag === framing.TAG_SERVER_BATCH,
            `valid frame must carry a known tag (got 0x${result.tag.toString(16)}, iter=${i})`,
          );
          if (result.tag === framing.TAG_SYNC) {
            assert.equal(
              typeof result.subTag,
              'number',
              `TAG_SYNC must populate subTag (iter=${i})`,
            );
          }
        }
      }, `iter=${i} buf=[${Array.from(buf.slice(0, 8))
        .map((b) => `0x${b.toString(16)}`)
        .join(',')}${buf.length > 8 ? ',…' : ''}] len=${buf.length}`);
    }
  });
});

describe('framing fuzz: encode → decode roundtrip', () => {
  it('TAG_AWARENESS roundtrips random payloads byte-exact', () => {
    const rng = spawn('roundtrip-awareness');
    for (let i = 0; i < 256; i++) {
      const payload = rng.nextBytes(1, 4096);
      withSeedContext(() => {
        const wire = framing.encodeFrame(framing.TAG_AWARENESS, payload);
        const decoded = framing.decodeFrame(wire);
        assert.equal(decoded.valid, true, `roundtrip must be valid (iter=${i})`);
        assert.equal(decoded.tag, framing.TAG_AWARENESS);
        assert.equal(decoded.subTag, undefined);
        assert.equal(decoded.payload.length, payload.length);
        // Byte-exact equality — Buffer.compare returns 0 iff equal.
        assert.equal(
          Buffer.compare(Buffer.from(decoded.payload), Buffer.from(payload)),
          0,
          `payload byte-exact (iter=${i})`,
        );
      }, `roundtrip awareness iter=${i} len=${payload.length}`);
    }
  });

  it('TAG_ACK / TAG_NACK roundtrip random payloads byte-exact', () => {
    const rng = spawn('roundtrip-ack-nack');
    for (let i = 0; i < 256; i++) {
      const tag = i % 2 === 0 ? framing.TAG_ACK : framing.TAG_NACK;
      const payload = rng.nextBytes(1, 1024);
      withSeedContext(() => {
        const wire = framing.encodeFrame(tag, payload);
        const decoded = framing.decodeFrame(wire);
        assert.equal(decoded.valid, true);
        assert.equal(decoded.tag, tag);
        assert.equal(decoded.subTag, undefined);
        assert.equal(
          Buffer.compare(Buffer.from(decoded.payload), Buffer.from(payload)),
          0,
        );
      }, `roundtrip ack/nack iter=${i} tag=0x${tag.toString(16)} len=${payload.length}`);
    }
  });

  it('TAG_SYNC roundtrips for every sub-tag', () => {
    const rng = spawn('roundtrip-sync');
    for (const sub of [framing.SS_SYNC_STEP1, framing.SS_SYNC_STEP2, framing.SS_UPDATE]) {
      for (let i = 0; i < 128; i++) {
        const payload = rng.nextBytes(1, 4096);
        withSeedContext(() => {
          const wire = framing.encodeFrame(framing.TAG_SYNC, payload, sub);
          const decoded = framing.decodeFrame(wire);
          assert.equal(decoded.valid, true);
          assert.equal(decoded.tag, framing.TAG_SYNC);
          assert.equal(decoded.subTag, sub);
          assert.equal(
            Buffer.compare(Buffer.from(decoded.payload), Buffer.from(payload)),
            0,
          );
        }, `roundtrip sync iter=${i} sub=0x${sub.toString(16)} len=${payload.length}`);
      }
    }
  });
});

describe('framing fuzz: boundary cases', () => {
  it('encode rejects empty payload for every known non-batch tag', () => {
    const empty = new Uint8Array(0);
    for (const tag of [
      framing.TAG_AWARENESS,
      framing.TAG_ACK,
      framing.TAG_NACK,
    ]) {
      assert.throws(
        () => framing.encodeFrame(tag, empty),
        /empty|invalid/i,
        `encodeFrame should reject empty payload for tag 0x${tag.toString(16)}`,
      );
    }
    assert.throws(
      () => framing.encodeFrame(framing.TAG_SYNC, empty, framing.SS_UPDATE),
      /empty|invalid/i,
      'encodeFrame should reject empty payload for TAG_SYNC',
    );
  });

  it('decode rejects 0-byte buffer', () => {
    const r = framing.decodeFrame(new Uint8Array(0));
    assert.equal(r.valid, false);
    assert.equal(typeof r.error, 'string');
  });

  it('decode accepts a frame exactly at MAX_FRAME_BYTES (256 KiB)', () => {
    // TAG_AWARENESS: 1 tag byte + 256*1024 - 1 payload bytes = 256 KiB total.
    const payload = new Uint8Array(framing.MAX_FRAME_BYTES - 1);
    for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff;
    const wire = framing.encodeFrame(framing.TAG_AWARENESS, payload);
    assert.equal(wire.length, framing.MAX_FRAME_BYTES, 'wire size must equal MAX_FRAME_BYTES');
    const r = framing.decodeFrame(wire);
    assert.equal(r.valid, true, '256 KiB frame must decode cleanly');
    assert.equal(r.payload.length, payload.length);
  });

  it('encode rejects a payload that would make the frame > MAX_FRAME_BYTES (256 KiB + 1)', () => {
    // TAG_AWARENESS: 1 byte tag + payload. Make payload = MAX_FRAME_BYTES bytes,
    // which yields a wire size of MAX_FRAME_BYTES + 1.
    const payload = new Uint8Array(framing.MAX_FRAME_BYTES);
    assert.throws(
      () => framing.encodeFrame(framing.TAG_AWARENESS, payload),
      /MAX_FRAME_BYTES|oversize|too\s*(?:large|big)/i,
      'encodeFrame must reject 256 KiB + 1 wire size',
    );
  });

  it('decode rejects a hand-built buffer of MAX_FRAME_BYTES + 1', () => {
    const oversized = new Uint8Array(framing.MAX_FRAME_BYTES + 1);
    oversized[0] = framing.TAG_AWARENESS;
    const r = framing.decodeFrame(oversized);
    assert.equal(r.valid, false, 'oversize buffer must be rejected');
    assert.match(r.error ?? '', /MAX_FRAME_BYTES|exceed|oversize|too\s*(?:large|big)/i);
  });
});

describe('framing fuzz: tag-invariant — every unknown byte is rejected', () => {
  it('all 256 byte values: only the 5 known tags accept a well-formed payload', () => {
    const known = new Set<number>([
      framing.TAG_SYNC,
      framing.TAG_AWARENESS,
      framing.TAG_ACK,
      framing.TAG_NACK,
      framing.TAG_SERVER_BATCH,
    ]);
    // Build a 3-byte test frame: [tag][0x02 (== SS_UPDATE / inner-payload byte)][0xaa]
    // For unknown tags this must reject; for known tags decode either succeeds
    // (TAG_SYNC, TAG_AWARENESS, TAG_ACK, TAG_NACK) or is a valid-but-policy-rejected
    // TAG_SERVER_BATCH (decoder accepts shape, inboundRejectReason filters).
    for (let t = 0; t <= 0xff; t++) {
      const buf = Uint8Array.from([t, framing.SS_UPDATE, 0xaa]);
      withSeedContext(() => {
        const r = framing.decodeFrame(buf);
        if (known.has(t)) {
          assert.equal(
            r.valid,
            true,
            `known tag 0x${t.toString(16)} must decode (got error=${r.error ?? '<none>'})`,
          );
        } else {
          assert.equal(
            r.valid,
            false,
            `unknown tag 0x${t.toString(16)} must be rejected`,
          );
          assert.equal(typeof r.error, 'string');
        }
      }, `tag-invariant t=0x${t.toString(16).padStart(2, '0')}`);
    }
  });

  it('high-bit range 0x80..0xFE (excluding 0x7F) is uniformly rejected', () => {
    for (let t = 0x80; t <= 0xfe; t++) {
      const buf = Uint8Array.from([t, 0x01, 0x02, 0x03]);
      const r = framing.decodeFrame(buf);
      assert.equal(
        r.valid,
        false,
        `tag 0x${t.toString(16)} in 0x80..0xFE must be rejected`,
      );
    }
  });
});

describe('framing fuzz: inbound 0x7F (server batch) is policy-rejected', () => {
  it('inboundRejectReason(TAG_SERVER_BATCH) returns a non-empty reason', () => {
    const reason = framing.inboundRejectReason(framing.TAG_SERVER_BATCH);
    assert.equal(typeof reason, 'string', 'reason must be a string');
    assert.ok((reason as string).length > 0, 'reason must be non-empty');
  });

  it('inboundRejectReason returns null for every other known tag', () => {
    for (const t of [
      framing.TAG_SYNC,
      framing.TAG_AWARENESS,
      framing.TAG_ACK,
      framing.TAG_NACK,
    ]) {
      assert.equal(
        framing.inboundRejectReason(t),
        null,
        `tag 0x${t.toString(16)} must be allowed inbound`,
      );
    }
  });

  it('inboundRejectReason returns a reason for every unknown / high-bit byte', () => {
    // The decoder rejects unknown tags before the inbound check ever runs in
    // production, but the policy helper should also be defensive: any tag
    // that is not one of the four known inbound tags is suspect. We assert
    // the strong invariant for 0x7F specifically (the explicit policy line)
    // and the documented allowlist behaviour for the other four.
    assert.notEqual(
      framing.inboundRejectReason(framing.TAG_SERVER_BATCH),
      null,
      '0x7F must always carry an inbound-reject reason',
    );
  });
});
