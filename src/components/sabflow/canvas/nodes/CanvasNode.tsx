'use client';
/**
 * CanvasNode — dispatcher for the different render variants.
 *
 * Reads handlers from CanvasHandlersContext so that `nodeTypes` below can be
 * a module-level constant — the only way to keep React Flow from remounting
 * nodes on every parent render (which was causing React error #185).
 */
import type { NodeProps, NodeTypes } from '@xyflow/react';
import type { CanvasNode as CanvasNodeType, CanvasNodeData } from '../types';
import { CanvasNodeDefault } from './CanvasNodeDefault';
import { CanvasNodeStickyNote } from './CanvasNodeStickyNote';
import { useCanvasHandlers } from '../CanvasHandlersContext';

function CanvasNodeDispatcher(props: NodeProps<CanvasNodeType>) {
  const data = props.data as CanvasNodeData;
  const handlers = useCanvasHandlers();
  void data.render; // placeholder: all variants currently share CanvasNodeDefault
  return (
    <CanvasNodeDefault
      {...props}
      onAdd={handlers.onNodeAdd}
      onDelete={handlers.onNodeDelete}
      onDuplicate={handlers.onNodeDuplicate}
      onToggleDisabled={handlers.onNodeToggleDisabled}
      onExecute={handlers.onNodeExecute}
      onRename={handlers.onNodeRename}
      renamingId={handlers.renamingNodeId}
      onRenameDone={handlers.onRenameDone}
      isReadOnly={handlers.isReadOnly}
    />
  );
}

function CanvasStickyDispatcher(props: NodeProps) {
  const handlers = useCanvasHandlers();
  return (
    <CanvasNodeStickyNote
      {...props}
      isReadOnly={handlers.isReadOnly}
      onUpdate={(id, patch) => handlers.onStickyUpdate?.(id, patch as Partial<Parameters<NonNullable<typeof handlers.onStickyUpdate>>[1]>)}
      onDelete={(id) => handlers.onStickyDelete?.(id)}
    />
  );
}

/**
 * Module-level stable map — required by React Flow to avoid warnings and
 * unnecessary node remounts. DO NOT recreate per-render.
 */
export const CANVAS_NODE_TYPES: NodeTypes = {
  canvasNode: CanvasNodeDispatcher,
  canvasSticky: CanvasStickyDispatcher,
};
