/**
 * SabFlow WS Gateway — binary frame encode / decode.
 *
 * Track A · Phase 4 · sub-task #6 of 10.
 *
 * Implements the wire format defined in `docs/adr/sabflow-ws-gateway-node.md`
 * §4.1 (1-byte tag prefix on every binary WS frame) and §5 (≤256 KiB
 * per-frame cap, 0x7F server-batch coalescing).
 *
 * Wire format (single binary WS frame, opcode 0x2):
 *
 *   +--------+--------------------------------------------+
 *   | u8 tag | payload (tag-specific)                     |
 *   +--------+--------------------------------------------+
 *
 *   tag = 0x00  Yjs sync          (payload: u8 sub-tag + yjs bytes)
 *   tag = 0x01  Yjs awareness     (payload: awareness bytes)
 *   tag = 0x02  ack               (payload: opaque client-correlation bytes)
 *   tag = 0x03  nack              (payload: opaque client-correlation bytes)
 *   tag = 0x7F  server batch      (server → client only; see below)
 *
 * For `tag = 0x00` (sync) the first payload byte is a sub-tag selecting
 * the Yjs sync sub-protocol:
 *
 *   sub = 0x00  sync-step-1  (state vector)
 *   sub = 0x01  sync-step-2  (diff to apply)
 *   sub = 0x02  update       (live update)
 *
 * Server batch (`tag = 0x7F`) payload layout — N records back-to-back:
 *
 *   +------------------+--------+----------------------------+
 *   | u32-BE inner-len | u8 tag | payload (inner-len-1 bytes)|
 *   +------------------+--------+----------------------------+
 *   | ...repeats...                                           |
 *
 *   `inner-len` counts the `u8 tag + payload` bytes (i.e. exactly the
 *   size of one top-level frame). A 0x7F frame must NEVER be nested
 *   inside another 0x7F (decoder rejects).
 *
 * SCOPE: this file ONLY. Zero runtime deps. Pure functions; no I/O.
 *
 * Constraints (enforced):
 *  - Empty payload (`payload.length === 0`) is rejected on encode and
 *    decode. Yjs sync messages always carry at least one byte.
 *  - Total frame size (including 1-byte tag prefix, and including the
 *    full batch envelope for 0x7F) must be ≤ MAX_FRAME_BYTES.
 *  - Inbound traffic must never carry tag 0x7F — the helper
 *    `assertInboundTagAllowed` is exported for `connection.ts` to call
 *    before dispatch.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Top-level frame tag for Yjs sync messages. */
export const TAG_SYNC = 0x00;
/** Top-level frame tag for Yjs awareness messages. */
export const TAG_AWARENESS = 0x01;
/** Top-level frame tag for application-level ACKs. */
export const TAG_ACK = 0x02;
/** Top-level frame tag for application-level NACKs. */
export const TAG_NACK = 0x03;
/** Top-level frame tag for server-coalesced batches (server → client only). */
export const TAG_SERVER_BATCH = 0x7f;

/** Sync sub-tag: client requests server state vector. */
export const SS_SYNC_STEP1 = 0x00;
/** Sync sub-tag: diff sent in response to a step-1. */
export const SS_SYNC_STEP2 = 0x01;
/** Sync sub-tag: live document update. */
export const SS_UPDATE = 0x02;

/**
 * Hard cap on a single WebSocket binary frame, including the 1-byte tag
 * prefix. Matches `docs/adr/sabflow-ws-gateway-node.md` §5.
 */
export const MAX_FRAME_BYTES = 256 * 1024; // 256 KiB

/** Bytes used by the server-batch per-record header (`u32-BE` length). */
const BATCH_LEN_HEADER_BYTES = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of decoding a single top-level binary frame. */
export interface DecodedFrame {
  /** Top-level tag byte. Always one of `TAG_*`. */
  tag: number;
  /**
   * Sync sub-tag, present iff `tag === TAG_SYNC`. One of `SS_*`. The
   * `payload` then excludes this byte.
   */
  subTag?: number;
  /**
   * Frame payload, with the tag (and sub-tag for sync) stripped. Always a
   * fresh `Uint8Array` view onto the original buffer (no copy).
   */
  payload: Uint8Array;
  /** `true` iff the frame parsed cleanly and passes all validation. */
  valid: boolean;
  /** Human-readable reason, populated iff `valid === false`. */
  error?: string;
}

/** One element of a server batch — same shape as a top-level frame minus sub-tag. */
export interface BatchedFrame {
  tag: number;
  payload: Uint8Array;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isKnownTopLevelTag(tag: number): boolean {
  return (
    tag === TAG_SYNC ||
    tag === TAG_AWARENESS ||
    tag === TAG_ACK ||
    tag === TAG_NACK ||
    tag === TAG_SERVER_BATCH
  );
}

function isKnownSyncSubTag(sub: number): boolean {
  return sub === SS_SYNC_STEP1 || sub === SS_SYNC_STEP2 || sub === SS_UPDATE;
}

function makeInvalid(reason: string): DecodedFrame {
  return {
    tag: -1,
    payload: new Uint8Array(0),
    valid: false,
    error: reason,
  };
}

// ---------------------------------------------------------------------------
// Public encode helpers
// ---------------------------------------------------------------------------

/**
 * Encode a single top-level binary frame.
 *
 * @param tag      One of the top-level `TAG_*` constants.
 * @param payload  Tag-specific payload (Yjs / awareness bytes, ack body, …).
 *                 MUST NOT be empty. For `TAG_SYNC`, this is the sub-protocol
 *                 payload AFTER the sub-tag (the sub-tag is supplied separately).
 * @param subTag   Required iff `tag === TAG_SYNC`; rejected otherwise.
 *
 * Single allocation: a `Buffer` of exactly the final wire size is created
 * and the source payload is `set()`-copied into it once. The caller may
 * then `ws.send(buffer)` directly.
 *
 * Throws on invalid input. Server batches must be built via
 * {@link encodeServerBatch} — this function rejects callers that try to
 * hand-roll a `TAG_SERVER_BATCH` frame to keep the size-cap centralized.
 */
export function encodeFrame(
  tag: number,
  payload: Uint8Array,
  subTag?: number,
): Buffer {
  if (!Number.isInteger(tag) || tag < 0 || tag > 0xff) {
    throw new RangeError(`encodeFrame: tag must be a byte (0..255), got ${tag}`);
  }
  if (!isKnownTopLevelTag(tag)) {
    throw new RangeError(`encodeFrame: unknown tag 0x${tag.toString(16)}`);
  }
  if (tag === TAG_SERVER_BATCH) {
    throw new Error(
      'encodeFrame: use encodeServerBatch() to build a 0x7F server-batch frame',
    );
  }
  if (!(payload instanceof Uint8Array)) {
    throw new TypeError('encodeFrame: payload must be a Uint8Array');
  }
  if (payload.length === 0) {
    throw new Error('encodeFrame: empty payload rejected');
  }

  if (tag === TAG_SYNC) {
    if (subTag === undefined) {
      throw new Error('encodeFrame: TAG_SYNC requires a subTag');
    }
    if (!Number.isInteger(subTag) || subTag < 0 || subTag > 0xff) {
      throw new RangeError(
        `encodeFrame: subTag must be a byte (0..255), got ${subTag}`,
      );
    }
    if (!isKnownSyncSubTag(subTag)) {
      throw new RangeError(
        `encodeFrame: unknown sync sub-tag 0x${subTag.toString(16)}`,
      );
    }
    const total = 2 + payload.length; // tag + sub + payload
    if (total > MAX_FRAME_BYTES) {
      throw new RangeError(
        `encodeFrame: frame size ${total} exceeds MAX_FRAME_BYTES ${MAX_FRAME_BYTES}`,
      );
    }
    const buf = Buffer.allocUnsafe(total);
    buf[0] = tag;
    buf[1] = subTag;
    buf.set(payload, 2);
    return buf;
  }

  // Non-sync top-level frame: tag byte + payload.
  if (subTag !== undefined) {
    throw new Error(
      `encodeFrame: subTag only valid for TAG_SYNC (got tag 0x${tag.toString(16)})`,
    );
  }
  const total = 1 + payload.length;
  if (total > MAX_FRAME_BYTES) {
    throw new RangeError(
      `encodeFrame: frame size ${total} exceeds MAX_FRAME_BYTES ${MAX_FRAME_BYTES}`,
    );
  }
  const buf = Buffer.allocUnsafe(total);
  buf[0] = tag;
  buf.set(payload, 1);
  return buf;
}

/**
 * Encode a server-batch frame (`tag = 0x7F`). Each inner frame is laid out
 * as `<u32-BE inner-len><u8 inner-tag><inner-payload>`, where `inner-len`
 * counts `inner-tag + inner-payload` bytes (so it is `1 + payload.length`).
 *
 * @throws RangeError if the total encoded frame would exceed
 *   {@link MAX_FRAME_BYTES}, or if any inner record would exceed `u32`
 *   range, or if a caller tries to nest another `TAG_SERVER_BATCH` inside.
 * @throws Error if `frames` is empty or any inner payload is empty.
 */
export function encodeServerBatch(frames: ReadonlyArray<BatchedFrame>): Buffer {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('encodeServerBatch: at least one inner frame required');
  }

  // First pass: validate + compute the final size.
  let bodySize = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (!Number.isInteger(f.tag) || f.tag < 0 || f.tag > 0xff) {
      throw new RangeError(
        `encodeServerBatch[${i}]: tag must be a byte, got ${f.tag}`,
      );
    }
    if (!isKnownTopLevelTag(f.tag)) {
      throw new RangeError(
        `encodeServerBatch[${i}]: unknown inner tag 0x${f.tag.toString(16)}`,
      );
    }
    if (f.tag === TAG_SERVER_BATCH) {
      throw new Error(
        `encodeServerBatch[${i}]: cannot nest TAG_SERVER_BATCH inside a batch`,
      );
    }
    if (!(f.payload instanceof Uint8Array)) {
      throw new TypeError(
        `encodeServerBatch[${i}]: payload must be a Uint8Array`,
      );
    }
    if (f.payload.length === 0) {
      throw new Error(`encodeServerBatch[${i}]: empty inner payload rejected`);
    }
    const innerLen = 1 + f.payload.length; // tag + payload
    if (innerLen > 0xffffffff) {
      throw new RangeError(
        `encodeServerBatch[${i}]: inner length ${innerLen} exceeds u32`,
      );
    }
    bodySize += BATCH_LEN_HEADER_BYTES + innerLen;
  }

  const total = 1 + bodySize; // outer 0x7F tag + body
  if (total > MAX_FRAME_BYTES) {
    throw new RangeError(
      `encodeServerBatch: total frame size ${total} exceeds MAX_FRAME_BYTES ${MAX_FRAME_BYTES}`,
    );
  }

  // Second pass: single allocation, fill in place.
  const buf = Buffer.allocUnsafe(total);
  buf[0] = TAG_SERVER_BATCH;
  let off = 1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const innerLen = 1 + f.payload.length;
    buf.writeUInt32BE(innerLen, off);
    off += BATCH_LEN_HEADER_BYTES;
    buf[off] = f.tag;
    off += 1;
    buf.set(f.payload, off);
    off += f.payload.length;
  }
  // Sanity: off should now equal total. Cheap assert to catch arithmetic bugs.
  if (off !== total) {
    throw new Error(
      `encodeServerBatch: write offset ${off} != computed total ${total}`,
    );
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Public decode helpers
// ---------------------------------------------------------------------------

/**
 * Decode a single top-level binary frame.
 *
 * Returns a discriminated result with `valid: true` on success. On any
 * structural problem (truncation, unknown tag, oversize, empty payload,
 * unknown sub-tag) it returns `{ valid: false, error }` rather than
 * throwing — the caller (`connection.ts`) maps `error` to a 4413/4500
 * close code and is in a better position to log the offender's identity.
 *
 * The returned `payload` is a zero-copy `Uint8Array` view onto `buf`. If
 * the caller intends to retain it past the current tick it must copy.
 */
export function decodeFrame(buf: Uint8Array): DecodedFrame {
  if (!(buf instanceof Uint8Array)) {
    return makeInvalid('frame: input is not a Uint8Array');
  }
  if (buf.length === 0) {
    return makeInvalid('frame: zero-length buffer');
  }
  if (buf.length > MAX_FRAME_BYTES) {
    return makeInvalid(
      `frame: size ${buf.length} exceeds MAX_FRAME_BYTES ${MAX_FRAME_BYTES}`,
    );
  }
  const tag = buf[0]!;
  if (!isKnownTopLevelTag(tag)) {
    return makeInvalid(`frame: unknown tag 0x${tag.toString(16)}`);
  }

  if (tag === TAG_SYNC) {
    if (buf.length < 2) {
      return makeInvalid('frame: TAG_SYNC missing sub-tag byte');
    }
    const subTag = buf[1]!;
    if (!isKnownSyncSubTag(subTag)) {
      return makeInvalid(`frame: unknown sync sub-tag 0x${subTag.toString(16)}`);
    }
    if (buf.length < 3) {
      return makeInvalid('frame: TAG_SYNC empty payload rejected');
    }
    return {
      tag,
      subTag,
      payload: buf.subarray(2),
      valid: true,
    };
  }

  // Non-sync top-level frame.
  if (buf.length < 2) {
    return makeInvalid(`frame: empty payload for tag 0x${tag.toString(16)}`);
  }
  return {
    tag,
    payload: buf.subarray(1),
    valid: true,
  };
}

/**
 * Unwrap a server-batch payload into its inner frames.
 *
 * `payload` is the body of a `TAG_SERVER_BATCH` frame — i.e. what
 * `decodeFrame` returned as `.payload` when `tag === TAG_SERVER_BATCH`.
 * Do NOT pass the wire bytes that include the outer `0x7F` tag prefix.
 *
 * Each inner record is `<u32-BE inner-len><u8 tag><payload>`, where
 * `inner-len = 1 + payload.length`.
 *
 * Behaviour on structural errors:
 *  - Throws `RangeError` on truncation / overrun (a server we wrote
 *    should never produce a malformed batch; throwing surfaces the bug
 *    loudly during integration).
 *  - Throws `Error` if an inner record has tag `TAG_SERVER_BATCH`
 *    (nesting forbidden) or zero payload length.
 */
export function decodeServerBatch(payload: Uint8Array): BatchedFrame[] {
  if (!(payload instanceof Uint8Array)) {
    throw new TypeError('decodeServerBatch: payload must be a Uint8Array');
  }

  const out: BatchedFrame[] = [];
  let off = 0;
  const end = payload.length;

  while (off < end) {
    if (end - off < BATCH_LEN_HEADER_BYTES) {
      throw new RangeError(
        `decodeServerBatch: truncated length header at offset ${off}`,
      );
    }
    // Read u32-BE without allocating a Buffer view over an arbitrary slice.
    const innerLen =
      (payload[off]! << 24) |
      (payload[off + 1]! << 16) |
      (payload[off + 2]! << 8) |
      payload[off + 3]!;
    // Coerce to unsigned (the `<<` above is signed in JS for the top bit).
    const innerLenU = innerLen >>> 0;
    off += BATCH_LEN_HEADER_BYTES;

    if (innerLenU < 2) {
      throw new RangeError(
        `decodeServerBatch: inner length ${innerLenU} too small (need >=2: tag + 1 byte)`,
      );
    }
    if (innerLenU > end - off) {
      throw new RangeError(
        `decodeServerBatch: inner length ${innerLenU} overruns batch (remaining ${end - off})`,
      );
    }

    const innerTag = payload[off]!;
    if (!isKnownTopLevelTag(innerTag)) {
      throw new RangeError(
        `decodeServerBatch: unknown inner tag 0x${innerTag.toString(16)}`,
      );
    }
    if (innerTag === TAG_SERVER_BATCH) {
      throw new Error('decodeServerBatch: nested TAG_SERVER_BATCH forbidden');
    }

    const innerPayload = payload.subarray(off + 1, off + innerLenU);
    if (innerPayload.length === 0) {
      throw new Error('decodeServerBatch: empty inner payload rejected');
    }
    out.push({ tag: innerTag, payload: innerPayload });
    off += innerLenU;
  }

  if (out.length === 0) {
    throw new Error('decodeServerBatch: batch contains zero frames');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inbound policy helper
// ---------------------------------------------------------------------------

/**
 * Returns a reason string if the given tag MUST NOT appear on an inbound
 * (client → server) frame, or `null` if it is allowed. `connection.ts`
 * calls this after `decodeFrame` to enforce that `TAG_SERVER_BATCH` is a
 * server-only construct.
 */
export function inboundRejectReason(tag: number): string | null {
  if (tag === TAG_SERVER_BATCH) {
    return 'server-batch frame (0x7F) is not allowed inbound';
  }
  return null;
}
