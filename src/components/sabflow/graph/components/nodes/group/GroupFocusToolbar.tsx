'use client';
import { LuPlay, LuCopy, LuTrash2 } from 'react-icons/lu';
import { cn } from '@/lib/utils';

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

type Props = {
  groupId: string;
  isSingleFocus: boolean;
  onPlayClick: () => void;
  className?: string;
};

export function GroupFocusToolbar({ isSingleFocus, onPlayClick, className }: Props) {
  if (!isSingleFocus) return null;

  const dispatchCopyEvent = () => {
    dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'c',
        [isMac() ? 'metaKey' : 'ctrlKey']: true,
        bubbles: true,
      }),
    );
  };

  const dispatchDeleteEvent = () => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
  };

  return (
    <div
      className={cn(
        'prevent-group-drag',
        'flex items-center rounded-md border shadow-md',
        'bg-[var(--gray-1)] border-[var(--gray-5)]',
        'animate-in fade-in-0 slide-in-from-bottom-2',
        className,
      )}
    >
      {/* Play */}
      <button
        type="button"
        aria-label="Preview flow from this group"
        onClick={(e) => {
          e.stopPropagation();
          onPlayClick();
        }}
        className="h-7 w-7 flex items-center justify-center hover:bg-[var(--gray-3)] transition-colors rounded-l-md"
      >
        <LuPlay size={13} />
      </button>

      <div className="w-px self-stretch bg-[var(--gray-5)]" />

      {/* Copy */}
      <button
        type="button"
        aria-label="Copy group"
        onClick={(e) => {
          e.stopPropagation();
          dispatchCopyEvent();
        }}
        className="h-7 w-7 flex items-center justify-center hover:bg-[var(--gray-3)] transition-colors"
      >
        <LuCopy size={13} />
      </button>

      <div className="w-px self-stretch bg-[var(--gray-5)]" />

      {/* Delete */}
      <button
        type="button"
        aria-label="Delete group"
        onClick={(e) => {
          e.stopPropagation();
          dispatchDeleteEvent();
        }}
        className="h-7 w-7 flex items-center justify-center hover:bg-[var(--gray-3)] transition-colors rounded-r-md"
      >
        <LuTrash2 size={13} />
      </button>
    </div>
  );
}
