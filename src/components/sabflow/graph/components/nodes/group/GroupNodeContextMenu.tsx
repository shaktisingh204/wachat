'use client';
import { useEffect, useRef, useCallback } from 'react';
import {
  Pencil,
  Files,
  Copy,
  ClipboardPaste,
  Network,
  Trash2,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { MenuItem, MenuSeparator } from '@/components/sabcrm/20ui';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { useSelectionStore } from '../../../hooks/useSelectionStore';

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

// -- Main component ------------------------------------------------------------

type Props = {
  groupId: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** Full flow doc, needed for connected-edge traversal, paste, delete. */
  flow?: Pick<SabFlowDoc, 'groups' | 'edges'>;
  /** Callback to commit flow mutations upward. */
  onFlowChange?: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => void;
  /** Optional: focus the title input on the group node. */
  onEditTitle?: () => void;
  /** Optional: pan the canvas to bring this group into view. */
  onFocusGroup?: (groupId: string) => void;
};

export function GroupNodeContextMenu({
  groupId,
  position,
  onClose,
  flow,
  onFlowChange,
  onEditTitle,
  onFocusGroup,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  const metaKey = isMac() ? '⌘' : 'Ctrl+';

  // -- Selection store ---------------------------------------------------------
  const elementsInClipboard = useSelectionStore(useShallow((s) => s.elementsInClipboard));
  const { setFocusedElements } = useSelectionStore(
    useShallow((s) => ({
      setFocusedElements: s.setFocusedElements,
    })),
  );

  // -- Close on outside click (capture) + Escape --------------------------------
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // -- Helpers to dispatch keyboard shortcuts that ElementsSelectionMenu handles --
  const dispatchKey = useCallback((key: string, modifiers?: { meta?: boolean }) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        [isMac() ? 'metaKey' : 'ctrlKey']: modifiers?.meta ?? false,
        bubbles: true,
      }),
    );
  }, []);

  // -- Action: Edit title -------------------------------------------------------
  const handleEditTitle = () => {
    onEditTitle?.();
    onClose();
  };

  // -- Action: Duplicate (Cmd+D) -------------------------------------------------
  const handleDuplicate = () => {
    dispatchKey('d', { meta: true });
    onClose();
  };

  // -- Action: Copy --------------------------------------------------------------
  const handleCopy = () => {
    dispatchKey('c', { meta: true });
    onClose();
  };

  // -- Action: Paste -------------------------------------------------------------
  const handlePaste = () => {
    dispatchKey('v', { meta: true });
    onClose();
  };

  // -- Action: Select connected --------------------------------------------------
  // BFS over edges to find all groups reachable from this group.
  const handleSelectConnected = useCallback(() => {
    if (!flow) { onClose(); return; }

    const visited = new Set<string>();
    const queue: string[] = [groupId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Forward edges: current is the source group
      flow.edges.forEach((edge) => {
        const fromGroupId = edge.from.groupId;
        if (fromGroupId === current && edge.to.groupId && !visited.has(edge.to.groupId)) {
          queue.push(edge.to.groupId);
        }
      });

      // Backward edges: current is the target group
      flow.edges.forEach((edge) => {
        const fromGroupId = edge.from.groupId;
        if (edge.to.groupId === current && fromGroupId && !visited.has(fromGroupId)) {
          queue.push(fromGroupId);
        }
      });
    }

    setFocusedElements(Array.from(visited));
    onFocusGroup?.(groupId);
    onClose();
  }, [flow, groupId, setFocusedElements, onFocusGroup, onClose]);

  // -- Action: Delete ------------------------------------------------------------
  const handleDelete = useCallback(() => {
    if (!flow || !onFlowChange) {
      // Fallback: dispatch Backspace so ElementsSelectionMenu handles it
      dispatchKey('Backspace');
      onClose();
      return;
    }

    const ids = new Set([groupId]);
    onFlowChange({
      groups: flow.groups.filter((g) => !ids.has(g.id)),
      edges: flow.edges.filter(
        (e) =>
          !ids.has(e.to.groupId) &&
          !(e.from.groupId != null && ids.has(e.from.groupId as string)),
      ),
    });
    onClose();
  }, [flow, onFlowChange, groupId, dispatchKey, onClose]);

  // -- Paste available? ----------------------------------------------------------
  const hasPasteContent =
    elementsInClipboard != null && (elementsInClipboard.groups?.length ?? 0) > 0;

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="20ui u-menu fixed z-[9999] min-w-[200px] select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem icon={Pencil} onSelect={handleEditTitle}>
        Edit title
      </MenuItem>
      <MenuItem icon={Files} hint={`${metaKey}D`} onSelect={handleDuplicate}>
        Duplicate
      </MenuItem>

      <MenuSeparator />

      <MenuItem icon={Copy} hint={`${metaKey}C`} onSelect={handleCopy}>
        Copy
      </MenuItem>
      <MenuItem
        icon={ClipboardPaste}
        hint={`${metaKey}V`}
        disabled={!hasPasteContent}
        onSelect={handlePaste}
      >
        Paste
      </MenuItem>

      <MenuSeparator />

      <MenuItem icon={Network} onSelect={handleSelectConnected}>
        Select connected
      </MenuItem>

      <MenuSeparator />

      <MenuItem icon={Trash2} hint="⌫" danger onSelect={handleDelete}>
        Delete group
      </MenuItem>
    </div>
  );
}
