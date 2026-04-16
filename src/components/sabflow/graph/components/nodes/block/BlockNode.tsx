'use client';
import { useEffect, useRef, useState } from 'react';
import type { Block, BlockType } from '@/lib/sabflow/types';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { useBlockDnd, useDragDistance } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { BlockNodeContent } from './BlockNodeContent';
import { BlockNodeContextMenu } from './BlockNodeContextMenu';
import { SettingsHoverBar } from './SettingsHoverBar';
import { BlockSourceEndpoint } from '../../endpoints/BlockSourceEndpoint';
import { TargetEndpoint } from '../../endpoints/TargetEndpoint';
import { ItemNodesList } from '../item/ItemNodesList';
import { cn } from '@/lib/utils';

const ITEM_BLOCK_TYPES: BlockType[] = ['choice_input', 'picture_choice_input', 'condition', 'ab_test'];

type NodePosition = { absolute: { x: number; y: number }; relative: { x: number; y: number } };

type ContextMenuPos = { x: number; y: number };

type Props = {
  block: Block;
  blockIndex: number;
  groupIndex: number;
  isConnectable: boolean;
  hasIncomingEdge: boolean;
  /** True when this block already has an outgoing edge — shows a persistent dot on the source endpoint. */
  hasOutgoingEdge?: boolean;
  onMouseDown?: (pos: NodePosition, block: Block) => void;
  onBlockChange?: (block: Block) => void;
  onDuplicate?: (block: Block) => void;
  onDelete?: (block: Block) => void;
};

export function BlockNode({
  block,
  blockIndex: _blockIndex,
  groupIndex: _groupIndex,
  isConnectable,
  hasIncomingEdge,
  hasOutgoingEdge = false,
  onMouseDown,
  onBlockChange,
  onDuplicate,
  onDelete,
}: Props) {
  const {
    openedNodeId,
    setOpenedNodeId,
    connectingIds,
    connectingIdsRef,
    setConnectingIds,
    isReadOnly,
  } = useGraph();
  const { mouseOverBlock, setMouseOverBlock } = useBlockDnd();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPos | null>(null);
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
    setIsHovered(true);
    if (mouseOverBlock?.id !== block.id && blockRef.current)
      setMouseOverBlock({ id: block.id, ref: blockRef });
    // Use the ref for a fresh read — avoids a stale-closure race when the drag
    // starts on another node and this handler fires before the next React render.
    const current = connectingIdsRef.current;
    if (current)
      setConnectingIds({
        ...current,
        target: { groupId: block.groupId, blockId: block.id },
      });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMouseOverBlock(undefined);
    // Use the ref for a fresh read so we never operate on a stale target.
    const current = connectingIdsRef.current;
    if (current?.target)
      setConnectingIds({
        ...current,
        target: { ...current.target, blockId: undefined },
      });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    setOpenedNodeId(isOpen ? undefined : block.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
    // Focus this block's group by opening the node
    setOpenedNodeId(block.id);
  };

  const showTargetEndpoint = hasIncomingEdge || !!connectingIds;
  const supportsItems = (ITEM_BLOCK_TYPES as string[]).includes(block.type);

  // Ensure items array exists for supported block types
  const blockWithItems: Block = supportsItems && !block.items
    ? { ...block, items: [] }
    : block;

  const handleBlockChange = (updated: Block) => {
    onBlockChange?.(updated);
  };

  return (
    <>
    <div
      ref={blockRef}
      data-block-id={block.id}
      className="prevent-group-drag relative flex flex-col w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Hover bar — floats above top-right corner of the card */}
      {isHovered && !isReadOnly && (
        <div className="absolute -top-8 right-0 z-20">
          <SettingsHoverBar
            onSettingsClick={() => setOpenedNodeId(isOpen ? undefined : block.id)}
            onDuplicateClick={() => onDuplicate?.(block)}
            onDeleteClick={() => onDelete?.(block)}
          />
        </div>
      )}

      <div
        className={cn(
          'flex gap-2 flex-1 p-3 rounded-lg items-start w-full text-left select-none transition-[border-color] cursor-pointer bg-[var(--gray-2)]',
          supportsItems ? 'rounded-b-none border-b-0' : '',
          isOpen || isConnecting
            ? 'border-2 border-[#f76808] -m-px'
            : 'border border-[var(--gray-5)] hover:border-[var(--gray-7)]',
        )}
      >
        <BlockNodeContent block={block} />

        {/* Target endpoint (left side) — shown when has incoming edge or a drag is in progress */}
        {showTargetEndpoint && (
          <TargetEndpoint
            className="absolute left-[-34px] top-[16px]"
            blockId={block.id}
            groupId={block.groupId}
          />
        )}

        {/* Source endpoint (right side) — only for blocks that don't manage items */}
        {isConnectable && !supportsItems && (
          <BlockSourceEndpoint
            blockId={block.id}
            groupId={block.groupId}
            hasOutgoingEdge={hasOutgoingEdge}
            className="absolute right-[-34px] bottom-[10px]"
          />
        )}
      </div>

      {/* Item list for blocks that support items */}
      {supportsItems && (
        <div
          className={cn(
            'rounded-b-lg border border-t-0 bg-[var(--gray-2)] px-2 pb-2 pt-1',
            isOpen || isConnecting
              ? 'border-[#f76808]'
              : 'border-[var(--gray-5)]',
          )}
        >
          <ItemNodesList
            block={blockWithItems}
            groupId={block.groupId}
            onBlockChange={handleBlockChange}
          />
        </div>
      )}
    </div>

    {contextMenu && (
      <BlockNodeContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onSettings={() => setOpenedNodeId(block.id)}
        onDuplicate={() => onDuplicate?.(block)}
        onDelete={() => onDelete?.(block)}
        onClose={() => setContextMenu(null)}
      />
    )}
    </>
  );
}
