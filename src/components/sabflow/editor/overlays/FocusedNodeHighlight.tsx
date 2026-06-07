'use client';

/**
 * FocusedNodeHighlight - Track A Phase 6, sub-task #8.
 *
 * Renders a per-peer outline ring around a flow block when one or more
 * remote peers have it inside their selection set. Each peer gets their
 * own ring colour (via sibling #7's `colorForUserId`) and rings stack
 * outwards by 2 px so all peers stay visible simultaneously.
 *
 * On hover, a stacked avatar group surfaces in the top-right corner so a
 * user can identify who's looking. Each avatar carries a 20ui tooltip,
 * so the identity is reachable by keyboard and assistive tech too.
 *
 * Usage:
 *
 *   <div className="relative">
 *     <BlockCard … />
 *     <FocusedNodeHighlight blockId={block.id} peerSelections={peerSelections} />
 *   </div>
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';

import {
  Avatar,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/sabcrm/20ui';

/** Shape of what each peer reports - a subset of `PresenceEntry`. */
export type PeerSelection = {
  userId: string;
  name?: string;
  avatarUrl?: string;
  /** IDs of blocks the peer currently has selected/focused. */
  selectedBlockIds: string[];
};

type Props = {
  blockId: string;
  peerSelections: PeerSelection[];
  /**
   * Optional override - defaults to a stable hash-based palette identical
   * in spirit to sibling #7's `colorForUserId`. Lets us decouple from
   * sibling #7's exact module path until it lands.
   */
  colorForUserId?: (userId: string) => string;
  /** Max avatars shown in the hover group before collapsing into "+N". */
  maxAvatars?: number;
};

const FALLBACK_PALETTE = [
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
] as const;

function fallbackColorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

export function FocusedNodeHighlight({
  blockId,
  peerSelections,
  colorForUserId = fallbackColorForUserId,
  maxAvatars = 3,
}: Props): ReactElement | null {
  // Filter to peers that have this block selected. Memoised so the array
  // identity is stable while the peer list churns on heartbeats.
  const focusedPeers = useMemo(
    () => peerSelections.filter((p) => p.selectedBlockIds.includes(blockId)),
    [peerSelections, blockId],
  );

  const [hover, setHover] = useState(false);

  if (focusedPeers.length === 0) return null;

  const shown = focusedPeers.slice(0, maxAvatars);
  const overflow = focusedPeers.length - shown.length;

  return (
    <div
      aria-hidden="false"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="pointer-events-none absolute inset-0"
    >
      {/* Stacked outline rings - outermost first, offset 2 px each. The inset
          and per-peer colour are runtime-computed, so they stay inline. */}
      {focusedPeers.map((peer, idx) => {
        const inset = -(idx * 2 + 2); // -2, -4, -6, …
        const color = colorForUserId(peer.userId);
        const ringStyle: CSSProperties = {
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 1px ${color}33`,
        };
        return (
          <div
            key={peer.userId}
            className="absolute rounded-[var(--st-radius-lg)]"
            style={ringStyle}
          />
        );
      })}

      {/* Hover avatar group - re-enables pointer events on itself only. */}
      <TooltipProvider delayDuration={120}>
        <div
          className={[
            'absolute -right-1.5 -top-2.5 flex items-center',
            'transition-[opacity,transform] duration-[var(--u-dur-fast)] ease-[var(--u-ease-out)]',
            hover
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-0.5 opacity-0',
          ].join(' ')}
        >
          {shown.map((peer, idx) => {
            const color = colorForUserId(peer.userId);
            // Per-peer ring colour is runtime-computed, so it stays inline.
            const ringStyle: CSSProperties = {
              border: `2px solid ${color}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
            };
            return (
              <Tooltip key={peer.userId}>
                <TooltipTrigger asChild>
                  <span
                    className={[
                      'inline-flex items-center justify-center rounded-full',
                      idx === 0 ? '' : '-ml-1.5',
                    ].join(' ')}
                    style={ringStyle}
                  >
                    <Avatar
                      name={peer.name ?? peer.userId}
                      src={peer.avatarUrl}
                      size="xs"
                      shape="round"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {`${peer.name ?? peer.userId}, focused here`}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {overflow > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="-ml-1.5 inline-flex">
                  <Badge tone="neutral" kind="solid">{`+${overflow}`}</Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {`${overflow} more peer${overflow === 1 ? '' : 's'} focused`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}

export default FocusedNodeHighlight;
