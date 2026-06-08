import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { Link2, User } from 'lucide-react';
import { BioState } from '../types';

type Props = {
  state: BioState;
};

export function BioPreview({ state }: Props) {
  const displayName = state.title || 'Your Name';
  const initials =
    displayName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'YN';

  return (
    <div className="flex justify-center lg:justify-start">
      {/* Phone mockup: the inner screen runs on the 20ui dark scope so the
          --st-* tokens resolve to their dark-surface values (light text on a
          dark screen) without any inverted color hacks. */}
      <div
        className="20ui dark relative w-[375px] min-h-[640px] overflow-hidden rounded-[2.5rem] border-4 border-[var(--st-border-strong)] bg-[var(--st-bg)] px-6 py-10 shadow-[var(--st-shadow-lg)]"
        role="img"
        aria-label={`Link-in-bio preview for ${displayName}`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="h-20 w-20 border-2 border-[var(--st-border)]">
            {state.avatarUrl ? (
              <AvatarImage src={state.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {state.title ? (
                initials
              ) : (
                <User className="h-7 w-7 text-[var(--st-text-tertiary)]" aria-hidden="true" />
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[17px] font-semibold text-[var(--st-text)]">
              {displayName}
            </p>
            {state.bio ? (
              <p className="mt-1 max-w-[280px] break-words text-[13px] text-[var(--st-text-secondary)]">
                {state.bio}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {state.links.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Link2}
              title="No links yet"
              description="Your links will appear here as you add them."
            />
          ) : (
            state.links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3 text-[13px] text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)]"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="truncate">{link.label || link.url || 'Untitled link'}</span>
              </div>
            ))
          )}
        </div>

        <div className="absolute inset-x-0 bottom-5 text-center">
          <span className="text-[10px] text-[var(--st-text-tertiary)]">Powered by SabNode</span>
        </div>
      </div>
    </div>
  );
}
