'use client';

/**
 * FocusedNodeHighlight — Track A Phase 6, sub-task #8.
 *
 * Renders a per-peer outline ring around a flow block when one or more
 * remote peers have it inside their selection set.  Each peer gets their
 * own ring colour (via sibling #7's `colorForUserId`) and rings stack
 * outwards by 2 px so all peers stay visible simultaneously.
 *
 * On hover, a stacked avatar group surfaces in the top-right corner so a
 * user can identify who's looking without needing tooltips on every ring.
 *
 * Usage:
 *
 *   <div style={{ position: 'relative' }}>
 *     <BlockCard … />
 *     <FocusedNodeHighlight blockId={block.id} peerSelections={peerSelections} />
 *   </div>
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

/** Shape of what each peer reports — a subset of `PresenceEntry`. */
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
   * Optional override — defaults to a stable hash-based palette identical
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

function initialOf(peer: PeerSelection): string {
  return (peer.name ?? peer.userId ?? '?').trim().charAt(0).toUpperCase() || '?';
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

  // Pulse the outline on first focus (200 ms ease-out). We key the
  // animation off a counter that increments when the *set* of peers
  // transitions from empty to non-empty.
  const [pulseKey, setPulseKey] = useState(0);
  const wasFocusedRef = useRef(false);
  useEffect(() => {
    const nowFocused = focusedPeers.length > 0;
    if (nowFocused && !wasFocusedRef.current) {
      setPulseKey((k) => k + 1);
    }
    wasFocusedRef.current = nowFocused;
  }, [focusedPeers.length]);

  if (focusedPeers.length === 0) return null;

  const shown = focusedPeers.slice(0, maxAvatars);
  const overflow = focusedPeers.length - shown.length;

  return (
    <div
      aria-hidden="false"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none', // rings shouldn't block canvas interaction…
      }}
    >
      {/* Stacked outline rings — outermost first, offset 2 px each. */}
      {focusedPeers.map((peer, idx) => {
        const inset = -(idx * 2 + 2); // -2, -4, -6, …
        const color = colorForUserId(peer.userId);
        return (
          <div
            key={`${peer.userId}-${pulseKey}`}
            style={{
              position: 'absolute',
              top: inset,
              left: inset,
              right: inset,
              bottom: inset,
              borderRadius: 10,
              border: `2px solid ${color}`,
              boxShadow: `0 0 0 1px ${color}33`,
              animation: idx === 0 ? 'sabflow-focus-pulse 200ms ease-out' : undefined,
              willChange: idx === 0 ? 'transform, opacity' : undefined,
            }}
          />
        );
      })}

      {/* Hover avatar group — re-enables pointer events on itself only. */}
      <div
        style={{
          position: 'absolute',
          top: -10,
          right: -6,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          opacity: hover ? 1 : 0,
          transform: hover ? 'translateY(0)' : 'translateY(-2px)',
          transition: 'opacity 120ms ease-out, transform 120ms ease-out',
          pointerEvents: hover ? 'auto' : 'none',
        }}
      >
        {shown.map((peer, idx) => {
          const color = colorForUserId(peer.userId);
          return (
            <span
              key={peer.userId}
              title={`${peer.name ?? peer.userId} — focused here`}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: peer.avatarUrl ? 'transparent' : color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1,
                border: `2px solid ${color}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                marginLeft: idx === 0 ? 0 : -6,
                zIndex: shown.length - idx,
              }}
            >
              {peer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={peer.avatarUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span>{initialOf(peer)}</span>
              )}
            </span>
          );
        })}
        {overflow > 0 && (
          <span
            title={`${overflow} more peer${overflow === 1 ? '' : 's'} focused`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              marginLeft: -6,
              borderRadius: 10,
              background: 'rgba(24,24,27,0.92)',
              color: '#fafafa',
              fontSize: 10,
              fontWeight: 600,
              border: '2px solid rgba(255,255,255,0.6)',
            }}
          >
            +{overflow}
          </span>
        )}
      </div>

      {/* Scoped keyframes — inline so the component is fully self-contained
          and doesn't depend on a global stylesheet shipping the rule. */}
      <style>{`
        @keyframes sabflow-focus-pulse {
          0%   { transform: scale(1.06); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default FocusedNodeHighlight;
