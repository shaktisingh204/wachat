/**
 * state-vector.ts — Yjs-compatible state-vector encode/decode + diff helpers.
 *
 * Track A · Phase 4 · sub-task #4 (sabflow-ws gateway sync helpers).
 *
 * A Yjs state vector is a `Map<clientId, clock>` describing the highest clock
 * the local doc has observed for each remote client. The wire format used by
 * Yjs / `lib0` is:
 *
 *   varint(size)
 *   repeat size times:
 *     varint(clientId)
 *     varint(clock)
 *
 * All varints are unsigned LEB128 (7-bit little-endian, MSB=continuation).
 * This module deliberately reimplements the varint codec inline (zero deps)
 * so the gateway can ship without a runtime dependency on `lib0` — the ADR
 * (`docs/adr/sabflow-ws-gateway-node.md` §4.1) requires deterministic binary
 * framing and we want one fewer install surface.
 *
 * The encoder writes entries in *ascending clientId order* so the byte output
 * is deterministic — two SVs with identical (clientId → clock) content always
 * produce byte-identical buffers, which simplifies digest-based equality
 * checks and snapshot tests.
 */

/** Map of `clientId → highest clock observed`. */
export type StateVector = Map<number, number>;

/** Output of `computeMissingClock` — one entry per clientId where remote lags. */
export interface MissingRange {
  clientId: number;
  /** First clock the remote does NOT yet have (inclusive). */
  from: number;
  /** Exclusive upper bound — equals `local.get(clientId)`. */
  to: number;
}

// ---------------------------------------------------------------------------
// varint (unsigned LEB128) — Yjs / lib0 compatible
// ---------------------------------------------------------------------------

/** Number of bytes a non-negative integer occupies in unsigned LEB128. */
function varintLength(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`varint expects a non-negative integer, got ${n}`);
  }
  let len = 1;
  let v = n;
  while (v >= 0x80) {
    v = Math.floor(v / 0x80);
    len += 1;
  }
  return len;
}

/** Write `n` as unsigned LEB128 into `out` starting at `offset`, returning new offset. */
function writeVarint(out: Uint8Array, offset: number, n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`varint expects a non-negative integer, got ${n}`);
  }
  let v = n;
  let i = offset;
  while (v >= 0x80) {
    out[i++] = (v & 0x7f) | 0x80;
    // Use floor-div rather than `>>> 7` so we handle clocks > 2^31 safely
    // (JS bitwise ops coerce to int32). Yjs clocks can in principle exceed
    // 2^31 in long-lived docs.
    v = Math.floor(v / 0x80);
  }
  out[i++] = v & 0x7f;
  return i;
}

/** Read an unsigned LEB128 starting at `offset`; returns `[value, newOffset]`. */
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shiftMul = 1; // 2^(7*k); use multiplication to stay safe past 32 bits
  let i = offset;
  // Cap at 10 bytes — max LEB128 length for a 64-bit value. Anything longer
  // is a malformed stream and we refuse to over-read.
  const hardCap = offset + 10;
  while (i < buf.length && i < hardCap) {
    const byte = buf[i++]!;
    result += (byte & 0x7f) * shiftMul;
    if ((byte & 0x80) === 0) {
      return [result, i];
    }
    shiftMul *= 0x80;
  }
  throw new RangeError(
    `varint: truncated or oversized at offset ${offset} (read up to ${i})`,
  );
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * Encode a state vector to its Yjs-compatible binary form.
 *
 * Entries are sorted by ascending clientId before encoding, making the output
 * byte-deterministic for any input map regardless of insertion order.
 */
export function encodeStateVector(sv: StateVector): Uint8Array {
  // Sort for deterministic output. Map iteration order is insertion-order in
  // JS, so two semantically-equal SVs built different ways would otherwise
  // produce different bytes.
  const entries = Array.from(sv.entries()).sort((a, b) => a[0] - b[0]);

  // Validate up-front so the size pre-pass and the writer agree.
  for (const [clientId, clock] of entries) {
    if (!Number.isInteger(clientId) || clientId < 0) {
      throw new RangeError(`encodeStateVector: bad clientId ${clientId}`);
    }
    if (!Number.isInteger(clock) || clock < 0) {
      throw new RangeError(
        `encodeStateVector: bad clock ${clock} for clientId ${clientId}`,
      );
    }
  }

  // Two-pass: compute exact buffer size, then write. Avoids reallocation and
  // keeps the function allocation-cheap for the typical hot-path call where
  // it runs on every sync-step-1.
  let size = varintLength(entries.length);
  for (const [clientId, clock] of entries) {
    size += varintLength(clientId) + varintLength(clock);
  }

  const out = new Uint8Array(size);
  let offset = writeVarint(out, 0, entries.length);
  for (const [clientId, clock] of entries) {
    offset = writeVarint(out, offset, clientId);
    offset = writeVarint(out, offset, clock);
  }
  return out;
}

/**
 * Decode a Yjs-compatible state-vector binary back into a `StateVector` map.
 *
 * Throws if the buffer is truncated, declares a count it cannot back, or
 * contains duplicate clientIds (which Yjs treats as malformed).
 */
export function decodeStateVector(buf: Uint8Array): StateVector {
  const sv: StateVector = new Map();
  if (buf.length === 0) {
    throw new RangeError("decodeStateVector: empty buffer");
  }
  const [count, afterCount] = readVarint(buf, 0);
  let offset = afterCount;
  for (let i = 0; i < count; i++) {
    const [clientId, afterClient] = readVarint(buf, offset);
    const [clock, afterClock] = readVarint(buf, afterClient);
    if (sv.has(clientId)) {
      throw new RangeError(
        `decodeStateVector: duplicate clientId ${clientId} in stream`,
      );
    }
    sv.set(clientId, clock);
    offset = afterClock;
  }
  if (offset !== buf.length) {
    throw new RangeError(
      `decodeStateVector: ${buf.length - offset} trailing byte(s) after ${count} entries`,
    );
  }
  return sv;
}

/**
 * Merge two state vectors into a new one taking the element-wise max.
 *
 * This is the natural join in the CRDT lattice — "what's the highest clock we
 * collectively know about for each client" — and is used when the gateway
 * unions the room's authoritative SV with what a freshly-joined peer claims
 * to already have.
 */
export function mergeStateVectors(a: StateVector, b: StateVector): StateVector {
  const out: StateVector = new Map(a);
  for (const [clientId, clock] of b) {
    const existing = out.get(clientId);
    if (existing === undefined || clock > existing) {
      out.set(clientId, clock);
    }
  }
  return out;
}

/**
 * `true` if `local` is behind `remote` for *any* clientId — i.e. remote knows
 * about a clock higher than local does (or knows about a client local is
 * unaware of). Used at sync-step-1 to decide whether we need to pull updates.
 */
export function isStateVectorBehind(
  local: StateVector,
  remote: StateVector,
): boolean {
  for (const [clientId, remoteClock] of remote) {
    const localClock = local.get(clientId) ?? 0;
    if (remoteClock > localClock) return true;
  }
  return false;
}

/**
 * Compute the ranges of updates `remote` is missing relative to `local`.
 *
 * For each clientId where `local`'s clock exceeds `remote`'s, emit `{from, to}`
 * where `from = remote.get(clientId) ?? 0` and `to = local.get(clientId)`.
 * The pair is half-open: `from` inclusive, `to` exclusive — matching Yjs's
 * `encodeStateAsUpdate(doc, remoteSV)` semantics.
 *
 * Results are sorted by ascending clientId for deterministic output, mirroring
 * `encodeStateVector`.
 */
export function computeMissingClock(
  local: StateVector,
  remote: StateVector,
): MissingRange[] {
  const ranges: MissingRange[] = [];
  for (const [clientId, localClock] of local) {
    const remoteClock = remote.get(clientId) ?? 0;
    if (localClock > remoteClock) {
      ranges.push({ clientId, from: remoteClock, to: localClock });
    }
  }
  ranges.sort((a, b) => a.clientId - b.clientId);
  return ranges;
}
