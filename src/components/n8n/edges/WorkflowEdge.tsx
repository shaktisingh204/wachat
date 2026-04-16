'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { roundCorners } from 'svg-round-corners';
import type { N8NConnection } from '../types';

/* ── Constants ───────────────────────────────────────────── */

const PATH_RADIUS = 16;
const STUB = 32;

/* ── Path builder ────────────────────────────────────────── */

/**
 * Builds an n8n-style bezier-ish path with rounded corners.
 *
 * All coordinates are in canvas-space.
 * The path always exits the source from the right and enters the
 * target from the left.
 */
function buildEdgePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const midX = sx + (tx - sx) / 2;
  const raw = [
    `M${sx},${sy}`,
    `L${sx + STUB},${sy}`,
    `L${midX},${sy}`,
    `L${midX},${ty}`,
    `L${tx - STUB},${ty}`,
    `L${tx},${ty}`,
  ].join(' ');
  return roundCorners(raw, PATH_RADIUS).path;
}

/* ── Types ───────────────────────────────────────────────── */

type PortPositionFn = (
  nodeId: string,
  side: 'output' | 'input',
  portIndex: number,
) => { x: number; y: number } | undefined;

type Props = {
  connection: N8NConnection;
  /** Canvas-space getter; supplied by WorkflowEdges. */
  getPortPosition: PortPositionFn;
  onDelete?: (connectionId: string) => void;
  isReadOnly?: boolean;
};

/* ── WorkflowEdge ────────────────────────────────────────── */

export function WorkflowEdge({
  connection,
  getPortPosition,
  onDelete,
  isReadOnly = false,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const src = getPortPosition(connection.sourceNodeId, 'output', connection.sourceOutputIndex);
  const tgt = getPortPosition(connection.targetNodeId, 'input', connection.targetInputIndex);

  /* Close context menu on next outside click */
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  /* Delete via keyboard while hovered */
  useEffect(() => {
    if (!isHovered || isReadOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        onDelete?.(connection.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHovered, isReadOnly, connection.id, onDelete]);

  if (!src || !tgt) return null;

  const path = buildEdgePath(src.x, src.y, tgt.x, tgt.y);
  const isActive = isHovered;

  return (
    <>
      <g>
        {/* Wide transparent hit-area — 18 px stroke for easy clicking */}
        <path
          data-edge-id={connection.id}
          d={path}
          strokeWidth={18}
          stroke="transparent"
          fill="none"
          style={{ cursor: isReadOnly ? 'default' : 'pointer', pointerEvents: 'stroke' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => !isReadOnly && setIsHovered(true)}
          onContextMenu={(e) => {
            if (isReadOnly) return;
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        />

        {/* Visible 2 px path */}
        <path
          d={path}
          strokeWidth={2}
          stroke={isActive ? '#f76808' : 'var(--gray-8)'}
          fill="none"
          markerEnd={isActive ? 'url(#n8n-orange-arrow)' : 'url(#n8n-arrow)'}
          pointerEvents="none"
          style={{ transition: 'stroke 120ms ease' }}
        />
      </g>

      {/* Right-click context menu — portal to body */}
      {contextMenu &&
        createPortal(
          <div
            className="fixed z-[9999] min-w-[130px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] py-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-[var(--gray-3)] transition-colors"
              onClick={() => {
                onDelete?.(connection.id);
                setContextMenu(null);
              }}
            >
              Delete connection
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
