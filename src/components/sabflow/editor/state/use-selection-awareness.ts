'use client';

/**
 * SabFlow editor — `useSelectionAwareness` React hook.
 *
 * Track A · Phase 6 · sub-task #5 of 10.
 *
 * What this owns
 * --------------
 * The collaborative "who has which block selected" wire. Each peer
 * broadcasts the set of block ids they've highlighted in the local editor;
 * the hook materializes those sets so React can paint outlines/halos using
 * each peer's identity color.
 *
 * Wiring (read in pairs with sub-task #4's `usePresence`)
 * -------------------------------------------------------
 *   - WRITE path: callers fire `setSelection(next)` whenever the local
 *     selection changes (single-click, marquee, keyboard nav). We coalesce
 *     bursts through a 50 ms debounce — fat-finger marquee drags don't melt
 *     awareness fan-out — then push exactly one `presence.setLocal({
 *     selection: { nodeIds } })`.
 *   - READ path: every render we walk `presence.peers` and project the
 *     `selection.nodeIds` field into a `Map<userId, Set<blockId>>`. We
 *     memoize so reference identity is stable across renders where no peer
 *     actually changed (cheap === check + Set rebuild only on diff).
 *   - SELF-CLEAR: if the browser window has been blurred for >60 s we drop
 *     the local selection so peers' "stale halo" doesn't linger across a
 *     long context switch. Re-focus is a no-op — the next real `setSelection`
 *     re-broadcasts. (Distinct from the 30 s idle marker `usePresence`
 *     already manages: that flags the *user*, this clears the *selection*.)
 *
 * File ownership (per the brief)
 * ------------------------------
 * This file is the ONLY one in sub-task #5. It does NOT:
 *   - render selection halos (presentational sub-task, separate file)
 *   - drive the canvas selection store (block-tree state owns that)
 *   - reach into Yjs or awareness directly — everything flows through the
 *     `presence` object the caller passes us.
 *
 * Why forward-declared shapes
 * ---------------------------
 * Mirroring `usePresence` itself: we structurally type the bits of
 * `PresenceState` and the presence-hook result we consume so this hook
 * compiles regardless of whether the consumer wires us to the Yjs-backed
 * `src/lib/sabflow/client/usePresence` or the polling-backed
 * `src/components/sabflow/presence/usePresence`. Both publish a
 * `selection.nodeIds: string[]` shape, so the projection is identical.
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

// ---------------------------------------------------------------------------
// Forward-declared presence surface
// ---------------------------------------------------------------------------

/**
 * Structural slice of a presence entry we read from. Matches the shape
 * published by both presence implementations in the tree — `userId` plus
 * an optional `selection.nodeIds` array. Anything else (color, cursor,
 * lastSeen) is ignored here; downstream halo paint owns identity rendering.
 */
export interface PresenceStateLike {
	readonly userId: string;
	readonly selection?: { readonly nodeIds: readonly string[] } | null;
}

/**
 * Structural slice of `usePresence`'s return value we drive. We only need
 * the peer map (keyed by whatever id type the transport uses — typically a
 * numeric Yjs clientID or a string user id) and `setLocal`.
 *
 * We accept the patch as `unknown`-shaped to keep this hook decoupled from
 * the concrete `PresencePatch` union — the only field we ever set here is
 * `selection`, which both implementations honor.
 */
export interface PresenceHandleLike<PeerKey = unknown> {
	readonly peers: ReadonlyMap<PeerKey, PresenceStateLike>;
	readonly setLocal: (patch: {
		selection: { nodeIds: string[] } | null;
	}) => void;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseSelectionAwarenessOptions<PeerKey = unknown> {
	/**
	 * Y.Doc handle the editor is wired to. Reserved for a future bind to
	 * `doc.on('beforeTransaction')` so that local selections survive
	 * round-tripped block-id renames. For now the hook only inspects its
	 * identity to invalidate the local-selection ref on doc swap.
	 */
	readonly doc: { readonly clientID?: number } | null | undefined;
	/** The full object returned by `usePresence`. */
	readonly presence: PresenceHandleLike<PeerKey>;
	/**
	 * Debounce window for outgoing broadcasts in ms. Defaults to
	 * {@link DEFAULT_DEBOUNCE_MS} (50 ms) per the brief — short enough to
	 * feel "live", long enough to coalesce marquee-drag bursts.
	 */
	readonly debounceMs?: number;
	/**
	 * Window-blur self-clear threshold in ms. Defaults to
	 * {@link DEFAULT_BLUR_CLEAR_MS} (60 s) per the brief.
	 */
	readonly blurClearMs?: number;
}

export interface UseSelectionAwarenessResult<PeerKey = unknown> {
	/** Stable Set of block ids the local user has selected. */
	readonly localSelection: ReadonlySet<string>;
	/** Live map of remote peers' selections, keyed by `PresenceState.userId`. */
	readonly peerSelections: ReadonlyMap<string, ReadonlySet<string>>;
	/** Replace the local selection. Triggers a debounced broadcast. */
	readonly setSelection: (next: ReadonlySet<string> | Iterable<string>) => void;
	/**
	 * Force-flush any pending debounced broadcast immediately. Exposed for
	 * "blur before debounce fires" callers (e.g. tab close, save) and tests.
	 */
	readonly flush: () => void;
	/** Convenience pass-through used by some peer-aware UIs. */
	readonly peerKeys: ReadonlyArray<PeerKey>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce window (ms) for outbound selection broadcasts. */
export const DEFAULT_DEBOUNCE_MS = 50;

/** Window-blur threshold (ms) before we self-clear the local selection. */
export const DEFAULT_BLUR_CLEAR_MS = 60_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * `true` iff `a` and `b` contain exactly the same string members. Order-
 * independent. Cheap fast-path on size mismatch, then a single membership
 * walk. Kept module-local — the React tree should never need to call this.
 */
function setEquals(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
	if (a === b) return true;
	if (a.size !== b.size) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
}

/**
 * Build a {@link Set} from a `selection.nodeIds` array, treating
 * null/undefined as the empty set. We sort-of-trust the array but defensively
 * skip non-strings so a malformed peer frame can't poison React state.
 */
function readNodeIds(
	selection: PresenceStateLike['selection'],
): Set<string> {
	const out = new Set<string>();
	if (!selection || !Array.isArray(selection.nodeIds)) return out;
	for (const id of selection.nodeIds) {
		if (typeof id === 'string' && id.length > 0) out.add(id);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wire a per-user, debounced selection-awareness channel on top of an
 * existing presence handle.
 *
 * @param options.doc         Editor Y.Doc (or null while loading).
 * @param options.presence    Result of `usePresence(...)` from sub-task #4.
 * @param options.debounceMs  Outbound broadcast debounce window.
 * @param options.blurClearMs Window-blur self-clear threshold.
 */
export function useSelectionAwareness<PeerKey = unknown>(
	options: UseSelectionAwarenessOptions<PeerKey>,
): UseSelectionAwarenessResult<PeerKey> {
	const {
		doc,
		presence,
		debounceMs = DEFAULT_DEBOUNCE_MS,
		blurClearMs = DEFAULT_BLUR_CLEAR_MS,
	} = options;

	// ------------------------------------------------------------------
	// Local selection — react state + ref shadow
	// ------------------------------------------------------------------
	// We hold the canonical Set in state so consumers re-render when it
	// changes, and a shadow ref so the debounced flusher reads the *latest*
	// value (not the one captured at schedule-time). The pair keeps writes
	// O(1) and reads reference-stable across no-op `setSelection` calls.
	const [localSelection, setLocalSelectionState] = useState<ReadonlySet<string>>(
		() => new Set<string>(),
	);
	const localSelectionRef = useRef<ReadonlySet<string>>(localSelection);
	localSelectionRef.current = localSelection;

	// Latest presence handle — captured in a ref so timers fired after a
	// re-render still hit the current `setLocal`. (Functional ident otherwise
	// would force us to add `presence` to every effect dep.)
	const setLocalRef = useRef(presence.setLocal);
	setLocalRef.current = presence.setLocal;

	// Debounce bookkeeping
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingPayloadRef = useRef<{ nodeIds: string[] } | null>(null);

	// Window-blur bookkeeping — self-clear if user wanders off too long.
	const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ------------------------------------------------------------------
	// Flush: actually push the pending payload to presence.setLocal
	// ------------------------------------------------------------------

	const flush = useCallback(() => {
		if (debounceTimerRef.current !== null) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		const payload = pendingPayloadRef.current;
		pendingPayloadRef.current = null;
		if (!payload) return;
		try {
			// Empty selection broadcasts as `null` so peers' UIs can cheaply
			// distinguish "no selection" from "selected zero blocks". Matches
			// how `usePresence` itself stores `selection: null` at init.
			setLocalRef.current({
				selection: payload.nodeIds.length === 0 ? null : payload,
			});
		} catch {
			// Swallow — a destroyed awareness or a torn-down provider should
			// never propagate into render. Next setSelection will retry.
		}
	}, []);

	// ------------------------------------------------------------------
	// setSelection: the public write-path
	// ------------------------------------------------------------------

	const setSelection = useCallback(
		(next: ReadonlySet<string> | Iterable<string>) => {
			// Normalize: accept any iterable so callers can pass arrays,
			// Sets, or generators without an extra `new Set(...)` ceremony.
			const nextSet =
				next instanceof Set
					? (next as ReadonlySet<string>)
					: new Set<string>(next);

			// Cheap identity short-circuit: if nothing actually changed,
			// don't touch state, don't reschedule the debounce. Keeps React
			// re-renders proportional to *real* selection churn.
			if (setEquals(localSelectionRef.current, nextSet)) return;

			localSelectionRef.current = nextSet;
			setLocalSelectionState(nextSet);

			// Schedule broadcast. We sort the ids before serializing so the
			// wire payload is order-stable — peers' equality checks then
			// don't fire on cosmetic reorderings.
			const sorted: string[] = [];
			for (const id of nextSet) sorted.push(id);
			sorted.sort();
			pendingPayloadRef.current = { nodeIds: sorted };

			if (debounceTimerRef.current !== null) {
				clearTimeout(debounceTimerRef.current);
			}
			debounceTimerRef.current = setTimeout(flush, debounceMs);
		},
		[debounceMs, flush],
	);

	// ------------------------------------------------------------------
	// Window-blur self-clear
	// ------------------------------------------------------------------
	// Per the brief: if the window stays blurred >60 s, drop our selection
	// so peers' halos don't paint stale state across long context switches.
	// Re-focus simply cancels the pending timer — no auto-restore (we don't
	// know what the user *currently* has selected once they come back).

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const armBlurTimer = () => {
			if (blurTimerRef.current !== null) clearTimeout(blurTimerRef.current);
			blurTimerRef.current = setTimeout(() => {
				// Only clear if there's actually something to clear — avoids a
				// noisy `setLocal(null)` on every blur of an empty editor.
				if (localSelectionRef.current.size === 0) return;
				const empty: ReadonlySet<string> = new Set<string>();
				localSelectionRef.current = empty;
				setLocalSelectionState(empty);
				pendingPayloadRef.current = { nodeIds: [] };
				flush();
			}, blurClearMs);
		};

		const cancelBlurTimer = () => {
			if (blurTimerRef.current !== null) {
				clearTimeout(blurTimerRef.current);
				blurTimerRef.current = null;
			}
		};

		const onBlur = () => armBlurTimer();
		const onFocus = () => cancelBlurTimer();

		window.addEventListener('blur', onBlur);
		window.addEventListener('focus', onFocus);
		// If the hook mounts while the tab is already backgrounded, arm now
		// so we don't need the user to blur-then-focus to start the timer.
		if (typeof document !== 'undefined' && document.hidden) armBlurTimer();

		return () => {
			window.removeEventListener('blur', onBlur);
			window.removeEventListener('focus', onFocus);
			cancelBlurTimer();
		};
	}, [blurClearMs, flush]);

	// ------------------------------------------------------------------
	// Doc-swap reset
	// ------------------------------------------------------------------
	// If the underlying Y.Doc is swapped out (e.g. user navigates to a new
	// flow) the previous selection no longer references valid block ids.
	// Drop local state — peers on the OLD doc will see the empty broadcast
	// via the flush in unmount, peers on the NEW doc see an empty start.

	const docKey = doc?.clientID ?? null;
	const lastDocKeyRef = useRef<number | null>(docKey);
	useEffect(() => {
		if (lastDocKeyRef.current === docKey) return;
		lastDocKeyRef.current = docKey;
		if (localSelectionRef.current.size === 0) return;
		const empty: ReadonlySet<string> = new Set<string>();
		localSelectionRef.current = empty;
		setLocalSelectionState(empty);
		pendingPayloadRef.current = { nodeIds: [] };
		flush();
	}, [docKey, flush]);

	// ------------------------------------------------------------------
	// Unmount: flush any pending broadcast so peers don't see stale state
	// ------------------------------------------------------------------

	useEffect(() => {
		return () => {
			// Best-effort flush; presence.setLocal may already be torn down
			// — the try/catch in `flush` covers that.
			if (debounceTimerRef.current !== null) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
				if (pendingPayloadRef.current) flush();
			}
		};
	}, [flush]);

	// ------------------------------------------------------------------
	// Peer projection — memoized for reference stability
	// ------------------------------------------------------------------
	// We rebuild only when:
	//   - the peer map identity changes (usePresence rebuilds on every
	//     awareness change — that's our trigger), OR
	//   - the previous projection's contents differ from the new one.
	//
	// When contents are equal we return the *previous* Map reference so
	// downstream `useMemo`/`React.memo` consumers don't re-run on noise.

	const previousProjectionRef = useRef<{
		map: ReadonlyMap<string, ReadonlySet<string>>;
		keys: ReadonlyArray<PeerKey>;
	}>({ map: new Map(), keys: [] });

	const projection = useMemo(() => {
		const nextMap = new Map<string, ReadonlySet<string>>();
		const nextKeys: PeerKey[] = [];
		for (const [key, state] of presence.peers) {
			nextKeys.push(key);
			if (!state || typeof state.userId !== 'string') continue;
			const ids = readNodeIds(state.selection);
			// Last-write-wins if two peers report the same userId — that can
			// happen briefly during a reconnect where the old session lingers
			// until awareness GC. The Phase 1 contract names that benign.
			nextMap.set(state.userId, ids);
		}

		// Reference-stability check: same keyset, same per-key Set contents
		// => return the prior map. Cheap O(N) walk; N ~ peer count (<50).
		const prev = previousProjectionRef.current.map;
		let same = prev.size === nextMap.size;
		if (same) {
			for (const [userId, ids] of nextMap) {
				const prior = prev.get(userId);
				if (!prior || !setEquals(prior, ids)) {
					same = false;
					break;
				}
			}
		}
		if (same) return previousProjectionRef.current;

		const snapshot = {
			map: nextMap as ReadonlyMap<string, ReadonlySet<string>>,
			keys: nextKeys as ReadonlyArray<PeerKey>,
		};
		previousProjectionRef.current = snapshot;
		return snapshot;
	}, [presence.peers]);

	// ------------------------------------------------------------------
	// Result
	// ------------------------------------------------------------------

	return useMemo(
		() => ({
			localSelection,
			peerSelections: projection.map,
			setSelection,
			flush,
			peerKeys: projection.keys,
		}),
		[localSelection, projection, setSelection, flush],
	);
}
