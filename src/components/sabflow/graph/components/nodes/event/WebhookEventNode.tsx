'use client';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useDrag } from '@use-gesture/react';
import { useShallow } from 'zustand/react/shallow';
import { LuGlobe, LuLink } from 'react-icons/lu';
import type { SabFlowEvent, SabFlowDoc, WebhookEventOptions } from '@/lib/sabflow/types';
import { useGraph } from '../../../providers/GraphProvider';
import { useSelectionStore } from '../../../hooks/useSelectionStore';
import { EventSourceEndpoint } from '../../endpoints/EventSourceEndpoint';
import { EventContextMenu } from './EventContextMenu';
import { eventWidth } from '../../../constants';
import { cn } from '@/lib/utils';

type Props = {
  event: SabFlowEvent;
  onEventUpdate?: (id: string, changes: Partial<SabFlowEvent>) => void;
  /** Optional: full flow slice for context menu operations. */
  flow?: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>;
  /** Current flow id — used to build the preview URL on the card body. */
  flowId?: string;
};

const WEBHOOK_TEAL = '#0891b2';
const WEBHOOK_CYAN = '#22d3ee';

function methodBadgeClass(method: WebhookEventOptions['method']): string {
  switch (method) {
    case 'GET':
      return 'bg-blue-500/20 text-blue-100';
    case 'POST':
      return 'bg-emerald-500/25 text-emerald-50';
    case 'PUT':
      return 'bg-amber-500/25 text-amber-50';
    case 'PATCH':
      return 'bg-orange-500/25 text-orange-50';
    case 'DELETE':
      return 'bg-red-500/25 text-red-50';
    case 'ANY':
    default:
      return 'bg-white/20 text-white';
  }
}

export function WebhookEventNode({ event, onEventUpdate, flow, flowId }: Props) {
  const { graphPosition } = useGraph();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

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

  // We are rendered specifically for an event with `type === 'webhook'`, so
  // the options union narrows to `WebhookEventOptions`.
  const options = event.options as
    | { method?: string; path?: string; enabled?: boolean }
    | undefined;
  const method = options?.method ?? 'POST';
  const path = options?.path ?? 'my-webhook';
  const enabled = options?.enabled !== false;

  const previewUrl = useMemo(() => {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://your-domain.com';
    const safePath = path.replace(/^\//, '');
    const id = flowId ?? 'flowId';
    return `${base}/api/sabflow/webhook/${id}/${safePath}`;
  }, [flowId, path]);

  return (
    <>
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
          'flex flex-col rounded-xl border select-none',
          'transition-[border-color,box-shadow]',
          'hover:shadow-md',
          isFocused ? 'border-2 border-[#0891b2]' : 'border border-[var(--gray-5)]',
          isMouseDown ? 'cursor-grabbing shadow-lg z-10' : 'cursor-grab',
          isDraggingGraph ? 'pointer-events-none' : 'pointer-events-auto',
          !enabled && 'opacity-75',
        )}
        onClick={(e) => {
          e.stopPropagation();
          focusElement(event.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          focusElement(event.id);
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* Cyan gradient header — rounded top corners only */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-t-xl"
          style={{
            background: `linear-gradient(135deg, ${WEBHOOK_TEAL} 0%, ${WEBHOOK_CYAN} 100%)`,
          }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
            <LuGlobe className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-[13px] font-semibold text-white flex-1">Webhook</span>
          <span
            className={cn(
              'rounded px-1.5 py-[1px] text-[10px] font-bold tracking-wide uppercase',
              methodBadgeClass(method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ANY'),
            )}
          >
            {method}
          </span>
        </div>

        {/* Body row — URL preview */}
        <div className="flex flex-col gap-1 px-3 py-2 bg-[var(--gray-1)] rounded-b-xl min-h-[34px]">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--gray-11)]">
            <LuLink className="h-3 w-3 shrink-0" strokeWidth={1.8} />
            <span className="truncate font-mono" title={previewUrl}>
              /{path.replace(/^\//, '')}
            </span>
          </div>
          {!enabled ? (
            <span className="text-[10.5px] text-amber-600 font-medium">Disabled</span>
          ) : null}
        </div>

        {/* Source endpoint — floats outside the right edge, vertically centred */}
        <EventSourceEndpoint
          eventId={event.id}
          className="absolute right-[-16px] top-1/2 -translate-y-1/2"
        />
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenuPos ? (
        <EventContextMenu
          eventId={event.id}
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
          flow={flow}
          onEditDescription={() => undefined}
        />
      ) : null}
    </>
  );
}
