'use client';

import type { MouseEvent } from 'react';
import { Settings, Copy, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  onSettingsClick: () => void;
  onDuplicateClick: () => void;
  onDeleteClick: () => void;
};

/**
 * Floating action bar that appears when hovering over a BlockNode.
 *
 * - `prevent-group-drag` class stops pointer events from bubbling to the
 *   group drag handler (mirrors Typebot's pattern).
 * - Gear icon opens the block settings panel via `setOpenedNodeId` in BlockNode.
 * - Duplicate / delete are forwarded to the parent BlockNodesList.
 */
export function SettingsHoverBar({
  className,
  onSettingsClick,
  onDuplicateClick,
  onDeleteClick,
}: Props) {
  const handle = (cb: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    cb();
  };

  return (
    <div
      className={cn(
        'prevent-group-drag',
        'flex items-center rounded-[var(--st-radius)] border border-[var(--st-border)] shadow-md bg-[var(--st-bg-secondary)]',
        'divide-x divide-[var(--st-border)]',
        className,
      )}
      // Stop pointer events so the bar itself never triggers group drag
      onPointerDown={(e) => e.stopPropagation()}
    >
      <IconButton
        label="Block settings"
        icon={Settings}
        size="sm"
        onClick={handle(onSettingsClick)}
        className="rounded-l-[var(--st-radius)] rounded-r-none"
      />

      <IconButton
        label="Duplicate block"
        icon={Copy}
        size="sm"
        onClick={handle(onDuplicateClick)}
        className="rounded-none"
      />

      <IconButton
        label="Delete block"
        icon={Trash2}
        size="sm"
        onClick={handle(onDeleteClick)}
        className="rounded-r-[var(--st-radius)] rounded-l-none text-[var(--st-text)] hover:text-[var(--st-danger)]"
      />
    </div>
  );
}
