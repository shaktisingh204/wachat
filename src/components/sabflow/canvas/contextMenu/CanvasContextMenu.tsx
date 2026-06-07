'use client';
/**
 * CanvasContextMenu - port of n8n's ContextMenu.vue + useContextMenuItems.
 *
 * Renders a positioned menu with an action list, where the set of visible
 * actions depends on the target (canvas / node / edge) and the current
 * read-only state. Dismiss on outside click or Esc.
 */
import { useEffect } from 'react';
import {
  Copy,
  CopyPlus,
  Trash2,
  Power,
  Pencil,
  Pin,
  Play,
  SquarePlus,
  StickyNote,
  MousePointer,
  AlignHorizontalJustifyCenter,
  Zap,
  Clock,
  Globe,
  Hand,
  type LucideIcon,
} from 'lucide-react';

import { MenuItem, MenuSeparator } from '@/components/sabcrm/20ui';

import type { ContextMenuState } from './useContextMenu';

type Action = {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  danger?: boolean;
  run: () => void;
  divider?: boolean;
};

export type TriggerKind = 'start' | 'webhook' | 'schedule' | 'manual' | 'error';

type Props = {
  state: ContextMenuState;
  onClose: () => void;
  isReadOnly?: boolean;
  /**
   * Map of nodeId to 'trigger' for trigger nodes. When a trigger node is
   * right-clicked we surface a "Change trigger" sub-list instead of the
   * normal node actions.
   */
  nodeKinds?: Map<string, 'trigger' | 'block' | 'sticky'>;
  /** True for the sole remaining trigger - disables the delete row for it. */
  isSoleTrigger?: (nodeId: string) => boolean;
  actions: {
    onAddNode?: (screenX: number, screenY: number) => void;
    onAddSticky?: (screenX: number, screenY: number) => void;
    onSelectAll?: () => void;
    onTidyUp?: () => void;
    onOpen?: (nodeId: string) => void;
    onExecute?: (nodeId: string) => void;
    onRename?: (nodeId: string) => void;
    onCopy?: (nodeIds: string[]) => void;
    onDuplicate?: (nodeIds: string[]) => void;
    onTogglePin?: (nodeId: string) => void;
    onToggleDisabled?: (nodeIds: string[]) => void;
    onDeleteNodes?: (nodeIds: string[]) => void;
    onDeleteEdge?: (edgeId: string) => void;
    onChangeTrigger?: (nodeId: string, kind: TriggerKind) => void;
  };
};

export function CanvasContextMenu({
  state,
  onClose,
  isReadOnly,
  nodeKinds,
  isSoleTrigger,
  actions,
}: Props) {
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
        icon: SquarePlus,
        shortcut: 'Tab',
        run: () => actions.onAddNode?.(state.x, state.y),
      },
      {
        id: 'add-sticky',
        label: 'Add sticky note',
        icon: StickyNote,
        shortcut: '⇧ S',
        run: () => actions.onAddSticky?.(state.x, state.y),
      },
      {
        id: 'select-all',
        label: 'Select all',
        icon: MousePointer,
        shortcut: '⌘ A',
        run: () => actions.onSelectAll?.(),
      },
      {
        id: 'tidy-up',
        label: 'Tidy up',
        icon: AlignHorizontalJustifyCenter,
        shortcut: '⇧ ⌥ T',
        run: () => actions.onTidyUp?.(),
      },
    );
  } else if (state.target.source === 'node') {
    const nodeIds = state.target.nodeIds;
    const single = nodeIds.length === 1 ? nodeIds[0] : undefined;
    const singleKind = single ? nodeKinds?.get(single) : undefined;
    const isTrigger = singleKind === 'trigger';

    if (single) {
      items.push({
        id: 'open',
        label: 'Open',
        icon: Pencil,
        shortcut: '↵',
        run: () => actions.onOpen?.(single),
      });
      if (!isTrigger) {
        items.push({
          id: 'execute',
          label: 'Execute step',
          icon: Play,
          run: () => actions.onExecute?.(single),
        });
      }
      /* Trigger-only: surface quick "Change trigger" options so the user
         can switch the flow's entry point without navigating elsewhere. */
      if (isTrigger && actions.onChangeTrigger) {
        items.push({
          id: 'trigger-start',
          label: 'Trigger: When flow starts',
          icon: Play,
          run: () => actions.onChangeTrigger?.(single, 'start'),
        });
        items.push({
          id: 'trigger-webhook',
          label: 'Trigger: On webhook',
          icon: Globe,
          run: () => actions.onChangeTrigger?.(single, 'webhook'),
        });
        items.push({
          id: 'trigger-schedule',
          label: 'Trigger: On schedule',
          icon: Clock,
          run: () => actions.onChangeTrigger?.(single, 'schedule'),
        });
        items.push({
          id: 'trigger-manual',
          label: 'Trigger: Manual',
          icon: Hand,
          run: () => actions.onChangeTrigger?.(single, 'manual'),
        });
        items.push({
          id: 'trigger-error',
          label: 'Trigger: On error',
          icon: Zap,
          run: () => actions.onChangeTrigger?.(single, 'error'),
        });
      }
    }
    items.push(
      {
        id: 'copy',
        label: nodeIds.length > 1 ? 'Copy nodes' : 'Copy node',
        icon: Copy,
        shortcut: '⌘ C',
        run: () => actions.onCopy?.(nodeIds),
      },
      {
        id: 'duplicate',
        label: nodeIds.length > 1 ? 'Duplicate nodes' : 'Duplicate',
        icon: CopyPlus,
        shortcut: '⌘ D',
        run: () => actions.onDuplicate?.(nodeIds),
      },
    );
    if (single) {
      items.push({
        id: 'pin',
        label: 'Pin / unpin data',
        icon: Pin,
        shortcut: 'P',
        run: () => actions.onTogglePin?.(single),
      });
      items.push({
        id: 'rename',
        label: 'Rename',
        icon: Pencil,
        shortcut: 'F2',
        run: () => actions.onRename?.(single),
      });
    }
    const cantDelete =
      nodeIds.length === 1 && isSoleTrigger?.(nodeIds[0]) === true;
    items.push({
      id: 'disable',
      label: nodeIds.length > 1 ? 'Toggle disabled' : 'Disable / enable',
      icon: Power,
      shortcut: 'D',
      run: () => actions.onToggleDisabled?.(nodeIds),
    });
    if (!cantDelete) {
      items.push({
        id: 'delete',
        label: nodeIds.length > 1 ? 'Delete nodes' : 'Delete',
        icon: Trash2,
        shortcut: '⌫',
        danger: true,
        run: () => actions.onDeleteNodes?.(nodeIds),
        divider: true,
      });
    }
  } else if (state.target.source === 'edge') {
    const edgeId = state.target.edgeId;
    items.push({
      id: 'delete-edge',
      label: 'Delete connection',
      icon: Trash2,
      shortcut: '⌫',
      danger: true,
      run: () => actions.onDeleteEdge?.(edgeId),
    });
  }

  const visible = items.filter(
    (item) => !(isReadOnly && item.id !== 'select-all' && item.id !== 'copy'),
  );

  return (
    <div
      className="ui20 sabflow-context-menu u-menu fixed z-[60]"
      role="menu"
      aria-label="Canvas actions"
      style={{ left: state.x, top: state.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="u-menu__list" role="presentation">
        {visible.map((item, idx) => (
          <div key={item.id}>
            {item.divider && idx > 0 ? <MenuSeparator /> : null}
            <MenuItem
              icon={item.icon}
              danger={item.danger}
              hint={item.shortcut}
              onSelect={() => {
                item.run();
                onClose();
              }}
            >
              {item.label}
            </MenuItem>
          </div>
        ))}
      </div>
    </div>
  );
}
