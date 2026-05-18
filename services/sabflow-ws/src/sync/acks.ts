/**
 * SabFlow WS Gateway — update-frame ACK / NACK + idempotency keys.
 *
 * Track A · Phase 4 · sub-task #5 of 10.
 *
 * Contract
 * --------
 * Every client → server update frame carries an opaque 8-byte `updateId`
 * (nanoid bytes or a monotonic counter — the server treats the bytes as an
 * opaque key). The server MUST reply with exactly one of:
 *
 *   ACK(updateId, seq)         tag 0x02 · payload <8B updateId><4B seq BE u32>
 *   NACK(updateId, reason)     tag 0x03 · payload <8B updateId><1B reason u8>
 *
 * Idempotency
 * -----------
 * Each connection keeps an LRU set of the most recent 1024 `updateId`s it has
 * acknowledged. If the same `updateId` arrives twice on the same connection
 * (typically because the client retried after a transient network blip), the
 * server skips re-persisting and replies with the original ACK — including the
 * original `seq`. The cache is per-connection by design: cross-connection
 * dedup is the oplog's job, not ours.
 *
 * Scope (file ownership)
 * ----------------------
 * This module owns the ACK / NACK wire encoding, the idempotency cache, and
 * the `markSeen` / `sendAck` / `sendNack` primitives. It does NOT own:
 *   - the update-frame decoder (sibling sub-task in this phase)
 *   - persistence / oplog seq allocation (Track A Phase 2)
 *   - rate-limit decisions (backpressure.ts)
 * Callers wire those up and reach into this module for the reply step.
 *
 * Zero runtime dependencies. The `send` callback is injected so this file has
 * no coupling to the `ws` package — keeps the unit test surface trivial and
 * lets the gateway swap transports later if needed.
 */

// ---------------------------------------------------------------------------
// Wire format constants
// ---------------------------------------------------------------------------

/** Frame tag for a server → client ACK. */
export const FRAME_TAG_ACK = 0x02;

/** Frame tag for a server → client NACK. */
export const FRAME_TAG_NACK = 0x03;

/** Width of the opaque idempotency key, in bytes. */
export const UPDATE_ID_BYTES = 8;

/** Width of the ACK seq field, in bytes (unsigned 32-bit, big-endian). */
export const ACK_SEQ_BYTES = 4;

/** Width of the NACK reason field, in bytes (unsigned 8-bit). */
export const NACK_REASON_BYTES = 1;

/** Max entries retained in the per-connection idempotency cache. */
export const IDEMPOTENCY_CAP_PER_CONN = 1024;

// Total frame lengths (tag + payload). Exposed for decoder sanity checks.
export const ACK_FRAME_LEN = 1 + UPDATE_ID_BYTES + ACK_SEQ_BYTES;     // 13
export const NACK_FRAME_LEN = 1 + UPDATE_ID_BYTES + NACK_REASON_BYTES; // 10

// ---------------------------------------------------------------------------
// NACK reasons — keep numeric values stable; the client decodes by number.
// ---------------------------------------------------------------------------

export enum NackReason {
	/** Reserved / "no reason given". Should never appear on a real NACK. */
	OK = 0,
	/** Caller exceeded its per-connection or per-doc rate budget. */
	RATE_LIMITED = 1,
	/** Frame exceeded the gateway's max-frame-size guard. */
	FRAME_TOO_BIG = 2,
	/** Auth token expired mid-session; client must re-handshake. */
	AUTH_EXPIRED = 3,
	/** Doc is locked (e.g. archive / migration in progress). */
	DOC_LOCKED = 4,
	/** Unhandled server-side error; client should retry with backoff. */
	INTERNAL = 5,
}

/** Numeric reasons we are willing to put on the wire. */
const KNOWN_REASONS: ReadonlySet<number> = new Set([
	NackReason.OK,
	NackReason.RATE_LIMITED,
	NackReason.FRAME_TOO_BIG,
	NackReason.AUTH_EXPIRED,
	NackReason.DOC_LOCKED,
	NackReason.INTERNAL,
]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Minimal send signature accepted by `sendAck` / `sendNack`. Matches `ws`'s
 * `WebSocket.send(data, cb?)` but we keep the shape structural so this file
 * compiles with zero deps.
 */
export type WsSendFn = (
	data: Buffer,
	cb?: (err?: Error) => void,
) => void;

/**
 * Per-connection idempotency state. Owned by the connection handler — one
 * instance per WebSocket. The shape is intentionally a plain object so the
 * connection handler can attach it directly to the socket and let GC clean
 * up on close without an explicit dispose step.
 */
export interface ConnectionAckState {
	/** Insertion-ordered map of updateId hex → assigned seq. */
	readonly seen: Map<string, number>;
	/** Hard cap; defaults to {@link IDEMPOTENCY_CAP_PER_CONN}. */
	readonly cap: number;
}

// ---------------------------------------------------------------------------
// Factory + helpers for the per-connection cache
// ---------------------------------------------------------------------------

/**
 * Build a fresh per-connection ack state. Callers SHOULD attach the returned
 * object to their connection record and reuse it for the connection's
 * lifetime.
 *
 * @param cap  Optional override (mostly for tests). Defaults to 1024.
 */
export function createConnectionAckState(
	cap: number = IDEMPOTENCY_CAP_PER_CONN,
): ConnectionAckState {
	if (!Number.isFinite(cap) || cap < 1) {
		throw new RangeError(`ack cache cap must be >= 1, got ${cap}`);
	}
	return { seen: new Map(), cap: cap | 0 };
}

/**
 * Convert an 8-byte updateId buffer to a stable string key for the Map.
 * Using hex (16 chars) is faster than base64 here because `Buffer.toString`
 * has a fast path for hex on small buffers and we never put the key on the
 * wire — only the raw bytes go out.
 */
function keyOf(updateId: Buffer): string {
	if (updateId.length !== UPDATE_ID_BYTES) {
		throw new RangeError(
			`updateId must be ${UPDATE_ID_BYTES} bytes, got ${updateId.length}`,
		);
	}
	return updateId.toString('hex');
}

/**
 * Mark an updateId as seen on this connection.
 *
 * Returns `true` if this is the **first** time we've seen the id on this
 * connection (caller should proceed with persist + ACK), or `false` if we've
 * already acknowledged it (caller should re-send the previous ACK via
 * {@link getStoredSeq} — no re-persist).
 *
 * The LRU policy is the cheap "Map preserves insertion order, evict head on
 * overflow" pattern — O(1) amortised, no extra structure needed.
 */
export function markSeen(state: ConnectionAckState, updateId: Buffer): boolean {
	const key = keyOf(updateId);
	if (state.seen.has(key)) {
		// Refresh recency by re-inserting at the tail.
		const prior = state.seen.get(key)!;
		state.seen.delete(key);
		state.seen.set(key, prior);
		return false;
	}
	// First sighting — but we don't have a seq yet. Reserve the slot with a
	// sentinel; the caller must follow up with `recordSeq` once persistence
	// allocates the real seq. This two-step keeps us honest: a NACK path
	// must call `forgetSeen` so a retry isn't silently swallowed.
	state.seen.set(key, SEQ_PENDING);
	// LRU eviction
	if (state.seen.size > state.cap) {
		const oldest = state.seen.keys().next().value as string | undefined;
		if (oldest !== undefined) state.seen.delete(oldest);
	}
	return true;
}

/** Sentinel for "seen but no seq allocated yet". */
const SEQ_PENDING = -1;

/**
 * Bind an allocated seq to a previously-seen updateId. MUST be called once
 * persistence assigns the real seq, otherwise a duplicate frame on the same
 * connection will replay the pending sentinel.
 */
export function recordSeq(
	state: ConnectionAckState,
	updateId: Buffer,
	seq: number,
): void {
	if (!Number.isInteger(seq) || seq < 0 || seq > 0xff_ff_ff_ff) {
		throw new RangeError(`seq must be a u32, got ${seq}`);
	}
	state.seen.set(keyOf(updateId), seq);
}

/**
 * Drop an updateId from the cache. Use after a NACK so the client's retry
 * gets a fresh attempt rather than a stale duplicate ACK.
 */
export function forgetSeen(
	state: ConnectionAckState,
	updateId: Buffer,
): void {
	state.seen.delete(keyOf(updateId));
}

/**
 * Look up the seq previously assigned to an updateId on this connection.
 * Returns `undefined` if not seen, or `null` if seen but the seq hasn't been
 * allocated yet (caller MUST treat this as a transient — the original
 * handler is still in flight; the duplicate frame can be silently dropped).
 */
export function getStoredSeq(
	state: ConnectionAckState,
	updateId: Buffer,
): number | null | undefined {
	const v = state.seen.get(keyOf(updateId));
	if (v === undefined) return undefined;
	if (v === SEQ_PENDING) return null;
	return v;
}

// ---------------------------------------------------------------------------
// Wire encoders
// ---------------------------------------------------------------------------

/**
 * Encode an ACK frame. Exported for tests; production callers should use
 * {@link sendAck} which encodes + dispatches in one step.
 */
export function encodeAck(updateId: Buffer, seq: number): Buffer {
	if (updateId.length !== UPDATE_ID_BYTES) {
		throw new RangeError(
			`updateId must be ${UPDATE_ID_BYTES} bytes, got ${updateId.length}`,
		);
	}
	if (!Number.isInteger(seq) || seq < 0 || seq > 0xff_ff_ff_ff) {
		throw new RangeError(`seq must be a u32, got ${seq}`);
	}
	const out = Buffer.allocUnsafe(ACK_FRAME_LEN);
	out[0] = FRAME_TAG_ACK;
	updateId.copy(out, 1, 0, UPDATE_ID_BYTES);
	out.writeUInt32BE(seq >>> 0, 1 + UPDATE_ID_BYTES);
	return out;
}

/**
 * Encode a NACK frame. Exported for tests; production callers should use
 * {@link sendNack}.
 */
export function encodeNack(updateId: Buffer, reason: NackReason): Buffer {
	if (updateId.length !== UPDATE_ID_BYTES) {
		throw new RangeError(
			`updateId must be ${UPDATE_ID_BYTES} bytes, got ${updateId.length}`,
		);
	}
	if (!KNOWN_REASONS.has(reason)) {
		// Don't leak unknown numeric reasons onto the wire — collapse to
		// INTERNAL so the client has a defined branch.
		reason = NackReason.INTERNAL;
	}
	const out = Buffer.allocUnsafe(NACK_FRAME_LEN);
	out[0] = FRAME_TAG_NACK;
	updateId.copy(out, 1, 0, UPDATE_ID_BYTES);
	out[1 + UPDATE_ID_BYTES] = reason & 0xff;
	return out;
}

// ---------------------------------------------------------------------------
// Public send helpers
// ---------------------------------------------------------------------------

/**
 * Encode + send an ACK on the given socket. `send` is the injected transport
 * callback (typically `ws.send.bind(ws)`).
 */
export function sendAck(
	send: WsSendFn,
	updateId: Buffer,
	seq: number,
): void {
	send(encodeAck(updateId, seq));
}

/**
 * Encode + send a NACK on the given socket.
 */
export function sendNack(
	send: WsSendFn,
	updateId: Buffer,
	reason: NackReason,
): void {
	send(encodeNack(updateId, reason));
}
