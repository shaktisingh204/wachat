'use client';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useConnections } from '../canvas/ConnectionsProvider';

/* ── Types ──────────────────────────────────────────────── */

type PortSide = 'input' | 'output';

type Props = {
  nodeId: string;
  side: PortSide;
  /** Zero-based port index (for multi-output nodes like IF/Switch). */
  portIndex?: number;
  /** Called when the user completes a drag onto this input port. */
  onConnect?: (sourceNodeId: string, sourceOutputIndex: number, targetInputIndex: number) => void;
  className?: string;
};

/* ── NodePortDot ─────────────────────────────────────────── */

export function NodePortDot({
  nodeId,
  side,
  portIndex = 0,
  onConnect,
  className,
}: Props) {
  const { connectingFrom, setConnectingFrom, isConnecting } = useConnections();

  /* Start dragging a new connection from this output port. */
  const handleOutputMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setConnectingFrom({ nodeId, outputIndex: portIndex });
    },
    [nodeId, portIndex, setConnectingFrom],
  );

  /* Complete the connection on this input port. */
  const handleInputMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!connectingFrom || connectingFrom.nodeId === nodeId) return;
      e.stopPropagation();
      onConnect?.(connectingFrom.nodeId, connectingFrom.outputIndex, portIndex);
      setConnectingFrom(null);
    },
    [connectingFrom, nodeId, portIndex, onConnect, setConnectingFrom],
  );

  /* Whether the active drag is hovering over a valid target (input side). */
  const isDropTarget = isConnecting && side === 'input' && connectingFrom?.nodeId !== nodeId;

  /* Visual: output ports are on the right, input on the left. */
  const isOutput = side === 'output';

  return (
    <div
      data-port-side={side}
      data-node-id={nodeId}
      data-port-index={portIndex}
      title={isOutput ? `Output ${portIndex}` : `Input ${portIndex}`}
      className={cn(
        // Positioned absolutely on the node card edge
        'absolute top-1/2 -translate-y-1/2 z-10',
        isOutput ? '-right-3' : '-left-3',
        // Hit-area wrapper
        'flex h-6 w-6 items-center justify-center',
        isOutput ? 'cursor-crosshair' : isDropTarget ? 'cursor-cell' : 'cursor-default',
        className,
      )}
      onMouseDown={isOutput ? handleOutputMouseDown : undefined}
      onMouseUp={!isOutput ? handleInputMouseUp : undefined}
    >
      {/* Outer ring — always visible */}
      <div
        className={cn(
          'flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-all duration-150',
          isDropTarget
            ? 'scale-125 border-[#f76808] bg-[#f76808]/15 shadow-[0_0_0_3px_rgba(247,104,8,0.25)]'
            : isOutput
              ? 'border-[var(--gray-6)] bg-[var(--gray-1)] hover:border-[#f76808] hover:bg-[#f76808]/10'
              : 'border-[var(--gray-6)] bg-[var(--gray-1)]',
        )}
      >
        {/* Inner dot */}
        <div
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-150',
            isDropTarget
              ? 'bg-[#f76808]'
              : isOutput
                ? 'bg-[#f7a868] group-hover:bg-[#f76808]'
                : 'bg-[var(--gray-7)]',
          )}
        />
      </div>
    </div>
  );
}
