'use client';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Block, BlockItem } from '@/lib/sabflow/types';
import { useBlockDnd, computeNearestPlaceholderIndex } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { PlaceholderNode } from '../PlaceholderNode';
import { ItemNode } from './ItemNode';
import { getItemName } from './getItemName';

type NodePosition = { absolute: { x: number; y: number }; relative: { x: number; y: number } };

type Props = {
  block: Block;
  groupId: string;
  onBlockChange: (block: Block) => void;
};

export function ItemNodesList({ block, groupId, onBlockChange }: Props) {
  const { draggedItem, setDraggedItem, mouseOverBlock } = useBlockDnd();
  const placeholderRefs = useRef<HTMLDivElement[]>([]);
  const [expandedPlaceholderIndex, setExpandedPlaceholderIndex] = useState<number | undefined>();
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const [mouseInElement, setMouseInElement] = useState({ x: 0, y: 0 });

  const items: BlockItem[] = block.items ?? [];
  const itemName = getItemName(block.type);

  const isDraggingOnCurrentBlock =
    draggedItem !== undefined &&
    draggedItem.blockId === block.id &&
    mouseOverBlock?.id === block.id;

  const showPlaceholders =
    draggedItem !== undefined && draggedItem.type === block.type;

  // Collapse placeholders when mouse leaves this block
  useEffect(() => {
    if (mouseOverBlock?.id !== block.id) setExpandedPlaceholderIndex(undefined);
  }, [block.id, mouseOverBlock?.id]);

  // Expand nearest placeholder on mousemove over block
  const onBlockMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingOnCurrentBlock) return;
      setExpandedPlaceholderIndex(computeNearestPlaceholderIndex(e.clientY, placeholderRefs));
    },
    [isDraggingOnCurrentBlock],
  );

  useEffect(() => {
    const el = mouseOverBlock?.ref.current;
    if (!el) return;
    el.addEventListener('mousemove', onBlockMouseMove);
    return () => el.removeEventListener('mousemove', onBlockMouseMove);
  }, [onBlockMouseMove, mouseOverBlock]);

  // Move overlay while dragging item FROM this block
  const onGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggedItem || draggedItem.blockId !== block.id) return;
      setOverlayPos({
        x: e.clientX - mouseInElement.x,
        y: e.clientY - mouseInElement.y,
      });
    },
    [draggedItem, block.id, mouseInElement],
  );

  useEffect(() => {
    window.addEventListener('mousemove', onGlobalMouseMove);
    return () => window.removeEventListener('mousemove', onGlobalMouseMove);
  }, [onGlobalMouseMove]);

  // Drop item into block
  const onBlockMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingOnCurrentBlock || !draggedItem) return;
      setExpandedPlaceholderIndex(undefined);
      const itemIndex = computeNearestPlaceholderIndex(e.clientY, placeholderRefs);
      e.stopPropagation();
      setDraggedItem(undefined);

      const newItem: BlockItem = { id: draggedItem.id, content: draggedItem.content };
      const filtered = items.filter((it) => it.id !== draggedItem.id);
      const reordered = [...filtered];
      reordered.splice(itemIndex, 0, newItem);
      onBlockChange({ ...block, items: reordered });
    },
    [isDraggingOnCurrentBlock, draggedItem, items, block, onBlockChange, setDraggedItem],
  );

  useEffect(() => {
    const el = mouseOverBlock?.ref.current;
    if (!el) return;
    el.addEventListener('mouseup', onBlockMouseUp, { capture: true });
    return () => el.removeEventListener('mouseup', onBlockMouseUp, { capture: true });
  }, [onBlockMouseUp, mouseOverBlock]);

  const handleItemMouseDown = (itemIndex: number) => (pos: NodePosition, item: BlockItem) => {
    if (items.length <= 1) return;
    placeholderRefs.current.splice(itemIndex + 1, 1);
    setMouseInElement(pos.relative);
    setOverlayPos({
      x: pos.absolute.x - pos.relative.x,
      y: pos.absolute.y - pos.relative.y,
    });
    setDraggedItem({ ...item, type: block.type, blockId: block.id });
    onBlockChange({ ...block, items: items.filter((_, i) => i !== itemIndex) });
  };

  const handleAddItem = () => {
    const newItem: BlockItem = { id: createId(), content: '' };
    onBlockChange({ ...block, items: [...items, newItem] });
  };

  const handleDeleteItem = (itemId: string) => {
    onBlockChange({ ...block, items: items.filter((it) => it.id !== itemId) });
  };

  const handlePushPlaceholderRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) placeholderRefs.current[idx] = el;
  };

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: click-stop wrapper inside graph surface */
    <div
      className="flex flex-col gap-0 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <PlaceholderNode
        ref={handlePushPlaceholderRef(0)}
        isExpanded={showPlaceholders && expandedPlaceholderIndex === 0}
        isVisible={showPlaceholders}
      />

      {items.map((item, idx) => (
        <div className="flex flex-col gap-0" key={item.id}>
          <ItemNode
            item={item}
            block={block}
            blockType={block.type}
            groupId={groupId}
            onDelete={handleDeleteItem}
            onMouseDown={handleItemMouseDown(idx)}
          />
          <PlaceholderNode
            ref={handlePushPlaceholderRef(idx + 1)}
            isExpanded={showPlaceholders && expandedPlaceholderIndex === idx + 1}
            isVisible={showPlaceholders}
          />
        </div>
      ))}

      {/* Add item button */}
      <button
        type="button"
        className="mt-1 w-full rounded-md border border-dashed border-[var(--gray-6)] py-1.5 text-[11px] text-[var(--gray-9)] hover:border-[var(--gray-8)] hover:text-[var(--gray-11)] transition-colors"
        onClick={handleAddItem}
      >
        + Add {itemName}
      </button>

      {/* Drag overlay portal */}
      {draggedItem && draggedItem.blockId === block.id &&
        createPortal(
          <div
            className="flex fixed w-[200px] pointer-events-none origin-[0_0_0] rotate-[-2deg]"
            style={{ left: overlayPos.x, top: overlayPos.y, zIndex: 9999 }}
          >
            <ItemNode
              item={draggedItem}
              block={block}
              blockType={block.type}
              groupId={groupId}
              onDelete={() => {}}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
