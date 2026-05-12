'use client';
/**
 * CanvasHandle — renders the input/output port handles on a canvas node.
 *
 * Layout contract (matches n8n's canvas):
 *   • Main inputs sit on the LEFT edge.
 *   • Main outputs sit on the RIGHT edge.
 *   • AI / Tool inputs sit on the BOTTOM edge (sub-graph fan-in).
 *   • AI / Tool outputs sit on the TOP edge.
 *   • Multiple ports on the same edge are distributed along that edge
 *     between 25% and 75% so the dots never touch the corners.
 *
 * The xyflow <Handle> is rendered directly with absolute coordinates so
 * React Flow's position registry sees the same coordinates we render the
 * dot at — wrapping in a positioned div previously caused edges to anchor
 * to the wrapper bounds rather than the dot.
 */
import { Handle, Position, useConnection } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { NodePort, PortType } from '@/lib/sabflow/types';
import { createCanvasConnectionHandleString } from '../utils';
import { CanvasConnectionMode } from '../types';

type Props = {
  /** Owning node id — only needed for the connection-in-progress check. */
  nodeId: string;
  ports: NodePort[];
  mode: CanvasConnectionMode;
  isReadOnly?: boolean;
  /** When true, renders a subtle label beside each port. */
  showLabels?: boolean;
};

/**
 * Decide which edge of the node a port sits on. Main ports flow horizontally
 * (left → right); AI / Tool / Data ports flow vertically so they don't get
 * tangled with the main path.
 */
function edgeFor(port: NodePort, isInput: boolean): 'left' | 'right' | 'top' | 'bottom' {
  const aiLike: PortType[] = ['ai', 'tool', 'data'];
  if (aiLike.includes(port.type)) return isInput ? 'bottom' : 'top';
  return isInput ? 'left' : 'right';
}

/** Distribute N ports along an edge between 25% and 75%. */
function offsetForIndex(total: number, index: number): string {
  if (total <= 1) return '50%';
  const min = 25;
  const max = 75;
  const step = (max - min) / (total - 1);
  return `${min + index * step}%`;
}

export function CanvasHandle({ nodeId, ports, mode, isReadOnly, showLabels }: Props) {
  const connection = useConnection();
  const isInput = mode === CanvasConnectionMode.Input;
  const handleType = isInput ? 'target' : 'source';

  // Group ports by the edge they will sit on so the index passed into
  // offsetForIndex reflects the per-edge ordering, not the global one.
  const byEdge = new Map<ReturnType<typeof edgeFor>, NodePort[]>();
  for (const port of ports) {
    const e = edgeFor(port, isInput);
    const bucket = byEdge.get(e) ?? [];
    bucket.push(port);
    byEdge.set(e, bucket);
  }

  return (
    <>
      {ports.map((port) => {
        const edge = edgeFor(port, isInput);
        const bucket = byEdge.get(edge) ?? [port];
        const indexInBucket = bucket.indexOf(port);
        const offset = offsetForIndex(bucket.length, indexInBucket);

        const handleId = createCanvasConnectionHandleString({
          mode,
          type: port.type,
          index: port.index,
        });
        const isBeingConnected =
          connection.inProgress &&
          connection.fromNode?.id === nodeId &&
          connection.fromHandle?.id === handleId;

        const handlePosition: Position =
          edge === 'left'
            ? Position.Left
            : edge === 'right'
              ? Position.Right
              : edge === 'top'
                ? Position.Top
                : Position.Bottom;

        const handleStyle: CSSProperties =
          edge === 'left' || edge === 'right'
            ? {
                top: offset,
                [edge]: 0,
                transform: 'translateY(-50%)',
                pointerEvents: isReadOnly ? 'none' : 'auto',
              }
            : {
                left: offset,
                [edge]: 0,
                transform: 'translateX(-50%)',
                pointerEvents: isReadOnly ? 'none' : 'auto',
              };

        const labelStyle: CSSProperties =
          edge === 'left' || edge === 'right'
            ? {
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [edge === 'left' ? 'left' : 'right']: '16px',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                color: 'var(--gray-10)',
                pointerEvents: 'none',
              }
            : {
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                [edge === 'top' ? 'top' : 'bottom']: '16px',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                color: 'var(--gray-10)',
                pointerEvents: 'none',
              };

        return (
          <Handle
            key={handleId}
            id={handleId}
            type={handleType}
            position={handlePosition}
            isConnectable={!isReadOnly}
            className={isBeingConnected ? 'connecting' : undefined}
            style={handleStyle}
          >
            {showLabels && port.label ? (
              <span className="sabflow-handle-label" style={labelStyle}>
                {port.label}
              </span>
            ) : null}
          </Handle>
        );
      })}
    </>
  );
}
