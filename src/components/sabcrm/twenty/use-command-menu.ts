'use client';

import * as React from 'react';

// Re-export the recently-viewed records helper so hosts can push a record into
// the menu's "Recent" list at navigation time (e.g. when a record page mounts),
// not only when a record is opened *through* the menu. Same localStorage list
// the command menu reads to render its "Recent" group. (The menu itself now
// lives at `@/components/sabcrm/command-menu`; its data layer owns recents.)
export { recordRecents } from '../command-menu-data';

/**
 * Controls the SabCRM global command menu (⌘K / Ctrl+K) and the keyboard
 * shortcuts help overlay (?).
 *
 * Registers a single document-level `keydown` listener that:
 *  - toggles the command menu on the platform shortcut (⌘K / Ctrl+K),
 *  - opens the command menu on `/` (only when the user is not already typing),
 *  - toggles the shortcuts help overlay on `?` (only when not typing).
 *
 * The editable-target guard ensures the bare-key shortcuts never hijack normal
 * text entry into inputs / textareas / contenteditable regions.
 */
export interface UseCommandMenuResult {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the keyboard-shortcuts help overlay is visible. */
  helpOpen: boolean;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function useCommandMenu(): UseCommandMenuResult {
  const [open, setOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // ⌘K (mac) / Ctrl+K (win/linux) — toggle from anywhere.
      const isToggleCombo =
        (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (isToggleCombo) {
        event.preventDefault();
        setHelpOpen(false);
        setOpen((prev) => !prev);
        return;
      }

      // "/" opens the menu, but never while the user is typing somewhere.
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setHelpOpen(false);
        setOpen(true);
        return;
      }

      // "?" toggles the keyboard-shortcuts help overlay, but never while typing.
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setHelpOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen, helpOpen, setHelpOpen };
}

export default useCommandMenu;
