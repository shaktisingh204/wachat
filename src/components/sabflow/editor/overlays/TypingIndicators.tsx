'use client';

/**
 * Track Audit A · Phase 7 · Sub-task 5/10 — Typing indicator overlay.
 *
 * Renders a small "Alice is typing…" pill below a block whenever a remote
 * peer's presence entry carries a fresh `typing.blockId` matching the
 * block we're rendering for.
 *
 * Consumer wiring (typical):
 *
 *     const { others } = usePresence(flowId);
 *     <TypingIndicators blockId={block.id} peers={others} />
 *
 * The pill auto-fades after {@link STALE_MS} (5 s) of presence quiet —
 * useful when a peer's tab loses focus but the slot hasn't been cleared
 * yet by the 2 s debounce.  Re-rendering is driven by an internal
 * `now` tick that runs only while at least one matching peer is present,
 * so idle blocks pay zero render cost.
 */

import { useEffect, useState } from 'react';

/** A typing slot living on a presence entry. */
type TypingSignal = {
  blockId: string;
  at: number;
};

/** Subset of a presence peer that this component needs. */
export type TypingPeer = {
  userId: string;
  name?: string;
  typing?: TypingSignal | null;
};

/** Hide the pill once the slot is older than this. */
const STALE_MS = 5_000;

/** How often we re-evaluate staleness while peers are typing. */
const TICK_MS = 1_000;

function displayNameOf(peer: TypingPeer): string {
  const trimmed = (peer.name ?? '').trim();
  return trimmed.length > 0 ? trimmed : peer.userId;
}

/**
 * Format the typing list as "Alice", "Alice and Bob", or
 * "Alice, Bob and 2 others" — the conventional collaborative-editor
 * phrasing.
 */
function summarise(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  const head = names.slice(0, 2).join(', ');
  const rest = names.length - 2;
  return `${head} and ${rest} ${rest === 1 ? 'other' : 'others'} are typing`;
}

export function TypingIndicators({
  blockId,
  peers,
}: {
  blockId: string;
  peers: readonly TypingPeer[];
}) {
  // We re-render once per second so stale entries naturally drop out of
  // the filter below.  The tick is only mounted when there's something
  // to watch — see the early-exit branch.
  const [now, setNow] = useState<number>(() => Date.now());

  const candidates = peers.filter(
    (p) => p.typing != null && p.typing.blockId === blockId,
  );

  useEffect(() => {
    if (candidates.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
    // We intentionally key on `candidates.length` rather than the array
    // reference — the parent will hand us a new array on every presence
    // poll, and we don't want to restart the timer on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length]);

  const fresh = candidates.filter((p) => {
    const at = p.typing?.at ?? 0;
    return now - at < STALE_MS;
  });

  if (fresh.length === 0) return null;

  const names = fresh.map(displayNameOf);
  const label = summarise(names);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none mt-1 flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-[var(--gray-11)]"
      data-typing-block-id={blockId}
    >
      <span
        aria-hidden
        className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-zoru-ink"
      />
      <span className="rounded-full bg-[var(--gray-3)] px-2 py-0.5">
        {label}
        <span aria-hidden className="ml-0.5 inline-block animate-pulse">
          …
        </span>
      </span>
    </div>
  );
}
