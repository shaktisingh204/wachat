'use client';
import type { N8NConnection } from '../types';
import { useConnections } from '../canvas/ConnectionsProvider';
import { DrawingEdge } from './DrawingEdge';
import { WorkflowEdge } from './WorkflowEdge';

/* ── Arrow marker definitions ────────────────────────────── */

function ArrowDefs() {
  // Shared arrow shape — same geometry as the SabFlow graph markers.
  const arrowPath =
    'M7.07138888,5.50174526 L2.43017246,7.82235347 C1.60067988,8.23709976 0.592024983,7.90088146 0.177278692,7.07138888 C0.0606951226,6.83822174 0,6.58111307 0,6.32042429 L0,1.67920787 C0,0.751806973 0.751806973,0 1.67920787,0 C1.93989666,0 2.19700532,0.0606951226 2.43017246,0.177278692 L7,3 C7.82949258,3.41474629 8.23709976,3.92128809 7.82235347,4.75078067 C7.6598671,5.07575341 7.39636161,5.33925889 7.07138888,5.50174526 Z';

  const commonMarkerProps = {
    refX: 8,
    refY: 4,
    orient: 'auto' as const,
    viewBox: '0 0 20 20',
    markerUnits: 'userSpaceOnUse' as const,
    markerWidth: 20,
    markerHeight: 20,
  };

  return (
    <defs>
      <marker id="n8n-arrow" {...commonMarkerProps}>
        <path d={arrowPath} fill="var(--gray-8)" />
      </marker>
      <marker id="n8n-orange-arrow" {...commonMarkerProps}>
        <path d={arrowPath} fill="#f76808" />
      </marker>
    </defs>
  );
}

/* ── Types ───────────────────────────────────────────────── */

type PortPositionFn = (
  nodeId: string,
  side: 'output' | 'input',
  portIndex: number,
) => { x: number; y: number } | undefined;

type Props = {
  connections: N8NConnection[];
  /** Looks up canvas-space port centre coordinates per node. */
  getPortPosition: PortPositionFn;
  onConnectionDelete?: (connectionId: string) => void;
  isReadOnly?: boolean;
};

/* ── WorkflowEdges ───────────────────────────────────────── */

export function WorkflowEdges({
  connections,
  getPortPosition,
  onConnectionDelete,
  isReadOnly = false,
}: Props) {
  const { connectingFrom, mousePosition } = useConnections();

  /* Resolve source port position for the live drawing edge */
  const drawingSrc = connectingFrom
    ? getPortPosition(connectingFrom.nodeId, 'output', connectingFrom.outputIndex)
    : undefined;

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <ArrowDefs />

      <g style={{ pointerEvents: 'all' }}>
        {/* Live connection being drawn */}
        {connectingFrom && drawingSrc && (
          <DrawingEdge
            sourceX={drawingSrc.x}
            sourceY={drawingSrc.y}
            onCancel={undefined}
          />
        )}

        {/* Persisted connections */}
        {connections.map((conn) => (
          <WorkflowEdge
            key={conn.id}
            connection={conn}
            getPortPosition={getPortPosition}
            onDelete={onConnectionDelete}
            isReadOnly={isReadOnly}
          />
        ))}
      </g>
    </svg>
  );
}
