'use client';
/**
 * useContextMenu — port of n8n's useContextMenu composable.
 *
 * Tracks open state + target (node/edge/canvas) + screen position, so the
 * <CanvasContextMenu /> renderer can pop in the right place with the right
 * set of actions.
 */
import { useCallback, useState } from 'react';

export type ContextMenuTarget =
  | { source: 'canvas'; nodeIds: [] }
  | { source: 'node'; nodeIds: string[] }
  | { source: 'edge'; edgeId: string };

export type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget | null;
};

const INITIAL: ContextMenuState = { open: false, x: 0, y: 0, target: null };

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>(INITIAL);

  const open = useCallback((event: { clientX: number; clientY: number }, target: ContextMenuTarget) => {
    setState({ open: true, x: event.clientX, y: event.clientY, target });
  }, []);

  const close = useCallback(() => setState(INITIAL), []);

  return { state, open, close };
}
