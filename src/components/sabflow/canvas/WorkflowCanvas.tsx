'use client';
/**
 * WorkflowCanvas — thin wrapper that provides the ReactFlowProvider context
 * and renders the Canvas. Matches n8n's WorkflowCanvas.vue role as the
 * embeddable "the canvas" unit consumed by the editor shell.
 */
import { ReactFlowProvider } from '@xyflow/react';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { Canvas } from './Canvas';

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (next: SabFlowDoc) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
