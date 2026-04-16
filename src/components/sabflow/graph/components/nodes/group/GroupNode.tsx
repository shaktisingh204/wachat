'use client';
import { useRef, useState, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useShallow } from 'zustand/react/shallow';
import type { Group } from '@/lib/sabflow/types';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { useSelectionStore } from '@/components/sabflow/graph/hooks/useSelectionStore';
import { BlockNodesList } from '../block/BlockNodesList';
import { cn } from '@/lib/utils';

const groupWidth = 300;

type Props = {
  group: Group;
  groupIndex: number;
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
};

export function GroupNode({ group, groupIndex, onGroupUpdate }: Props) {
  const { connectingIds, setConnectingIds, previewingEdge, isReadOnly, graphPosition } = useGraph();
  const { setMouseOverGroup, mouseOverGroup } = useBlockDnd();
  const [isConnecting, setIsConnecting] = useState(false);
  const [title, setTitle] = useState(group.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const groupRef = useRef<HTMLDivElement | null>(null);

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const isFocused = useSelectionStore(useShallow((s) => s.focusedElementsId.includes(group.id)));
  const groupCoords = useSelectionStore(
    useShallow((s) =>
      s.elementsCoordinates?.[group.id] ?? group.graphCoordinates
    ),
  );
  const { moveFocusedElements, focusElement, getElementsCoordinates, updateElementCoordinates } =
    useSelectionStore(
      useShallow((s) => ({
        moveFocusedElements: s.moveFocusedElements,
        focusElement: s.focusElement,
        getElementsCoordinates: s.getElementsCoordinates,
        updateElementCoordinates: s.updateElementCoordinates,
      })),
    );

  // Sync this group's coordinate into selection store on mount
  useEffect(() => {
    updateElementCoordinates(group.id, group.graphCoordinates);
  }, [group.id, group.graphCoordinates.x, group.graphCoordinates.y]);

  useEffect(() => {
    setIsConnecting(
      connectingIds?.target?.groupId === group.id && !connectingIds.target?.blockId
    );
  }, [connectingIds, group.id]);

  useEffect(() => {
    if (group.title !== title) setTitle(group.title);
  }, [group.title]);

  useDrag(
    ({ first, last, delta, event }) => {
      event.stopPropagation();
      if (first) {
        setIsMouseDown(true);
        focusElement(group.id, (event as MouseEvent).shiftKey);
      }
      moveFocusedElements({
        x: delta[0] / graphPosition.scale,
        y: delta[1] / graphPosition.scale,
      });
      if (last) {
        setIsMouseDown(false);
        const coords = getElementsCoordinates();
        if (coords && onGroupUpdate) {
          onGroupUpdate(group.id, { graphCoordinates: coords[group.id] });
        }
      }
    },
    {
      target: groupRef,
      pointer: { keys: false },
      from: () => [groupCoords.x * graphPosition.scale, groupCoords.y * graphPosition.scale],
    },
  );

  return (
    <div
      ref={groupRef}
      id={`group-${group.id}`}
      data-selectable={group.id}
      style={{
        '--group-width': `${groupWidth}px`,
        transform: `translate(${groupCoords?.x ?? 0}px, ${groupCoords?.y ?? 0}px)`,
        touchAction: 'none',
        width: groupWidth,
      } as React.CSSProperties}
      className={cn(
        'flex flex-col group absolute rounded-xl border select-none bg-[var(--gray-1)]',
        'transition-[border-color,box-shadow] px-0 pt-3 pb-2 gap-0',
        'hover:shadow-md',
        isFocused || isConnecting
          ? 'border-[#f76808] -m-px border-2'
          : 'border-[var(--gray-5)]',
        isMouseDown ? 'cursor-grabbing z-10' : 'cursor-pointer',
        isDraggingGraph ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      onMouseEnter={() => {
        if (isReadOnly || !groupRef.current) return;
        setMouseOverGroup({ id: group.id, ref: groupRef });
        if (connectingIds) setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
      }}
      onMouseLeave={() => {
        if (isReadOnly) return;
        setMouseOverGroup(undefined);
        if (connectingIds) setConnectingIds({ ...connectingIds, target: undefined });
      }}
    >
      {/* Title */}
      <div className="px-4 pb-2 flex items-center gap-2">
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              onGroupUpdate?.(group.id, { title });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setEditingTitle(false);
                onGroupUpdate?.(group.id, { title });
              }
            }}
            className="prevent-group-drag flex-1 text-[13px] font-medium bg-transparent border-b border-[#f76808] outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[13px] font-medium truncate text-[var(--gray-12)]"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
          >
            {title || <span className="text-[var(--gray-8)] italic">Untitled</span>}
          </span>
        )}
      </div>

      {/* Blocks list */}
      <BlockNodesList
        blocks={group.blocks}
        groupIndex={groupIndex}
        groupRef={groupRef}
      />

      {/* Target endpoint (left side, top) */}
      <div
        className="absolute left-[-13px] top-4 flex h-[22px] w-[22px] items-center justify-center"
        onMouseUp={(e) => {
          e.stopPropagation();
          if (!connectingIds) return;
          setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
        }}
      >
        <div className={cn(
          'h-3 w-3 rounded-full border-2 bg-[var(--gray-1)] transition-colors',
          isConnecting ? 'border-[#f76808] bg-[#f76808]' : 'border-[var(--gray-7)]'
        )} />
      </div>
    </div>
  );
}
