'use client';
import { useRef, useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { cn } from '@/lib/utils';
import { getBlockLabel, getBlockIcon } from '@/lib/sabflow/blocks';

type Props = {
  block: Block;
  blockIndex: number;
  groupIndex: number;
};

export function BlockNode({ block, blockIndex, groupIndex }: Props) {
  const { openedNodeId, setOpenedNodeId, connectingIds, setConnectingIds, isReadOnly } = useGraph();
  const [isHovered, setIsHovered] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const isOpen = openedNodeId === block.id;
  const isConnecting = connectingIds?.source.blockId === block.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    setOpenedNodeId(isOpen ? undefined : block.id);
  };

  const label = getBlockLabel(block.type);
  const Icon = getBlockIcon(block.type);

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      className={cn(
        'relative flex items-center gap-2 rounded-lg border mx-2 my-1 px-3 py-2.5 cursor-pointer select-none',
        'bg-[var(--gray-1)] text-[var(--gray-12)]',
        'transition-[border-color,box-shadow]',
        'hover:border-[var(--gray-6)] hover:shadow-sm',
        isOpen || isConnecting
          ? 'border-[#f76808] shadow-[0_0_0_2px_rgba(247,104,8,0.15)]'
          : 'border-[var(--gray-5)]',
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--gray-3)] text-[var(--gray-11)]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-[10px] font-mono">?</span>}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate">{label}</div>
        {block.options?.content && (
          <div className="text-[11px] text-[var(--gray-9)] truncate mt-0.5">
            {String(block.options.content).slice(0, 60)}
          </div>
        )}
      </div>

      {/* Source endpoint dot */}
      <div
        className="absolute right-[-13px] top-1/2 -translate-y-1/2 flex h-[22px] w-[22px] items-center justify-center cursor-crosshair"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (isReadOnly) return;
          setConnectingIds({
            source: { groupId: block.groupId, blockId: block.id },
          });
        }}
      >
        <div className="h-3 w-3 rounded-full border-2 border-[var(--gray-7)] bg-[var(--gray-1)] hover:border-[#f76808] hover:bg-[#f76808] transition-colors" />
      </div>
    </div>
  );
}
