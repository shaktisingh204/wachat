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
  const { connectingIds, setConnectingIds, isReadOnly, graphPosition } = useGraph();
  const { setMouseOverGroup } = useBlockDnd();
  const [isConnecting, setIsConnecting] = useState(false);
  const [title, setTitle] = useState(group.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const groupRef = useRef<HTMLDivElement | null>(null);

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const isFocused = useSelectionStore(useShallow((s) => s.focusedElementsId.includes(group.id)));

  // Read live position from store (falls back to prop coordinates if not yet set)
  const groupCoords = useSelectionStore(
    useShallow((s) => s.elementsCoordinates?.[group.id] ?? group.graphCoordinates),
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

  // Register this group's coordinate in the selection store
  useEffect(() => {
    updateElementCoordinates(group.id, group.graphCoordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  useEffect(() => {
    setIsConnecting(
      connectingIds?.target?.groupId === group.id && !connectingIds.target?.blockId,
    );
  }, [connectingIds, group.id]);

  useEffect(() => {
    if (group.title !== title) setTitle(group.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.title]);

  // Drag: moves this group (and any other selected groups)
  useDrag(
    ({ first, last, delta: [dx, dy], event }) => {
      // Stop event so the canvas useGesture doesn't also start panning
      event.stopPropagation();

      if (first) {
        setIsDragging(true);
        // Re-register current position in case store coords were cleared (e.g. after blurElements)
        updateElementCoordinates(group.id, groupCoords);
        focusElement(group.id, (event as MouseEvent).shiftKey);
      }

      // Apply delta in canvas space (divide by scale)
      moveFocusedElements({
        x: dx / graphPosition.scale,
        y: dy / graphPosition.scale,
      });

      if (last) {
        setIsDragging(false);
        // Persist final position to the flow document
        const coords = getElementsCoordinates();
        if (coords?.[group.id] && onGroupUpdate) {
          onGroupUpdate(group.id, { graphCoordinates: coords[group.id] });
        }
      }
    },
    {
      target: groupRef,
      pointer: { keys: false },
      // filterTaps prevents accidental tiny drags from triggering
      filterTaps: true,
    },
  );

  return (
    <div
      ref={groupRef}
      id={`group-${group.id}`}
      // data attributes let Graph.tsx detect "drag started on a group"
      data-selectable={group.id}
      data-no-canvas-drag="true"
      style={{
        transform: `translate(${groupCoords.x}px, ${groupCoords.y}px)`,
        touchAction: 'none',
        width: groupWidth,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      className={cn(
        'flex flex-col rounded-xl border select-none',
        'bg-[var(--gray-1)] pt-3 pb-2',
        'transition-[border-color,box-shadow]',
        'hover:shadow-md',
        isFocused || isConnecting
          ? 'border-2 border-[#f76808]'
          : 'border border-[var(--gray-5)]',
        isDragging ? 'cursor-grabbing shadow-lg z-10' : 'cursor-grab',
        isDraggingGraph ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      onMouseEnter={() => {
        if (isReadOnly || !groupRef.current) return;
        setMouseOverGroup({ id: group.id, ref: groupRef });
        if (connectingIds)
          setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
      }}
      onMouseLeave={() => {
        if (isReadOnly) return;
        setMouseOverGroup(undefined);
        if (connectingIds)
          setConnectingIds({ ...connectingIds, target: undefined });
      }}
    >
      {/* ── Title bar ───────────────────────────────────────── */}
      <div className="px-4 pb-2 flex items-center gap-2 min-h-[28px]">
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
            className="prevent-group-drag flex-1 text-[13px] font-semibold bg-transparent border-b border-[#f76808] outline-none text-[var(--gray-12)]"
            onClick={(e) => e.stopPropagation()}
            // prevent the drag gesture from starting while typing
            data-no-canvas-drag="true"
          />
        ) : (
          <span
            className="flex-1 text-[13px] font-semibold truncate text-[var(--gray-12)]"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
          >
            {title || <span className="text-[var(--gray-8)] italic text-[12px]">Untitled</span>}
          </span>
        )}
      </div>

      {/* ── Block list ──────────────────────────────────────── */}
      <BlockNodesList
        blocks={group.blocks}
        groupIndex={groupIndex}
        groupRef={groupRef}
      />

      {/* ── Target endpoint (incoming connection dot, left side) */}
      <div
        data-no-canvas-drag="true"
        className="absolute left-[-13px] top-5 flex h-[22px] w-[22px] items-center justify-center cursor-crosshair"
        onMouseUp={(e) => {
          e.stopPropagation();
          if (!connectingIds) return;
          setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
        }}
      >
        <div
          className={cn(
            'h-3 w-3 rounded-full border-2 bg-[var(--gray-1)] transition-colors',
            isConnecting ? 'border-[#f76808] bg-[#f76808]' : 'border-[var(--gray-7)] hover:border-[#f76808]',
          )}
        />
      </div>
    </div>
  );
}
