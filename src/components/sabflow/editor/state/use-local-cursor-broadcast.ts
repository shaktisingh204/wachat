'use client';

/**
 * SabFlow editor — `useLocalCursorBroadcast` React hook.
 *
 * Track A · Phase 7 · sub-task #3 of 10.
 *
 * What this owns
 * --------------
 * The OUTBOUND half of the live-cursor wire. The hook subscribes to the
 * canvas's `pointermove` events, translates them from viewport-space pixels
 * into canvas-space coordinates (so peers paint in the same coordinate
 * system node positions live in), and pushes the result into
 * `presence.setLocal({ cursor })` at a steady 20 Hz cap.
 *
 * Pair with sub-task #2 (`overlays/RemoteCursors.tsx`), which consumes the
 * mirror image: it reads `presence.peers[*].cursor` (canvas-space) and
 * paints it through `canvasRef.current.getViewport()` on rAF. The wire shape
 * on both sides is `{ x: number; y: number } | null` — the exact contract
 * `PresenceState.cursor` already publishes.
 *
 * Throttle design
 * ---------------
 * The brief asks for 20 Hz (50 ms windows) rAF-aligned. We implement that
 * as a "trailing-on-frame" throttle:
 *
 *   1. Every `pointermove` writes its (x, y) into a ref — cheap, no React.
 *   2. The first event after a quiet period schedules a single
 *      `requestAnimationFrame` callback.
 *   3. Inside the rAF callback, if at least 50 ms have elapsed since the
 *      last *emit*, we read the latest ref value and call `setLocal`.
 *      Otherwise we reschedule another rAF — this naturally rounds the
 *      cadence to whole frames at 60 Hz (≈16.7 ms) so we emit at most
 *      every ~50 ms (i.e. every third frame), aligned to vsync.
 *
 * The "always-trailing" guarantee means the final position before the user
 * stops moving is broadcast, so peers' last-seen cursor matches reality
 * within ~50 ms regardless of timer phase.
 *
 * Suppression rules
 * -----------------
 *   - **Mouseleave**: when the pointer exits the canvas surface we emit a
 *     single `setLocal({ cursor: null })` and stop the rAF loop.
 *   - **Window blur**: same — clear and stop. Re-focus is a no-op; the next
 *     real `pointermove` re-arms the broadcast.
 *   - **Typing in an input**: if `document.activeElement` is an editable
 *     element (input/textarea/contenteditable) we skip the emit for that
 *     window. Avoids spamming awareness while the user types into the
 *     inspector / variable picker. We DON'T clear the cursor on focus —
 *     the last-known position is still informative to peers — we just
 *     stop *updating* it.
 *
 * Constraints
 * -----------
 * Zero deps: only `react` + DOM. The file is ONLY the hook (sub-task #3);
 * no presence transport, no canvas wiring, no overlay rendering.
 */

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Forward-declared shapes
// ---------------------------------------------------------------------------
// Kept structural so this hook ships before the wire-up sub-task (#10) and
// works against either presence implementation (Yjs awareness or polling).

/** Canvas pan + zoom snapshot. Matches `RemoteCursors`'s `CanvasViewport`. */
export interface CursorBroadcastViewport {
	/** Pan offset in viewport-space pixels (canvas-origin → DOM origin). */
	readonly x: number;
	readonly y: number;
	/** Uniform scale factor; 1 = 100 %. */
	readonly zoom: number;
}

/**
 * Minimal canvas handle. We need:
 *   - `getViewport()` to invert the pan+zoom matrix.
 *   - either a direct `getBoundingClientRect()` or a `.element` we can call
 *     it on, so we can translate `pointermove.clientX/Y` into surface-local
 *     pixels before applying the inverse zoom.
 *
 * We accept either shape so the consumer can pass the imperative canvas
 * handle directly, or wrap a raw DOM ref. The hook detects which is present.
 */
export interface CursorBroadcastCanvasHandle {
	getViewport(): CursorBroadcastViewport;
	/** Optional — direct surface element. Preferred if available. */
	readonly element?: HTMLElement | null;
	/** Optional — fallback when `element` isn't exposed. */
	getBoundingClientRect?: () => DOMRect;
}

/**
 * Minimal presence handle slice. Mirrors the `setLocal` signature both
 * presence transports already publish — `cursor` is `{ x, y } | null`.
 */
export interface CursorBroadcastPresence {
	readonly setLocal: (patch: {
		cursor: { x: number; y: number } | null;
	}) => void;
}

export interface UseLocalCursorBroadcastOptions {
	readonly canvasRef: {
		readonly current: CursorBroadcastCanvasHandle | null;
	};
	readonly presence: CursorBroadcastPresence;
	/**
	 * Minimum gap between outbound emits, in ms. Defaults to 50 (20 Hz)
	 * per the brief. Exposed for tests; not part of the public API.
	 */
	readonly minIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 20 Hz cap → 50 ms minimum between emits. */
const DEFAULT_MIN_INTERVAL_MS = 50;

/** Tag names that always count as "user is typing" surfaces. */
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * `true` iff focus is currently inside an editable surface. We check both
 * the explicit form-control tag names and any `contenteditable` ancestor —
 * the SabFlow inspector uses contenteditable divs for inline rename, and
 * we don't want pointer-jitter while the user is mid-rename to pump
 * awareness traffic.
 */
function isTypingFocus(): boolean {
	if (typeof document === 'undefined') return false;
	const el = document.activeElement;
	if (!el || el === document.body) return false;
	if (el instanceof HTMLElement) {
		if (TYPING_TAGS.has(el.tagName)) return true;
		if (el.isContentEditable) return true;
	}
	return false;
}

/**
 * Resolve the surface DOMRect from a canvas handle. Returns null if the
 * handle is unmounted or exposes neither `element` nor a callable
 * `getBoundingClientRect`. Callers treat null as "skip this frame".
 */
function rectOf(handle: CursorBroadcastCanvasHandle | null): DOMRect | null {
	if (!handle) return null;
	if (handle.element) return handle.element.getBoundingClientRect();
	if (typeof handle.getBoundingClientRect === 'function') {
		return handle.getBoundingClientRect();
	}
	return null;
}

/**
 * Transform a viewport-space pointer event into canvas-space coordinates
 * using the inverse pan+zoom matrix.
 *
 * Forward (the overlay uses this):  vx = x * zoom + ox
 * Inverse (we use this):            x = (vx - ox) / zoom
 *
 * `clientX/Y` is page-relative; we subtract the surface's `left/top` to get
 * surface-local pixels first (that's what the viewport offsets `(x, y)` are
 * expressed against).
 */
function toCanvas(
	clientX: number,
	clientY: number,
	rect: DOMRect,
	v: CursorBroadcastViewport,
): { x: number; y: number } {
	const localX = clientX - rect.left;
	const localY = clientY - rect.top;
	// Guard against a degenerate zoom — should never happen, but we don't
	// want a NaN cursor escaping into awareness.
	const z = v.zoom === 0 ? 1 : v.zoom;
	return { x: (localX - v.x) / z, y: (localY - v.y) / z };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wire a throttled, viewport-aware local-cursor broadcast on top of an
 * imperative canvas handle and a presence transport.
 *
 * @param options.canvasRef       Imperative canvas ref (see header).
 * @param options.presence        Presence handle exposing `setLocal`.
 * @param options.minIntervalMs   Min ms between emits (default 50 = 20 Hz).
 */
export function useLocalCursorBroadcast(
	options: UseLocalCursorBroadcastOptions,
): void {
	const { canvasRef, presence, minIntervalMs = DEFAULT_MIN_INTERVAL_MS } =
		options;

	// Keep the latest presence handle in a ref so listeners attached on
	// mount don't capture a stale `setLocal` after a re-render.
	const setLocalRef = useRef(presence.setLocal);
	setLocalRef.current = presence.setLocal;

	// Keep the canvas ref accessible to listeners without re-binding them.
	const canvasRefRef = useRef(canvasRef);
	canvasRefRef.current = canvasRef;

	const minIntervalRef = useRef(minIntervalMs);
	minIntervalRef.current = minIntervalMs;

	useEffect(() => {
		if (typeof window === 'undefined') return undefined;

		// Pending pointer sample — overwritten by every pointermove, drained
		// by the rAF callback. `null` means "no sample since last emit".
		let pending: { clientX: number; clientY: number } | null = null;
		// Timestamp (performance.now) of the last actual emit. Used to
		// enforce the 50 ms floor across multiple rAF ticks.
		let lastEmitAt = 0;
		// Last cursor we broadcast — used to dedupe identical coords (mostly
		// hits the "user wiggled within a single canvas pixel" case after
		// zoom-out) so we don't spam peers with redundant frames.
		let lastBroadcast: { x: number; y: number } | null = null;
		// Has the local cursor currently been broadcast to peers? Tracks
		// whether we need to send a clearing `null` on leave/blur.
		let hasLiveCursor = false;
		// Active rAF id, or null when no frame is scheduled.
		let rafId: number | null = null;

		const cancelRaf = (): void => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		};

		/**
		 * The rAF callback. Drains the pending sample if (and only if) the
		 * 50 ms floor has elapsed since the last emit. Otherwise re-schedules
		 * itself for the next frame.
		 */
		const tick = (): void => {
			rafId = null;
			if (pending === null) return;
			// Pause emits while focus is in an editable element. We DON'T
			// clear the cursor — last-known position is still meaningful to
			// peers — we just stop updating it until focus returns.
			if (isTypingFocus()) {
				// Drop the pending sample; re-arm on next pointermove.
				pending = null;
				return;
			}

			const now =
				typeof performance !== 'undefined' && performance.now
					? performance.now()
					: Date.now();
			const gap = now - lastEmitAt;
			if (gap < minIntervalRef.current) {
				// Too soon — defer to the next frame. The pending sample
				// stays so we always broadcast the *latest* position when
				// the floor finally elapses.
				rafId = requestAnimationFrame(tick);
				return;
			}

			const handle = canvasRefRef.current.current;
			const rect = rectOf(handle);
			if (!handle || !rect) {
				// Canvas torn down between the move and the frame — drop.
				pending = null;
				return;
			}

			const viewport = handle.getViewport();
			const { clientX, clientY } = pending;
			pending = null;

			const coords = toCanvas(clientX, clientY, rect, viewport);
			// Dedupe sub-pixel jitter — same canvas coord as last emit is a
			// no-op. Cheap two-field compare; far cheaper than a setLocal.
			if (
				lastBroadcast !== null &&
				lastBroadcast.x === coords.x &&
				lastBroadcast.y === coords.y
			) {
				return;
			}

			lastBroadcast = coords;
			lastEmitAt = now;
			hasLiveCursor = true;
			try {
				setLocalRef.current({ cursor: coords });
			} catch {
				// Presence might be torn down mid-frame; swallow so we don't
				// crash render. Next pointermove will retry.
			}
		};

		const schedule = (): void => {
			if (rafId === null) rafId = requestAnimationFrame(tick);
		};

		/**
		 * Send a single clearing `null` cursor. Used by leave/blur paths.
		 * Idempotent — a no-op if we never broadcast a position in the first
		 * place, so peers don't see redundant null frames on hover-out from
		 * a canvas the user never moved over.
		 */
		const clearCursor = (): void => {
			pending = null;
			cancelRaf();
			if (!hasLiveCursor) return;
			hasLiveCursor = false;
			lastBroadcast = null;
			try {
				setLocalRef.current({ cursor: null });
			} catch {
				// As above — tear-down race; ignore.
			}
		};

		// ----------------------------------------------------------------
		// DOM listeners
		// ----------------------------------------------------------------
		// We attach `pointermove` and `pointerleave` to the canvas surface
		// when it's available; otherwise we re-poll via a microtask. The
		// surface element identity is stable for the lifetime of the canvas
		// component (it's the wrapping div), so we don't need a
		// MutationObserver — just bind once we find it.

		let boundEl: HTMLElement | null = null;
		const onPointerMove = (e: PointerEvent): void => {
			pending = { clientX: e.clientX, clientY: e.clientY };
			schedule();
		};
		const onPointerLeave = (): void => {
			clearCursor();
		};
		const onWindowBlur = (): void => {
			clearCursor();
		};

		const bind = (): void => {
			const handle = canvasRefRef.current.current;
			const el = handle?.element ?? null;
			if (!el || el === boundEl) return;
			// If we previously bound to a different element (canvas swap),
			// detach there first.
			if (boundEl) {
				boundEl.removeEventListener('pointermove', onPointerMove);
				boundEl.removeEventListener('pointerleave', onPointerLeave);
				boundEl.removeEventListener('mouseleave', onPointerLeave);
			}
			boundEl = el;
			// Passive listeners — we never preventDefault, and the canvas's
			// own pan/zoom logic owns motion handling. Marking passive lets
			// the browser fast-path scroll/gesture handling.
			el.addEventListener('pointermove', onPointerMove, { passive: true });
			el.addEventListener('pointerleave', onPointerLeave, { passive: true });
			// `mouseleave` is a belt-and-braces alias for browsers that miss
			// pointerleave when the user exits via a synthetic boundary
			// (e.g. dragging onto an iframe overlay).
			el.addEventListener('mouseleave', onPointerLeave, { passive: true });
		};

		// First attempt: bind synchronously if the canvas is already mounted.
		bind();

		// Retry once on the next frame to cover the "hook mounts before
		// canvas ref attaches" race. Both presence and canvas usually settle
		// within the same commit, so a single retry is sufficient — we don't
		// want a long-running poll.
		const retryId = requestAnimationFrame(bind);

		window.addEventListener('blur', onWindowBlur);

		return () => {
			cancelAnimationFrame(retryId);
			cancelRaf();
			window.removeEventListener('blur', onWindowBlur);
			if (boundEl) {
				boundEl.removeEventListener('pointermove', onPointerMove);
				boundEl.removeEventListener('pointerleave', onPointerLeave);
				boundEl.removeEventListener('mouseleave', onPointerLeave);
			}
			// Best-effort clear on unmount so peers don't see a frozen
			// cursor outliving the editor session. `clearCursor` is
			// idempotent and safe even after the canvas has detached.
			clearCursor();
		};
		// We deliberately depend on nothing — the refs above feed live values
		// into the handlers, and presence/canvas swaps are handled inside the
		// effect. Re-binding on every render would tear down the rAF loop
		// and lose the 50 ms phase alignment.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}

export default useLocalCursorBroadcast;
