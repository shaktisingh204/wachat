'use client';

import { Play, Copy, Trash2 } from 'lucide-react';

import { ButtonGroup, IconButton } from '@/components/sabcrm/20ui';
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
    <ButtonGroup
      className={cn(
        'prevent-group-drag',
        'rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-md',
        'animate-in fade-in-0 slide-in-from-bottom-2',
        className,
      )}
    >
      <IconButton
        label="Preview flow from this group"
        icon={Play}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onPlayClick();
        }}
      />
      <IconButton
        label="Copy group"
        icon={Copy}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          dispatchCopyEvent();
        }}
      />
      <IconButton
        label="Delete group"
        icon={Trash2}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          dispatchDeleteEvent();
        }}
      />
    </ButtonGroup>
  );
}
