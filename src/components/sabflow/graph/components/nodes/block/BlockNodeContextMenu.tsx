'use client';
import { useEffect, useRef } from 'react';
import {
  LuSettings2,
  LuCopy,
  LuTrash2,
  LuPin,
  LuPinOff,
  LuPlay,
} from 'react-icons/lu';

type Props = {
  x: number;
  y: number;
  /** Whether the target block currently has pinned output. Drives the
   *  pin / unpin menu item's label + icon. */
  isPinned?: boolean;
  onSettings: () => void;
  onDuplicate: () => void;
  /** Fired when the user picks the pin/unpin menu item. Optional — when
   *  omitted (e.g. for trigger event nodes that can't be pinned) the
   *  menu item is hidden. */
  onTogglePin?: () => void;
  /** Fired when the user picks "Run from here". Optional — when omitted
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
      className="fixed z-[9999] min-w-[160px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-lg py-1 select-none"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
        onClick={handleSettings}
      >
        <LuSettings2 className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
        Settings
      </button>

      {onRunFrom && (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
          onClick={handleRunFrom}
        >
          <LuPlay
            className="h-3.5 w-3.5 shrink-0 text-[var(--green-10)]"
            strokeWidth={2.5}
          />
          Run from here
        </button>
      )}

      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
        onClick={handleDuplicate}
      >
        <LuCopy className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
        Duplicate
      </button>

      {onTogglePin && (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
          onClick={handleTogglePin}
        >
          {isPinned ? (
            <>
              <LuPinOff className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
              Unpin output
            </>
          ) : (
            <>
              <LuPin className="h-3.5 w-3.5 shrink-0 text-[var(--amber-10)]" />
              Pin output
            </>
          )}
        </button>
      )}

      <div className="my-1 h-px bg-[var(--gray-4)]" />

      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)]/30 transition-colors"
        onClick={handleDelete}
      >
        <LuTrash2 className="h-3.5 w-3.5 shrink-0" />
        Delete
      </button>
    </div>
  );
}
