'use client';

/**
 * Track A Phase 6 #6 - remote-cursor overlay.
 *
 * Renders one absolutely-positioned cursor + name pill per remote peer on top
 * of the SabFlow canvas. Coordinates arrive from `PresenceState.cursor` in
 * *canvas space* (the same space node positions live in), so we transform
 * them through the canvas's current pan + zoom matrix before painting.
 *
 * Implementation notes
 * --------------------
 * - The component is purely presentational. It never mutates presence, never
 *   intercepts events (root has `pointer-events: none`), and never paints to
 *   a `<canvas>` - it's a sibling DOM layer that React owns.
 * - Movement uses CSS `transform: translate3d(...)` - GPU-cheap, no layout
 *   thrash on every cursor wiggle. The transform value is runtime-computed
 *   from the viewport matrix, so it stays in an inline style.
 * - The pan/zoom matrix is read from `canvasRef.current.getViewport()` on
 *   every animation frame while at least one peer is visible. This keeps the
 *   cursors stuck to canvas coordinates while the user pans/zooms without
 *   coupling us to the canvas's React tree.
 * - Idle: peers fade to 50% opacity after 2 s of no `lastSeen` bump, hide
 *   entirely after 10 s. We re-evaluate idleness on each rAF tick.
 *
 * Styling: all static chrome is Tailwind + 20ui tokens. Only the per-frame
 * cursor transform, the staleness opacity, and the per-peer color (cursor fill
 * + pill background) remain as inline values, since those are runtime-computed.
 *
 * Forward-decl shapes
 * -------------------
 * `presence` and `canvasRef` are typed structurally so this file can ship
 * before the consumer (sub-task #10) wires them up. The minimal contracts:
 *
 *   presence.peers: Map<number, { userId, name, color, cursor?, lastSeen }>
 *   canvasRef.current.getViewport(): { x, y, zoom }
 *
 * Anything beefier in `PresenceState` (selection, idleSince, ...) is fine -
 * we only read the four fields above.
 */

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Forward-declared shapes (kept narrow on purpose - see header).
// ---------------------------------------------------------------------------

/** Minimal peer shape the overlay needs. Matches `PresenceState`. */
export interface RemoteCursorPeer {
	readonly userId: string;
	readonly name: string;
	readonly color: string;
	readonly cursor?: { x: number; y: number } | null;
	readonly lastSeen: number;
}

/**
 * Minimal presence handle. Either `peers` (Map keyed by clientID - matches
 * `usePresence` in `src/lib/sabflow/client/usePresence.ts`) or an iterable
 * `others` array (matches the polling hook). We accept both so the consumer
 * can pick whichever it has on hand.
 */
export interface RemoteCursorPresence {
	readonly peers?: ReadonlyMap<number | string, RemoteCursorPeer>;
	readonly others?: ReadonlyArray<RemoteCursorPeer>;
}

/** Pan + zoom snapshot of the canvas viewport. */
export interface CanvasViewport {
	/** Pan offset in *viewport* pixels (canvas-origin to DOM origin). */
	readonly x: number;
	readonly y: number;
	/** Uniform scale factor; 1 = 100 %. */
	readonly zoom: number;
}

/** Minimal canvas handle. Only `getViewport` is required. */
export interface RemoteCursorCanvasHandle {
	getViewport(): CanvasViewport;
}

export interface RemoteCursorsProps {
	readonly presence: RemoteCursorPresence;
	readonly canvasRef: { readonly current: RemoteCursorCanvasHandle | null };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fade to 50 % after this many ms without a `lastSeen` bump. */
const FADE_AFTER_MS = 2_000;
/** Hide entirely after this many ms. */
const HIDE_AFTER_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise the presence handle into a flat peer list. */
function flattenPeers(presence: RemoteCursorPresence): RemoteCursorPeer[] {
	if (presence.peers) {
		const out: RemoteCursorPeer[] = [];
		for (const p of presence.peers.values()) out.push(p);
		return out;
	}
	return presence.others ? [...presence.others] : [];
}

/** Map canvas-space `(x, y)` to viewport-space pixels via the pan+zoom matrix. */
function toViewport(
	x: number,
	y: number,
	v: CanvasViewport,
): { vx: number; vy: number } {
	return { vx: x * v.zoom + v.x, vy: y * v.zoom + v.y };
}

/** Opacity step based on staleness - 1, then 0.5, then 0. */
function opacityFor(ageMs: number): number {
	if (ageMs >= HIDE_AFTER_MS) return 0;
	if (ageMs >= FADE_AFTER_MS) return 0.5;
	return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render the live cursors of every remote peer in `presence` on top of the
 * canvas. Pure overlay - does not capture pointer events.
 */
export function RemoteCursors({
	presence,
	canvasRef,
}: RemoteCursorsProps): React.JSX.Element | null {
	const peers = flattenPeers(presence);

	// `tick` exists solely to nudge a re-render on every animation frame while
	// peers are present. We don't store the viewport in state - reading it
	// straight from the ref keeps movement in lockstep with whatever the
	// canvas is doing this frame (no React to CSS one-frame lag).
	const [, setTick] = useState(0);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (peers.length === 0) return undefined;
		let cancelled = false;
		const loop = (): void => {
			if (cancelled) return;
			setTick((t) => (t + 1) & 0xffff);
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			cancelled = true;
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		};
		// `peers.length` is intentionally the only dep - we don't want to
		// tear down the rAF loop when individual peer fields change.
	}, [peers.length]);

	if (peers.length === 0) return null;

	const viewport = canvasRef.current?.getViewport() ?? {
		x: 0,
		y: 0,
		zoom: 1,
	};
	const now = Date.now();

	return (
		<div
			aria-hidden
			data-testid="remote-cursors"
			// `z-30` establishes the containing block for the children's absolute
			// positioning + provides a stacking context above the canvas.
			className="absolute inset-0 z-30 overflow-hidden pointer-events-none"
		>
			{peers.map((peer) => {
				if (!peer.cursor) return null;
				const opacity = opacityFor(now - peer.lastSeen);
				if (opacity === 0) return null;
				const { vx, vy } = toViewport(
					peer.cursor.x,
					peer.cursor.y,
					viewport,
				);
				return (
					<RemoteCursor
						key={peer.userId}
						name={peer.name}
						color={peer.color}
						vx={vx}
						vy={vy}
						opacity={opacity}
					/>
				);
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Cursor sub-component - arrow SVG + name pill
// ---------------------------------------------------------------------------

interface RemoteCursorInnerProps {
	readonly name: string;
	readonly color: string;
	readonly vx: number;
	readonly vy: number;
	readonly opacity: number;
}

function RemoteCursor({
	name,
	color,
	vx,
	vy,
	opacity,
}: RemoteCursorInnerProps): React.JSX.Element {
	return (
		<div
			className="absolute left-0 top-0 pointer-events-none transition-opacity duration-200 ease-linear will-change-transform"
			// Runtime-computed: per-frame GPU translate + staleness opacity.
			style={{ transform: `translate3d(${vx}px, ${vy}px, 0)`, opacity }}
		>
			{/* Arrow - 14x14 SVG anchored at top-left so (vx,vy) is the tip. */}
			<svg
				aria-hidden
				width={14}
				height={14}
				viewBox="0 0 14 14"
				className="block [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.25))]"
			>
				<path
					d="M1 1 L1 11 L4.2 8 L6.4 13 L8.2 12.2 L6 7.2 L11 7 Z"
					// `fill` is the runtime per-peer color; presentation attr, not a style.
					fill={color}
					stroke="#fff"
					strokeWidth={1}
					strokeLinejoin="round"
				/>
			</svg>
			{/* Name pill - offset so it sits to the lower-right of the tip. */}
			<div
				className="absolute left-3 top-3 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--st-radius-sm)] px-1.5 py-0.5 font-[var(--st-font)] text-[11px] font-medium leading-[14px] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)]"
				// Runtime-computed: per-peer pill color.
				style={{ background: color }}
			>
				{name}
			</div>
		</div>
	);
}

export default RemoteCursors;
