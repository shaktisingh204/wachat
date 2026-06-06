import { cn } from '@/components/sabcrm/20ui/compat';
import { Link2 } from 'lucide-react';
import { BioState } from '../types';

type Props = {
  state: BioState;
};

export function BioPreview({ state }: Props) {
  return (
    <div className="flex justify-center lg:justify-start">
      <div
        className="relative w-[375px] min-h-[640px] rounded-[2.5rem] border-4 border-[var(--st-border)] bg-[var(--st-text)] px-6 py-10 shadow-2xl overflow-hidden"
        aria-label="Preview"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {state.avatarUrl ? (
            <img
              src={state.avatarUrl}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover border-2 border-[var(--st-border)]"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[var(--st-text)] border-2 border-[var(--st-border)]" />
          )}
          <div>
            <p className={cn('text-[17px] font-semibold text-white', !state.title && 'text-[var(--st-text)]')}>
              {state.title || 'Your Name'}
            </p>
            {state.bio ? (
              <p className="mt-1 text-[13px] text-[var(--st-text-secondary)] max-w-[280px] break-words">{state.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {state.links.length === 0 ? (
            <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-text)] py-3 text-center">
              <p className="text-[12px] text-[var(--st-text)]">Your links will appear here</p>
            </div>
          ) : (
            state.links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--st-border)] bg-[var(--st-text)] px-4 py-3 text-[13px] text-white hover:bg-[var(--st-text)] transition-colors"
              >
                <Link2 className="h-3.5 w-3.5 text-[var(--st-text)] shrink-0" />
                <span className="truncate">{link.label || link.url || 'Untitled link'}</span>
              </div>
            ))
          )}
        </div>

        <div className="absolute bottom-5 left-0 right-0 text-center">
          <span className="text-[10px] text-[var(--st-text)]">Powered by SabNode</span>
        </div>
      </div>
    </div>
  );
}
