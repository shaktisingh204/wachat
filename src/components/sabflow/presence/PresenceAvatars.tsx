'use client';

/**
 * Stacked-avatar renderer for the presence indicator (Step 33).
 *
 * Drop into the editor toolbar:
 *
 *   const { others } = usePresence(flowId);
 *   <PresenceAvatars others={others} />
 *
 * Shows up to N avatars side-by-side with a "+M" overflow chip.  Each
 * avatar tooltips its display name; missing avatars get the initial-letter
 * colored bubble.
 */

import type { PresenceEntry } from './usePresence';

const AVATAR_PALETTE = [
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
  'bg-[var(--st-text)]',
];

function colourFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialOf(entry: PresenceEntry): string {
  return (entry.name ?? entry.userId ?? '?').trim().charAt(0).toUpperCase() || '?';
}

export function PresenceAvatars({
  others,
  max = 5,
}: {
  others: PresenceEntry[];
  max?: number;
}) {
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const overflow = others.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((entry) => (
        <span
          key={entry.userId}
          title={`${entry.name ?? entry.userId} — viewing now`}
          className={`relative inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-[var(--gray-1)] text-[10px] font-semibold text-white ${
            entry.avatarUrl ? 'bg-transparent' : colourFor(entry.userId)
          }`}
        >
          {entry.avatarUrl ? (
            // Disable Next/Image to avoid forcing the consumer page into a
            // dynamic-import path; presence avatars are tiny and cached by
            // the browser.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.avatarUrl}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>{initialOf(entry)}</span>
          )}
          <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-[var(--st-text)] ring-2 ring-[var(--gray-1)]" />
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={`${overflow} more viewing`}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full ring-2 ring-[var(--gray-1)] bg-[var(--gray-4)] px-1.5 text-[10px] font-semibold text-[var(--gray-12)]"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
