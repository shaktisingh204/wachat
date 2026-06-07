'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { roundCorners } from 'svg-round-corners';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui';

import type { N8NConnection } from '../types';

/* Constants */

const PATH_RADIUS = 16;
const STUB = 32;

/* Path builder */

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

/* Types */

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

/* WorkflowEdge */

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
        {/* Wide transparent hit-area, 18 px stroke for easy clicking */}
        <path
          data-edge-id={connection.id}
          d={path}
          strokeWidth={18}
          stroke="transparent"
          fill="none"
          className={isReadOnly ? 'cursor-default' : 'cursor-pointer'}
          pointerEvents="stroke"
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
          stroke={isActive ? 'var(--st-accent)' : 'var(--st-border-strong)'}
          fill="none"
          markerEnd={isActive ? 'url(#n8n-orange-arrow)' : 'url(#n8n-arrow)'}
          pointerEvents="none"
          className="transition-[stroke] duration-100 ease-out"
        />
      </g>

      {/* Right-click context menu, controlled DropdownMenu anchored at the cursor */}
      {contextMenu ? (
        <DropdownMenu
          open
          onOpenChange={(next) => {
            if (!next) setContextMenu(null);
          }}
        >
          <DropdownMenuTrigger
            aria-hidden="true"
            tabIndex={-1}
            className="fixed h-0 w-0"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              variant="danger"
              iconLeft={Trash2}
              onSelect={() => {
                onDelete?.(connection.id);
                setContextMenu(null);
              }}
            >
              Delete connection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
