'use client';

import { Icon as IconifyIcon } from '@iconify/react';
import { getBlockColor, getBlockIcon } from '@/lib/sabflow/blocks';
import { getBlockBrandIcon } from '@/lib/sabflow/blocks/icons';
import { cn } from '@/lib/utils';

type Props = {
  blockType: string;
  typeLabel: string;
  displayName: string;
  fieldCount: number;
  distance: number;
  open: boolean;
  /** True when this node has output from a recent test/live run. */
  hasLiveData: boolean;
  onToggle: () => void;
};

/**
 * Collapsible header for a single upstream node inside the picker.
 * Shows the block's icon/colour, display name, and field count, mirroring the
 * canvas appearance so the user can quickly map picker entries to nodes.
 */
export function NodeOutputBadge({
  blockType,
  typeLabel,
  displayName,
  fieldCount,
  distance,
  open,
  hasLiveData,
  onToggle,
}: Props) {
  const Icon = getBlockIcon(blockType);
  const color = getBlockColor(blockType);
  const brand = getBlockBrandIcon(blockType);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5',
        'text-left transition-colors',
        open
          ? 'bg-[var(--gray-3)]'
          : 'hover:bg-[var(--gray-3)]',
      )}
    >
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          brand && 'bg-[var(--gray-1)]',
        )}
        style={brand ? undefined : { background: `${color}22`, color }}
      >
        {brand ? (
          <IconifyIcon icon={brand} className="h-3.5 w-3.5" aria-hidden />
        ) : (
          Icon && <Icon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex flex-1 flex-col leading-tight min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-[var(--gray-12)]">
          <span className="truncate">{displayName}</span>
          {hasLiveData && (
            <span
              title="Has data from the most recent run"
              aria-label="Live data available"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
            />
          )}
        </span>
        <span className="truncate text-[10.5px] text-[var(--gray-9)]">
          {typeLabel}
          {distance > 1 ? ` · ${distance} steps back` : ''}
          {!hasLiveData ? ' · no run yet' : ''}
        </span>
      </div>
      <span className="shrink-0 rounded-md bg-[var(--gray-4)] px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-[var(--gray-11)]">
        {fieldCount}
      </span>
      <svg
        className={cn(
          'h-3 w-3 shrink-0 text-[var(--gray-9)] transition-transform',
          open ? 'rotate-90' : '',
        )}
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
