'use client';

import { useEffect, useRef } from 'react';

export interface FormKeyboardShortcutsOptions {
  onSave?: () => void;
  onSaveNew?: () => void;
  onCancel?: () => void;
  enabled?: boolean;
}

/**
 * §1D.3 keyboard contract for CRM forms:
 *   - Cmd/Ctrl+S        → onSave()        (fires even when typing)
 *   - Cmd/Ctrl+Enter    → onSaveNew()     (fires even when typing)
 *   - Esc               → onCancel()      (fires unconditionally; consumer
 *                                          should check dirty state)
 *
 * Plain alpha keys are ignored while focus is in an input / textarea /
 * select / contentEditable element to avoid hijacking typing.
 */
export function useFormKeyboardShortcuts({
  onSave,
  onSaveNew,
  onCancel,
  enabled = true,
}: FormKeyboardShortcutsOptions): void {
  const ref = useRef({ onSave, onSaveNew, onCancel });
  ref.current = { onSave, onSaveNew, onCancel };

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 's') {
        e.preventDefault();
        ref.current.onSave?.();
        return;
      }

      if (mod && key === 'enter') {
        e.preventDefault();
        ref.current.onSaveNew?.();
        return;
      }

      if (key === 'escape') {
        ref.current.onCancel?.();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
