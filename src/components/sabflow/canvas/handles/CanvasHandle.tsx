'use client';
/**
 * CanvasHandle — port of n8n's CanvasHandleRenderer.vue.
 *
 * Renders the input/output handles (ports) on each canvas node. Handles are
 * positioned on the LEFT for inputs and RIGHT for outputs, matching n8n.
 * Multiple ports are distributed vertically.
 */
import { Handle, Position, useConnection } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { NodePort } from '@/lib/sabflow/types';
import { createCanvasConnectionHandleString } from '../utils';
import { CanvasConnectionMode } from '../types';

function mkStyleForIndex(total: number, index: number): CSSProperties {
  // Distribute vertically: evenly spaced from 20% to 80% of the node's height.
  if (total <= 1) return { top: '50%' };
  const min = 20;
  const max = 80;
  const step = (max - min) / (total - 1);
  return { top: `${min + index * step}%` };
}

type Props = {
  /** The node's id — used to label handles with their parent. */
  nodeId: string;
  ports: NodePort[];
  mode: CanvasConnectionMode;
  isReadOnly?: boolean;
  /** When true, renders a subtle label beside each port. */
  showLabels?: boolean;
};

export function CanvasHandle({ nodeId, ports, mode, isReadOnly, showLabels }: Props) {
  const connection = useConnection();
  const position = mode === CanvasConnectionMode.Input ? Position.Left : Position.Right;

  return (
    <>
      {ports.map((port, index) => {
        const handleId = createCanvasConnectionHandleString({
          mode,
          type: port.type,
          index: port.index,
        });
        const style = mkStyleForIndex(ports.length, index);
        const isBeingConnected =
          connection.inProgress &&
          connection.fromNode?.id === nodeId &&
          connection.fromHandle?.id === handleId;

        return (
          <div
            key={handleId}
            className="sabflow-handle-wrap"
            style={{
              position: 'absolute',
              ...style,
              [mode === CanvasConnectionMode.Input ? 'left' : 'right']: 0,
              transform: 'translateY(-50%)',
              pointerEvents: isReadOnly ? 'none' : 'auto',
            }}
          >
            <Handle
              type={mode === CanvasConnectionMode.Input ? 'target' : 'source'}
              position={position}
              id={handleId}
              isConnectable={!isReadOnly}
              className={isBeingConnected ? 'connecting' : undefined}
              style={{ position: 'relative', top: 0, transform: 'none' }}
            />
            {showLabels && port.label ? (
              <span
                className="sabflow-handle-label"
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [mode === CanvasConnectionMode.Input ? 'left' : 'right']: '16px',
                  whiteSpace: 'nowrap',
                  fontSize: '11px',
                  color: 'var(--gray-10)',
                  pointerEvents: 'none',
                }}
              >
                {port.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
