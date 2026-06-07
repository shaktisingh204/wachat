'use client';
import { useEffect, useRef } from 'react';
import { Settings2, Copy, Trash2, Pin, PinOff, Play } from 'lucide-react';

import { MenuItem, MenuSeparator } from '@/components/sabcrm/20ui';

type Props = {
  x: number;
  y: number;
  /** Whether the target block currently has pinned output. Drives the
   *  pin / unpin menu item's label + icon. */
  isPinned?: boolean;
  onSettings: () => void;
  onDuplicate: () => void;
  /** Fired when the user picks the pin/unpin menu item. Optional. When
   *  omitted (e.g. for trigger event nodes that can't be pinned) the
   *  menu item is hidden. */
  onTogglePin?: () => void;
  /** Fired when the user picks "Run from here". Optional. When omitted
   *  the menu item is hidden (e.g. read-only flows, trigger nodes). */
  onRunFrom?: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function BlockNodeContextMenu({
  x,
  y,
  isPinned = false,
  onSettings,
  onDuplicate,
  onTogglePin,
  onRunFrom,
  onDelete,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click via capture-phase listener
  useEffect(() => {
    const handleCapture = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleCapture, true);
    return () => document.removeEventListener('mousedown', handleCapture, true);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSettings = () => {
    onSettings();
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate();
    onClose();
  };

  const handleTogglePin = () => {
    onTogglePin?.();
    onClose();
  };

  const handleRunFrom = () => {
    onRunFrom?.();
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="ui20 u-menu fixed z-[9999] min-w-[184px] select-none"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="u-menu__list" role="menu" aria-label="Block actions">
        <MenuItem icon={Settings2} onSelect={handleSettings}>
          Settings
        </MenuItem>

        {onRunFrom && (
          <MenuItem icon={Play} onSelect={handleRunFrom}>
            Run from here
          </MenuItem>
        )}

        <MenuItem icon={Copy} onSelect={handleDuplicate}>
          Duplicate
        </MenuItem>

        {onTogglePin && (
          <MenuItem
            icon={isPinned ? PinOff : Pin}
            onSelect={handleTogglePin}
          >
            {isPinned ? 'Unpin output' : 'Pin output'}
          </MenuItem>
        )}

        <MenuSeparator />

        <MenuItem icon={Trash2} danger onSelect={handleDelete}>
          Delete
        </MenuItem>
      </div>
    </div>
  );
}
