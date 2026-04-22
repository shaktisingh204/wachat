/**
 * Canvas element types — mirror of n8n's canvas.types.ts, reshaped for React
 * and for SabFlow's existing BlockType / Block / NodePort model.
 */
import type { Edge as XYEdge, Node as XYNode } from '@xyflow/react';
import type {
  Block,
  BlockType,
  EdgeStatus,
  NodePort,
  SabFlowEvent,
} from '@/lib/sabflow/types';

/** n8n's CanvasConnectionMode — 'inputs' or 'outputs'. */
export const CanvasConnectionMode = {
  Input: 'inputs',
  Output: 'outputs',
} as const;
export type CanvasConnectionMode =
  (typeof CanvasConnectionMode)[keyof typeof CanvasConnectionMode];

/** Render variant for a canvas node (matches n8n's CanvasNodeRenderType). */
export const CanvasNodeRenderType = {
  Default: 'default',
  Trigger: 'trigger',
  StickyNote: 'stickyNote',
  AddNodes: 'addNodes',
} as const;
export type CanvasNodeRenderType =
  (typeof CanvasNodeRenderType)[keyof typeof CanvasNodeRenderType];

/** Execution state tracked per node (mirror of n8n's CanvasNodeData.execution). */
export type CanvasNodeExecution = {
  status?: 'success' | 'error' | 'running' | 'waiting';
  running?: boolean;
  waitingForNext?: boolean;
};

/**
 * Data payload attached to every @xyflow/react Node in our canvas.
 * Matches n8n's CanvasNodeData shape (trimmed to what SabFlow uses).
 */
export type CanvasNodeData = {
  /** Canvas ID — same as the underlying SabFlow `block.id` or `event.id`. */
  id: string;
  /** User-visible label (block label / event label). */
  label: string;
  /** One-line subtitle (e.g. operation or description). */
  subtitle?: string;
  /** The BlockType for regular blocks, or 'event:start'/'event:webhook' for triggers. */
  type: string;
  /** Is this a trigger (start/webhook/schedule) node? Gets distinct visuals. */
  isTrigger: boolean;
  /** Disabled nodes are skipped at runtime and show a strike-through. */
  disabled: boolean;
  /** Has the user pinned output data to this node? */
  pinned: boolean;
  /** Port definitions for rendering handles. */
  inputs: NodePort[];
  outputs: NodePort[];
  /** Execution state for badge + ring animation. */
  execution: CanvasNodeExecution;
  /** Pointer back to the underlying SabFlow Block (omitted for trigger events). */
  block?: Block;
  /** Pointer back to the underlying SabFlow Event (omitted for blocks). */
  event?: SabFlowEvent;
  /** Render variant. */
  render: CanvasNodeRenderType;
  /** BlockType used for icon/color lookup in registry. */
  blockType?: BlockType;
};

/** Data payload on each edge — carries source/target port metadata + status. */
export type CanvasEdgeData = {
  source: { type: string; index: number };
  target: { type: string; index: number };
  status?: EdgeStatus;
} & Record<string, unknown>;

export type CanvasNode = XYNode<CanvasNodeData>;
export type CanvasEdge = XYEdge<CanvasEdgeData>;
