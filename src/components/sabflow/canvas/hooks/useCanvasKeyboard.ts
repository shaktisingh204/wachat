'use client';
/**
 * useCanvasKeyboard — canvas keybindings.
 *
 * Receives `selectedNodeIds` / `selectedEdgeIds` as arguments from the caller
 * rather than reading them from React Flow's zustand store via inline
 * selectors — that pattern returns a fresh array every render and was
 * producing React error #185 (infinite re-render) because zustand kept
 * reporting "store changed" on every evaluation.
 *
 * Shortcut set (same as before):
 *   ⌘A / ⌘D / ⌘C / ⌘V / ⌘X / ⌘Z / ⌘⇧Z  (Z/⇧Z owned by EditorPage)
 *   Delete   — delete selected nodes/edges
 *   d        — toggle disabled
 *   p        — pin / unpin
 *   Tab      — open node creator
 *   Escape   — clear selection / close pickers
 *   0        — reset zoom
 *   1        — fit-to-view
 *   Enter    — open selected node
 *   F2       — rename selected
 *   ←/→/↑/↓  — hop between connected nodes
 *   ⇧S       — add sticky note
 *   ⇧⌥T      — tidy up
 *   ?        — toggle help overlay
 */
import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { shouldIgnoreCanvasShortcut } from '../utils';

type Handlers = {
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  onToggleDisabledSelected?: () => void;
  onTogglePinSelected?: () => void;
  onOpenNodeCreator?: () => void;
  onCopySelected?: () => void;
  onPaste?: () => void;
  onCutSelected?: () => void;
  onClearSelection?: () => void;
  onOpenSelected?: () => void;
  onRenameSelected?: () => void;
  onNavigate?: (dir: 'left' | 'right' | 'up' | 'down') => void;
  onAddSticky?: () => void;
  onTidyUp?: () => void;
  onToggleHelp?: () => void;
  readOnly?: boolean;
  /** IDs of currently-selected nodes (from caller's local state). */
  selectedNodeIds: string[];
  /** IDs of currently-selected edges (from caller's local state). */
  selectedEdgeIds: string[];
};

export function useCanvasKeyboard(h: Handlers) {
  const rf = useReactFlow();

  /**
   * Keep a ref to the latest handlers so we can register the keydown
   * listener exactly once. Without this the listener would be re-attached
   * on every render (cheap but wasteful).
   */
  const handlersRef = useRef(h);
  handlersRef.current = h;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const h = handlersRef.current;
      if (shouldIgnoreCanvasShortcut(document.activeElement)) return;
      const meta = e.metaKey || e.ctrlKey;
      const { selectedNodeIds, selectedEdgeIds } = h;

      // Help overlay — "?" (shift+/)
      if (!meta && e.key === '?') {
        e.preventDefault();
        h.onToggleHelp?.();
        return;
      }

      // ⌘A — select all
      if (meta && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        h.onSelectAll?.();
        return;
      }
      // ⌘D — duplicate
      if (meta && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault();
        if (!h.readOnly) h.onDuplicateSelected?.();
        return;
      }
      // ⌘C — copy
      if (meta && e.key.toLowerCase() === 'c') {
        h.onCopySelected?.();
        return;
      }
      // ⌘V — paste
      if (meta && e.key.toLowerCase() === 'v') {
        if (!h.readOnly) h.onPaste?.();
        return;
      }
      // ⌘X — cut
      if (meta && e.key.toLowerCase() === 'x') {
        if (!h.readOnly) h.onCutSelected?.();
        return;
      }

      // Shift+Alt+T — tidy up
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (!h.readOnly) h.onTidyUp?.();
        return;
      }

      // Shift+S — add sticky
      if (e.shiftKey && !meta && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!h.readOnly) h.onAddSticky?.();
        return;
      }

      // Plain keys
      if (!meta && !e.shiftKey && !e.altKey) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!h.readOnly && (selectedNodeIds.length || selectedEdgeIds.length)) {
            e.preventDefault();
            h.onDeleteSelected?.();
          }
          return;
        }
        if (e.key === 'd' && selectedNodeIds.length) {
          e.preventDefault();
          if (!h.readOnly) h.onToggleDisabledSelected?.();
          return;
        }
        if (e.key === 'p' && selectedNodeIds.length === 1) {
          e.preventDefault();
          if (!h.readOnly) h.onTogglePinSelected?.();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          if (!h.readOnly) h.onOpenNodeCreator?.();
          return;
        }
        if (e.key === 'Escape') {
          h.onClearSelection?.();
          return;
        }
        if (e.key === 'Enter' && selectedNodeIds.length === 1) {
          e.preventDefault();
          h.onOpenSelected?.();
          return;
        }
        if (e.key === 'F2' && selectedNodeIds.length === 1) {
          e.preventDefault();
          if (!h.readOnly) h.onRenameSelected?.();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          rf.zoomTo(1);
          return;
        }
        if (e.key === '1') {
          e.preventDefault();
          rf.fitView({ padding: 0.2, duration: 200 });
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          h.onNavigate?.('left');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          h.onNavigate?.('right');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          h.onNavigate?.('up');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          h.onNavigate?.('down');
          return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Only re-register if the react-flow instance itself changes (essentially never).
  }, [rf]);
}
