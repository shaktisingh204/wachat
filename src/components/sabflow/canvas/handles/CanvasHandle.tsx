'use client';
/**
 * CanvasHandle — renders the input/output port handles on a canvas node.
 *
 * Layout contract (matches n8n):
 *   • Inputs live on the LEFT edge of the node.
 *   • Outputs live on the RIGHT edge of the node.
 *   • Multiple ports are distributed vertically between 20% and 80% of node height.
 *
 * We position the xyflow <Handle> directly via absolute coordinates so React
 * Flow's internal position registry sees the same coordinates we render the
 * dot at — wrapping the handle in a positioned div was causing edges to anchor
 * to the wrong side because xyflow measured the wrapper bounds, not the dot.
 */
import { Handle, Position, useConnection } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { NodePort } from '@/lib/sabflow/types';
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

/** Distribute N ports vertically between 20% and 80% of the node height. */
function topForIndex(total: number, index: number): string {
  if (total <= 1) return '50%';
  const min = 20;
  const max = 80;
  const step = (max - min) / (total - 1);
  return `${min + index * step}%`;
}

export function CanvasHandle({ nodeId, ports, mode, isReadOnly, showLabels }: Props) {
  const connection = useConnection();
  const isInput = mode === CanvasConnectionMode.Input;
  const handlePosition = isInput ? Position.Left : Position.Right;
  const handleType = isInput ? 'target' : 'source';

  return (
    <>
      {ports.map((port, index) => {
        const handleId = createCanvasConnectionHandleString({
          mode,
          type: port.type,
          index: port.index,
        });
        const top = topForIndex(ports.length, index);
        const isBeingConnected =
          connection.inProgress &&
          connection.fromNode?.id === nodeId &&
          connection.fromHandle?.id === handleId;

        const handleStyle: CSSProperties = {
          top,
          // Pin the handle to the correct edge. xyflow reads the bounding box
          // of THIS element to compute the edge anchor, so the dot needs to
          // sit at the visual edge of the node — no extra wrapper offsets.
          [isInput ? 'left' : 'right']: 0,
          transform: 'translateY(-50%)',
          pointerEvents: isReadOnly ? 'none' : 'auto',
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
              <span
                className="sabflow-handle-label"
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [isInput ? 'left' : 'right']: '16px',
                  whiteSpace: 'nowrap',
                  fontSize: '11px',
                  color: 'var(--gray-10)',
                  pointerEvents: 'none',
                }}
              >
                {port.label}
              </span>
            ) : null}
          </Handle>
        );
      })}
    </>
  );
}
