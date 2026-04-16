'use client';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { computeDropOffPath, dropOffBoxDimensions, dropOffStubLength } from '../../helpers/computeDropOffPath';
import { computeSourceCoordinates } from '../../helpers/computeSourceCoordinates';
import { groupWidth } from '../../constants';
import type { Group } from '@/lib/sabflow/types';

type Props = {
  /** The block that has no outgoing edge. */
  blockId: string;
  /** All groups in the flow — used to locate the block's parent group. */
  groups: Group[];
};

/**
 * Renders a short curved "drop-off" arc at the right edge of a block that has
 * no outgoing connection. The arc is drawn in orange to visually indicate that
 * the flow ends here without an explicit target.
 *
 * Behaviour mirrors Typebot's DropOffEdge but without the analytics overlay —
 * SabFlow does not yet expose per-block drop-off metrics.
 */
export function DropOffEdge({ blockId, groups }: Props) {
  // Locate the parent group so we can read its canvas coordinates.
  const parentGroup = useMemo(
    () => groups.find((g) => g.blocks.some((b) => b.id === blockId)),
    [blockId, groups],
  );

  const groupCoordinates = useSelectionStore(
    useShallow((state) =>
      parentGroup?.id && state.elementsCoordinates
        ? state.elementsCoordinates[parentGroup.id]
        : undefined,
    ),
  );

  const { sourceEndpointYOffsets } = useEndpoints();

  // Determine whether this block is the last one in its group so we can curve
  // the arc downward rather than sideways.
  const isLastBlock = useMemo(() => {
    if (!parentGroup) return false;
    const lastBlock = parentGroup.blocks.at(-1);
    return lastBlock?.id === blockId;
  }, [blockId, parentGroup]);

  // Y offset for this block's source endpoint (registered by the block node).
  const sourceTop = useMemo(
    () => sourceEndpointYOffsets.get(blockId)?.y,
    [blockId, sourceEndpointYOffsets],
  );

  // Absolute canvas coordinates of the source endpoint.
  const endpointCoordinates = useMemo(() => {
    if (!groupCoordinates || sourceTop === undefined) return undefined;
    return computeSourceCoordinates({
      sourcePosition: groupCoordinates,
      sourceTop,
      elementWidth: groupWidth,
    });
  }, [groupCoordinates, sourceTop]);

  if (!endpointCoordinates) return null;

  const pathD = computeDropOffPath(endpointCoordinates, isLastBlock);

  // Badge position mirrors Typebot's foreignObject placement.
  const badgeX = endpointCoordinates.x + dropOffStubLength;
  const badgeY = isLastBlock
    ? endpointCoordinates.y + 80 // dropOffSegmentLength
    : endpointCoordinates.y - dropOffBoxDimensions.height / 2;

  return (
    <g data-testid={`dropoff-edge-${blockId}`}>
      {/* The arc path */}
      <path
        d={pathD}
        stroke="#f76808"
        strokeWidth={2}
        fill="none"
        strokeDasharray="6 3"
        pointerEvents="none"
      />

      {/* Small badge indicating the dead-end */}
      <foreignObject
        width={dropOffBoxDimensions.width}
        height={dropOffBoxDimensions.height}
        x={badgeX}
        y={badgeY}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            backgroundColor: '#f76808',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          No connection
        </div>
      </foreignObject>
    </g>
  );
}
