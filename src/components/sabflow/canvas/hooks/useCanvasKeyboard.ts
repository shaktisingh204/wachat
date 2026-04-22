'use client';
/**
 * useCanvasKeyboard — port of n8n's canvas keybindings from Canvas.vue.
 *
 * Full set ported so far:
 *   ⌘A / ⌘D / ⌘C / ⌘V / ⌘X / ⌘Z / ⌘⇧Z — owned by EditorPage
 *   Delete                — delete selected nodes/edges
 *   d                     — toggle disabled
 *   p                     — pin/unpin single selected node
 *   Tab                   — open node creator
 *   Escape                — clear selection / close pickers
 *   0                     — reset zoom
 *   1                     — fit-to-view
 *   Enter                 — open last-selected node's settings panel
 *   F2                    — start rename-in-place on last selected node
 *   ← / → / ↑ / ↓         — hop to adjacent connected node
 *   ⇧S                    — create sticky note at viewport center
 *   ⇧⌥T                   — tidy-up (auto-layout)
 *   ?                     — toggle keyboard help overlay
 */
import { useEffect } from 'react';
import { useReactFlow, useStore as useRFStore } from '@xyflow/react';
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
};

export function useCanvasKeyboard(h: Handlers) {
  const rf = useReactFlow();
  const selectedNodeIds = useRFStore((s) =>
    s.nodes.filter((n) => n.selected).map((n) => n.id),
  );
  const selectedEdgeIds = useRFStore((s) =>
    s.edges.filter((e) => e.selected).map((e) => e.id),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (shouldIgnoreCanvasShortcut(document.activeElement)) return;
      const meta = e.metaKey || e.ctrlKey;

      // Help overlay — "?" (shift+/ on most layouts)
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

      // Shift+S — add sticky note
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
  }, [h, rf, selectedNodeIds, selectedEdgeIds]);
}
