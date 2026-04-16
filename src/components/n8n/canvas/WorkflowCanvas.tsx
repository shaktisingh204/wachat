'use client';
import { useRef, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { createId } from '@paralleldrive/cuid2';
import { cn } from '@/lib/utils';
import { useWorkflow } from '../WorkflowContext';
import { N8NNode, NODE_WIDTH, NODE_HEADER_HEIGHT, NODE_BODY_HEIGHT } from '../nodes/N8NNode';
import { getNodeMeta } from '../registry';
import type {
  N8NCanvasWorkflow,
  N8NCanvasNode,
  N8NCanvasConnection,
} from '../types';

const MAX_SCALE = 2;
const MIN_SCALE = 0.2;
const ZOOM_STEP = 0.15;

/** Port anchor in canvas-space.
 *  side: 'output' = right edge, 'input' = left edge
 */
function portAnchor(
  node: N8NCanvasNode,
  side: 'input' | 'output',
  portIndex: number,
  totalPorts: number,
): { x: number; y: number } {
  const [nx, ny] = node.position;
  const x = side === 'output' ? nx + NODE_WIDTH : nx;
  const bodyStart = NODE_HEADER_HEIGHT;
  const spacing = NODE_BODY_HEIGHT / Math.max(totalPorts, 1);
  const y = ny + bodyStart + spacing * portIndex + spacing / 2;
  return { x, y };
}

/** SVG cubic bezier path between two canvas points. */
function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const cp = Math.abs(tx - sx) * 0.5;
  return `M ${sx} ${sy} C ${sx + cp} ${sy}, ${tx - cp} ${ty}, ${tx} ${ty}`;
}

type Props = {
  workflow: N8NCanvasWorkflow;
  onChange: (changes: Partial<Pick<N8NCanvasWorkflow, 'nodes' | 'connections'>>) => void;
};

export function WorkflowCanvas({ workflow, onChange }: Props) {
  const {
    graphPosition,
    setGraphPosition,
    draftConnection,
    setDraftConnection,
    draggedNodeType,
    setDraggedNodeType,
    setSelectedNodeId,
  } = useWorkflow();

  const canvasRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /* ── screen → canvas coords ────────────────────────────────────────────── */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - graphPosition.x) / graphPosition.scale,
        y: (clientY - rect.top - graphPosition.y) / graphPosition.scale,
      };
    },
    [graphPosition],
  );

  /* ── Live mouse tracking for draft edge ────────────────────────────────── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = toCanvas(e.clientX, e.clientY);
      mousePosRef.current = pos;
      if (draftConnection) {
        setDraftConnection((prev) =>
          prev ? { ...prev, mouseX: pos.x, mouseY: pos.y } : null,
        );
      }
    },
    [draftConnection, setDraftConnection, toCanvas],
  );

  /* ── Drop new node from palette ─────────────────────────────────────────── */
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (draftConnection) {
        setDraftConnection(null);
        return;
      }
      if (draggedNodeType) {
        const pos = toCanvas(e.clientX, e.clientY);
        const meta = getNodeMeta(draggedNodeType);
        // Deduplicate node names: append " 2", " 3" etc.
        const baseName = meta.label;
        const existingNames = new Set(workflow.nodes.map((n) => n.name));
        let name = baseName;
        let counter = 2;
        while (existingNames.has(name)) {
          name = `${baseName} ${counter++}`;
        }
        const newNode: N8NCanvasNode = {
          id: createId(),
          name,
          type: draggedNodeType,
          typeVersion: 1,
          position: [
            Math.round((pos.x - NODE_WIDTH / 2) / 20) * 20,
            Math.round((pos.y - NODE_HEADER_HEIGHT / 2) / 20) * 20,
          ],
          parameters: {},
        };
        onChange({ nodes: [...workflow.nodes, newNode] });
        setDraggedNodeType(null);
      }
    },
    [
      draggedNodeType,
      draftConnection,
      toCanvas,
      workflow.nodes,
      onChange,
      setDraggedNodeType,
      setDraftConnection,
    ],
  );

  /* ── Node move (by name, since name is the connection key in n8n) ───────── */
  const handleNodeMove = useCallback(
    (name: string, x: number, y: number) => {
      onChange({
        nodes: workflow.nodes.map((n) =>
          n.name === name ? { ...n, position: [x, y] as [number, number] } : n,
        ),
      });
    },
    [workflow.nodes, onChange],
  );

  /* ── Connection start ───────────────────────────────────────────────────── */
  const handleConnectionStart = useCallback(
    (nodeName: string, outputIndex: number) => {
      setDraftConnection({
        sourceNodeName: nodeName,
        sourceOutputIndex: outputIndex,
        mouseX: mousePosRef.current.x,
        mouseY: mousePosRef.current.y,
      });
    },
    [setDraftConnection],
  );

  /* ── Connection end ─────────────────────────────────────────────────────── */
  const handleConnectionEnd = useCallback(
    (targetNodeName: string, targetInputIndex: number) => {
      if (!draftConnection) return;
      if (draftConnection.sourceNodeName === targetNodeName) {
        setDraftConnection(null);
        return;
      }
      const duplicate = workflow.connections.find(
        (c) =>
          c.sourceNodeName === draftConnection.sourceNodeName &&
          c.sourceOutputIndex === draftConnection.sourceOutputIndex &&
          c.targetNodeName === targetNodeName &&
          c.targetInputIndex === targetInputIndex,
      );
      if (!duplicate) {
        const newConn: N8NCanvasConnection = {
          id: createId(),
          sourceNodeName: draftConnection.sourceNodeName,
          sourceOutputIndex: draftConnection.sourceOutputIndex,
          targetNodeName,
          targetInputIndex,
        };
        onChange({ connections: [...workflow.connections, newConn] });
      }
      setDraftConnection(null);
    },
    [draftConnection, workflow.connections, onChange, setDraftConnection],
  );

  /* ── Delete connection (double-click on edge) ───────────────────────────── */
  const handleConnectionDelete = useCallback(
    (connId: string) => {
      onChange({
        connections: workflow.connections.filter((c) => c.id !== connId),
      });
    },
    [workflow.connections, onChange],
  );

  /* ── Canvas pan + zoom ──────────────────────────────────────────────────── */
  useGesture(
    {
      onDrag: ({ delta: [dx, dy], first, last }) => {
        if (first || last) return;
        setGraphPosition((pos) => ({ ...pos, x: pos.x + dx, y: pos.y + dy }));
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = (event as WheelEvent).clientX - rect.left;
        const my = (event as WheelEvent).clientY - rect.top;
        setGraphPosition((pos) => {
          const factor = dy > 0 ? 0.9 : 1.1;
          const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pos.scale * factor));
          const ratio = newScale / pos.scale;
          return {
            scale: newScale,
            x: pos.x - mx * (ratio - 1),
            y: pos.y - my * (ratio - 1),
          };
        });
      },
      onPinch: ({ offset: [scale] }) => {
        setGraphPosition((pos) => ({
          ...pos,
          scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)),
        }));
      },
    },
    {
      target: canvasRef,
      drag: { pointer: { keys: false } },
      wheel: { eventOptions: { passive: false } },
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE } },
    },
  );

  const handleZoom = (dir: 'in' | 'out') => {
    setGraphPosition((pos) => {
      const newScale =
        dir === 'in'
          ? Math.min(MAX_SCALE, pos.scale + ZOOM_STEP)
          : Math.max(MIN_SCALE, pos.scale - ZOOM_STEP);
      return { ...pos, scale: newScale };
    });
  };

  /* ── Build SVG edge paths ───────────────────────────────────────────────── */
  const nodeMap = new Map(workflow.nodes.map((n) => [n.name, n]));

  const edgePaths = workflow.connections.map((conn) => {
    const src = nodeMap.get(conn.sourceNodeName);
    const tgt = nodeMap.get(conn.targetNodeName);
    if (!src || !tgt) return null;
    const srcMeta = getNodeMeta(src.type);
    const tgtMeta = getNodeMeta(tgt.type);
    const srcAnchor = portAnchor(src, 'output', conn.sourceOutputIndex, srcMeta.outputs);
    const tgtAnchor = portAnchor(tgt, 'input', conn.targetInputIndex, tgtMeta.inputs);
    return {
      conn,
      path: edgePath(srcAnchor.x, srcAnchor.y, tgtAnchor.x, tgtAnchor.y),
    };
  });

  // Draft edge path
  let draftPath: string | null = null;
  if (draftConnection) {
    const src = nodeMap.get(draftConnection.sourceNodeName);
    if (src) {
      const srcMeta = getNodeMeta(src.type);
      const srcAnchor = portAnchor(
        src,
        'output',
        draftConnection.sourceOutputIndex,
        srcMeta.outputs,
      );
      draftPath = edgePath(
        srcAnchor.x,
        srcAnchor.y,
        draftConnection.mouseX,
        draftConnection.mouseY,
      );
    }
  }

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative flex-1 overflow-hidden',
        draggedNodeType ? 'cursor-crosshair' : 'cursor-default',
      )}
      style={{
        touchAction: 'none',
        backgroundColor: 'var(--gray-3)',
        backgroundImage: 'radial-gradient(var(--gray-7) 1px, transparent 0)',
        backgroundSize: '32px 32px',
        backgroundPosition: '-15px -15px',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (e.target === canvasRef.current) setSelectedNodeId(null);
      }}
    >
      {/* ── Transformed layer ──────────────────────────────────────────────── */}
      <div
        className="absolute will-change-transform w-full h-full"
        style={{
          transform: `translate(${graphPosition.x}px,${graphPosition.y}px) scale(${graphPosition.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG edges rendered under nodes */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <defs>
            <marker id="n8n-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--gray-8)" />
            </marker>
            <marker id="n8n-arrow-hover" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#f76808" />
            </marker>
            <marker id="n8n-arrow-draft" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
            </marker>
          </defs>

          {edgePaths.map((ep) => {
            if (!ep) return null;
            return (
              <g key={ep.conn.id} className="group" style={{ pointerEvents: 'all' }}>
                {/* Wide invisible hit target */}
                <path
                  d={ep.path}
                  stroke="transparent"
                  strokeWidth={14}
                  fill="none"
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onDoubleClick={() => handleConnectionDelete(ep.conn.id)}
                />
                {/* Visible line — turns orange on hover */}
                <path
                  d={ep.path}
                  stroke="var(--gray-8)"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#n8n-arrow)"
                  className="group-hover:stroke-[#f76808]"
                  style={{ pointerEvents: 'none', transition: 'stroke 0.1s' }}
                />
              </g>
            );
          })}

          {/* Draft (in-progress) edge */}
          {draftPath && (
            <path
              d={draftPath}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="none"
              markerEnd="url(#n8n-arrow-draft)"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Nodes rendered on top of edges */}
        {workflow.nodes.map((node) => (
          <N8NNode
            key={node.id}
            node={node}
            connections={workflow.connections}
            onMove={handleNodeMove}
            onConnectionStart={handleConnectionStart}
            onConnectionEnd={handleConnectionEnd}
          />
        ))}
      </div>

      {/* ── Zoom controls ──────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 flex items-stretch gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-1.5 shadow-sm z-10">
        <button
          onClick={() => handleZoom('in')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors font-medium text-base"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px bg-[var(--gray-5)] self-stretch" />
        <button
          onClick={() => handleZoom('out')}
          className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors font-medium text-base"
          title="Zoom out"
        >
          −
        </button>
        <div className="w-px bg-[var(--gray-5)] self-stretch" />
        <button
          onClick={() => setGraphPosition({ x: 0, y: 0, scale: 1 })}
          className="px-2 h-7 text-[11px] rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors tabular-nums"
          title="Reset zoom"
        >
          {Math.round(graphPosition.scale * 100)}%
        </button>
      </div>

      {/* ── Empty-state hint ───────────────────────────────────────────────── */}
      {workflow.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl border border-dashed border-[var(--gray-6)] bg-[var(--gray-1)]/60 px-8 py-6 text-center backdrop-blur-sm">
            <div className="text-[13px] font-medium text-[var(--gray-10)]">
              Drag a node from the left sidebar
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--gray-9)]">
              or hover the left edge to open the node palette
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
