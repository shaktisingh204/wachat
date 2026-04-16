'use client';
import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getNodeMeta } from '../registry';
import { useWorkflow } from '../WorkflowContext';
import type { N8NCanvasNode, N8NCanvasConnection } from '../types';

/** Width of every node card (used for edge anchor calculations). */
export const NODE_WIDTH = 200;
/** Height of the node header area. */
export const NODE_HEADER_HEIGHT = 44;
/** Height of the body section (ports live here). */
export const NODE_BODY_HEIGHT = 36;

type Props = {
  node: N8NCanvasNode;
  connections: N8NCanvasConnection[];
  onMove: (name: string, x: number, y: number) => void;
  onConnectionStart: (nodeName: string, outputIndex: number) => void;
  onConnectionEnd: (nodeName: string, inputIndex: number) => void;
};

export function N8NNode({
  node,
  connections,
  onMove,
  onConnectionStart,
  onConnectionEnd,
}: Props) {
  const { selectedNodeId, setSelectedNodeId, graphPosition, draftConnection } =
    useWorkflow();
  const meta = getNodeMeta(node.type);
  const isSelected = selectedNodeId === node.id;
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ mx: number; my: number; nx: number; ny: number } | null>(
    null,
  );

  /* ── Drag-to-reposition ─────────────────────────────────────────────────── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-port]')) return;
      e.stopPropagation();
      setSelectedNodeId(node.id);

      const [nx, ny] = node.position;
      dragOrigin.current = { mx: e.clientX, my: e.clientY, nx, ny };

      const onMouseMove = (mv: MouseEvent) => {
        if (!dragOrigin.current) return;
        const dx = (mv.clientX - dragOrigin.current.mx) / graphPosition.scale;
        const dy = (mv.clientY - dragOrigin.current.my) / graphPosition.scale;
        // Snap to 20px grid
        const snappedX = Math.round((dragOrigin.current.nx + dx) / 20) * 20;
        const snappedY = Math.round((dragOrigin.current.ny + dy) / 20) * 20;
        onMove(node.name, snappedX, snappedY);
      };

      const onMouseUp = () => {
        dragOrigin.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [node.id, node.name, node.position, graphPosition.scale, onMove, setSelectedNodeId],
  );

  const Icon = meta.icon;
  const isTarget =
    draftConnection !== null && draftConnection.sourceNodeName !== node.name;

  const [posX, posY] = node.position;

  return (
    <div
      ref={nodeRef}
      data-node-id={node.id}
      data-node-name={node.name}
      className={cn(
        'absolute select-none rounded-xl border-2 bg-[var(--gray-1)] shadow-md',
        'transition-[border-color,box-shadow] duration-100',
        isSelected
          ? 'border-[#f76808] shadow-[0_0_0_3px_rgba(247,104,8,0.18)]'
          : isTarget
          ? 'border-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.25)]'
          : 'border-[var(--gray-5)] hover:border-[var(--gray-7)]',
        node.disabled && 'opacity-50',
      )}
      style={{
        left: posX,
        top: posY,
        width: NODE_WIDTH,
        cursor: 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2.5"
        style={{ background: `${meta.color}18` }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.color, color: '#fff' }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span
          className="flex-1 truncate text-[12px] font-semibold text-[var(--gray-12)]"
          title={node.name}
        >
          {node.name}
        </span>
      </div>

      {/* ── Body: port connectors + description ─────────────────────────────── */}
      <div className="relative flex items-stretch py-2 px-0 min-h-[36px]">
        {/* Input ports — left edge */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-around -translate-x-1/2 z-10">
          {Array.from({ length: meta.inputs }).map((_, i) => (
            <button
              key={i}
              data-port="input"
              type="button"
              title={`Input ${i}`}
              className={cn(
                'h-3 w-3 rounded-full border-2 border-[var(--gray-1)] transition-colors',
                isTarget
                  ? 'bg-blue-400 scale-125'
                  : 'bg-[var(--gray-8)] hover:bg-blue-400',
              )}
              onMouseUp={(e) => {
                e.stopPropagation();
                onConnectionEnd(node.name, i);
              }}
            />
          ))}
        </div>

        {/* Description text */}
        <span className="flex-1 px-3 py-0.5 text-[10.5px] text-[var(--gray-9)] truncate leading-tight">
          {meta.description.length > 36
            ? meta.description.slice(0, 36) + '…'
            : meta.description}
        </span>

        {/* Output ports — right edge */}
        <div className="absolute right-0 top-0 h-full flex flex-col justify-around translate-x-1/2 z-10">
          {Array.from({ length: meta.outputs }).map((_, i) => (
            <button
              key={i}
              data-port="output"
              type="button"
              title={`Output ${i}`}
              className="h-3 w-3 rounded-full border-2 border-[var(--gray-1)] bg-[var(--gray-8)] hover:bg-[#f76808] transition-colors"
              onMouseDown={(e) => {
                e.stopPropagation();
                onConnectionStart(node.name, i);
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Disabled badge ──────────────────────────────────────────────────── */}
      {node.disabled && (
        <div className="absolute -top-2 -right-2 rounded-full bg-[var(--gray-6)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--gray-10)]">
          off
        </div>
      )}

      {/* ── Notes indicator ─────────────────────────────────────────────────── */}
      {node.notes && (
        <div className="absolute -bottom-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-white">
          N
        </div>
      )}
    </div>
  );
}
