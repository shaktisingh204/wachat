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
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge as XYEdge,
  type EdgeChange,
  type Node as XYNode,
  type NodeChange,
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
  findStartEvent,
  flowDocToCanvas,
} from './adapter';
import { CANVAS_NODE_TYPES } from './nodes/CanvasNode';
import { CANVAS_EDGE_TYPES } from './edges/CanvasEdge';
import { CanvasHandlersProvider } from './CanvasHandlersContext';
import { CanvasContextMenu } from './contextMenu/CanvasContextMenu';
import { useContextMenu } from './contextMenu/useContextMenu';
import { NodeCreator } from './nodeCreator/NodeCreator';
import { useNodeCreator } from './nodeCreator/useNodeCreator';
import { useCanvasOperations } from './hooks/useCanvasOperations';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { MIN_ZOOM, MAX_ZOOM, GRID_SIZE } from './constants';
import type { CanvasEdge as CanvasEdgeType, CanvasNode as CanvasNodeType } from './types';
import { parseCanvasConnectionHandleString } from './utils';
import { canConnect } from './connectionValidation';
import { findNeighbor } from './navigation';
import { EmptyCanvasOverlay } from './EmptyCanvasOverlay';
import { ShortcutHelp } from './ShortcutHelp';
import { TriggerStartPanel } from './triggerPanel/TriggerStartPanel';

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);

  const ops = useCanvasOperations(flow, onFlowChange);

  /**
   * Trigger picker — n8n-style "What triggers this workflow?" rail.
   *
   * When a flow has zero trigger events, auto-open the picker on mount so the
   * user explicitly chooses the entry point (mirrors n8n). The user can close
   * it; from then on the empty-canvas overlay's "Add first step" CTA reopens
   * it (still routed through the picker, never auto-creating a default).
   */
  const [triggerPanelOpen, setTriggerPanelOpen] = useState(false);
  const didAutoOpenTriggerRef = useRef(false);
  useEffect(() => {
    if (isReadOnly) return;
    if (didAutoOpenTriggerRef.current) return;
    if ((flow.events ?? []).length === 0) {
      didAutoOpenTriggerRef.current = true;
      setTriggerPanelOpen(true);
    }
  }, [flow.events, isReadOnly]);

  const handlePickTrigger = useCallback(
    (type: 'start' | 'webhook' | 'schedule' | 'manual' | 'error') => {
      ops.addTrigger(type);
      setTriggerPanelOpen(false);
    },
    [ops],
  );

  // Translate SabFlowDoc → { nodes, edges } (memoized on flow identity).
  const translated = useMemo(() => flowDocToCanvas(flow), [flow]);

  // Local nodes/edges state — React Flow needs controlled state for smooth
  // interaction; we sync the important changes (positions, selection) back
  // to the flow doc after the interaction settles.
  const [nodes, setNodes] = useState<XYNode[]>(translated.nodes);
  const [edges, setEdges] = useState<XYEdge[]>(translated.edges);

  /**
   * Sync doc → local state. On every flow change we merge instead of
   * replace, preserving each node's React-Flow-measured dimensions and
   * selection state. Wholesale replacement would wipe the `measured` field
   * React Flow sets via ResizeObserver, forcing a re-measure cycle on every
   * doc update — which (combined with zustand subscribers) has been enough
   * to re-trigger React error #185 in the past.
   */
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      const merged: XYNode[] = [];
      for (const next of translated.nodes) {
        const existing = byId.get(next.id);
        if (existing) {
          // Preserve measured dims + selection; refresh position + data.
          merged.push({
            ...existing,
            position: next.position,
            data: next.data,
            type: next.type,
          });
        } else {
          merged.push(next);
        }
      }
      return merged;
    });
    setEdges((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      const merged: XYEdge[] = [];
      for (const next of translated.edges) {
        const existing = byId.get(next.id);
        merged.push(existing ? { ...existing, data: next.data } : next);
      }
      return merged;
    });
  }, [translated]);

  /* ── Selection helpers ─────────────────────────────────── */
  const selectedNodeIds = useMemo(
    () => nodes.filter((n) => n.selected).map((n) => n.id),
    [nodes],
  );
  const selectedEdgeIds = useMemo(
    () => edges.filter((e) => e.selected).map((e) => e.id),
    [edges],
  );

  /* ── Handlers wired into CanvasNode via the node-type factory ─ */
  const handleNodeDelete = useCallback(
    (id: string) => {
      /* Never let the user delete the sole remaining trigger — without one,
         the engine can't start the flow. Fail soft (no-op). */
      const triggerIds = new Set((flow.events ?? []).map((e) => e.id));
      if (triggerIds.has(id) && triggerIds.size <= 1) return;
      ops.deleteNodes([id]);
    },
    [ops, flow.events],
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

  /**
   * nodeTypes / edgeTypes MUST be stable (module-level constants). Every new
   * reference forces React Flow to re-register and remount — an infinite loop
   * generator when combined with onResize-on-mount callbacks.
   *
   * Dynamic handlers flow through <CanvasHandlersProvider> below.
   */
  const handlersValue = useMemo(
    () => ({
      onNodeAdd: handleNodeAdd,
      onNodeDelete: handleNodeDelete,
      onNodeDuplicate: handleNodeDuplicate,
      onNodeToggleDisabled: handleNodeToggleDisabled,
      onNodeExecute: handleNodeExecute,
      onNodeRename: (id: string, label: string) => ops.rename(id, label),
      renamingNodeId: renamingId,
      onRenameDone: () => setRenamingId(undefined),
      onStickyUpdate: ops.patchSticky,
      onStickyDelete: (id: string) => ops.deleteNodes([id]),
      onEdgeAdd: (edgeId: string) => openCreator({ kind: 'edge-button', edgeId }),
      onEdgeDelete: ops.deleteEdgeById,
      isReadOnly,
    }),
    [
      handleNodeAdd,
      handleNodeDelete,
      handleNodeDuplicate,
      handleNodeToggleDisabled,
      handleNodeExecute,
      ops,
      renamingId,
      openCreator,
      isReadOnly,
    ],
  );

  /* ── Node / edge events ────────────────────────────────── */

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  /**
   * Apply incremental edge changes (selection, dimension, etc). We deliberately
   * filter out "remove" — deletions go through our ops.deleteEdgeById pipeline
   * so the flow doc stays the source of truth.
   */
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const filtered = changes.filter((c) => c.type !== 'remove');
    if (filtered.length === 0) return;
    setEdges((eds) => applyEdgeChanges(filtered, eds));
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
      const result = canConnect(c, flow);
      if (!result.ok) return;
      ops.connect({
        source: c.source,
        sourceHandle: c.sourceHandle ?? 'outputs/main/0',
        target: c.target,
        targetHandle: c.targetHandle ?? 'inputs/main/0',
      });
    },
    [ops, flow],
  );

  const isValidConnection = useCallback(
    (c: Connection | XYEdge) => {
      const conn: Connection = {
        source: c.source ?? null,
        target: c.target ?? null,
        sourceHandle: (c as Connection).sourceHandle ?? null,
        targetHandle: (c as Connection).targetHandle ?? null,
      };
      return canConnect(conn, flow).ok;
    },
    [flow],
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
        /* keyboard / plus-button / catch-all — if a start event exists and
           isn't yet connected, auto-wire the new block to it so the user never
           ends up with an orphaned flow. */
        const start = findStartEvent(flow);
        const startAlreadyConnected =
          start &&
          (flow.edges ?? []).some(
            (e) => 'eventId' in e.from && e.from.eventId === start.id,
          );
        if (start && !startAlreadyConnected) {
          // Drop the new block to the right of the start event
          const startPos = start.graphCoordinates;
          ops.addBlock({
            type,
            position: { x: startPos.x + 260, y: startPos.y },
            connectFrom: { nodeId: start.id, handleId: 'outputs/main/0' },
          });
        } else {
          ops.addBlock({ type, position: fallbackPos });
        }
      }
      closeCreator();
    },
    [creatorState.source, rf, ops, closeCreator, containerRef, flow],
  );

  /* ── Keyboard shortcuts ──────────────────────────────── */
  useCanvasKeyboard({
    selectedNodeIds,
    selectedEdgeIds,
    onSelectAll: () =>
      setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
    onDeleteSelected: () => {
      for (const eid of selectedEdgeIds) ops.deleteEdgeById(eid);
      if (selectedNodeIds.length) ops.deleteNodes(selectedNodeIds);
    },
    onDuplicateSelected: () => ops.duplicateNodes(selectedNodeIds),
    onToggleDisabledSelected: () => ops.toggleDisabled(selectedNodeIds),
    onTogglePinSelected: () => {
      if (selectedNodeIds.length === 1) ops.togglePin(selectedNodeIds[0]);
    },
    onOpenNodeCreator: () => openCreator({ kind: 'keyboard' }),
    onClearSelection: () => setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))),
    onOpenSelected: () => {
      if (selectedNodeIds.length === 1) setOpenedNodeId(selectedNodeIds[0]);
    },
    onRenameSelected: () => {
      if (selectedNodeIds.length === 1) setRenamingId(selectedNodeIds[0]);
    },
    onNavigate: (dir) => {
      if (selectedNodeIds.length !== 1) return;
      const next = findNeighbor(nodes, edges, selectedNodeIds[0], dir);
      if (!next) return;
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === next })));
      rf.setCenter(
        nodes.find((n) => n.id === next)?.position.x ?? 0,
        nodes.find((n) => n.id === next)?.position.y ?? 0,
        { duration: 200, zoom: rf.getZoom() },
      );
    },
    onCopySelected: () => {
      const payload = ops.buildClipboardPayload(selectedNodeIds);
      try {
        void navigator.clipboard.writeText(JSON.stringify(payload));
      } catch {
        /* noop */
      }
    },
    onPaste: async () => {
      try {
        const raw = await navigator.clipboard.readText();
        const parsed = JSON.parse(raw) as { type?: string };
        if (parsed?.type !== 'sabflow-clipboard') return;
        const rect = containerRef.current?.getBoundingClientRect();
        const flowPos = rf.screenToFlowPosition({
          x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
          y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
        });
        ops.pastePayload(parsed as Parameters<typeof ops.pastePayload>[0], flowPos);
      } catch {
        /* noop */
      }
    },
    onCutSelected: () => {
      const payload = ops.buildClipboardPayload(selectedNodeIds);
      try {
        void navigator.clipboard.writeText(JSON.stringify(payload));
      } catch {
        /* noop */
      }
      ops.deleteNodes(selectedNodeIds);
    },
    onAddSticky: () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const flowPos = rf.screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
      });
      ops.addSticky(flowPos);
    },
    onTidyUp: () => ops.tidyUp(),
    onToggleHelp: () => setHelpOpen((v) => !v),
    readOnly: isReadOnly,
  });

  return (
    <div
      className="sabflow-canvas"
      onPointerUp={onCanvasPointerUp}
      data-testid="sabflow-canvas"
    >
     <CanvasHandlersProvider value={handlersValue}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={CANVAS_NODE_TYPES}
        edgeTypes={CANVAS_EDGE_TYPES}
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
        isValidConnection={isValidConnection}
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
     </CanvasHandlersProvider>

      {/* Empty-canvas overlay. Shown when there are NO nodes at all, OR when
          the only thing on the canvas is an unconnected start event and no
          blocks yet — in which case the CTA explicitly invites wiring the
          first action after the trigger. The trigger picker takes priority
          when it's open, so the overlay hides while it's showing. */}
      {!isReadOnly && !triggerPanelOpen && (() => {
        const blockCount = (flow.groups ?? []).reduce(
          (n, g) => n + g.blocks.length,
          0,
        );
        const start = findStartEvent(flow);
        const startUnconnected =
          start &&
          !(flow.edges ?? []).some(
            (e) => 'eventId' in e.from && e.from.eventId === start.id,
          );
        const hasAnyTrigger = (flow.events ?? []).length > 0;
        if (nodes.length === 0 || (blockCount === 0 && startUnconnected)) {
          return (
            <EmptyCanvasOverlay
              onAdd={() => {
                /* No trigger picked yet → reopen the n8n-style trigger picker
                   instead of jumping straight to the block creator. */
                if (!hasAnyTrigger) {
                  setTriggerPanelOpen(true);
                  return;
                }
                if (start) {
                  /* Wire directly from the existing start event when the user
                     clicks "Add first step" — never leave them with an
                     orphaned action. */
                  openCreator({
                    kind: 'drag-from-handle',
                    nodeId: start.id,
                    handleId: 'outputs/main/0',
                    position: {
                      x:
                        (containerRef.current?.getBoundingClientRect().left ?? 0) +
                        (containerRef.current?.getBoundingClientRect().width ?? 600) / 2,
                      y:
                        (containerRef.current?.getBoundingClientRect().top ?? 0) +
                        60,
                    },
                  });
                } else {
                  openCreator({ kind: 'plus-button' });
                }
              }}
            />
          );
        }
        return null;
      })()}

      <TriggerStartPanel
        open={triggerPanelOpen}
        onClose={() => setTriggerPanelOpen(false)}
        onPick={handlePickTrigger}
      />

      <NodeCreator state={creatorState} onClose={closeCreator} onPick={onPickType} />

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      <CanvasContextMenu
        state={menuState}
        onClose={closeMenu}
        isReadOnly={isReadOnly}
        nodeKinds={
          new Map<string, 'trigger' | 'block' | 'sticky'>([
            ...(flow.events ?? []).map(
              (e) => [e.id, 'trigger'] as [string, 'trigger'],
            ),
            ...(flow.annotations ?? []).map(
              (a) => [a.id, 'sticky'] as [string, 'sticky'],
            ),
            ...(flow.groups ?? []).flatMap((g) =>
              g.blocks.map((b) => [b.id, 'block'] as [string, 'block']),
            ),
          ])
        }
        isSoleTrigger={(id) => {
          const events = flow.events ?? [];
          return events.length === 1 && events[0].id === id;
        }}
        actions={{
          onAddNode: (x, y) =>
            openCreator({ kind: 'canvas-context-menu', position: { x, y } }),
          onAddSticky: (x, y) => {
            const flowPos = rf.screenToFlowPosition({ x, y });
            ops.addSticky(flowPos);
          },
          onSelectAll: () => setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
          onTidyUp: () => ops.tidyUp(),
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
          onRename: (id) => setRenamingId(id),
          onDuplicate: (ids) => ops.duplicateNodes(ids),
          onTogglePin: (id) => ops.togglePin(id),
          onToggleDisabled: (ids) => ops.toggleDisabled(ids),
          onDeleteNodes: (ids) => ops.deleteNodes(ids),
          onDeleteEdge: (id) => ops.deleteEdgeById(id),
          onChangeTrigger: (id, kind) => ops.setEventType(id, kind),
        }}
      />
    </div>
  );
}

// Escape hatch used by Canvas.tsx internals but currently unused externally —
// keeping the export here for future Canvas.tsx refactors.
export { parseCanvasConnectionHandleString };
