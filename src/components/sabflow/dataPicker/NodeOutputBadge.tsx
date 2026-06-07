'use client';

import { Icon as IconifyIcon } from '@iconify/react';
import { ChevronRight } from 'lucide-react';

import { Badge, Button, Dot } from '@/components/sabcrm/20ui';
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
    <Button
      variant="ghost"
      block
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'h-auto justify-start gap-2 px-2 py-1.5 text-left whitespace-normal',
        '[&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-2 [&_.u-btn__label]:overflow-visible',
        open && 'bg-[var(--st-bg-secondary)]',
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)]',
          brand && 'bg-[var(--st-bg-secondary)]',
        )}
        style={brand ? undefined : { background: `${color}22`, color }}
      >
        {brand ? (
          <IconifyIcon icon={brand} className="h-3.5 w-3.5" aria-hidden />
        ) : (
          Icon && <Icon className="h-3.5 w-3.5" aria-hidden />
        )}
      </span>
      <span className="flex flex-1 flex-col min-w-0 leading-tight">
        <span className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-[var(--st-text)]">
          <span className="truncate">{displayName}</span>
          {hasLiveData && (
            <Dot
              tone="success"
              pulse
              role="img"
              aria-label="Live data available"
              title="Has data from the most recent run"
            />
          )}
        </span>
        <span className="truncate text-[10.5px] text-[var(--st-text-tertiary)]">
          {typeLabel}
          {distance > 1 ? ` , ${distance} steps back` : ''}
          {!hasLiveData ? ' , no run yet' : ''}
        </span>
      </span>
      <Badge tone="neutral" kind="soft" className="shrink-0 tabular-nums">
        {fieldCount}
      </Badge>
      <ChevronRight
        size={12}
        aria-hidden="true"
        className={cn(
          'shrink-0 text-[var(--st-text-tertiary)] transition-transform',
          open && 'rotate-90',
        )}
      />
    </Button>
  );
}
