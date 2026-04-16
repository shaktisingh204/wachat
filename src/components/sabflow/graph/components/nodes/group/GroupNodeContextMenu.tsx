'use client';
import { useEffect, useRef, useCallback } from 'react';
import {
  LuPencil,
  LuFiles,
  LuCopy,
  LuClipboardPaste,
  LuNetwork,
  LuTrash2,
} from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { useSelectionStore } from '../../../hooks/useSelectionStore';

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

// ── Menu item sub-components ──────────────────────────────────────────────────

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
};

function MenuItem({ icon, label, shortcut, variant = 'default', disabled = false, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 px-3 py-[7px] text-[12.5px] transition-colors select-none',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : variant === 'danger'
            ? 'cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
            : 'cursor-pointer text-[var(--gray-12)] hover:bg-[var(--gray-3)]',
      ].join(' ')}
    >
      <span className={variant === 'danger' ? 'shrink-0' : 'shrink-0 text-[var(--gray-10)]'}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="ml-3 text-[11px] text-[var(--gray-9)] font-mono">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-[var(--gray-5)]" />;
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  groupId: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** Full flow doc — needed for connected-edge traversal, paste, delete. */
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

  // ── Selection store ─────────────────────────────────────────────────────────
  const elementsInClipboard = useSelectionStore(useShallow((s) => s.elementsInClipboard));
  const { setFocusedElements } = useSelectionStore(
    useShallow((s) => ({
      setFocusedElements: s.setFocusedElements,
    })),
  );

  // ── Close on outside click (capture) + Escape ────────────────────────────────
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

  // ── Helpers to dispatch keyboard shortcuts that ElementsSelectionMenu handles ──
  const dispatchKey = useCallback((key: string, modifiers?: { meta?: boolean }) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        [isMac() ? 'metaKey' : 'ctrlKey']: modifiers?.meta ?? false,
        bubbles: true,
      }),
    );
  }, []);

  // ── Action: Edit title ───────────────────────────────────────────────────────
  const handleEditTitle = () => {
    onEditTitle?.();
    onClose();
  };

  // ── Action: Duplicate (Cmd+D) ─────────────────────────────────────────────────
  const handleDuplicate = () => {
    dispatchKey('d', { meta: true });
    onClose();
  };

  // ── Action: Copy ──────────────────────────────────────────────────────────────
  const handleCopy = () => {
    dispatchKey('c', { meta: true });
    onClose();
  };

  // ── Action: Paste ─────────────────────────────────────────────────────────────
  const handlePaste = () => {
    dispatchKey('v', { meta: true });
    onClose();
  };

  // ── Action: Select connected ──────────────────────────────────────────────────
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

  // ── Action: Delete ────────────────────────────────────────────────────────────
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

  // ── Paste available? ──────────────────────────────────────────────────────────
  const hasPasteContent =
    elementsInClipboard != null && (elementsInClipboard.groups?.length ?? 0) > 0;

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-[9999] min-w-[200px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-xl py-1 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem
        icon={<LuPencil size={13} />}
        label="Edit title"
        onClick={handleEditTitle}
      />
      <MenuItem
        icon={<LuFiles size={13} />}
        label="Duplicate"
        shortcut={`${metaKey}D`}
        onClick={handleDuplicate}
      />

      <Separator />

      <MenuItem
        icon={<LuCopy size={13} />}
        label="Copy"
        shortcut={`${metaKey}C`}
        onClick={handleCopy}
      />
      <MenuItem
        icon={<LuClipboardPaste size={13} />}
        label="Paste"
        shortcut={`${metaKey}V`}
        disabled={!hasPasteContent}
        onClick={handlePaste}
      />

      <Separator />

      <MenuItem
        icon={<LuNetwork size={13} />}
        label="Select connected"
        onClick={handleSelectConnected}
      />

      <Separator />

      <MenuItem
        icon={<LuTrash2 size={13} />}
        label="Delete group"
        shortcut="⌫"
        variant="danger"
        onClick={handleDelete}
      />
    </div>
  );
}
