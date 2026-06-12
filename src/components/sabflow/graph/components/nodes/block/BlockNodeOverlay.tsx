'use client';

import { BrandIcon } from '@/components/sabflow/BrandIcon';
import { cn } from '@/lib/utils';
import type { Block } from '@/lib/sabflow/types';
import { getBlockDisplay } from '@/lib/sabflow/blocks';
import { getBlockBrandIcon } from '@/lib/sabflow/blocks/icons';

type Props = {
  block: Block;
  className?: string;
  style?: React.CSSProperties;
};

export function BlockNodeOverlay({ block, className, style }: Props) {
  // Block-aware display: app presets carry their brand name in
  // options.__label, so the overlay shows "Vimeo" instead of "App preset".
  const { icon: Icon, label } = getBlockDisplay(block);
  const brand = getBlockBrandIcon(block.type);

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg border border-[var(--gray-5)] w-[264px] shadow-md bg-[var(--gray-2)] cursor-grab pointer-events-none select-none',
        className,
      )}
      style={style}
    >
      {/* Brand logo or fallback icon — matches BlockNodeContent. */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md mt-0.5',
          !brand && 'bg-[var(--gray-3)] text-[var(--gray-11)]',
        )}
      >
        {brand ? (
          <BrandIcon icon={brand} className="h-5 w-5" aria-hidden />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5" />
        ) : (
          <span className="text-[10px] font-mono">?</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--gray-12)] truncate">{label}</div>
      </div>
    </div>
  );
}
