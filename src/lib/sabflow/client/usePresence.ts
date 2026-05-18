/**
 * SabFlow client — `usePresence` React hook.
 *
 * Track A · Phase 5 · sub-task #2 of 10.
 *
 * What this owns
 * --------------
 * Binds a Yjs awareness channel (per the `y-protocols/awareness` `Awareness`
 * class) to a Y.Doc returned by the sibling `useSabFlowDoc` hook (sub-task
 * #1). Exposes the *local* user's presence state plus a live `Map` of every
 * remote peer's state. The hook does NOT pick a transport — sub-task #3
 * (`<SabFlowProvider>`) wires the awareness instance into the WS gateway.
 *
 * Lifecycle
 * ---------
 *   1. Mount: construct an `Awareness(doc)`, seed local state from
 *      `localUser`, subscribe to `'change'` to keep `peers` fresh.
 *   2. Identity hot-update: if the caller passes a new `name` or `color`,
 *      we patch the awareness state in-place (no remount, no flap).
 *   3. Idle detection: a 30 s timer arms after every `setLocal` call;
 *      firing it stamps `idleSince = Date.now()`. Window `focus` (and any
 *      subsequent `setLocal`) clears it.
 *   4. Unmount: `awareness.destroy()` — that emits the standard
 *      "client gone" awareness diff so peers' maps shed our entry.
 *
 * Why a *forward-declared* awareness type
 * ---------------------------------------
 * Same pattern as the sibling `optimistic.ts` and `undo-redo.ts` files in
 * this directory: we keep `yjs` and `y-protocols` out of the static type
 * graph so this module compiles even before those deps are installed in
 * `package.json`. The Provider sub-task is the ONE place that imports the
 * concrete `Awareness` constructor and hands the instance to us via the
 * `awarenessFactory` option (default factory dynamically imports
 * `y-protocols/awareness` at first call — see {@link defaultAwarenessFactory}).
 *
 * Dependency note (called out per the brief)
 * ------------------------------------------
 * This module REQUIRES the `y-protocols` package to be added to
 * `package.json` before runtime use. Pinning is owned by sub-task #5
 * (CRDT-lib pick — ADR `docs/adr/sabflow-crdt-lib.md`). Build/test today
 * can stub the factory; production usage MUST install:
 *
 *     pnpm add y-protocols yjs
 *
 * Scope / file ownership
 * ----------------------
 * This file owns the React-side awareness binding ONLY. It does NOT:
 *   - own the WS transport (sub-task #3)
 *   - own the doc lifecycle (sub-task #1 — `useSabFlowDoc`)
 *   - own per-doc RBAC filtering of awareness frames (Phase 8)
 *   - replace the in-memory presence store at
 *     `src/lib/sabflow/presence/store.ts` — that swap is Phase 7.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Forward-declared Yjs / y-protocols surface
// ---------------------------------------------------------------------------

/**
 * Structural slice of `Y.Doc` we hand to `new Awareness(doc)`. The concrete
 * doc comes from `useSabFlowDoc` (sub-task #1); we don't depend on any
 * particular field of it here.
 */
export interface YDocLike {
	readonly clientID: number;
}

/**
 * Subset of `y-protocols/awareness`'s `Awareness` class we drive. Matches
 * the upstream shape precisely so the default factory can return a real
 * `Awareness` without a cast.
 *
 * See: https://github.com/yjs/y-protocols/blob/master/awareness.js
 */
export interface AwarenessLike {
	readonly clientID: number;
	getLocalState(): Record<string, unknown> | null;
	setLocalState(state: Record<string, unknown> | null): void;
	setLocalStateField(field: string, value: unknown): void;
	getStates(): Map<number, Record<string, unknown>>;
	on(
		event: 'change' | 'update',
		handler: (
			changes: { added: number[]; updated: number[]; removed: number[] },
			origin: unknown,
		) => void,
	): void;
	off(
		event: 'change' | 'update',
		handler: (
			changes: { added: number[]; updated: number[]; removed: number[] },
			origin: unknown,
		) => void,
	): void;
	destroy(): void;
}

/** Factory contract: produce an `AwarenessLike` bound to the given doc. */
export type AwarenessFactory = (doc: YDocLike) => AwarenessLike;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Identity payload owned by the calling component. Anything else (cursor,
 * selection, idleSince, lastSeen) is computed by the hook itself.
 */
export interface LocalUser {
	readonly id: string;
	readonly name: string;
	/** Hex color, e.g. `'#ff8800'`. Phase 6 / 7 deterministic palette feeds it. */
	readonly color: string;
}

/**
 * The shape every awareness participant publishes. Mirrors the SabFlow
 * presence contract; field semantics match the in-memory store at
 * `src/lib/sabflow/presence/store.ts` so the Phase 7 swap is mechanical.
 */
export interface PresenceState {
	readonly userId: string;
	readonly name: string;
	readonly color: string;
	/** Canvas-space cursor coordinates (null when the cursor left the canvas). */
	cursor?: { x: number; y: number } | null;
	/** Currently-highlighted node ids. */
	selection?: { nodeIds: string[] } | null;
	/**
	 * Wall-clock ms when the user went idle (no `setLocal` in {@link IDLE_MS}).
	 * `null`/absent means active.
	 */
	idleSince?: number | null;
	/** Wall-clock ms of the latest local mutation (or initial mount). */
	lastSeen: number;
}

/** Partial update accepted by `setLocal`. Identity fields are owned by props. */
export type PresencePatch = Partial<
	Pick<PresenceState, 'cursor' | 'selection'>
>;

export interface UsePresenceOptions {
	readonly localUser: LocalUser;
	/**
	 * Override for the awareness instance. Sub-task #3
	 * (`<SabFlowProvider>`) injects a shared instance so the same awareness
	 * is reused across `useSabFlowDoc` consumers. When omitted, we build a
	 * fresh one via {@link defaultAwarenessFactory} on first render.
	 */
	readonly awarenessFactory?: AwarenessFactory;
	/**
	 * Idle threshold in ms. Default {@link IDLE_MS}. The brief pins 30 s.
	 */
	readonly idleMs?: number;
}

export interface UsePresenceResult {
	/** Live map of remote peers, keyed by Yjs `clientID`. Excludes self. */
	readonly peers: Map<number, PresenceState>;
	/** Patch the local presence state. Resets the idle timer. */
	readonly setLocal: (patch: PresencePatch) => void;
	/** Convenience — `peers.size + 1` for "self + others" counters. */
	readonly count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Idle threshold per the brief. */
export const IDLE_MS = 30_000;

/**
 * Awareness state-key under which we stash the SabFlow `PresenceState`.
 * Kept under a single key so unrelated fields (e.g. future "typing" markers)
 * can coexist without colliding with our shape.
 */
const STATE_KEY = 'sabflow';

// ---------------------------------------------------------------------------
// Default factory — dynamic import keeps `y-protocols` off the static graph
// ---------------------------------------------------------------------------

/**
 * Default awareness factory. We dynamically import `y-protocols/awareness`
 * the first time it's called and cache the constructor across calls so
 * subsequent mounts pay zero overhead.
 *
 * The dynamic import is deliberate: it lets this file ship before
 * `y-protocols` lands in `package.json`. Callers who use the hook before
 * the dep is installed get a synchronous throw with a clear remediation
 * message — that's MUCH friendlier than a cryptic module-not-found at
 * import time of a downstream file.
 */
let cachedAwarenessCtor:
	| (new (doc: YDocLike) => AwarenessLike)
	| undefined;

export const defaultAwarenessFactory: AwarenessFactory = (doc) => {
	if (!cachedAwarenessCtor) {
		// `require` is the only path that's synchronous in a React render.
		// We accept the bundler-warning in exchange for keeping the hook
		// signature non-async. If `y-protocols` isn't installed, surface a
		// pointed error rather than letting the missing-module error bubble
		// from deep inside React.
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('y-protocols/awareness') as {
				Awareness: new (doc: YDocLike) => AwarenessLike;
			};
			cachedAwarenessCtor = mod.Awareness;
		} catch (err) {
			throw new Error(
				'[usePresence] `y-protocols` is not installed. ' +
					'Run `pnpm add y-protocols yjs` or pass a custom ' +
					'`awarenessFactory` to usePresence().',
				{ cause: err as Error },
			);
		}
	}
	return new cachedAwarenessCtor(doc);
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Bind awareness to the given Yjs doc and reflect peer state into React.
 *
 * @param doc       Y.Doc from {@link useSabFlowDoc} (sibling sub-task #1).
 * @param options.localUser  Identity payload — name/color changes hot-update.
 * @param options.awarenessFactory  Override the default constructor.
 * @param options.idleMs    Override the 30 s default.
 *
 * @returns `{ peers, setLocal, count }`. `peers` is a *reference-stable per
 *          revision* `Map` so React `useMemo` consumers don't fight us.
 */
export function usePresence(
	doc: YDocLike,
	options: UsePresenceOptions,
): UsePresenceResult {
	const { localUser, awarenessFactory, idleMs = IDLE_MS } = options;

	// One awareness instance per doc/factory pair. `useState` lazy-init runs
	// exactly once per mounted hook instance (StrictMode-safe — React 18
	// double-invokes the *initializer* but discards one of the resulting
	// states). We hold the value in a ref so identity-effect reads see the
	// same instance the subscribe-effect cleans up.
	// See `rerender-lazy-state-init` + `rerender-use-ref-transient-values`.
	const factory = awarenessFactory ?? defaultAwarenessFactory;
	const [awarenessInstance] = useState<AwarenessLike>(() => factory(doc));
	const awarenessRef = useRef<AwarenessLike | null>(awarenessInstance);
	// Re-bind the ref each render so a hot-reload that swaps the factory
	// still points at the live instance. No allocation — same object.
	awarenessRef.current = awarenessInstance;

	// React state: the current `peers` snapshot. We rebuild this on every
	// awareness `change` event — Yjs guarantees that event coalesces all
	// concurrent diffs in the same tick, so the rebuild is cheap.
	const [peers, setPeers] = useState<Map<number, PresenceState>>(
		() => new Map(),
	);

	// `lastSeen` for the local user must be writable from setLocal without
	// causing a re-render storm. We track it in a ref and only flush into
	// awareness inside setLocal/identity-sync effects.
	const lastSeenRef = useRef<number>(Date.now());
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// -------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------

	const armIdleTimer = useCallback(() => {
		const awareness = awarenessRef.current;
		if (!awareness) return;
		if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
		idleTimerRef.current = setTimeout(() => {
			// Re-read the latest state so we don't clobber a cursor/selection
			// patch that landed between arm-time and fire-time.
			const current = (awareness.getLocalState() ?? {}) as Record<
				string,
				unknown
			>;
			const cur = (current[STATE_KEY] as PresenceState | undefined) ?? null;
			if (!cur) return;
			awareness.setLocalStateField(STATE_KEY, {
				...cur,
				idleSince: Date.now(),
			} satisfies PresenceState);
		}, idleMs);
	}, [idleMs]);

	const clearIdle = useCallback(() => {
		const awareness = awarenessRef.current;
		if (!awareness) return;
		const current = (awareness.getLocalState() ?? {}) as Record<
			string,
			unknown
		>;
		const cur = (current[STATE_KEY] as PresenceState | undefined) ?? null;
		if (!cur || cur.idleSince == null) return;
		awareness.setLocalStateField(STATE_KEY, {
			...cur,
			idleSince: null,
		} satisfies PresenceState);
	}, []);

	// -------------------------------------------------------------------
	// Effect: subscribe + seed initial local state + cleanup
	// -------------------------------------------------------------------

	useEffect(() => {
		const awareness = awarenessRef.current;
		if (!awareness) return;
		const selfId = awareness.clientID;

		const initial: PresenceState = {
			userId: localUser.id,
			name: localUser.name,
			color: localUser.color,
			cursor: null,
			selection: null,
			idleSince: null,
			lastSeen: Date.now(),
		};
		awareness.setLocalStateField(STATE_KEY, initial);
		lastSeenRef.current = initial.lastSeen;

		// Rebuild `peers` from the full awareness map on every change.
		// Cheap — typical room size is <50 per the Phase 1 bench shape.
		const onChange = () => {
			const next = new Map<number, PresenceState>();
			for (const [clientId, state] of awareness.getStates()) {
				if (clientId === selfId) continue;
				const entry = (state as Record<string, unknown>)[STATE_KEY] as
					| PresenceState
					| undefined;
				if (entry && typeof entry === 'object') {
					next.set(clientId, entry);
				}
			}
			setPeers(next);
		};
		awareness.on('change', onChange);
		onChange();

		// Window focus clears idle so a returning user doesn't look stuck.
		const onFocus = () => clearIdle();
		if (typeof window !== 'undefined') {
			window.addEventListener('focus', onFocus);
		}

		armIdleTimer();

		return () => {
			awareness.off('change', onChange);
			if (typeof window !== 'undefined') {
				window.removeEventListener('focus', onFocus);
			}
			if (idleTimerRef.current !== null) {
				clearTimeout(idleTimerRef.current);
				idleTimerRef.current = null;
			}
			// Per the brief: destroy awareness on unmount. This broadcasts
			// a "removed" diff to peers, who shed our entry from their maps.
			awareness.destroy();
			awarenessRef.current = null;
		};
		// We intentionally do NOT depend on `localUser` here — the next effect
		// hot-patches name/color in place rather than tearing down awareness.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// -------------------------------------------------------------------
	// Effect: hot-update identity (name / color / userId) without remount
	// -------------------------------------------------------------------

	useEffect(() => {
		const awareness = awarenessRef.current;
		if (!awareness) return;
		const current = (awareness.getLocalState() ?? {}) as Record<
			string,
			unknown
		>;
		const cur = (current[STATE_KEY] as PresenceState | undefined) ?? null;
		if (!cur) return;
		if (
			cur.userId === localUser.id &&
			cur.name === localUser.name &&
			cur.color === localUser.color
		) {
			return;
		}
		awareness.setLocalStateField(STATE_KEY, {
			...cur,
			userId: localUser.id,
			name: localUser.name,
			color: localUser.color,
		} satisfies PresenceState);
	}, [localUser.id, localUser.name, localUser.color]);

	// -------------------------------------------------------------------
	// Public setLocal
	// -------------------------------------------------------------------

	const setLocal = useCallback(
		(patch: PresencePatch) => {
			const awareness = awarenessRef.current;
			if (!awareness) return;
			const current = (awareness.getLocalState() ?? {}) as Record<
				string,
				unknown
			>;
			const cur = (current[STATE_KEY] as PresenceState | undefined) ?? null;
			const now = Date.now();
			const next: PresenceState = {
				userId: localUser.id,
				name: localUser.name,
				color: localUser.color,
				cursor: patch.cursor !== undefined ? patch.cursor : cur?.cursor ?? null,
				selection:
					patch.selection !== undefined
						? patch.selection
						: cur?.selection ?? null,
				idleSince: null,
				lastSeen: now,
			};
			lastSeenRef.current = now;
			awareness.setLocalStateField(STATE_KEY, next);
			armIdleTimer();
		},
		[armIdleTimer, localUser.id, localUser.name, localUser.color],
	);

	// -------------------------------------------------------------------
	// Result
	// -------------------------------------------------------------------

	return useMemo(
		() => ({
			peers,
			setLocal,
			count: peers.size + 1,
		}),
		[peers, setLocal],
	);
}
