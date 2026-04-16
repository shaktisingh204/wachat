'use client';
import { useRef, useState } from 'react';
import type { Block, BlockItem, BlockType } from '@/lib/sabflow/types';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { useDragDistance } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { BlockSourceEndpoint } from '../../endpoints/BlockSourceEndpoint';
import { ItemNodeContent } from './ItemNodeContent';
import { cn } from '@/lib/utils';

type NodePosition = { absolute: { x: number; y: number }; relative: { x: number; y: number } };

type Props = {
  item: BlockItem;
  block: Block;
  blockType: BlockType;
  groupId: string;
  onDelete: (itemId: string) => void;
  onMouseDown?: (pos: NodePosition, item: BlockItem) => void;
};

export function ItemNode({ item, block, blockType, groupId, onDelete, onMouseDown }: Props) {
  const { previewingEdge, connectingIds } = useGraph();
  const itemRef = useRef<HTMLDivElement>(null);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const isPreviewing =
    previewingEdge &&
    'itemId' in previewingEdge.from &&
    previewingEdge.from.itemId === item.id;

  const isConnecting = !!(connectingIds);

  const showEndpoint = isMouseOver || isConnecting || isPreviewing;

  useDragDistance({
    ref: itemRef,
    onDrag: (pos) => onMouseDown?.(pos, item),
    isDisabled: !onMouseDown || blockType === 'ab_test',
  });

  const handleMouseEnter = () => setIsMouseOver(true);
  const handleMouseLeave = () => setIsMouseOver(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setIsContextMenuOpen(true);
  };

  const handleDelete = () => {
    setIsContextMenuOpen(false);
    onDelete(item.id);
  };

  const closeContextMenu = () => setIsContextMenuOpen(false);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: draggable graph item */}
      <div
        ref={itemRef}
        className="prevent-group-drag relative flex w-full"
        data-item-id={item.id}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        <div
          className={cn(
            'flex items-center rounded-md border w-full min-h-[36px] transition-colors bg-[var(--gray-1)] select-none',
            isContextMenuOpen || isPreviewing
              ? 'border-[#f76808]'
              : 'border-[var(--gray-5)] hover:border-[var(--gray-7)]',
          )}
        >
          <ItemNodeContent item={item} blockType={blockType} />
        </div>

        <BlockSourceEndpoint
          blockId={block.id}
          itemId={item.id}
          groupId={groupId}
          className="absolute right-[-42px] bottom-[2px] pointer-events-auto"
          isHidden={!showEndpoint}
        />
      </div>

      {/* Context menu popup */}
      {isContextMenuOpen && (
        <>
          {/* Backdrop to close */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop close handler */}
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={closeContextMenu}
          />
          <div
            className="fixed z-[9999] min-w-[140px] rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-lg py-1"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-600 hover:bg-[var(--gray-3)] transition-colors"
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
