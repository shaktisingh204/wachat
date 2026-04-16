'use client';
import { useEffect, useRef, useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { useBlockDnd, useDragDistance } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { getBlockIcon } from '@/lib/sabflow/blocks';
import { BlockNodeContent } from './BlockNodeContent';
import { BlockSourceEndpoint } from '../../endpoints/BlockSourceEndpoint';
import { TargetEndpoint } from '../../endpoints/TargetEndpoint';
import { cn } from '@/lib/utils';

type NodePosition = { absolute: { x: number; y: number }; relative: { x: number; y: number } };

type Props = {
  block: Block;
  blockIndex: number;
  groupIndex: number;
  isConnectable: boolean;
  hasIncomingEdge: boolean;
  onMouseDown?: (pos: NodePosition, block: Block) => void;
};

export function BlockNode({
  block,
  blockIndex,
  groupIndex,
  isConnectable,
  hasIncomingEdge,
  onMouseDown,
}: Props) {
  const { openedNodeId, setOpenedNodeId, connectingIds, setConnectingIds, isReadOnly } = useGraph();
  const { mouseOverBlock, setMouseOverBlock } = useBlockDnd();
  const [isConnecting, setIsConnecting] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const isOpen = openedNodeId === block.id;

  // Typebot pattern: useDragDistance with native pointerdown stopPropagation
  useDragDistance({
    ref: blockRef,
    onDrag: (pos) => onMouseDown?.(pos, block),
    isDisabled: !onMouseDown,
  });

  // Prevent group drag from triggering when clicking on the block
  useEffect(() => {
    const el = blockRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => e.stopPropagation();
    el.addEventListener('pointerdown', onPointerDown);
    return () => el.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setIsConnecting(
      connectingIds?.target?.groupId === block.groupId &&
        connectingIds?.target?.blockId === block.id,
    );
  }, [connectingIds, block.id, block.groupId]);

  const handleMouseEnter = () => {
    if (isReadOnly) return;
    if (mouseOverBlock?.id !== block.id && blockRef.current)
      setMouseOverBlock({ id: block.id, ref: blockRef });
    if (connectingIds)
      setConnectingIds({ ...connectingIds, target: { groupId: block.groupId, blockId: block.id } });
  };

  const handleMouseLeave = () => {
    setMouseOverBlock(undefined);
    if (connectingIds?.target)
      setConnectingIds({ ...connectingIds, target: { ...connectingIds.target, blockId: undefined } });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    setOpenedNodeId(isOpen ? undefined : block.id);
  };

  const Icon = getBlockIcon(block.type);
  const showTargetEndpoint = hasIncomingEdge || !!connectingIds;

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      className="prevent-group-drag relative flex w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        className={cn(
          'flex gap-2 flex-1 p-3 rounded-lg items-start w-full text-left select-none transition-[border-color] cursor-pointer bg-[var(--gray-2)]',
          isOpen || isConnecting
            ? 'border-2 border-[#f76808] -m-px'
            : 'border border-[var(--gray-5)] hover:border-[var(--gray-7)]',
        )}
      >
        {/* Icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--gray-3)] text-[var(--gray-11)] mt-0.5">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-[10px] font-mono">?</span>}
        </div>

        <BlockNodeContent block={block} />

        {/* Target endpoint (left side) — shown when has incoming edge or is connecting */}
        {showTargetEndpoint && (
          <TargetEndpoint
            className="absolute left-[-34px] top-[16px]"
            blockId={block.id}
            groupId={block.groupId}
          />
        )}

        {/* Source endpoint (right side) — shown for connectable blocks */}
        {isConnectable && (
          <BlockSourceEndpoint
            blockId={block.id}
            groupId={block.groupId}
            className="absolute right-[-34px] bottom-[10px]"
            isHidden={!isConnectable}
          />
        )}
      </div>
    </div>
  );
}
