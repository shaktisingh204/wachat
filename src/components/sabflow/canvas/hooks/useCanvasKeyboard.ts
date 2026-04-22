'use client';
/**
 * useCanvasKeyboard — port of n8n's canvas keybindings from Canvas.vue.
 *
 * Only a focused subset is ported for now:
 *   ⌘A       → select all
 *   ⌘C       → copy selected (snapshot → clipboard as JSON)
 *   ⌘V       → paste (JSON clipboard → add blocks)
 *   ⌘D       → duplicate selected
 *   ⌘X       → cut (copy + delete)
 *   Delete   → delete selected
 *   d        → toggle disabled on selected
 *   Tab      → open node creator
 *   p        → pin/unpin selected
 *   Escape   → close picker / clear selection
 *   0        → reset zoom
 *   1        → fit-to-view
 *
 * Undo/redo (⌘Z / ⌘⇧Z) remains owned by EditorPage so its SabFlowDoc history
 * stack stays the source of truth.
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

      // ↓ plain keys — only if there's selection or global actions
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
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h, rf, selectedNodeIds, selectedEdgeIds]);
}
