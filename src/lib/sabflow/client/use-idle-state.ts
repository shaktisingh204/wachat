/**
 * SabFlow client — `useIdleState` React hook.
 *
 * Track A · Phase 7 · sub-task #8 of 10.
 *
 * What this owns
 * --------------
 * Richer tri-state idle/away detection layered ON TOP of `usePresence`'s
 * coarse 30 s idle stamp (sibling `usePresence.ts`, sub-task #2). Whereas
 * `usePresence` only knows "active" vs "idle (>30 s)", this hook
 * distinguishes three states the UI cares about:
 *
 *   - `'active'` — any tracked input within the last 60 s.
 *   - `'idle'`   — 60 s ≤ since-last-input < 5 min.
 *   - `'away'`   — ≥ 5 min since last input, OR the tab is hidden, OR
 *                   the user explicitly hit a "Take a break" toggle.
 *
 * The hook *consumes* a `setLocal` from a parent `usePresence` and
 * publishes the tri-state plus an `awayReason` discriminator into the
 * awareness payload's `status` / `awayReason` fields so peers can render
 * a "tab hidden" vs "manually away" vs "timed out" indicator.
 *
 * Scope (what this file does NOT own)
 * -----------------------------------
 *   - The presence transport — that's `usePresence` (#2) + Provider (#3).
 *   - The "Take a break" UI button — the caller owns the toggle and
 *     drives it via the returned {@link setManualAway} setter.
 *   - Persisting `manualAway` across reloads — out of scope; the parent
 *     can rehydrate from localStorage if desired.
 *
 * Activity sources
 * ----------------
 * Per the brief:
 *   - `pointermove`, `keydown`, `touchstart` on `window` (capture-phase so
 *     we see input before any stopPropagation in app code).
 *   - `scroll` on the *canvas element only* — listening to document scroll
 *     would mark a user "active" just because a sidebar list scrolled
 *     under their cursor, which is exactly the false-positive we want to
 *     avoid.
 *
 * The canvas target is opt-in: pass `canvasRef` (a React ref to the flow
 * canvas root) and we attach a passive scroll listener on mount. Without
 * a ref, scroll is simply not tracked.
 *
 * SSR safety
 * ----------
 * All `window` / `document` access is gated on `typeof window !==
 * 'undefined'`. The initial state is `'active'` on the server (matches
 * the post-hydration "user just landed" view, so we avoid a hydration
 * mismatch) and only flips after the first client-side tick.
 *
 * Zero deps
 * ---------
 * No external libraries — just `react`. Timers use `setTimeout` /
 * `clearTimeout` directly so this hook tree-shakes cleanly and ships
 * before any Phase-7 transport work lands.
 */
'use client';

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Tri-state UI label for the local user's presence.
 *
 *   - `'active'` — input within the last `idleAfterMs`.
 *   - `'idle'`   — quiet for ≥ `idleAfterMs` but < `awayAfterMs`.
 *   - `'away'`   — quiet for ≥ `awayAfterMs`, tab hidden, or manual.
 */
export type IdleState = 'active' | 'idle' | 'away';

/**
 * Why we entered `'away'`. Surfaced into the awareness payload so peers
 * can render distinct UI ("On break" vs "Tab hidden" vs "Idle"). Only
 * meaningful when {@link IdleState} is `'away'`.
 */
export type AwayReason = 'tab_hidden' | 'manual' | 'timeout';

/**
 * Subset of the parent `usePresence` API we need. We don't import the
 * full `UsePresenceResult` to keep this hook independently composable —
 * any caller (test harness, Storybook) can stub a `setLocal` without
 * standing up a full awareness instance.
 */
export interface PresenceLike {
	setLocal: (patch: {
		status: IdleState;
		awayReason?: AwayReason;
	}) => void;
}

export interface UseIdleStateOptions {
	/** Presence sink — usually `{ setLocal }` from `usePresence`. */
	readonly setLocal: PresenceLike['setLocal'];
	/**
	 * Optional canvas root. When provided we attach a passive `scroll`
	 * listener to it as an activity source. Document-level scroll is
	 * deliberately *not* tracked — see file header.
	 */
	readonly canvasRef?: RefObject<HTMLElement | null>;
	/**
	 * Threshold before active → idle. Default 60 s per the brief.
	 * Exposed for tests / Storybook only.
	 */
	readonly idleAfterMs?: number;
	/**
	 * Threshold before idle → away (timeout reason). Default 5 min per
	 * the brief. Exposed for tests / Storybook only.
	 */
	readonly awayAfterMs?: number;
}

export interface UseIdleStateResult {
	/** Live tri-state — re-renders on every transition. */
	readonly state: IdleState;
	/**
	 * Mirrors the "Take a break" toggle. When `true`, {@link state} is
	 * forced to `'away'` with reason `'manual'` regardless of input.
	 */
	readonly manualAway: boolean;
	/** Caller-facing setter for the "Take a break" toggle. */
	readonly setManualAway: (yes: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants — match the brief
// ---------------------------------------------------------------------------

/** 60 s — active → idle threshold. */
export const DEFAULT_IDLE_AFTER_MS = 60_000;

/** 5 min — idle → away threshold. */
export const DEFAULT_AWAY_AFTER_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Tri-state idle detector. See file header for the full contract.
 *
 * Algorithm
 * ---------
 * 1. We stamp `lastInputRef` on every tracked input event.
 * 2. A single recurring timer (`tickRef`) wakes up at the *nearest*
 *    upcoming transition boundary — either `idleAfterMs` or
 *    `awayAfterMs` minus elapsed — and recomputes `state`. We never
 *    poll faster than necessary, so idle tabs stay cheap.
 * 3. `visibilitychange` short-circuits to `'away' / 'tab_hidden'` and
 *    flips back to `'active'` (resetting the timer) on visible.
 * 4. `manualAway === true` always wins; releasing it falls back to the
 *    timer-driven state without resetting `lastInputRef` (so a user who
 *    toggled away then back gets the natural idle/active state).
 */
export function useIdleState(
	options: UseIdleStateOptions,
): UseIdleStateResult {
	const {
		setLocal,
		canvasRef,
		idleAfterMs = DEFAULT_IDLE_AFTER_MS,
		awayAfterMs = DEFAULT_AWAY_AFTER_MS,
	} = options;

	// SSR-safe initial state: assume the user is active. On the client we
	// re-evaluate inside the mount effect, which may immediately downgrade
	// if `document.hidden` is already true.
	const [state, setState] = useState<IdleState>('active');
	const [manualAway, setManualAwayState] = useState(false);

	// Refs for values the activity-handler reads without re-subscribing.
	const lastInputRef = useRef<number>(
		typeof window === 'undefined' ? 0 : Date.now(),
	);
	const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const stateRef = useRef<IdleState>('active');
	const manualAwayRef = useRef(false);
	const setLocalRef = useRef(setLocal);
	setLocalRef.current = setLocal;

	// Keep refs in sync so the timer / event handlers always see fresh values
	// without re-binding listeners on every render.
	useEffect(() => {
		stateRef.current = state;
	}, [state]);
	useEffect(() => {
		manualAwayRef.current = manualAway;
	}, [manualAway]);

	// -------------------------------------------------------------------
	// Core transition machine — recompute the state and reschedule.
	// -------------------------------------------------------------------

	const applyTransition = useCallback(
		(next: IdleState, reason: AwayReason | undefined) => {
			if (stateRef.current === next) return;
			stateRef.current = next;
			setState(next);
			// Push to presence. Only attach `awayReason` for `'away'` — the
			// presence payload treats it as undefined-when-not-applicable so
			// peers can rely on `status === 'away' ? awayReason : undefined`.
			if (next === 'away') {
				setLocalRef.current({ status: 'away', awayReason: reason });
			} else {
				setLocalRef.current({ status: next });
			}
		},
		[],
	);

	const recompute = useCallback(() => {
		if (typeof window === 'undefined') return;

		// Manual away wins outright.
		if (manualAwayRef.current) {
			applyTransition('away', 'manual');
			// No timer needed — release-of-toggle re-runs recompute.
			if (tickRef.current !== null) {
				clearTimeout(tickRef.current);
				tickRef.current = null;
			}
			return;
		}

		// Tab hidden also wins (but is independent of input timestamps).
		if (typeof document !== 'undefined' && document.hidden) {
			applyTransition('away', 'tab_hidden');
			if (tickRef.current !== null) {
				clearTimeout(tickRef.current);
				tickRef.current = null;
			}
			return;
		}

		const elapsed = Date.now() - lastInputRef.current;
		let next: IdleState;
		let nextBoundary: number;

		if (elapsed >= awayAfterMs) {
			next = 'away';
			// Already past the away boundary — nothing left to schedule.
			nextBoundary = Number.POSITIVE_INFINITY;
		} else if (elapsed >= idleAfterMs) {
			next = 'idle';
			nextBoundary = awayAfterMs - elapsed;
		} else {
			next = 'active';
			nextBoundary = idleAfterMs - elapsed;
		}

		applyTransition(next, next === 'away' ? 'timeout' : undefined);

		if (tickRef.current !== null) clearTimeout(tickRef.current);
		if (Number.isFinite(nextBoundary)) {
			// Add 1 ms slack so the boundary read sees `elapsed >= threshold`.
			tickRef.current = setTimeout(recompute, nextBoundary + 1);
		} else {
			tickRef.current = null;
		}
	}, [applyTransition, awayAfterMs, idleAfterMs]);

	// -------------------------------------------------------------------
	// Activity handler — stamps lastInput and (cheaply) recomputes.
	// -------------------------------------------------------------------

	const onActivity = useCallback(() => {
		lastInputRef.current = Date.now();
		// If we're currently active and not manual/hidden, we don't need to
		// recompute — the next scheduled tick handles the active→idle edge.
		// But if we were idle/away due to timeout, we MUST flip back now.
		if (manualAwayRef.current) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		if (stateRef.current !== 'active') {
			recompute();
		} else {
			// Reschedule the next idle boundary against the new stamp.
			if (tickRef.current !== null) clearTimeout(tickRef.current);
			tickRef.current = setTimeout(recompute, idleAfterMs + 1);
		}
	}, [idleAfterMs, recompute]);

	// -------------------------------------------------------------------
	// Mount effect: subscribe to inputs, visibility, and start the timer.
	// -------------------------------------------------------------------

	useEffect(() => {
		if (typeof window === 'undefined') return;

		// Initial evaluation — handles a tab that mounts while already hidden.
		lastInputRef.current = Date.now();
		recompute();

		const opts: AddEventListenerOptions = { passive: true, capture: true };
		window.addEventListener('pointermove', onActivity, opts);
		window.addEventListener('keydown', onActivity, opts);
		window.addEventListener('touchstart', onActivity, opts);

		const canvasEl = canvasRef?.current ?? null;
		if (canvasEl) {
			// Passive — we never preventDefault on scroll.
			canvasEl.addEventListener('scroll', onActivity, { passive: true });
		}

		const onVisibility = () => recompute();
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			window.removeEventListener('pointermove', onActivity, opts);
			window.removeEventListener('keydown', onActivity, opts);
			window.removeEventListener('touchstart', onActivity, opts);
			if (canvasEl) {
				canvasEl.removeEventListener('scroll', onActivity);
			}
			document.removeEventListener('visibilitychange', onVisibility);
			if (tickRef.current !== null) {
				clearTimeout(tickRef.current);
				tickRef.current = null;
			}
		};
		// `canvasRef` is a ref object — its identity is stable per the React
		// contract, so we depend on `.current` snapshot at mount. If the
		// caller swaps refs at runtime, they should remount the hook.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [onActivity, recompute]);

	// React to threshold changes (test/Storybook): recompute on the new bounds.
	useEffect(() => {
		recompute();
	}, [idleAfterMs, awayAfterMs, recompute]);

	// -------------------------------------------------------------------
	// Public setManualAway — stable identity, drives recompute on toggle.
	// -------------------------------------------------------------------

	const setManualAway = useCallback(
		(yes: boolean) => {
			setManualAwayState(yes);
			manualAwayRef.current = yes;
			// If releasing, reset the input stamp so we start in 'active'
			// rather than instantly re-classifying as idle/away based on
			// however long the manual break lasted.
			if (!yes) {
				lastInputRef.current = Date.now();
			}
			recompute();
		},
		[recompute],
	);

	return { state, manualAway, setManualAway };
}
