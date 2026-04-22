'use client';
/**
 * CanvasContextMenu — port of n8n's ContextMenu.vue + useContextMenuItems.
 *
 * Renders a positioned menu with an action list, where the set of visible
 * actions depends on the target (canvas / node / edge) and the current
 * read-only state. Dismiss on outside click or Esc.
 */
import { useEffect } from 'react';
import {
  LuCopy,
  LuCopyPlus,
  LuTrash2,
  LuPower,
  LuPencil,
  LuPin,
  LuPlay,
  LuSquarePlus,
  LuStickyNote,
  LuMousePointer,
} from 'react-icons/lu';
import type { ContextMenuState } from './useContextMenu';

type Action = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  danger?: boolean;
  run: () => void;
  divider?: boolean;
};

type Props = {
  state: ContextMenuState;
  onClose: () => void;
  isReadOnly?: boolean;
  actions: {
    onAddNode?: (screenX: number, screenY: number) => void;
    onAddSticky?: (screenX: number, screenY: number) => void;
    onSelectAll?: () => void;
    onOpen?: (nodeId: string) => void;
    onExecute?: (nodeId: string) => void;
    onRename?: (nodeId: string) => void;
    onCopy?: (nodeIds: string[]) => void;
    onDuplicate?: (nodeIds: string[]) => void;
    onTogglePin?: (nodeId: string) => void;
    onToggleDisabled?: (nodeIds: string[]) => void;
    onDeleteNodes?: (nodeIds: string[]) => void;
    onDeleteEdge?: (edgeId: string) => void;
  };
};

export function CanvasContextMenu({ state, onClose, isReadOnly, actions }: Props) {
  useEffect(() => {
    if (!state.open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.sabflow-context-menu')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [state.open, onClose]);

  if (!state.open || !state.target) return null;

  const items: Action[] = [];

  if (state.target.source === 'canvas') {
    items.push(
      {
        id: 'add-node',
        label: 'Add node',
        icon: LuSquarePlus,
        shortcut: 'Tab',
        run: () => actions.onAddNode?.(state.x, state.y),
      },
      {
        id: 'add-sticky',
        label: 'Add sticky note',
        icon: LuStickyNote,
        shortcut: '⇧ S',
        run: () => actions.onAddSticky?.(state.x, state.y),
      },
      {
        id: 'select-all',
        label: 'Select all',
        icon: LuMousePointer,
        shortcut: '⌘ A',
        run: () => actions.onSelectAll?.(),
      },
    );
  } else if (state.target.source === 'node') {
    const nodeIds = state.target.nodeIds;
    const single = nodeIds.length === 1 ? nodeIds[0] : undefined;
    if (single) {
      items.push({
        id: 'open',
        label: 'Open',
        icon: LuPencil,
        shortcut: '↵',
        run: () => actions.onOpen?.(single),
      });
      items.push({
        id: 'execute',
        label: 'Execute step',
        icon: LuPlay,
        run: () => actions.onExecute?.(single),
      });
    }
    items.push(
      {
        id: 'copy',
        label: nodeIds.length > 1 ? 'Copy nodes' : 'Copy node',
        icon: LuCopy,
        shortcut: '⌘ C',
        run: () => actions.onCopy?.(nodeIds),
      },
      {
        id: 'duplicate',
        label: nodeIds.length > 1 ? 'Duplicate nodes' : 'Duplicate',
        icon: LuCopyPlus,
        shortcut: '⌘ D',
        run: () => actions.onDuplicate?.(nodeIds),
      },
    );
    if (single) {
      items.push({
        id: 'pin',
        label: 'Pin / unpin data',
        icon: LuPin,
        shortcut: 'P',
        run: () => actions.onTogglePin?.(single),
      });
      items.push({
        id: 'rename',
        label: 'Rename',
        icon: LuPencil,
        shortcut: 'F2',
        run: () => actions.onRename?.(single),
      });
    }
    items.push(
      {
        id: 'disable',
        label: nodeIds.length > 1 ? 'Toggle disabled' : 'Disable / enable',
        icon: LuPower,
        shortcut: 'D',
        run: () => actions.onToggleDisabled?.(nodeIds),
      },
      {
        id: 'delete',
        label: nodeIds.length > 1 ? 'Delete nodes' : 'Delete',
        icon: LuTrash2,
        shortcut: '⌫',
        danger: true,
        run: () => actions.onDeleteNodes?.(nodeIds),
        divider: true,
      },
    );
  } else if (state.target.source === 'edge') {
    const edgeId = state.target.edgeId;
    items.push({
      id: 'delete-edge',
      label: 'Delete connection',
      icon: LuTrash2,
      shortcut: '⌫',
      danger: true,
      run: () => actions.onDeleteEdge?.(edgeId),
    });
  }

  return (
    <div
      className="sabflow-context-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const disabled = isReadOnly && item.id !== 'select-all' && item.id !== 'copy';
        if (disabled) return null;
        return (
          <div key={item.id}>
            {item.divider && idx > 0 ? <div className="sabflow-context-menu__divider" /> : null}
            <button
              type="button"
              className={`sabflow-context-menu__item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                item.run();
                onClose();
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.shortcut ? (
                <span className="sabflow-context-menu__shortcut">{item.shortcut}</span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
