'use client';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Block, Group } from '@/lib/sabflow/types';
import { BlockNode } from './BlockNode';
import { BlockNodeOverlay } from './BlockNodeOverlay';
import { PlaceholderNode } from '../PlaceholderNode';
import { useBlockDnd, computeNearestPlaceholderIndex } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

type NodePosition = { absolute: { x: number; y: number }; relative: { x: number; y: number } };

type Props = {
  blocks: Block[];
  group: Group;
  groupIndex: number;
  groupRef: React.RefObject<HTMLDivElement | null>;
  edges: { from: { blockId?: string }; to: { blockId?: string } }[];
  onBlocksChange: (blocks: Block[]) => void;
};

export function BlockNodesList({ blocks, group, groupIndex, groupRef, edges, onBlocksChange }: Props) {
  const { draggedBlock, setDraggedBlock, draggedBlockType, setDraggedBlockType, mouseOverGroup } = useBlockDnd();
  const { isReadOnly, setOpenedNodeId } = useGraph();
  const placeholderRefs = useRef<HTMLDivElement[]>([]);
  const [expandedPlaceholderIndex, setExpandedPlaceholderIndex] = useState<number | undefined>();
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const [mouseInElement, setMouseInElement] = useState({ x: 0, y: 0 });

  const groupId = group.id;
  const isDraggingOnCurrentGroup = (draggedBlock || draggedBlockType) && mouseOverGroup?.id === groupId;
  const showPlaceholders = !!(draggedBlock || draggedBlockType);

  // When mouse leaves this group, collapse placeholders
  useEffect(() => {
    if (mouseOverGroup?.id !== groupId) setExpandedPlaceholderIndex(undefined);
  }, [groupId, mouseOverGroup?.id]);

  // Track placeholder expansion on mousemove within group
  const onGroupMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingOnCurrentGroup) return;
    setExpandedPlaceholderIndex(
      computeNearestPlaceholderIndex(e.clientY, placeholderRefs),
    );
  }, [isDraggingOnCurrentGroup]);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    el.addEventListener('mousemove', onGroupMouseMove);
    return () => el.removeEventListener('mousemove', onGroupMouseMove);
  }, [onGroupMouseMove, groupRef]);

  // Move overlay while dragging block FROM this group
  const onGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedBlock?.groupId || draggedBlock.groupId !== groupId) return;
    setOverlayPos({
      x: e.clientX - mouseInElement.x,
      y: e.clientY - mouseInElement.y,
    });
  }, [draggedBlock, groupId, mouseInElement]);

  useEffect(() => {
    window.addEventListener('mousemove', onGlobalMouseMove);
    return () => window.removeEventListener('mousemove', onGlobalMouseMove);
  }, [onGlobalMouseMove]);

  // Drop block into this group
  const onGroupMouseUp = useCallback((e: MouseEvent) => {
    setExpandedPlaceholderIndex(undefined);
    if (!isDraggingOnCurrentGroup) return;
    const blockIndex = computeNearestPlaceholderIndex(e.clientY, placeholderRefs);

    if (draggedBlock) {
      // Reorder or drop from another group
      const newBlock: Block = { ...draggedBlock, groupId };
      const filtered = blocks.filter((b) => b.id !== draggedBlock.id);
      filtered.splice(blockIndex, 0, newBlock);
      onBlocksChange(filtered);
      setDraggedBlock(undefined);
    } else if (draggedBlockType) {
      const newBlockId = createId();
      const newBlock: Block = {
        id: newBlockId,
        type: draggedBlockType,
        groupId,
        options: {},
      };
      const newBlocks = [...blocks];
      newBlocks.splice(blockIndex, 0, newBlock);
      onBlocksChange(newBlocks);
      setDraggedBlockType(undefined);
      setOpenedNodeId(newBlockId);
    }
  }, [isDraggingOnCurrentGroup, draggedBlock, draggedBlockType, blocks, groupId, onBlocksChange, setDraggedBlock, setDraggedBlockType, setOpenedNodeId]);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    el.addEventListener('mouseup', onGroupMouseUp, { capture: true });
    return () => el.removeEventListener('mouseup', onGroupMouseUp, { capture: true });
  }, [onGroupMouseUp, groupRef]);

  const handleBlockMouseDown = (blockIndex: number) => (pos: NodePosition, block: Block) => {
    if (isReadOnly) return;
    // Remove the block from the list immediately (Typebot pattern)
    placeholderRefs.current.splice(blockIndex + 1, 1);
    setMouseInElement(pos.relative);
    setOverlayPos({
      x: pos.absolute.x - pos.relative.x,
      y: pos.absolute.y - pos.relative.y,
    });
    setDraggedBlock({ ...block, groupId });
    // Detach from this group
    onBlocksChange(blocks.filter((_, i) => i !== blockIndex));
  };

  const handlePushPlaceholderRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) placeholderRefs.current[idx] = el;
  };

  // Determine which blocks have incoming edges
  const blockIdsWithIncomingEdge = new Set(
    edges.map((e) => e.to.blockId).filter(Boolean) as string[],
  );

  // Last block (or only block) gets a source endpoint
  const lastConnectableIndex = blocks.length - 1;

  return (
    <div className="flex flex-col">
      {/* Placeholder at top (index 0) */}
      <PlaceholderNode
        ref={handlePushPlaceholderRef(0)}
        isExpanded={showPlaceholders && expandedPlaceholderIndex === 0}
        isVisible={showPlaceholders}
      />

      {blocks.map((block, index) => (
        <div key={block.id}>
          <BlockNode
            block={block}
            blockIndex={index}
            groupIndex={groupIndex}
            isConnectable={index === lastConnectableIndex}
            hasIncomingEdge={blockIdsWithIncomingEdge.has(block.id)}
            onMouseDown={!isReadOnly ? handleBlockMouseDown(index) : undefined}
            onBlockChange={(updatedBlock) => {
              const updated = blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b));
              onBlocksChange(updated);
            }}
          />
          {/* Placeholder after each block */}
          <PlaceholderNode
            ref={handlePushPlaceholderRef(index + 1)}
            isExpanded={showPlaceholders && expandedPlaceholderIndex === index + 1}
            isVisible={showPlaceholders}
          />
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="flex items-center justify-center py-4 text-[12px] text-[var(--gray-9)] italic">
          Drop a block here
        </div>
      )}

      {/* Drag overlay portal */}
      {draggedBlock?.groupId === groupId &&
        createPortal(
          <BlockNodeOverlay
            block={draggedBlock}
            style={{
              position: 'fixed',
              left: overlayPos.x,
              top: overlayPos.y,
              zIndex: 9999,
            }}
          />,
          document.body,
        )}
    </div>
  );
}
