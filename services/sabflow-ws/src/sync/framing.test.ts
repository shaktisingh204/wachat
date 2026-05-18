/**
 * Exhaustive tests for the SabFlow WS binary framing layer.
 *
 * Runs under Node's built-in `node:test` runner so we don't add a test
 * dependency to this service. Execute with:
 *
 *   pnpm --filter @sabnode/sabflow-ws exec tsx --test src/sync/framing.test.ts
 *
 * Covered:
 *   1.  encode/decode roundtrip — TAG_SYNC (each sub-tag)
 *   2.  encode/decode roundtrip — TAG_AWARENESS
 *   3.  encode/decode roundtrip — TAG_ACK
 *   4.  encode/decode roundtrip — TAG_NACK
 *   5.  encode rejects empty payload
 *   6.  decode rejects empty buffer / known-tag-but-empty-payload
 *   7.  decode rejects unknown tag
 *   8.  decode rejects unknown sync sub-tag
 *   9.  decode rejects oversize (> MAX_FRAME_BYTES) input
 *  10.  encode rejects oversize input
 *  11.  encode rejects hand-rolled TAG_SERVER_BATCH (must go via encodeServerBatch)
 *  12.  encode rejects TAG_SYNC without subTag, and non-sync with subTag
 *  13.  encodeServerBatch + decodeServerBatch roundtrip
 *  14.  encodeServerBatch refuses to nest TAG_SERVER_BATCH
 *  15.  encodeServerBatch throws when total > 256 KiB
 *  16.  decodeServerBatch rejects truncation / overrun
 *  17.  inboundRejectReason — 0x7F rejected, others allowed
 *  18.  decode boundary — exactly MAX_FRAME_BYTES accepted
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MAX_FRAME_BYTES,
  SS_SYNC_STEP1,
  SS_SYNC_STEP2,
  SS_UPDATE,
  TAG_ACK,
  TAG_AWARENESS,
  TAG_NACK,
  TAG_SERVER_BATCH,
  TAG_SYNC,
  decodeFrame,
  decodeServerBatch,
  encodeFrame,
  encodeServerBatch,
  inboundRejectReason,
} from './framing.js';

// ---------------------------------------------------------------------------
// Roundtrip — sync (every sub-tag)
// ---------------------------------------------------------------------------

describe('framing: encode/decode roundtrip — TAG_SYNC', () => {
  for (const [name, sub] of [
    ['sync-step-1', SS_SYNC_STEP1],
    ['sync-step-2', SS_SYNC_STEP2],
    ['update', SS_UPDATE],
  ] as const) {
    it(`roundtrips ${name}`, () => {
      const payload = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
      const wire = encodeFrame(TAG_SYNC, payload, sub);
      // Wire = [tag, sub, ...payload]
      assert.equal(wire.length, payload.length + 2);
      assert.equal(wire[0], TAG_SYNC);
      assert.equal(wire[1], sub);

      const decoded = decodeFrame(wire);
      assert.equal(decoded.valid, true);
      assert.equal(decoded.tag, TAG_SYNC);
      assert.equal(decoded.subTag, sub);
      assert.deepEqual(Array.from(decoded.payload), Array.from(payload));
    });
  }
});

// ---------------------------------------------------------------------------
// Roundtrip — non-sync top-level tags
// ---------------------------------------------------------------------------

describe('framing: encode/decode roundtrip — non-sync tags', () => {
  for (const [name, tag] of [
    ['awareness', TAG_AWARENESS],
    ['ack', TAG_ACK],
    ['nack', TAG_NACK],
  ] as const) {
    it(`roundtrips ${name}`, () => {
      const payload = Uint8Array.from([1, 2, 3, 4, 5]);
      const wire = encodeFrame(tag, payload);
      assert.equal(wire.length, payload.length + 1);
      assert.equal(wire[0], tag);

      const decoded = decodeFrame(wire);
      assert.equal(decoded.valid, true);
      assert.equal(decoded.tag, tag);
      assert.equal(decoded.subTag, undefined);
      assert.deepEqual(Array.from(decoded.payload), Array.from(payload));
    });
  }
});

// ---------------------------------------------------------------------------
// Empty / invalid input
// ---------------------------------------------------------------------------

describe('framing: empty + invalid inputs', () => {
  it('encodeFrame rejects empty payload', () => {
    assert.throws(
      () => encodeFrame(TAG_AWARENESS, new Uint8Array(0)),
      /empty payload/,
    );
    assert.throws(
      () => encodeFrame(TAG_SYNC, new Uint8Array(0), SS_UPDATE),
      /empty payload/,
    );
  });

  it('decodeFrame rejects empty buffer', () => {
    const r = decodeFrame(new Uint8Array(0));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /zero-length/);
  });

  it('decodeFrame rejects known tag with no payload', () => {
    // Just a lone TAG_AWARENESS byte — no payload follows.
    const r = decodeFrame(Uint8Array.from([TAG_AWARENESS]));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /empty payload/);
  });

  it('decodeFrame rejects TAG_SYNC missing sub-tag', () => {
    const r = decodeFrame(Uint8Array.from([TAG_SYNC]));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /sub-tag/);
  });

  it('decodeFrame rejects TAG_SYNC with sub-tag but no payload', () => {
    const r = decodeFrame(Uint8Array.from([TAG_SYNC, SS_UPDATE]));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /empty payload/);
  });

  it('decodeFrame rejects unknown top-level tag', () => {
    const r = decodeFrame(Uint8Array.from([0x55, 0xaa, 0xbb]));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /unknown tag/);
  });

  it('decodeFrame rejects unknown sync sub-tag', () => {
    const r = decodeFrame(Uint8Array.from([TAG_SYNC, 0x7e, 0x01, 0x02]));
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /sub-tag/);
  });
});

// ---------------------------------------------------------------------------
// Size cap
// ---------------------------------------------------------------------------

describe('framing: size cap (MAX_FRAME_BYTES = 256 KiB)', () => {
  it('decode accepts exactly MAX_FRAME_BYTES', () => {
    // Build a max-size awareness frame: 1 tag byte + (MAX-1) payload bytes.
    const payload = Buffer.alloc(MAX_FRAME_BYTES - 1, 0x42);
    const wire = encodeFrame(TAG_AWARENESS, payload);
    assert.equal(wire.length, MAX_FRAME_BYTES);
    const decoded = decodeFrame(wire);
    assert.equal(decoded.valid, true);
    assert.equal(decoded.payload.length, MAX_FRAME_BYTES - 1);
  });

  it('decode rejects > MAX_FRAME_BYTES input', () => {
    const oversized = Buffer.alloc(MAX_FRAME_BYTES + 1, 0x00);
    oversized[0] = TAG_AWARENESS;
    const r = decodeFrame(oversized);
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /exceeds MAX_FRAME_BYTES/);
  });

  it('encode rejects > MAX_FRAME_BYTES payload', () => {
    // Need 1 tag + payload > MAX → payload of size MAX itself is too big.
    const payload = Buffer.alloc(MAX_FRAME_BYTES, 0x01);
    assert.throws(
      () => encodeFrame(TAG_AWARENESS, payload),
      /exceeds MAX_FRAME_BYTES/,
    );
  });

  it('encode rejects > MAX_FRAME_BYTES sync payload', () => {
    // 1 tag + 1 sub + payload; payload of size MAX-1 yields total MAX+1.
    const payload = Buffer.alloc(MAX_FRAME_BYTES, 0x01);
    assert.throws(
      () => encodeFrame(TAG_SYNC, payload, SS_UPDATE),
      /exceeds MAX_FRAME_BYTES/,
    );
  });
});

// ---------------------------------------------------------------------------
// API misuse guards
// ---------------------------------------------------------------------------

describe('framing: encode API misuse', () => {
  it('encodeFrame rejects hand-rolled 0x7F', () => {
    assert.throws(
      () => encodeFrame(TAG_SERVER_BATCH, Uint8Array.from([1, 2, 3])),
      /encodeServerBatch/,
    );
  });

  it('encodeFrame rejects TAG_SYNC without subTag', () => {
    assert.throws(
      () => encodeFrame(TAG_SYNC, Uint8Array.from([1, 2, 3])),
      /subTag/,
    );
  });

  it('encodeFrame rejects unknown sync sub-tag', () => {
    assert.throws(
      () => encodeFrame(TAG_SYNC, Uint8Array.from([1, 2, 3]), 0x99),
      /sub-tag/,
    );
  });

  it('encodeFrame rejects subTag on non-sync frame', () => {
    assert.throws(
      () => encodeFrame(TAG_AWARENESS, Uint8Array.from([1, 2, 3]), SS_UPDATE),
      /subTag only valid for TAG_SYNC/,
    );
  });

  it('encodeFrame rejects unknown tag', () => {
    assert.throws(
      () => encodeFrame(0x42, Uint8Array.from([1, 2, 3])),
      /unknown tag/,
    );
  });
});

// ---------------------------------------------------------------------------
// Server batch — encode/decode roundtrip
// ---------------------------------------------------------------------------

describe('framing: server batch (0x7F) roundtrip', () => {
  it('roundtrips a mixed batch of 4 inner frames', () => {
    const inners = [
      {
        tag: TAG_SYNC,
        // For batch encoding the sub-tag is part of the *inner payload*:
        // the inner record is `<u32 len><u8 tag><payload>` and the sync
        // sub-tag is just the first byte of `<payload>`. So we glue
        // sub-tag onto the front here.
        payload: Uint8Array.from([SS_UPDATE, 0xaa, 0xbb]),
      },
      { tag: TAG_AWARENESS, payload: Uint8Array.from([0x10, 0x20, 0x30]) },
      { tag: TAG_ACK, payload: Uint8Array.from([0x01]) },
      { tag: TAG_NACK, payload: Uint8Array.from([0x02, 0x03]) },
    ];

    const wire = encodeServerBatch(inners);
    assert.equal(wire[0], TAG_SERVER_BATCH);

    const top = decodeFrame(wire);
    assert.equal(top.valid, true);
    assert.equal(top.tag, TAG_SERVER_BATCH);

    const unpacked = decodeServerBatch(top.payload);
    assert.equal(unpacked.length, inners.length);
    for (let i = 0; i < inners.length; i++) {
      assert.equal(unpacked[i]!.tag, inners[i]!.tag);
      assert.deepEqual(
        Array.from(unpacked[i]!.payload),
        Array.from(inners[i]!.payload),
      );
    }
  });

  it('inner sync frame can be re-routed through decodeFrame', () => {
    // Server batches an update. The flat-frame equivalent the client sees
    // after unwrap is `<TAG_SYNC><SS_UPDATE><bytes>` — i.e. exactly what
    // decodeFrame expects for a top-level sync.
    const innerPayload = Uint8Array.from([SS_UPDATE, 0xde, 0xad]);
    const wire = encodeServerBatch([
      { tag: TAG_SYNC, payload: innerPayload },
    ]);
    const top = decodeFrame(wire);
    assert.equal(top.valid, true);
    const inners = decodeServerBatch(top.payload);
    assert.equal(inners.length, 1);

    // Reconstruct the flat frame and re-decode.
    const flat = new Uint8Array(1 + inners[0]!.payload.length);
    flat[0] = inners[0]!.tag;
    flat.set(inners[0]!.payload, 1);

    const reDecoded = decodeFrame(flat);
    assert.equal(reDecoded.valid, true);
    assert.equal(reDecoded.tag, TAG_SYNC);
    assert.equal(reDecoded.subTag, SS_UPDATE);
    assert.deepEqual(Array.from(reDecoded.payload), [0xde, 0xad]);
  });
});

// ---------------------------------------------------------------------------
// Server batch — error paths
// ---------------------------------------------------------------------------

describe('framing: server batch errors', () => {
  it('encodeServerBatch rejects empty list', () => {
    assert.throws(() => encodeServerBatch([]), /at least one inner frame/);
  });

  it('encodeServerBatch rejects empty inner payload', () => {
    assert.throws(
      () =>
        encodeServerBatch([{ tag: TAG_AWARENESS, payload: new Uint8Array(0) }]),
      /empty inner payload/,
    );
  });

  it('encodeServerBatch refuses to nest TAG_SERVER_BATCH', () => {
    assert.throws(
      () =>
        encodeServerBatch([
          { tag: TAG_SERVER_BATCH, payload: Uint8Array.from([1, 2]) },
        ]),
      /nest TAG_SERVER_BATCH/,
    );
  });

  it('encodeServerBatch refuses unknown inner tag', () => {
    assert.throws(
      () =>
        encodeServerBatch([{ tag: 0x42, payload: Uint8Array.from([1, 2]) }]),
      /unknown inner tag/,
    );
  });

  it('encodeServerBatch throws when total > MAX_FRAME_BYTES', () => {
    // Two ~150 KiB awareness frames → batch overhead pushes past 256 KiB.
    const big = Buffer.alloc(150 * 1024, 0x7f);
    assert.throws(
      () =>
        encodeServerBatch([
          { tag: TAG_AWARENESS, payload: big },
          { tag: TAG_AWARENESS, payload: big },
        ]),
      /exceeds MAX_FRAME_BYTES/,
    );
  });

  it('decodeServerBatch rejects truncated length header', () => {
    // Two bytes of "header" — need 4.
    assert.throws(
      () => decodeServerBatch(Uint8Array.from([0x00, 0x00])),
      /truncated length header/,
    );
  });

  it('decodeServerBatch rejects overrun (len longer than remaining)', () => {
    // u32-BE = 100, but only 1 byte (tag) follows.
    const bad = Uint8Array.from([0x00, 0x00, 0x00, 0x64, TAG_AWARENESS]);
    assert.throws(() => decodeServerBatch(bad), /overruns batch/);
  });

  it('decodeServerBatch rejects inner len < 2', () => {
    // u32-BE = 1 → would mean tag with zero payload.
    const bad = Uint8Array.from([0x00, 0x00, 0x00, 0x01, TAG_AWARENESS]);
    assert.throws(() => decodeServerBatch(bad), /too small/);
  });

  it('decodeServerBatch rejects nested TAG_SERVER_BATCH', () => {
    // inner-len = 2 (tag + 1 byte payload); inner tag = 0x7F.
    const bad = Uint8Array.from([0x00, 0x00, 0x00, 0x02, TAG_SERVER_BATCH, 0xff]);
    assert.throws(() => decodeServerBatch(bad), /nested TAG_SERVER_BATCH/);
  });

  it('decodeServerBatch rejects unknown inner tag', () => {
    const bad = Uint8Array.from([0x00, 0x00, 0x00, 0x02, 0x55, 0xff]);
    assert.throws(() => decodeServerBatch(bad), /unknown inner tag/);
  });
});

// ---------------------------------------------------------------------------
// Inbound policy
// ---------------------------------------------------------------------------

describe('framing: inboundRejectReason', () => {
  it('rejects TAG_SERVER_BATCH', () => {
    const reason = inboundRejectReason(TAG_SERVER_BATCH);
    assert.ok(reason !== null);
    assert.match(reason!, /server-batch/);
  });

  it('allows all client-allowed tags', () => {
    assert.equal(inboundRejectReason(TAG_SYNC), null);
    assert.equal(inboundRejectReason(TAG_AWARENESS), null);
    assert.equal(inboundRejectReason(TAG_ACK), null);
    assert.equal(inboundRejectReason(TAG_NACK), null);
  });
});
