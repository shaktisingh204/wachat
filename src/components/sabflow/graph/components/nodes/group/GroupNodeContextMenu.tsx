'use client';
import { useEffect, useRef } from 'react';
import { LuCopy, LuFiles, LuTrash2 } from 'react-icons/lu';

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

type Props = {
  groupId: string;
  position: { x: number; y: number };
  onClose: () => void;
};

export function GroupNodeContextMenu({ groupId: _groupId, position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so the click fires before React synthetic events bubble
    document.addEventListener('mousedown', handleOutsideClick, true);
    return () => document.removeEventListener('mousedown', handleOutsideClick, true);
  }, [onClose]);

  const dispatchCopy = () => {
    dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'c',
        [isMac() ? 'metaKey' : 'ctrlKey']: true,
        bubbles: true,
      }),
    );
    onClose();
  };

  const dispatchDuplicate = () => {
    dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        [isMac() ? 'metaKey' : 'ctrlKey']: true,
        bubbles: true,
      }),
    );
    onClose();
  };

  const dispatchDelete = () => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed bg-[var(--gray-1)] border border-[var(--gray-5)] rounded-lg shadow-lg py-1 z-50 min-w-[150px]"
    >
      <button
        type="button"
        onClick={dispatchCopy}
        className="w-full px-3 py-1.5 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] cursor-pointer flex items-center gap-2 transition-colors"
      >
        <LuCopy size={13} />
        Copy group
      </button>

      <button
        type="button"
        onClick={dispatchDuplicate}
        className="w-full px-3 py-1.5 text-[12.5px] text-[var(--gray-12)] hover:bg-[var(--gray-3)] cursor-pointer flex items-center gap-2 transition-colors"
      >
        <LuFiles size={13} />
        Duplicate
      </button>

      <div className="my-1 h-px bg-[var(--gray-5)]" />

      <button
        type="button"
        onClick={dispatchDelete}
        className="w-full px-3 py-1.5 text-[12.5px] text-[var(--gray-12)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer flex items-center gap-2 transition-colors"
      >
        <LuTrash2 size={13} />
        Delete
      </button>
    </div>
  );
}
