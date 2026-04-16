'use client';
import { useRef, useState, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useShallow } from 'zustand/react/shallow';
import { LuPlay } from 'react-icons/lu';
import type { SabFlowEvent } from '@/lib/sabflow/types';
import { useGraph } from '../../../providers/GraphProvider';
import { useSelectionStore } from '../../../hooks/useSelectionStore';
import { EventSourceEndpoint } from '../../endpoints/EventSourceEndpoint';
import { eventWidth } from '../../../constants';
import { cn } from '@/lib/utils';

type Props = {
  event: SabFlowEvent;
  onEventUpdate?: (id: string, changes: Partial<SabFlowEvent>) => void;
};

export function StartNode({ event, onEventUpdate }: Props) {
  const { graphPosition } = useGraph();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const isFocused = useSelectionStore(
    useShallow((s) => s.focusedElementsId.includes(event.id)),
  );
  const eventCoords = useSelectionStore(
    useShallow((s) => s.elementsCoordinates?.[event.id] ?? event.graphCoordinates),
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

  // Seed this event's coordinates into the store on mount
  useEffect(() => {
    updateElementCoordinates(event.id, event.graphCoordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  useDrag(
    ({ first, last, delta: [dx, dy], event: dragEvent, target }) => {
      dragEvent.stopPropagation();

      if ((target as HTMLElement).closest('.prevent-group-drag')) return;

      if (first) {
        setIsMouseDown(true);
        const focused = useSelectionStore.getState().focusedElementsId;
        if (focused.includes(event.id) && !(dragEvent as PointerEvent).shiftKey) return;
        focusElement(event.id, (dragEvent as PointerEvent).shiftKey);
      }

      moveFocusedElements({
        x: dx / graphPosition.scale,
        y: dy / graphPosition.scale,
      });

      if (last) {
        setIsMouseDown(false);
        const coords = getElementsCoordinates();
        if (coords?.[event.id]) {
          onEventUpdate?.(event.id, { graphCoordinates: coords[event.id] });
        }
      }
    },
    {
      target: nodeRef,
      pointer: { keys: false },
      from: () => [
        eventCoords.x * graphPosition.scale,
        eventCoords.y * graphPosition.scale,
      ],
    },
  );

  return (
    <div
      ref={nodeRef}
      id={`event-${event.id}`}
      data-moving-element={`event-${event.id}`}
      data-selectable={event.id}
      style={{
        transform: `translate(${eventCoords.x}px, ${eventCoords.y}px)`,
        touchAction: 'none',
        width: eventWidth,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      className={cn(
        'flex flex-col rounded-xl border select-none overflow-hidden',
        'transition-[border-color,box-shadow]',
        'hover:shadow-md',
        isFocused ? 'border-2 border-[#f76808]' : 'border border-[var(--gray-5)]',
        isMouseDown ? 'cursor-grabbing shadow-lg z-10' : 'cursor-grab',
        isDraggingGraph ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      onClick={(e) => {
        e.stopPropagation();
        focusElement(event.id);
      }}
    >
      {/* Orange gradient header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{
          background: 'linear-gradient(135deg, #f76808 0%, #f7a035 100%)',
        }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
          <LuPlay className="h-3.5 w-3.5 text-white translate-x-[1px]" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold text-white">Start</span>
      </div>

      {/* Description row */}
      <div className="flex items-center px-3 py-2 bg-[var(--gray-1)]">
        <span className="text-[12px] text-[var(--gray-10)]">Flow starts</span>
      </div>

      {/* Source endpoint — right side, vertically centred on the card */}
      <EventSourceEndpoint
        eventId={event.id}
        className="absolute right-[-19px] bottom-[3px]"
      />
    </div>
  );
}
