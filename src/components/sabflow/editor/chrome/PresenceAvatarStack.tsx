'use client';

/**
 * SabFlow editor, top-right presence avatar stack (Track A, Phase 7, #2/10).
 *
 * Renders up to `max` active peers as a tight, outer-first overlapping stack
 * of 28x28 rounded-square avatars, each ringed by the peer's deterministic
 * color. Overflow collapses into a neutral "+N more" pill that opens a
 * popover listing every remaining peer. Idle peers (no setLocal in
 * the idle window) render at 50% opacity with a gray "status" dot instead
 * of the green "active" dot.
 *
 * Design contract
 * ...............
 *   - Pure presentational. The hook (`usePresence`) lives one layer up; this
 *     component just maps a `peers` array to DOM. That keeps it SSR-safe:
 *     parents can pass `peers={[]}` during the server render and hydrate
 *     real data on the client without divergent markup.
 *   - Color comes from `peer.color` when provided, falling back to
 *     `colorForUserId(peer.id)` so the ring stays stable even if the parent
 *     forgot to plumb the color through (e.g. older awareness payloads).
 *   - Initials come from `peer.name` via {@link nameInitials} (handles
 *     emoji / ZWJ / RTL gracefully) and are only rendered when no avatar
 *     URL is supplied.
 *   - Click is opt-in. Sub-task #6 (follow-user) will plumb the handler.
 *     Without `onPeerClick` the avatar renders as a plain `<span>` (no
 *     focus ring, no pointer cursor) so it stays inert and quiet.
 *
 * Layout
 * ......
 *   - Inline-flex row, `-space-x-2` (= 8px overlap per pair).
 *   - `flex-row-reverse` + reversed source order = first peer ends up on
 *     the left and visually on top (outer-first stacking).
 *   - Each avatar gets a `zIndex` so hover/focus surfaces above its
 *     neighbours without breaking the overlap.
 */

import * as React from 'react';

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Button,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import {
	colorForUserId,
	nameInitials,
} from '@/lib/sabflow/client/user-color';

// .............................................................................
// Public types
// .............................................................................

/**
 * Minimal shape this component needs to render a peer. Designed as a
 * structural subset of the SabFlow `PresenceState` so the parent can pass
 * awareness entries through with at most a 1-line `.map`.
 */
export interface PresencePeer {
	/** Stable user id, feeds {@link colorForUserId} as a fallback. */
	readonly id: string;
	/** Display name. Used for initials, tooltip, and popover row. */
	readonly name: string;
	/** Resolved hex color. Falls back to `colorForUserId(id)` if absent. */
	readonly color?: string;
	/** Optional avatar URL. When present it replaces the initials. */
	readonly avatarUrl?: string | null;
	/**
	 * Wall-clock ms of the peer's most recent activity. Drives the
	 * "last active" tooltip line.
	 */
	readonly lastActiveAt?: number | null;
	/** `true` when the peer has been quiet for the idle threshold. */
	readonly idle?: boolean;
}

export interface PresenceAvatarStackProps {
	/** Active + idle peers, already de-duplicated and ordered. */
	readonly peers: readonly PresencePeer[];
	/** Max avatars shown before collapsing into "+N more". Default 5. */
	readonly max?: number;
	/** Invoked with the peer id on click, wired by sub-task #6. */
	readonly onPeerClick?: (peerId: string) => void;
	/** Optional className for the outer wrapper (positioning, etc.). */
	readonly className?: string;
}

// .............................................................................
// Helpers
// .............................................................................

/**
 * Format a millisecond timestamp as a human-friendly "X ago" suffix for the
 * tooltip. Kept tiny and synchronous (no `Intl.RelativeTimeFormat` instance
 * per render, no date-fns) so the component stays cheap on hover.
 *
 * Falls back to `'just now'` for missing / future timestamps so the tooltip
 * never reads as "active in -3 seconds".
 */
function formatLastActive(ts: number | null | undefined): string {
	if (typeof ts !== 'number' || !Number.isFinite(ts)) return 'just now';
	const delta = Date.now() - ts;
	if (delta < 5_000) return 'just now';
	if (delta < 60_000) return `${Math.floor(delta / 1_000)}s ago`;
	if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
	if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
	return `${Math.floor(delta / 86_400_000)}d ago`;
}

/** Resolve the ring color for a peer, falling back to the deterministic palette. */
function resolveColor(peer: PresencePeer): string {
	return peer.color && peer.color.length > 0
		? peer.color
		: colorForUserId(peer.id);
}

// .............................................................................
// Internal avatar tile
// .............................................................................

interface AvatarTileProps {
	readonly peer: PresencePeer;
	readonly onPeerClick?: (peerId: string) => void;
	readonly stackIndex: number;
}

/**
 * One 28x28 avatar in the stack. Memoised so re-renders triggered by an
 * unrelated peer's heartbeat do not repaint the whole row.
 */
const AvatarTile = React.memo(function AvatarTile({
	peer,
	onPeerClick,
	stackIndex,
}: AvatarTileProps) {
	const color = resolveColor(peer);
	const initials = nameInitials(peer.name) || '?';
	const isIdle = peer.idle === true;
	const lastActive = formatLastActive(peer.lastActiveAt);

	const handleClick = React.useCallback(() => {
		onPeerClick?.(peer.id);
	}, [onPeerClick, peer.id]);

	const tileClass = cn(
		'relative inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] p-0',
		'bg-[var(--st-bg-muted)] text-[10px] font-semibold uppercase text-[var(--st-text)]',
		'transition-opacity',
		isIdle && 'opacity-50',
		onPeerClick &&
			'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--st-bg)]',
	);
	// 3px solid border in the peer's color. Inline because the dynamic hex value
	// never needs to round-trip through Tailwind's JIT.
	const borderStyle: React.CSSProperties = {
		border: `3px solid ${color}`,
		// `box-sizing: border-box` is the Tailwind default; the 28px outer
		// dimension already includes the ring.
	};

	const dotClass = cn(
		'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--st-bg)]',
		isIdle ? 'bg-[var(--st-text-tertiary)]' : 'bg-[var(--st-status-ok)]',
	);

	const inner = (
		<>
			{peer.avatarUrl ? (
				// Presence avatars are tiny (28px) and short-lived in the
				// viewport, so `next/image` would force the host page into a
				// dynamic-import path with no measurable bandwidth win.
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={peer.avatarUrl}
					alt=""
					className="h-full w-full rounded-[3px] object-cover"
					draggable={false}
				/>
			) : (
				<span aria-hidden="true">{initials}</span>
			)}
			<span className={dotClass} aria-hidden="true" />
		</>
	);

	const tooltipBody = (
		<div className="flex flex-col gap-0.5 text-left">
			<span className="font-semibold leading-tight">{peer.name}</span>
			<span className="text-[10px] leading-tight text-[var(--st-text-secondary)]">
				{isIdle ? `Idle, ${lastActive}` : `Active, ${lastActive}`}
			</span>
		</div>
	);

	// `zIndex: stackIndex` keeps the natural DOM-order layering so the
	// left-most avatar sits on top while still allowing hover to bring the
	// focused tile forward.
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{onPeerClick ? (
					<Button
						variant="ghost"
						onClick={handleClick}
						aria-label={`Follow ${peer.name}`}
						className={tileClass}
						style={{ ...borderStyle, zIndex: stackIndex }}
					>
						{inner}
					</Button>
				) : (
					<span
						role="img"
						aria-label={peer.name}
						className={tileClass}
						style={{ ...borderStyle, zIndex: stackIndex }}
					>
						{inner}
					</span>
				)}
			</TooltipTrigger>
			<TooltipContent side="bottom">{tooltipBody}</TooltipContent>
		</Tooltip>
	);
});

// .............................................................................
// Overflow popover
// .............................................................................

interface OverflowPillProps {
	readonly overflow: readonly PresencePeer[];
	readonly onPeerClick?: (peerId: string) => void;
}

const OverflowPill = React.memo(function OverflowPill({
	overflow,
	onPeerClick,
}: OverflowPillProps) {
	const count = overflow.length;
	if (count === 0) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					aria-label={`${count} more ${count === 1 ? 'collaborator' : 'collaborators'}`}
					className={cn(
						'relative z-0 inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--st-radius)]',
						'border-2 border-[var(--st-bg)] bg-[var(--st-bg-muted)] px-1.5 text-[10px] font-semibold text-[var(--st-text)]',
						'hover:bg-[var(--st-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]',
						'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--st-bg)]',
					)}
				>
					+{count}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-64 p-2"
				// Avoid Radix's default "return focus to trigger" because the
				// trigger sits inside a stacking context that the editor
				// canvas can occlude on small viewports.
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
					{count} more
				</div>
				<ul className="flex flex-col" role="list">
					{overflow.map((peer) => {
						const color = resolveColor(peer);
						const initials = nameInitials(peer.name) || '?';
						const isIdle = peer.idle === true;
						const lastActive = formatLastActive(peer.lastActiveAt);
						const rowClass = cn(
							'flex items-center gap-2 rounded-[var(--st-radius)] px-2 py-1.5 text-left text-sm',
							'transition-colors',
							isIdle && 'opacity-60',
							onPeerClick && 'hover:bg-[var(--st-bg-muted)] cursor-pointer',
						);
						const tile = (
							<span
								className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[9px] font-semibold uppercase text-[var(--st-text)]"
								style={{ border: `2px solid ${color}` }}
								aria-hidden="true"
							>
								{peer.avatarUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={peer.avatarUrl}
										alt=""
										className="h-full w-full rounded-[3px] object-cover"
										draggable={false}
									/>
								) : (
									<span>{initials}</span>
								)}
							</span>
						);
						const body = (
							<>
								{tile}
								<span className="flex min-w-0 flex-col">
									<span className="truncate font-medium text-[var(--st-text)]">
										{peer.name}
									</span>
									<span className="truncate text-[10px] text-[var(--st-text-secondary)]">
										{isIdle ? `Idle, ${lastActive}` : `Active, ${lastActive}`}
									</span>
								</span>
							</>
						);
						return (
							<li key={peer.id}>
								{onPeerClick ? (
									<Button
										variant="ghost"
										className={cn(rowClass, 'w-full justify-start')}
										onClick={() => onPeerClick(peer.id)}
									>
										{body}
									</Button>
								) : (
									<div className={rowClass}>{body}</div>
								)}
							</li>
						);
					})}
				</ul>
			</PopoverContent>
		</Popover>
	);
});

// .............................................................................
// Public component
// .............................................................................

/**
 * Stacked-avatar presence indicator for the SabFlow editor chrome.
 *
 * @example
 *   const { peers } = usePresence(...);
 *   <PresenceAvatarStack
 *     peers={[...peers.values()].map(toPresencePeer)}
 *     onPeerClick={followUser}
 *   />
 */
export function PresenceAvatarStack({
	peers,
	max = 5,
	onPeerClick,
	className,
}: PresenceAvatarStackProps): React.ReactElement | null {
	// Split into "shown" + "overflow" once per render. `useMemo` is overkill
	// for a 5-element slice, but the function-reference stability matters
	// because `OverflowPill` is memoised on its `overflow` prop.
	const { shown, overflow } = React.useMemo(() => {
		if (peers.length <= max) {
			return { shown: peers, overflow: [] as PresencePeer[] };
		}
		return {
			shown: peers.slice(0, max),
			overflow: peers.slice(max),
		};
	}, [peers, max]);

	if (peers.length === 0) return null;

	// `flex-row-reverse` paired with `.slice().reverse()` keeps the
	// first peer rendered last in DOM order, which means it sits on top of
	// the stack (outer-first overlap) without needing per-tile z-index math
	// beyond the small offsets we already apply.
	const reversed = shown.slice().reverse();

	return (
		<TooltipProvider delayDuration={150} skipDelayDuration={300}>
			<div
				className={cn(
					'flex flex-row-reverse items-center -space-x-2 space-x-reverse',
					className,
				)}
				role="group"
				aria-label={`${peers.length} active ${peers.length === 1 ? 'collaborator' : 'collaborators'}`}
			>
				{overflow.length > 0 && (
					<OverflowPill overflow={overflow} onPeerClick={onPeerClick} />
				)}
				{reversed.map((peer, i) => (
					<AvatarTile
						key={peer.id}
						peer={peer}
						onPeerClick={onPeerClick}
						// Higher index = later in DOM = visually on top when
						// the row is read right-to-left thanks to
						// `flex-row-reverse`. Translates to outer-first.
						stackIndex={shown.length - i}
					/>
				))}
			</div>
		</TooltipProvider>
	);
}

export default PresenceAvatarStack;
