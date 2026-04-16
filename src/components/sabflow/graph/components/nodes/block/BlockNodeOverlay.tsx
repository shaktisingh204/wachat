'use client';
import type { Block } from '@/lib/sabflow/types';
import { getBlockIcon, getBlockLabel } from '@/lib/sabflow/blocks';

type Props = {
  block: Block;
  style?: React.CSSProperties;
};

export function BlockNodeOverlay({ block, style }: Props) {
  const Icon = getBlockIcon(block.type);
  const label = getBlockLabel(block.type);

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg border border-[var(--gray-5)] w-[264px] shadow-md bg-[var(--gray-1)] cursor-grab pointer-events-none select-none"
      style={style}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--gray-3)] text-[var(--gray-11)]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-[10px] font-mono">?</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--gray-12)] truncate">{label}</div>
      </div>
    </div>
  );
}
