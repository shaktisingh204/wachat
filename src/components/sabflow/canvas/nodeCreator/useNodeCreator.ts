'use client';
/**
 * useNodeCreator — store for the picker's open state + its opening "source"
 * (what initiated it, and what to auto-wire the new node to).
 *
 * Mirrors n8n's nodeCreator.store.ts at a minimal subset: we only need enough
 * state to support the four opening sources SabFlow exposes.
 */
import { useCallback, useState } from 'react';
import type { BlockType } from '@/lib/sabflow/types';

export type NodeCreatorOpenSource =
  | { kind: 'plus-button' }
  | { kind: 'edge-button'; edgeId: string }
  | {
      kind: 'drag-from-handle';
      nodeId: string;
      handleId: string;
      position: { x: number; y: number };
    }
  | { kind: 'keyboard' }
  | { kind: 'canvas-context-menu'; position: { x: number; y: number } };

export type NodeCreatorState = {
  open: boolean;
  source: NodeCreatorOpenSource | null;
  /** Filter — only show these block types. When absent, all types are visible. */
  allow?: BlockType[];
};

const INITIAL: NodeCreatorState = { open: false, source: null };

export function useNodeCreator() {
  const [state, setState] = useState<NodeCreatorState>(INITIAL);

  const open = useCallback((source: NodeCreatorOpenSource, allow?: BlockType[]) => {
    setState({ open: true, source, allow });
  }, []);

  const close = useCallback(() => setState(INITIAL), []);

  return { state, open, close };
}
