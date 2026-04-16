'use client';
import { useRef, useState } from 'react';
import type { Block, Group } from '@/lib/sabflow/types';
import { BlockNode } from './BlockNode';
import { useBlockDnd, computeNearestPlaceholderIndex } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { cn } from '@/lib/utils';

type Props = {
  blocks: Block[];
  groupIndex: number;
  groupRef: React.RefObject<HTMLDivElement | null>;
  onBlocksChange?: (blocks: Block[]) => void;
};

export function BlockNodesList({ blocks, groupIndex, groupRef, onBlocksChange }: Props) {
  const { draggedBlock, draggedBlockType, mouseOverGroup } = useBlockDnd();
  const placeholderRefs = useRef<HTMLDivElement[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isDraggingOverThisGroup = mouseOverGroup !== undefined;

  return (
    <div className="flex flex-col gap-0">
      {/* Placeholder at top when dragging */}
      {isDraggingOverThisGroup && hoveredIndex === 0 && (
        <div className="h-1 rounded-full bg-[#f76808] mx-2 my-1 transition-all" />
      )}
      {blocks.map((block, index) => (
        <div key={block.id}>
          <BlockNode
            block={block}
            blockIndex={index}
            groupIndex={groupIndex}
          />
          {/* Placeholder between blocks */}
          {isDraggingOverThisGroup && hoveredIndex === index + 1 && (
            <div className="h-1 rounded-full bg-[#f76808] mx-2 my-1 transition-all" />
          )}
        </div>
      ))}
      {blocks.length === 0 && (
        <div className="flex items-center justify-center py-4 text-[12px] text-[var(--gray-9)] italic">
          Drop a block here
        </div>
      )}
    </div>
  );
}
