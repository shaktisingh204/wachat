'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { useGraph } from '../providers/GraphProvider';
import { useSelectionStore } from '../hooks/useSelectionStore';
import { useBlockDnd } from '../providers/GraphDndProvider';
import { createId } from '@paralleldrive/cuid2';
import GraphElements from './GraphElements';
import type { SabFlowDoc, Group, Coordinates } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';

const maxScale = 2;
const minScale = 0.2;
const zoomStep = 0.2;

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function Graph({ flow, onFlowChange, containerRef }: Props) {
  const { graphPosition, setGraphPosition } = useGraph();
  const { draggedBlockType, setDraggedBlockType } = useBlockDnd();

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const setIsDraggingGraph = useSelectionStore((s) => s.setIsDraggingGraph);
  const blurElements = useSelectionStore((s) => s.blurElements);
  const { setElementsCoordinates, updateElementCoordinates } = useSelectionStore(
    useShallow((s) => ({
      setElementsCoordinates: s.setElementsCoordinates,
      updateElementCoordinates: s.updateElementCoordinates,
    })),
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Seed all group coordinates once on mount (Typebot pattern) ───────────
  useEffect(() => {
    const coords: Record<string, Coordinates> = {};
    flow.groups.forEach((g) => { coords[g.id] = g.graphCoordinates; });
    setElementsCoordinates(coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Project screen coords → canvas coords */
  const projectMouse = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - graphPosition.x) / graphPosition.scale,
      y: (clientY - rect.top - graphPosition.y) / graphPosition.scale,
    };
  }, [graphPosition]);

  /* Handle group position updates */
  const handleGroupUpdate = useCallback((id: string, changes: Partial<Group>) => {
    onFlowChange({
      groups: flow.groups.map((g) => (g.id === id ? { ...g, ...changes } : g)),
    });
  }, [flow.groups, onFlowChange]);

  /* Drop new block from sidebar */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggedBlockType) {
      const pos = projectMouse(e.clientX, e.clientY);
      const newGroupId = createId();
      const newBlockId = createId();
      const coords = { x: pos.x - 150, y: pos.y - 30 };
      const newGroup: Group = {
        id: newGroupId,
        title: 'Group',
        graphCoordinates: coords,
        blocks: [{
          id: newBlockId,
          type: draggedBlockType,
          groupId: newGroupId,
          options: {},
        }],
      };
      updateElementCoordinates(newGroupId, coords);
      onFlowChange({ groups: [...flow.groups, newGroup] });
      setDraggedBlockType(undefined);
    }
  }, [draggedBlockType, projectMouse, flow.groups, onFlowChange, setDraggedBlockType, updateElementCoordinates]);

  /* Canvas pan + zoom gestures.
   * Groups stop event propagation on pointerdown (no filterTaps), so this
   * handler only fires when the user drags directly on the canvas background.
   */
  useGesture(
    {
      onDrag: ({ delta: [dx, dy], first, last }) => {
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
          const ratio = newScale / pos.scale;
          return {
            scale: newScale,
            x: pos.x - mouseX * (ratio - 1),
            y: pos.y - mouseY * (ratio - 1),
          };
        });
      },
      onPinch: ({ offset: [scale] }) => {
        setGraphPosition((pos) => ({
          ...pos,
          scale: Math.min(maxScale, Math.max(minScale, scale)),
        }));
      },
    },
    {
      target: canvasRef,
      drag: { pointer: { keys: false } },
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
        'relative flex-1 overflow-hidden',
        draggedBlockType
          ? 'cursor-crosshair'
          : isDraggingGraph
          ? 'cursor-grabbing'
          : 'cursor-default',
      )}
      style={{
        touchAction: 'none',
        backgroundColor: 'var(--gray-3)',
        backgroundImage: 'radial-gradient(var(--gray-7) 1px, transparent 0)',
        backgroundSize: '40px 40px',
        backgroundPosition: '-19px -19px',
      }}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (e.target === canvasRef.current) blurElements();
      }}
    >
      {/* Transformed canvas layer — Typebot pattern: fills viewport, groups are absolute within */}
      <div
        className="flex flex-1 w-full h-full absolute will-change-transform"
        style={{
          transform: `translate(${graphPosition.x}px, ${graphPosition.y}px) scale(${graphPosition.scale})`,
          transformOrigin: '0 0',
          perspective: 1000,
        }}
      >
        <GraphElements
          flow={flow}
          onGroupUpdate={handleGroupUpdate}
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex items-stretch gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-1.5 shadow-sm z-10">
        <button
          onClick={() => handleZoom('in')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors font-medium text-base"
          title="Zoom in"
        >+</button>
        <div className="w-px bg-[var(--gray-5)] self-stretch" />
        <button
          onClick={() => handleZoom('out')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors font-medium text-base"
          title="Zoom out"
        >−</button>
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
