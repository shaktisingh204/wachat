'use client';
/**
 * CanvasNode — dispatcher for the different render variants. Since most nodes
 * share the same shell, this routes everything through CanvasNodeDefault for
 * now (trigger vs. default is a style variant on the same component).
 */
import type { NodeProps } from '@xyflow/react';
import type { CanvasNode as CanvasNodeType, CanvasNodeData } from '../types';
import { CanvasNodeDefault } from './CanvasNodeDefault';

export type CanvasNodeHandlers = {
  onAdd?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  isReadOnly?: boolean;
};

export function makeCanvasNodeType(handlers: CanvasNodeHandlers) {
  return function CanvasNode(props: NodeProps<CanvasNodeType>) {
    const data = props.data as CanvasNodeData;
    switch (data.render) {
      case 'stickyNote':
        // Sticky note placeholder — same shell for now, distinct styling can
        // be layered later without changing the adapter.
        return <CanvasNodeDefault {...props} {...handlers} />;
      case 'addNodes':
      case 'trigger':
      case 'default':
      default:
        return <CanvasNodeDefault {...props} {...handlers} />;
    }
  };
}
