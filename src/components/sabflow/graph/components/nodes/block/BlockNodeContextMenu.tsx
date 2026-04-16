'use client';
import { useEffect, useRef } from 'react';
import { LuSettings2, LuCopy, LuTrash2 } from 'react-icons/lu';

type Props = {
  x: number;
  y: number;
  onSettings: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function BlockNodeContextMenu({
  x,
  y,
  onSettings,
  onDuplicate,
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

      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
        onClick={handleDuplicate}
      >
        <LuCopy className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
        Duplicate
      </button>

      <div className="my-1 h-px bg-[var(--gray-4)]" />

      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        onClick={handleDelete}
      >
        <LuTrash2 className="h-3.5 w-3.5 shrink-0" />
        Delete
      </button>
    </div>
  );
}
