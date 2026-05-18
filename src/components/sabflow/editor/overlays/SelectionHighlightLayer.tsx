'use client';

/**
 * SabFlow editor — `<SelectionHighlightLayer />` render layer.
 *
 * Track A · Phase 7 · sub-task #4 of 10.
 *
 * What this owns
 * --------------
 * The viewport-culled render fan-out for collaborative selection halos.
 * Walks the canvas's block list, projects each block's screen rect from
 * `block.position` + the canvas viewport, and — for blocks inside the
 * visible viewport (plus a 200 px margin) — mounts one
 * `<FocusedNodeHighlight />` per block with the subset of peer selections
 * targeting that block.
 *
 * Wiring (read in pairs with Phase 6 siblings)
 * --------------------------------------------
 *   - PRESENCE: we take the same `presence` handle the rest of the editor
 *     uses and feed it to `useSelectionAwareness` to materialize a
 *     `Map<userId, Set<blockId>>`. The hook handles debounce, blur-clear
 *     and reference-stable projection — we just consume.
 *   - GEOMETRY: each block carries an `{ x, y, width?, height? }` position;
 *     `canvasRef` is the scrollable/transformed parent. We translate world
 *     space → screen space by reading `canvasRef.current` scroll + bounding
 *     rect. No external dep on the canvas store: rect is recomputed on the
 *     React passes already triggered by scroll/zoom listeners upstream.
 *   - CULLING: a 200 px-margin intersection check trims the render set so
 *     a 10 000-block canvas pays only for what's on-screen. Cheaper than a
 *     real `IntersectionObserver` here because the blocks aren't actual DOM
 *     children of the layer — they're virtual rects we compute.
 *
 * File ownership (per the brief)
 * ------------------------------
 * This file is the ONLY one in sub-task #4. It does NOT:
 *   - rebuild the awareness wire (sub-task #5 of Phase 6 owns it)
 *   - paint the per-block ring (sub-task #8 of Phase 6 owns it)
 *   - own block geometry or canvas transforms (canvas store owns it)
 *
 * Performance notes (per `react-best-practices`)
 * ----------------------------------------------
 *   - `rerender-memo`: the per-block subset Map is memoized off
 *     `peerSelections` + `blocks` so frequent presence churn doesn't
 *     rebuild on every parent render.
 *   - `rerender-derived-state-no-effect`: viewport rect is derived during
 *     render from `canvasRef.current` — no `useEffect` round-trip.
 *   - `js-set-map-lookups`: block-id → PeerSelection[] is a Map, peer
 *     membership inside a block is a Set walk (already a Set on the hook
 *     side).
 *   - `rerender-no-inline-components`: we use the existing
 *     `<FocusedNodeHighlight />`, never declare a child component inline.
 */

import { useMemo, useSyncExternalStore, type ReactElement, type RefObject } from 'react';

import {
	useSelectionAwareness,
	type PresenceHandleLike,
} from '../state/use-selection-awareness';
import {
	FocusedNodeHighlight,
	type PeerSelection,
} from './FocusedNodeHighlight';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Structural slice of a canvas block we render against. Matches the shape
 * the SabFlow canvas store publishes — `id` + `position` (`x`, `y`, and
 * optional `width`/`height`). We never mutate this; the layer is read-only.
 */
export interface CanvasBlockLike {
	readonly id: string;
	readonly position: {
		readonly x: number;
		readonly y: number;
		readonly width?: number;
		readonly height?: number;
	};
}

/**
 * Optional richer peer metadata the awareness wire may carry. We accept
 * an extractor on the `presence` handle so callers can surface peer names
 * & avatars into the hover group; if absent we fall back to `userId`.
 */
export interface SelectionHighlightLayerProps<PeerKey = unknown> {
	/** Live presence handle — same one fed to the rest of the editor. */
	readonly presence: PresenceHandleLike<PeerKey>;
	/** Block list rendered on the canvas (visible *and* off-screen). */
	readonly blocks: ReadonlyArray<CanvasBlockLike>;
	/**
	 * Ref to the scrollable canvas container. Used for world→screen
	 * translation and viewport culling. May be `null` during initial
	 * mount — we render nothing until it's attached.
	 */
	readonly canvasRef: RefObject<HTMLElement | null>;
	/**
	 * Optional per-peer identity color resolver. Forwarded straight through
	 * to `<FocusedNodeHighlight />`; if omitted that component falls back
	 * to its built-in hash palette.
	 */
	readonly colorForUserId?: (userId: string) => string;
	/**
	 * Optional resolver for human-readable peer metadata (name, avatar).
	 * Lets callers paint hover avatars without us reaching into the
	 * presence schema. Falls back to `{ userId }` when unset.
	 */
	readonly peerMetaForUserId?: (userId: string) => {
		readonly name?: string;
		readonly avatarUrl?: string;
	};
	/**
	 * Viewport-culling margin in CSS pixels. Defaults to
	 * {@link DEFAULT_CULL_MARGIN_PX} (200 px) per the brief — enough that
	 * a quick pan reveals halos without the user seeing them pop in.
	 */
	readonly cullMarginPx?: number;
	/**
	 * Default block dimensions when `block.position.width`/`height` are
	 * absent. Matches the canvas's nominal node card size so culling and
	 * rect math degrade gracefully for blocks that haven't measured yet.
	 */
	readonly defaultBlockSize?: { readonly width: number; readonly height: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cull margin (px) added to the viewport on each side. */
export const DEFAULT_CULL_MARGIN_PX = 200;

/** Fallback block size in CSS pixels when `position.width`/`height` is missing. */
const DEFAULT_BLOCK_SIZE = { width: 220, height: 96 } as const;

// ---------------------------------------------------------------------------
// Viewport subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to scroll/resize on the canvas + window so the layer recomputes
 * which blocks are in-viewport. We use `useSyncExternalStore` instead of
 * `useEffect`+`useState` so the snapshot lives outside the render loop —
 * per `react-best-practices` (`rerender-use-ref-transient-values`-style:
 * frequent scroll updates don't trash component identity).
 *
 * The snapshot is a monotonically-increasing tick — we never return the
 * rect itself, because doing so would require allocating a new object on
 * every scroll frame (defeats SES bail-out). Consumers read the rect
 * lazily inside render via `canvasRef.current`.
 */
function useViewportTick(canvasRef: RefObject<HTMLElement | null>): number {
	const subscribe = useMemo(
		() => (onChange: () => void) => {
			const el = canvasRef.current;
			if (!el || typeof window === 'undefined') return () => {};
			const opts: AddEventListenerOptions = { passive: true };
			el.addEventListener('scroll', onChange, opts);
			window.addEventListener('resize', onChange, opts);
			window.addEventListener('scroll', onChange, opts);
			return () => {
				el.removeEventListener('scroll', onChange);
				window.removeEventListener('resize', onChange);
				window.removeEventListener('scroll', onChange);
			};
		},
		[canvasRef],
	);

	// A monotone counter is enough — we just need React to re-derive the
	// per-block rects whenever scroll fires.
	const tickRef = useMemo(() => ({ value: 0 }), []);
	const getSnapshot = useMemo(
		() => () => {
			tickRef.value = (tickRef.value + 1) & 0x7fffffff;
			return tickRef.value;
		},
		[tickRef],
	);
	const getServerSnapshot = () => 0;

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------------------------------------------------------------------------
// Pure helpers (hoisted — `rendering-hoist-jsx` adjacent)
// ---------------------------------------------------------------------------

/**
 * `true` iff the block's world-space rect intersects the viewport rect
 * inflated by `margin` on every side. Both rects are in the same
 * coordinate space (canvas client coords).
 */
function intersectsViewport(
	block: { x: number; y: number; width: number; height: number },
	viewport: { left: number; top: number; right: number; bottom: number },
	margin: number,
): boolean {
	return (
		block.x + block.width >= viewport.left - margin &&
		block.x <= viewport.right + margin &&
		block.y + block.height >= viewport.top - margin &&
		block.y <= viewport.bottom + margin
	);
}

/**
 * Translate a block's world-space `position` into the canvas's *content*
 * coordinate system. The canvas owner has typically already applied scroll
 * + zoom on a transformed inner layer; this layer renders inside that same
 * transformed parent, so we emit raw `position` values and let the parent
 * transform handle the mapping. The viewport check operates on the same
 * content coords (read off `scrollLeft`/`scrollTop` + clientWidth/Height).
 */
function readViewport(el: HTMLElement | null): {
	left: number;
	top: number;
	right: number;
	bottom: number;
} | null {
	if (!el) return null;
	const left = el.scrollLeft;
	const top = el.scrollTop;
	const right = left + el.clientWidth;
	const bottom = top + el.clientHeight;
	return { left, top, right, bottom };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render layer that maps the live `peerSelections` Map onto absolutely
 * positioned `<FocusedNodeHighlight />` instances over each visible block.
 *
 * Renders inside the canvas's transformed inner surface so block
 * `position.x` / `position.y` map 1:1 to layer CSS coordinates. Parents
 * that compose with a CSS `transform: scale(…)` zoom will see halos
 * inherit the same transform — no extra math required here.
 */
export function SelectionHighlightLayer<PeerKey = unknown>(
	props: SelectionHighlightLayerProps<PeerKey>,
): ReactElement | null {
	const {
		presence,
		blocks,
		canvasRef,
		colorForUserId,
		peerMetaForUserId,
		cullMarginPx = DEFAULT_CULL_MARGIN_PX,
		defaultBlockSize = DEFAULT_BLOCK_SIZE,
	} = props;

	// Source-of-truth: the awareness hook already debounces inbound peer
	// frames and returns a reference-stable `peerSelections` Map.
	const { peerSelections } = useSelectionAwareness<PeerKey>({
		// `doc` is reserved for doc-swap resets in the hook itself; the
		// layer doesn't own the doc, so we pass `null` and rely on the
		// presence handle being swapped out by the parent on flow change.
		doc: null,
		presence,
	});

	// Re-derive on scroll/resize. The tick is unused beyond invalidation.
	useViewportTick(canvasRef);

	// ------------------------------------------------------------------
	// Invert peerSelections: blockId → PeerSelection[]
	// ------------------------------------------------------------------
	// `useSelectionAwareness` returns `Map<userId, Set<blockId>>`. Our
	// child takes the opposite shape (`blockId → who has it`). One linear
	// pass; memoized so re-renders triggered solely by scroll don't redo
	// the inversion. Per `js-set-map-lookups` we use a Map for O(1) reads.

	const peerListByBlock = useMemo(() => {
		const out = new Map<string, PeerSelection[]>();
		for (const [userId, blockIds] of peerSelections) {
			const meta = peerMetaForUserId?.(userId);
			// One PeerSelection per peer — the child filters by `blockId`
			// against `selectedBlockIds`, so we hand each block only its
			// peers (not every peer's full set).
			for (const blockId of blockIds) {
				let bucket = out.get(blockId);
				if (!bucket) {
					bucket = [];
					out.set(blockId, bucket);
				}
				bucket.push({
					userId,
					name: meta?.name,
					avatarUrl: meta?.avatarUrl,
					// Single-id slice: the child only needs to know that
					// THIS peer focuses THIS block. Avoids broadcasting a
					// peer's full selection set to every block they touch.
					selectedBlockIds: [blockId],
				});
			}
		}
		return out;
	}, [peerSelections, peerMetaForUserId]);

	// ------------------------------------------------------------------
	// Viewport rect — derived during render (no effect round-trip)
	// ------------------------------------------------------------------

	const viewport = readViewport(canvasRef.current);
	if (!viewport) return null;

	// ------------------------------------------------------------------
	// Render visible blocks
	// ------------------------------------------------------------------

	const children: ReactElement[] = [];
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		// Skip blocks no peer has selected. Cheaper than rendering a
		// `<FocusedNodeHighlight />` that itself returns `null` — saves
		// the child's `useMemo`/`useState`/effect setup on cold blocks.
		const peers = peerListByBlock.get(block.id);
		if (!peers || peers.length === 0) continue;

		const width = block.position.width ?? defaultBlockSize.width;
		const height = block.position.height ?? defaultBlockSize.height;
		const rect = {
			x: block.position.x,
			y: block.position.y,
			width,
			height,
		};

		// Viewport cull: skip blocks fully outside the visible area +
		// margin. We still drive the awareness wire for them (the hook
		// runs once per layer), we just don't paint.
		if (!intersectsViewport(rect, viewport, cullMarginPx)) continue;

		children.push(
			<div
				key={block.id}
				// Halos don't intercept canvas pointer events; only the
				// child's hover-avatar group re-enables pointer-events on
				// itself. Keeps panning/marquee/select reach-through intact.
				style={{
					position: 'absolute',
					left: rect.x,
					top: rect.y,
					width: rect.width,
					height: rect.height,
					pointerEvents: 'none',
				}}
			>
				<FocusedNodeHighlight
					blockId={block.id}
					peerSelections={peers}
					colorForUserId={colorForUserId}
				/>
			</div>,
		);
	}

	if (children.length === 0) return null;

	return (
		<div
			data-sabflow-overlay="selection-highlight"
			aria-hidden="true"
			style={{
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
				// Sit above edges, below the active-drag ghost. The parent
				// canvas owns the broader z-order contract; we just claim
				// a mid-band slot that matches sibling overlays.
				zIndex: 5,
			}}
		>
			{children}
		</div>
	);
}

export default SelectionHighlightLayer;
