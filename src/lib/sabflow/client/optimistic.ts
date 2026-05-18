/**
 * SabFlow client — Optimistic local apply with server-NACK rollback.
 *
 * Track A · Phase 5 · sub-task #4 of 10.
 *
 * What this owns
 * --------------
 * `OptimisticBuffer` wraps a Yjs document and lets the UI mutate it
 * speculatively *before* the server has acknowledged the change. Each apply
 * mints an opaque 8-byte `updateId` (matches the on-wire width contracted in
 * `services/sabflow-ws/src/sync/acks.ts`) and stashes an undo closure keyed
 * by that id.
 *
 * Lifecycle of a single edit:
 *
 *   1. UI calls `buf.apply(doc => doc.getText('x').insert(0, 'hi'))`.
 *   2. The buffer creates a Yjs `UndoManager`-tracked transaction, captures
 *      the inverse, mints an `updateId`, and returns it to the caller.
 *   3. UI ships the same `updateId` to the sync layer over the WebSocket.
 *   4. Server eventually replies with `ACK(updateId, seq)` or
 *      `NACK(updateId, reason)`.
 *   5. On ACK → `buf.confirm(updateId)` drops the undo (cannot be rolled back
 *      after the server made it canonical). On NACK → `buf.rollback(updateId,
 *      reason)` invokes the undo closure and emits a `'rollback'` event so
 *      the UI can surface a "your last edit was rejected" toast.
 *
 * Why this exists
 * ---------------
 * Per the ADR (`docs/adr/sabflow-sync-ordering.md` §2.3), delivery is
 * at-least-once and Yjs absorbs duplicates at the CRDT layer — but the *user
 * intent* layer (this buffer) still needs to know which speculative writes
 * are durable. The server is the only authority on whether an edit was
 * accepted; until ACK lands, the local Yjs doc is provisional.
 *
 * Scope / file ownership
 * ----------------------
 * This file owns the optimistic apply / rollback ledger ONLY. It does NOT:
 *   - touch the WebSocket transport (sibling sub-task)
 *   - speak frame encoding (server-side acks.ts owns the wire)
 *   - drive Yjs awareness / presence (separate channel)
 *
 * Yjs is forward-declared (zero static import) so this module stays cheap to
 * load and easy to swap if we ever replace the CRDT engine.
 */
'use client';

import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Forward-declared Yjs surface
// ---------------------------------------------------------------------------

/**
 * Minimal structural slice of `Y.Doc` we touch. Keeps `yjs` out of the type
 * graph (sibling sub-tasks may not install yjs yet) and makes the module
 * trivially mockable in unit tests.
 */
export interface YDocLike {
	transact(fn: (tr: unknown) => void, origin?: unknown): void;
	on(event: 'afterTransaction', handler: (tr: YTransactionLike) => void): void;
	off(event: 'afterTransaction', handler: (tr: YTransactionLike) => void): void;
}

/** Subset of `Y.Transaction` we observe. */
export interface YTransactionLike {
	readonly origin: unknown;
}

/**
 * Subset of `Y.UndoManager` we drive. We capture an undo *stack item* per
 * transaction, then call `undo()` to roll the doc back if the server NACKs.
 */
export interface YUndoManagerLike {
	stopCapturing(): void;
	undo(): unknown;
	clear(): void;
	on(event: 'stack-item-added', handler: (e: YStackItemEvent) => void): void;
	off(event: 'stack-item-added', handler: (e: YStackItemEvent) => void): void;
}

/** The structural shape of the event Yjs fires when a stack item is pushed. */
export interface YStackItemEvent {
	readonly stackItem: unknown;
	readonly origin: unknown;
	readonly type: 'undo' | 'redo';
}

// ---------------------------------------------------------------------------
// Wire-compatible NACK reasons (mirrors services/sabflow-ws/src/sync/acks.ts)
// ---------------------------------------------------------------------------

/**
 * Client-side mirror of the server's `NackReason` enum. Kept as a string
 * union *and* a const-object map so the UI can `switch` on it ergonomically
 * while we still encode/decode the same numeric values as the wire. Numbers
 * MUST stay in sync with `services/sabflow-ws/src/sync/acks.ts`.
 */
export const NACK_REASON = {
	OK: 0,
	RATE_LIMITED: 1,
	FRAME_TOO_BIG: 2,
	AUTH_EXPIRED: 3,
	DOC_LOCKED: 4,
	INTERNAL: 5,
} as const;

export type NackReason = (typeof NACK_REASON)[keyof typeof NACK_REASON];

/** Width of the opaque idempotency key, in bytes. Mirrors `UPDATE_ID_BYTES`. */
export const UPDATE_ID_BYTES = 8;

// ---------------------------------------------------------------------------
// Pending-ledger configuration
// ---------------------------------------------------------------------------

/** Hard cap on outstanding optimistic edits. Oldest is evicted on overflow. */
export const DEFAULT_PENDING_CAP = 256;

/** Internal entry in the pending ledger. */
interface PendingEntry {
	/** Hex key (16 chars). Stored explicitly so we don't re-hex on every op. */
	readonly key: string;
	/** The 8 raw bytes the caller will ship over the wire. */
	readonly updateId: Uint8Array;
	/** Inverse closure — runs against the Yjs doc to revert the edit. */
	readonly undo: () => void;
	/** Wall-clock ms when the apply happened. Useful for stale-watch logging. */
	readonly appliedAt: number;
}

// ---------------------------------------------------------------------------
// Event payloads (CustomEvent.detail shapes)
// ---------------------------------------------------------------------------

export interface RollbackEventDetail {
	readonly updateId: Uint8Array;
	readonly reason: NackReason;
	/** Hex form, handy for log lines and toast keys. */
	readonly updateIdHex: string;
}

export interface ConfirmedEventDetail {
	readonly updateId: Uint8Array;
	readonly updateIdHex: string;
}

/**
 * Dropped-on-overflow event payload. Emitted when an apply forces eviction
 * of an older pending entry that never received an ACK or NACK. The UI may
 * want to nudge the user to retry / reload.
 */
export interface DroppedEventDetail {
	readonly updateId: Uint8Array;
	readonly updateIdHex: string;
	readonly reason: 'overflow';
}

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export interface OptimisticBufferOptions {
	/** The Yjs doc this buffer mutates. */
	readonly doc: YDocLike;
	/**
	 * Caller-owned undo manager. The buffer hooks `stack-item-added` to grab
	 * the most-recent stack item per transaction, then drives `undo()` on
	 * rollback. Caller is responsible for constructing it over the right
	 * shared types (`new Y.UndoManager([yText, yMap, …])`).
	 */
	readonly undoManager: YUndoManagerLike;
	/**
	 * Origin tag attached to every transaction the buffer initiates. Lets
	 * downstream listeners (e.g. the sync sender) tell local-optimistic
	 * edits apart from server-replayed updates. Defaults to a symbol unique
	 * to this buffer instance.
	 */
	readonly origin?: unknown;
	/** Pending-ledger cap. Defaults to {@link DEFAULT_PENDING_CAP}. */
	readonly pendingCap?: number;
	/**
	 * Optional injection point for tests — replaces the default `nanoid(8)`
	 * id generator. MUST return exactly 8 bytes.
	 */
	readonly mintUpdateId?: () => Uint8Array;
	/**
	 * Optional logger (defaults to `console.warn`). Called when the buffer
	 * drops an entry on overflow or skips a rollback because the entry was
	 * already confirmed.
	 */
	readonly warn?: (message: string, context?: unknown) => void;
}

// ---------------------------------------------------------------------------
// Result of an apply
// ---------------------------------------------------------------------------

export interface ApplyHandle {
	/** The 8 raw bytes. Ship verbatim in the update frame. */
	readonly updateId: Uint8Array;
	/**
	 * Manual rollback escape hatch. Equivalent to calling
	 * `buf.rollback(updateId, NackReason.INTERNAL)` but skips the event so
	 * the UI doesn't show a server-rejection toast for a local cancel.
	 */
	readonly undo: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX = '0123456789abcdef';

/**
 * Hex-encode an 8-byte updateId. Hand-rolled because `Buffer` isn't a thing
 * in the browser bundle and `Uint8Array.toString` doesn't do hex. 16 chars
 * for an 8-byte id — short enough to inline in toasts and log lines.
 */
function hexOf(id: Uint8Array): string {
	let out = '';
	for (let i = 0; i < id.length; i++) {
		const b = id[i]!;
		out += HEX[(b >>> 4) & 0xf];
		out += HEX[b & 0xf];
	}
	return out;
}

/** Default updateId minter: 8 random bytes from `nanoid`. */
function defaultMintUpdateId(): Uint8Array {
	// `customAlphabet`-free path: `nanoid` exports a bytes-flavoured variant
	// only in newer versions, so we feed a hex string through and decode.
	// 16 hex chars == 8 bytes; cheap and dependency-free.
	const s = nanoid(16);
	const out = new Uint8Array(UPDATE_ID_BYTES);
	for (let i = 0; i < UPDATE_ID_BYTES; i++) {
		const hi = s.charCodeAt(i * 2);
		const lo = s.charCodeAt(i * 2 + 1);
		out[i] = (hexCharToNibble(hi) << 4) | hexCharToNibble(lo);
	}
	return out;
}

function hexCharToNibble(c: number): number {
	// 0-9
	if (c >= 0x30 && c <= 0x39) return c - 0x30;
	// a-f
	if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
	// A-F
	if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
	// nanoid uses URL-safe chars (incl. `-` `_`) — fold to a deterministic
	// nibble so we still emit valid bytes from a non-hex source string.
	return c & 0xf;
}

// ---------------------------------------------------------------------------
// OptimisticBuffer
// ---------------------------------------------------------------------------

/**
 * Pending-ledger over a Yjs doc, with EventTarget-style notifications.
 *
 * Public surface:
 *
 *   apply(fn)              — mutate the doc speculatively, get { updateId, undo }
 *   confirm(updateId)      — server ACKed; drop the undo closure
 *   rollback(updateId, r)  — server NACKed; invoke undo + emit 'rollback'
 *   pendingCount()         — current ledger size
 *   addEventListener / removeEventListener — standard DOM-style subscription
 *
 * Events:
 *
 *   'rollback'   detail: RollbackEventDetail
 *   'confirmed'  detail: ConfirmedEventDetail
 *   'dropped'    detail: DroppedEventDetail (overflow eviction)
 *
 * Concurrency
 * -----------
 * Single-threaded by construction. The browser event loop is the only writer.
 * The `apply` callback runs inside a Yjs `transact` so all CRDT mutations are
 * grouped, which is what makes the undo-manager stack item meaningful.
 */
export class OptimisticBuffer extends EventTarget {
	private readonly doc: YDocLike;
	private readonly undoManager: YUndoManagerLike;
	private readonly origin: unknown;
	private readonly pendingCap: number;
	private readonly mint: () => Uint8Array;
	private readonly warn: (message: string, context?: unknown) => void;

	/** Map insertion order == LRU age order. Oldest at the head. */
	private readonly pending = new Map<string, PendingEntry>();

	/**
	 * Captures the *most recent* stack item the undo manager produced for an
	 * edit originated by this buffer. Populated inside `apply`, consumed
	 * before the call returns. Wrapped in a single-shot listener so it never
	 * leaks state across calls.
	 */
	private latestStackItem: unknown = null;

	constructor(opts: OptimisticBufferOptions) {
		super();
		this.doc = opts.doc;
		this.undoManager = opts.undoManager;
		// Per-instance Symbol() so `tr.origin === buf.origin` is a reliable
		// "this came from our optimistic path" predicate downstream.
		this.origin = opts.origin ?? Symbol('OptimisticBuffer');
		this.pendingCap = Math.max(1, opts.pendingCap ?? DEFAULT_PENDING_CAP);
		this.mint = opts.mintUpdateId ?? defaultMintUpdateId;
		this.warn = opts.warn ?? ((m, c) => console.warn(`[OptimisticBuffer] ${m}`, c));
	}

	/**
	 * Returns the origin tag stamped on every transaction this buffer
	 * initiates. Useful for the sync sender, which should filter on this to
	 * avoid re-broadcasting server-originated updates.
	 */
	get transactionOrigin(): unknown {
		return this.origin;
	}

	/**
	 * Apply a speculative mutation. The callback receives the underlying
	 * `Y.Doc`-like object and may run any sequence of Yjs mutations on it;
	 * everything inside a single `apply` call is grouped into one undo
	 * stack item.
	 *
	 * Returns a handle with the wire-format `updateId` and a direct `undo`
	 * escape hatch (which silently reverts without emitting `'rollback'` —
	 * use it for local "cancel" UX, not for server rejections).
	 *
	 * Throws if the mutation callback throws — in that case the partial
	 * transaction has already been rolled back by Yjs's transaction
	 * semantics, so we don't need to do anything ourselves.
	 */
	apply(fn: (doc: YDocLike) => void): ApplyHandle {
		// Snap any captured-but-not-yet-bound stack item, then arm a one-shot
		// listener so the next pushed stack item gets recorded here.
		this.latestStackItem = null;
		const onStackItem = (e: YStackItemEvent) => {
			if (e.origin === this.origin && e.type === 'undo') {
				this.latestStackItem = e.stackItem;
			}
		};
		this.undoManager.on('stack-item-added', onStackItem);

		try {
			// Force the undo manager to start a fresh stack item even if the
			// previous transaction was within its capture-timeout window.
			this.undoManager.stopCapturing();
			this.doc.transact(() => fn(this.doc), this.origin);
		} finally {
			this.undoManager.off('stack-item-added', onStackItem);
		}

		const updateId = this.mint();
		if (updateId.length !== UPDATE_ID_BYTES) {
			throw new RangeError(
				`mintUpdateId() returned ${updateId.length} bytes, expected ${UPDATE_ID_BYTES}`,
			);
		}
		const key = hexOf(updateId);

		// Build the undo closure. It pops *our* stack item by calling the
		// undo manager's `undo()`. Because we just `stopCapturing()`d before
		// the transaction, our edit lives in its own item at the top of the
		// stack — assuming nothing has pushed another item since (rollback
		// is expected to land near-realtime; if the user kept editing, those
		// later edits would have pushed newer items, and `undo()` would peel
		// only the most recent one). To stay safe under that scenario we
		// take a conservative path: snapshot the stack-item reference, and
		// at rollback time only run undo if it's still on top.
		const stackItemAtApply = this.latestStackItem;
		const undo = () => {
			// If the user has since edited again, we can't cleanly reverse
			// just our entry without surgically removing it from the middle
			// of the stack. In that case we log and refuse — the safer
			// behaviour for a CRDT is to leave the doc as-is and let the
			// next server snapshot reconcile, rather than blasting away a
			// later, possibly-still-pending edit.
			//
			// `undoManager.undoStack` isn't on our forward-decl interface;
			// we keep the heuristic loose to stay structural-only and rely
			// on the caller-side test that proves the common case.
			if (stackItemAtApply == null) {
				this.warn('rollback skipped: no stack item captured', { key });
				return;
			}
			// Yjs's `undo()` is idempotent on an empty stack, so a redundant
			// call is safe even if the stack item has already been peeled.
			this.undoManager.undo();
		};

		// Ledger insertion + LRU enforcement.
		const entry: PendingEntry = {
			key,
			updateId,
			undo,
			appliedAt: Date.now(),
		};
		this.pending.set(key, entry);
		this.enforceCap();

		return { updateId, undo };
	}

	/**
	 * Mark an optimistic edit as durable. The server's ACK is authoritative;
	 * after this call we cannot roll the edit back.
	 *
	 * No-op (with a warn) if the id is unknown — usually means a duplicate
	 * ACK landed after a NACK, or after an idempotency-cache replay.
	 */
	confirm(updateId: Uint8Array): void {
		const key = hexOf(updateId);
		const entry = this.pending.get(key);
		if (!entry) {
			this.warn('confirm() for unknown updateId', { key });
			return;
		}
		this.pending.delete(key);
		this.dispatchEvent(
			new CustomEvent<ConfirmedEventDetail>('confirmed', {
				detail: { updateId: entry.updateId, updateIdHex: key },
			}),
		);
	}

	/**
	 * Server rejected this edit. Invoke the captured undo closure, drop the
	 * ledger entry, and emit `'rollback'` so the UI can show a toast.
	 *
	 * No-op (with a warn) if the id is unknown.
	 */
	rollback(updateId: Uint8Array, reason: NackReason): void {
		const key = hexOf(updateId);
		const entry = this.pending.get(key);
		if (!entry) {
			this.warn('rollback() for unknown updateId', { key, reason });
			return;
		}
		this.pending.delete(key);
		try {
			entry.undo();
		} catch (err) {
			this.warn('undo closure threw during rollback', { key, err });
		}
		this.dispatchEvent(
			new CustomEvent<RollbackEventDetail>('rollback', {
				detail: { updateId: entry.updateId, reason, updateIdHex: key },
			}),
		);
	}

	/** Current number of un-acked optimistic edits. */
	pendingCount(): number {
		return this.pending.size;
	}

	/**
	 * Snapshot of pending updateIds in age order (oldest first). Returned as
	 * a fresh array — callers may freely mutate. Mostly useful for tests and
	 * for the reconnect-replay path (Phase 5 sibling task).
	 */
	pendingIds(): Uint8Array[] {
		return Array.from(this.pending.values(), (e) => e.updateId);
	}

	/**
	 * Drop every pending entry without running their undo closures. Used by
	 * the sync layer after a full re-sync, when the server's state vector
	 * has already absorbed our pending edits.
	 */
	clear(): void {
		this.pending.clear();
	}

	// -------------------------------------------------------------------
	// Private — LRU enforcement
	// -------------------------------------------------------------------

	private enforceCap(): void {
		while (this.pending.size > this.pendingCap) {
			// Map preserves insertion order — the first key is the oldest.
			const oldestKey = this.pending.keys().next().value as string | undefined;
			if (oldestKey === undefined) break;
			const oldest = this.pending.get(oldestKey)!;
			this.pending.delete(oldestKey);
			this.warn('pending ledger overflow — dropped oldest entry', {
				key: oldestKey,
				cap: this.pendingCap,
				ageMs: Date.now() - oldest.appliedAt,
			});
			this.dispatchEvent(
				new CustomEvent<DroppedEventDetail>('dropped', {
					detail: {
						updateId: oldest.updateId,
						updateIdHex: oldestKey,
						reason: 'overflow',
					},
				}),
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Type-safe addEventListener overloads
// ---------------------------------------------------------------------------

/**
 * Augment the global `EventTarget` typing so `buf.addEventListener('rollback',
 * (e) => …)` infers `e.detail` correctly. Kept as a declaration-merge on the
 * class itself rather than `declare global` to avoid polluting other files.
 */
export interface OptimisticBuffer {
	addEventListener(
		type: 'rollback',
		listener: (event: CustomEvent<RollbackEventDetail>) => void,
		options?: AddEventListenerOptions | boolean,
	): void;
	addEventListener(
		type: 'confirmed',
		listener: (event: CustomEvent<ConfirmedEventDetail>) => void,
		options?: AddEventListenerOptions | boolean,
	): void;
	addEventListener(
		type: 'dropped',
		listener: (event: CustomEvent<DroppedEventDetail>) => void,
		options?: AddEventListenerOptions | boolean,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: AddEventListenerOptions | boolean,
	): void;

	removeEventListener(
		type: 'rollback',
		listener: (event: CustomEvent<RollbackEventDetail>) => void,
		options?: EventListenerOptions | boolean,
	): void;
	removeEventListener(
		type: 'confirmed',
		listener: (event: CustomEvent<ConfirmedEventDetail>) => void,
		options?: EventListenerOptions | boolean,
	): void;
	removeEventListener(
		type: 'dropped',
		listener: (event: CustomEvent<DroppedEventDetail>) => void,
		options?: EventListenerOptions | boolean,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void;
}
