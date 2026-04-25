'use client';
/**
 * CanvasHandlersContext — holds the canvas-level callbacks and read-only
 * flag, so that CanvasNode/CanvasEdge can access them WITHOUT the Canvas
 * component having to rebuild `nodeTypes` / `edgeTypes` on every render.
 *
 * React Flow treats a new `nodeTypes` reference as "the set of custom types
 * changed" and remounts every node — which, combined with onResize callbacks
 * firing on mount, can produce an infinite render loop (React error #185).
 *
 * By making `nodeTypes` / `edgeTypes` module-level constants and reading
 * handlers from a context, we decouple callback identity from the ReactFlow
 * component tree's stability.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Annotation, BlockType } from '@/lib/sabflow/types';

export type CanvasHandlers = {
  /** Click the right-side "+" on a node → open node creator wired to this
   *  source. `handleId` identifies the specific output port for multi-output
   *  nodes (Condition True/False, Switch cases, Choice items, etc.); falls
   *  back to `outputs/main/0` when omitted. */
  onNodeAdd?: (nodeId: string, handleId?: string) => void;
  /** Toolbar delete button. */
  onNodeDelete?: (nodeId: string) => void;
  /** Toolbar duplicate button. */
  onNodeDuplicate?: (nodeId: string) => void;
  /** Toolbar toggle-disabled button. */
  onNodeToggleDisabled?: (nodeId: string) => void;
  /** Toolbar execute button. */
  onNodeExecute?: (nodeId: string) => void;
  /** Commit an inline-rename edit. */
  onNodeRename?: (nodeId: string, label: string) => void;
  /** ID of the node currently rendering its inline rename input. */
  renamingNodeId?: string;
  /** Called when the rename input commits or cancels. */
  onRenameDone?: () => void;

  /** Sticky note resize / color / content patch. */
  onStickyUpdate?: (id: string, patch: Partial<Annotation>) => void;
  /** Sticky delete. */
  onStickyDelete?: (id: string) => void;

  /** Edge midpoint "+" click — opens node creator splicing onto this edge. */
  onEdgeAdd?: (edgeId: string) => void;
  /** Edge midpoint trash click. */
  onEdgeDelete?: (edgeId: string) => void;

  /** Disable every interactive control when true. */
  isReadOnly?: boolean;
  /** Unused — exposed so future callers can fetch block-type metadata without
   *  re-importing the registry in every node subtree. */
  resolveBlockLabel?: (type: BlockType) => string | undefined;
};

const CanvasHandlersContext = createContext<CanvasHandlers>({});

export function CanvasHandlersProvider({
  value,
  children,
}: {
  value: CanvasHandlers;
  children: ReactNode;
}) {
  return (
    <CanvasHandlersContext.Provider value={value}>{children}</CanvasHandlersContext.Provider>
  );
}

export function useCanvasHandlers(): CanvasHandlers {
  return useContext(CanvasHandlersContext);
}
