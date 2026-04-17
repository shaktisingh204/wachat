'use client';
/**
 * MultiSourceEndpoints
 *
 * n8n-style output-pin stack rendered on the right edge of a BlockNode.
 * Each pin is a small coloured dot that:
 *  - registers its canvas-space Y offset with `useEndpoints()` under the
 *    composite key `${blockId}:${pinId}` so <Edge> can look it up
 *  - starts a new drag via `useGraph().setConnectingIds({...})`
 *  - shows a tooltip label on hover
 *
 * The stack is vertically distributed along the right side of the card so
 * that even narrow Typebot-style cards remain readable.
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type { OutputPin } from '@/lib/sabflow/types';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useBlockDnd } from '../../providers/GraphDndProvider';
import { endpointSourceHeight } from '../../constants';

type Props = {
  blockId: string;
  groupId: string;
  pins: OutputPin[];
  /** Edge ids currently originating from this block — used to draw persistent dots. */
  outgoingPinIds?: ReadonlySet<string>;
  className?: string;
};

/** Composite endpoint key so Edge.tsx can resolve `blockId:pinId` lookups. */
export const pinEndpointId = (blockId: string, pinId: string): string =>
  `${blockId}:${pinId}`;

export function MultiSourceEndpoints({
  blockId,
  groupId,
  pins,
  outgoingPinIds,
  className,
}: Props) {
  return (
    <div
      data-testid="multi-source-endpoints"
      className={cn(
        'prevent-group-drag pointer-events-auto flex flex-col gap-1.5',
        className,
      )}
    >
      {pins.map((pin) => (
        <PinEndpoint
          key={pin.id}
          pin={pin}
          blockId={blockId}
          groupId={groupId}
          hasOutgoingEdge={outgoingPinIds?.has(pin.id) ?? false}
        />
      ))}
    </div>
  );
}

/* ── Single pin ──────────────────────────────────────────────────────────── */

type PinProps = {
  pin: OutputPin;
  blockId: string;
  groupId: string;
  hasOutgoingEdge: boolean;
};

function PinEndpoint({ pin, blockId, groupId, hasOutgoingEdge }: PinProps) {
  const {
    canvasPosition,
    connectingIds,
    setConnectingIds,
    previewingEdge,
  } = useGraph();
  const { mouseOverBlock } = useBlockDnd();
  const { setSourceEndpointYOffset, deleteSourceEndpointYOffset } = useEndpoints();

  const ref = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

  /** Composite key used for sourceEndpointYOffsets lookup by <Edge>. */
  const endpointId = pinEndpointId(blockId, pin.id);

  const isParentHovered = mouseOverBlock?.id === blockId;

  // Canvas-space Y — recomputed on canvas move / group resize / group move.
  const endpointY = useMemo(
    () => {
      if (!ref.current) return undefined;
      return Number(
        ((ref.current.getBoundingClientRect().y +
          (endpointSourceHeight * canvasPosition.scale) / 2 -
          canvasPosition.y) /
          canvasPosition.scale).toFixed(2),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasPosition.scale, canvasPosition.y, groupHeight, groupTransform],
  );

  useLayoutEffect(() => {
    const el = document.getElementById(`group-${groupId}`);
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setGroupHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [groupId]);

  useLayoutEffect(() => {
    const el = document.getElementById(`group-${groupId}`);
    if (!el) return;
    const mo = new MutationObserver((entries) => {
      setGroupTransform((entries[0].target as HTMLElement).style.transform);
    });
    mo.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => mo.disconnect();
  }, [groupId]);

  useEffect(() => {
    if (endpointY === undefined) return;
    setSourceEndpointYOffset({ id: endpointId, y: endpointY });
  }, [setSourceEndpointYOffset, endpointId, endpointY]);

  useEffect(() => {
    return () => deleteSourceEndpointYOffset(endpointId);
  }, [deleteSourceEndpointYOffset, endpointId]);

  const isDraggingFromHere =
    connectingIds?.source.blockId === blockId &&
    connectingIds?.source.pinId === pin.id;

  const isPreviewingFromHere =
    !!previewingEdge &&
    'blockId' in previewingEdge.from &&
    previewingEdge.from.blockId === blockId &&
    previewingEdge.from.pinId === pin.id;

  const [isPinHovered, setIsPinHovered] = useState(false);

  const isHighlighted =
    isParentHovered || isDraggingFromHere || isPreviewingFromHere || isPinHovered;

  const color = pin.color ?? 'var(--gray-9)';

  return (
    <div
      ref={ref}
      data-testid={`pin-endpoint-${pin.id}`}
      className="relative flex h-5 w-5 cursor-copy items-center justify-center rounded-full"
      onMouseEnter={() => setIsPinHovered(true)}
      onMouseLeave={() => setIsPinHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
        setConnectingIds({
          source: { groupId, blockId, pinId: pin.id },
          target: undefined,
        });
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Outer ring — always visible so pins read as pins even at rest */}
      <div
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border-2 bg-[var(--gray-1)] transition-transform duration-150',
          isHighlighted ? 'scale-125' : 'scale-100',
        )}
        style={{ borderColor: color }}
      >
        {/* Inner dot — fills when active or already has an edge */}
        <div
          className="h-[7px] w-[7px] rounded-full transition-opacity duration-150"
          style={{
            backgroundColor: color,
            opacity: isHighlighted || hasOutgoingEdge ? 1 : 0.55,
          }}
        />
      </div>

      {/* Hover tooltip — label shown to the right of the pin */}
      {isPinHovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded border border-[var(--gray-5)] bg-[var(--gray-1)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--gray-12)] shadow-sm z-10"
        >
          {pin.label}
        </div>
      )}
    </div>
  );
}
