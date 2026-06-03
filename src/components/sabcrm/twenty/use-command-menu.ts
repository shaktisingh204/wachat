'use client';

import * as React from 'react';

/**
 * Controls the SabCRM global command menu (⌘K / Ctrl+K).
 *
 * Registers a single document-level `keydown` listener that toggles the menu
 * on the platform shortcut. The `/` shortcut is also supported, but only when
 * the user is not already typing into an input / textarea / contenteditable so
 * it never hijacks normal text entry.
 */
export interface UseCommandMenuResult {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function useCommandMenu(): UseCommandMenuResult {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // ⌘K (mac) / Ctrl+K (win/linux) — toggle from anywhere.
      const isToggleCombo =
        (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (isToggleCombo) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // "/" opens the menu, but never while the user is typing somewhere.
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}

export default useCommandMenu;
