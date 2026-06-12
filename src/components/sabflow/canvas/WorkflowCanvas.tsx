'use client';
/**
 * WorkflowCanvas — thin wrapper rendering the Canvas. Matches n8n's
 * WorkflowCanvas.vue role as the embeddable "the canvas" unit consumed by
 * the editor shell.
 *
 * NOTE: the `ReactFlowProvider` is intentionally NOT created here — the
 * editor shells (EditorPage / EditorContentCollab) mount it ABOVE both the
 * canvas and the right-rail panels, because panel hooks like
 * `useContextVariables` call `useReactFlow()` to read upstream nodes and
 * must share the SAME store as the canvas (React Flow error #001 otherwise).
 */
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { Canvas } from './Canvas';

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (next: SabFlowDoc) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function WorkflowCanvas(props: Props) {
  return <Canvas {...props} />;
}
