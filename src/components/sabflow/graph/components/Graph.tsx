'use client';
import { useRef, useState, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { useGraph } from '../providers/GraphProvider';
import { useSelectionStore } from '../hooks/useSelectionStore';
import { useBlockDnd } from '../providers/GraphDndProvider';
import { createId } from '@paralleldrive/cuid2';
import { SelectBox, computeSelectBoxDimensions } from './SelectBox';
import GraphElements from './GraphElements';
import type { SabFlowDoc, Group, Coordinates } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

const maxScale = 2;
const minScale = 0.2;
const zoomStep = 0.2;

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function Graph({ flow, onFlowChange, containerRef }: Props) {
  const { graphPosition, setGraphPosition, connectingIds } = useGraph();
  const { draggedBlockType, setDraggedBlockType } = useBlockDnd();

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const setIsDraggingGraph = useSelectionStore((s) => s.setIsDraggingGraph);
  const blurElements = useSelectionStore((s) => s.blurElements);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectBoxStart, setSelectBoxStart] = useState<Coordinates | null>(null);
  const [selectBoxEnd, setSelectBoxEnd] = useState<Coordinates | null>(null);

  /* project screen coords to canvas coords */
  const projectMouse = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - graphPosition.x) / graphPosition.scale,
      y: (clientY - rect.top - graphPosition.y) / graphPosition.scale,
    };
  }, [graphPosition]);

  /* Drop new block from sidebar */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggedBlockType) {
      const pos = projectMouse(e.clientX, e.clientY);
      const newGroupId = createId();
      const newBlockId = createId();
      const newGroup: Group = {
        id: newGroupId,
        title: 'Group',
        graphCoordinates: { x: pos.x - 150, y: pos.y - 30 },
        blocks: [{
          id: newBlockId,
          type: draggedBlockType,
          groupId: newGroupId,
          options: {},
        }],
      };
      onFlowChange({ groups: [...flow.groups, newGroup] });
      setDraggedBlockType(undefined);
    }
  }, [draggedBlockType, projectMouse, flow.groups, onFlowChange, setDraggedBlockType]);

  /* Gesture binding for pan + zoom */
  useGesture(
    {
      onDrag: ({ delta: [dx, dy], event, first, last }) => {
        const e = event as MouseEvent;
        if (first) setIsDraggingGraph(true);
        if (last) { setIsDraggingGraph(false); return; }
        setGraphPosition((pos) => ({ ...pos, x: pos.x + dx, y: pos.y + dy }));
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = (event as WheelEvent).clientX - rect.left;
        const mouseY = (event as WheelEvent).clientY - rect.top;
        setGraphPosition((pos) => {
          const zoomFactor = dy > 0 ? 0.9 : 1.1;
          const newScale = Math.min(maxScale, Math.max(minScale, pos.scale * zoomFactor));
          const scaleDiff = newScale - pos.scale;
          return {
            scale: newScale,
            x: pos.x - mouseX * scaleDiff / pos.scale,
            y: pos.y - mouseY * scaleDiff / pos.scale,
          };
        });
      },
      onPinch: ({ offset: [scale], origin: [ox, oy] }) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setGraphPosition((pos) => {
          const clampedScale = Math.min(maxScale, Math.max(minScale, scale));
          return { ...pos, scale: clampedScale };
        });
      },
    },
    {
      target: canvasRef,
      drag: { filterTaps: true, pointer: { keys: false } },
      wheel: { eventOptions: { passive: false } },
      pinch: { scaleBounds: { min: minScale, max: maxScale } },
    },
  );

  const handleZoom = (direction: 'in' | 'out') => {
    setGraphPosition((pos) => {
      const newScale = direction === 'in'
        ? Math.min(maxScale, pos.scale + zoomStep)
        : Math.max(minScale, pos.scale - zoomStep);
      return { ...pos, scale: newScale };
    });
  };

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative flex-1 overflow-hidden sabflow-canvas-bg',
        draggedBlockType ? 'cursor-crosshair' : isDraggingGraph ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ backgroundColor: 'var(--gray-3)' }}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (e.target === canvasRef.current) blurElements();
      }}
    >
      {/* Transformed canvas layer */}
      <div
        style={{
          transform: `translate(${graphPosition.x}px, ${graphPosition.y}px) scale(${graphPosition.scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <GraphElements flow={flow} />
      </div>

      {/* Select box */}
      {selectBoxStart && selectBoxEnd && (
        <SelectBox dimensions={computeSelectBoxDimensions(selectBoxStart, selectBoxEnd)} />
      )}

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex items-stretch gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-1.5 shadow-sm z-10">
        <button
          onClick={() => handleZoom('in')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors text-base font-medium"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px bg-[var(--gray-5)] self-stretch" />
        <button
          onClick={() => handleZoom('out')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors text-base font-medium"
          title="Zoom out"
        >
          −
        </button>
        <div className="w-px bg-[var(--gray-5)] self-stretch" />
        <button
          onClick={() => setGraphPosition({ x: 0, y: 0, scale: 1 })}
          className="px-2 h-7 text-[11px] rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors tabular-nums"
          title="Reset zoom"
        >
          {Math.round(graphPosition.scale * 100)}%
        </button>
      </div>
    </div>
  );
}
