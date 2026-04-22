'use client';
/**
 * Canvas — port of n8n's Canvas.vue + WorkflowCanvas.vue, running on
 * @xyflow/react. This is the central component that:
 *   • Translates the current SabFlowDoc into React Flow nodes/edges.
 *   • Forwards node drag/resize/delete/connect events back to the flow doc.
 *   • Hosts the node toolbar, context menu, node creator, background grid,
 *     minimap, and zoom controls.
 *
 * Shell (header, right panel, etc.) is still owned by EditorPage — we only
 * render the canvas itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge as XYEdge,
  type EdgeTypes,
  type Node as XYNode,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';

import type { BlockType, SabFlowDoc } from '@/lib/sabflow/types';
import { blockRegistryMap } from '@/components/sabflow/editor/blockRegistry';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

import {
  applyBulkNodePositions,
  flowDocToCanvas,
} from './adapter';
import { makeCanvasNodeType } from './nodes/CanvasNode';
import { CanvasEdge } from './edges/CanvasEdge';
import { CanvasContextMenu } from './contextMenu/CanvasContextMenu';
import { useContextMenu } from './contextMenu/useContextMenu';
import { NodeCreator } from './nodeCreator/NodeCreator';
import { useNodeCreator } from './nodeCreator/useNodeCreator';
import { useCanvasOperations } from './hooks/useCanvasOperations';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { MIN_ZOOM, MAX_ZOOM, GRID_SIZE } from './constants';
import type { CanvasEdge as CanvasEdgeType, CanvasNode as CanvasNodeType } from './types';
import { parseCanvasConnectionHandleString } from './utils';

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (next: SabFlowDoc) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function Canvas({ flow, onFlowChange, containerRef }: Props) {
  const rf = useReactFlow();
  const { isReadOnly, setOpenedNodeId } = useGraph();
  const { draggedBlockType, setDraggedBlockType } = useBlockDnd();

  const { state: menuState, open: openMenu, close: closeMenu } = useContextMenu();
  const { state: creatorState, open: openCreator, close: closeCreator } = useNodeCreator();

  const ops = useCanvasOperations(flow, onFlowChange);

  // Translate SabFlowDoc → { nodes, edges } (memoized on flow identity).
  const translated = useMemo(() => flowDocToCanvas(flow), [flow]);

  // Local nodes/edges state — React Flow needs controlled state for smooth
  // interaction; we sync the important changes (positions, selection) back
  // to the flow doc after the interaction settles.
  const [nodes, setNodes] = useState<XYNode[]>(translated.nodes);
  const [edges, setEdges] = useState<XYEdge[]>(translated.edges);
  const prevTranslatedRef = useRef(translated);

  useEffect(() => {
    // Reset local nodes/edges only when the underlying doc changes meaningfully.
    if (prevTranslatedRef.current !== translated) {
      prevTranslatedRef.current = translated;
      setNodes(translated.nodes);
      setEdges(translated.edges);
    }
  }, [translated]);

  /* ── Selection helpers ─────────────────────────────────── */
  const selectedNodeIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);

  /* ── Handlers wired into CanvasNode via the node-type factory ─ */
  const handleNodeDelete = useCallback(
    (id: string) => ops.deleteNodes([id]),
    [ops],
  );
  const handleNodeDuplicate = useCallback(
    (id: string) => ops.duplicateNodes([id]),
    [ops],
  );
  const handleNodeToggleDisabled = useCallback(
    (id: string) => ops.toggleDisabled([id]),
    [ops],
  );
  const handleNodeExecute = useCallback(
    (_id: string) => {
      // Single-node execute is handled by the existing engine via the right-rail
      // panel; opening the node for now gives the user the "Test step" button.
      setOpenedNodeId(_id);
    },
    [setOpenedNodeId],
  );

  const handleNodeAdd = useCallback(
    (fromNodeId: string) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      openCreator({
        kind: 'drag-from-handle',
        nodeId: fromNodeId,
        handleId: 'outputs/main/0',
        position: { x: rect.right - 360, y: rect.top + 60 },
      });
    },
    [openCreator, containerRef],
  );

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      canvasNode: makeCanvasNodeType({
        onAdd: handleNodeAdd,
        onDelete: handleNodeDelete,
        onDuplicate: handleNodeDuplicate,
        onToggleDisabled: handleNodeToggleDisabled,
        onExecute: handleNodeExecute,
        isReadOnly,
      }),
    }),
    [
      handleNodeAdd,
      handleNodeDelete,
      handleNodeDuplicate,
      handleNodeToggleDisabled,
      handleNodeExecute,
      isReadOnly,
    ],
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      canvasEdge: (edgeProps) => (
        <CanvasEdge
          {...edgeProps}
          readOnly={isReadOnly}
          onAdd={(edgeId) =>
            openCreator({ kind: 'edge-button', edgeId }, /* allow all types */)
          }
          onDelete={(edgeId) => ops.deleteEdgeById(edgeId)}
        />
      ),
    }),
    [isReadOnly, openCreator, ops],
  );

  /* ── Node / edge events ────────────────────────────────── */

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((_changes: unknown) => {
    // We ignore xyflow-driven edge removals and let context menu drive removes.
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, draggedNodes) => {
      const updates = (draggedNodes.length ? draggedNodes : [_node]).map((n) => ({
        id: n.id,
        position: { x: n.position.x, y: n.position.y },
      }));
      onFlowChange(applyBulkNodePositions(flow, updates));
    },
    [flow, onFlowChange],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      ops.connect({
        source: c.source,
        sourceHandle: c.sourceHandle ?? 'outputs/main/0',
        target: c.target,
        targetHandle: c.targetHandle ?? 'inputs/main/0',
      });
    },
    [ops],
  );

  /* Connection-to-empty-canvas triggers the node creator */
  const connectingRef = useRef<{ nodeId: string; handleId: string } | null>(null);
  const onConnectStart: OnConnectStart = useCallback((_e, { nodeId, handleId }) => {
    if (!nodeId || !handleId) return;
    connectingRef.current = { nodeId, handleId };
  }, []);
  const onConnectEnd: OnConnectEnd = useCallback(
    (e) => {
      const from = connectingRef.current;
      connectingRef.current = null;
      if (!from) return;
      // If the release landed on an invalid target (not a handle), pop the creator.
      const target = (e.target as HTMLElement | null) ?? null;
      const droppedOnHandle = target?.classList?.contains('react-flow__handle') ?? false;
      if (droppedOnHandle) return;
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      openCreator({
        kind: 'drag-from-handle',
        nodeId: from.nodeId,
        handleId: from.handleId,
        position: { x: clientX, y: clientY },
      });
    },
    [openCreator],
  );

  /* ── Context menu wiring ──────────────────────────────── */
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      openMenu(event, { source: 'canvas', nodeIds: [] });
    },
    [openMenu],
  );
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: XYNode) => {
      event.preventDefault();
      const targetIds = node.selected
        ? nodes.filter((n) => n.selected).map((n) => n.id)
        : [node.id];
      openMenu(event, { source: 'node', nodeIds: targetIds });
    },
    [nodes, openMenu],
  );
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: XYEdge) => {
      event.preventDefault();
      openMenu(event, { source: 'edge', edgeId: edge.id });
    },
    [openMenu],
  );

  /* ── Drop from BlocksSideBar (existing drag source) ──── */
  const onCanvasPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!draggedBlockType) return;
      const position = rf.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      ops.addBlock({ type: draggedBlockType, position });
      setDraggedBlockType(undefined);
    },
    [draggedBlockType, rf, ops, setDraggedBlockType],
  );

  /* ── Open node settings on double-click ───────────────── */
  const onNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: XYNode) => {
      setOpenedNodeId(node.id);
    },
    [setOpenedNodeId],
  );

  /* ── Node-creator pick → add or splice ───────────────── */
  const onPickType = useCallback(
    (type: BlockType) => {
      const src = creatorState.source;
      if (!src) return;

      const fallbackPos = rf.screenToFlowPosition({
        x: (containerRef.current?.getBoundingClientRect().left ?? 0) + 300,
        y: (containerRef.current?.getBoundingClientRect().top ?? 0) + 200,
      });

      if (src.kind === 'drag-from-handle') {
        const pos = rf.screenToFlowPosition({
          x: src.position.x,
          y: src.position.y,
        });
        ops.addBlock({
          type,
          position: { x: pos.x - 30, y: pos.y - 30 },
          connectFrom: { nodeId: src.nodeId, handleId: src.handleId },
        });
      } else if (src.kind === 'edge-button') {
        ops.addBlock({
          type,
          position: fallbackPos,
          spliceEdgeId: src.edgeId,
        });
      } else if (src.kind === 'canvas-context-menu') {
        const pos = rf.screenToFlowPosition({ x: src.position.x, y: src.position.y });
        ops.addBlock({ type, position: pos });
      } else {
        ops.addBlock({ type, position: fallbackPos });
      }
      closeCreator();
    },
    [creatorState.source, rf, ops, closeCreator, containerRef],
  );

  /* ── Keyboard shortcuts ──────────────────────────────── */
  useCanvasKeyboard({
    onSelectAll: () =>
      setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
    onDeleteSelected: () => ops.deleteNodes(selectedNodeIds),
    onDuplicateSelected: () => ops.duplicateNodes(selectedNodeIds),
    onToggleDisabledSelected: () => ops.toggleDisabled(selectedNodeIds),
    onTogglePinSelected: () => {
      if (selectedNodeIds.length === 1) ops.togglePin(selectedNodeIds[0]);
    },
    onOpenNodeCreator: () => openCreator({ kind: 'keyboard' }),
    onClearSelection: () => setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))),
    readOnly: isReadOnly,
  });

  return (
    <div
      className="sabflow-canvas"
      onPointerUp={onCanvasPointerUp}
      data-testid="sabflow-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onlyRenderVisibleElements
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitView
        selectNodesOnDrag={false}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'canvasEdge' }}
        connectionLineStyle={{ stroke: '#f76808', strokeWidth: 2 }}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
        deleteKeyCode={null /* handled by our useCanvasKeyboard */}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_SIZE}
          size={1}
          color="var(--gray-6)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.05)"
          nodeColor={(n) => {
            const type = (n.data as { blockType?: BlockType }).blockType;
            return (type && blockRegistryMap.get(type)?.color) || '#f76808';
          }}
        />
      </ReactFlow>

      <NodeCreator state={creatorState} onClose={closeCreator} onPick={onPickType} />

      <CanvasContextMenu
        state={menuState}
        onClose={closeMenu}
        isReadOnly={isReadOnly}
        actions={{
          onAddNode: (x, y) =>
            openCreator({ kind: 'canvas-context-menu', position: { x, y } }),
          onSelectAll: () => setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
          onOpen: (id) => setOpenedNodeId(id),
          onExecute: (id) => setOpenedNodeId(id),
          onCopy: (ids) => {
            try {
              const payload = {
                type: 'sabflow-clipboard',
                ids,
                ts: Date.now(),
              };
              void navigator.clipboard.writeText(JSON.stringify(payload));
            } catch {
              /* noop */
            }
          },
          onDuplicate: (ids) => ops.duplicateNodes(ids),
          onTogglePin: (id) => ops.togglePin(id),
          onToggleDisabled: (ids) => ops.toggleDisabled(ids),
          onDeleteNodes: (ids) => ops.deleteNodes(ids),
          onDeleteEdge: (id) => ops.deleteEdgeById(id),
        }}
      />
    </div>
  );
}

// Escape hatch used by Canvas.tsx internals but currently unused externally —
// keeping the export here for future Canvas.tsx refactors.
export { parseCanvasConnectionHandleString };
