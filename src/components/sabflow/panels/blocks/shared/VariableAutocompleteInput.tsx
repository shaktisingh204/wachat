'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   VariableAutocompleteInput

   An <input> / <textarea> that opens a floating variable picker when the user
   types the trigger sequence `{{`.  Behaves like a Notion / Typebot mention
   menu.

   Behaviour summary
   ─────────────────
   - Trigger opens when the characters immediately preceding the caret contain
     an un-closed `{{` token (e.g. `Hi {{na`).  The menu closes as soon as the
     token becomes closed (`{{name}}`) or the user types whitespace outside a
     word (`{{ `).
   - Filter text is everything after the `{{` up to the caret.
   - Keyboard:
       ArrowDown / ArrowUp  — move activeIndex
       Enter / Tab          — insert active variable → `{{name}}`
       Escape               — close without inserting
   - Mouse:
       Click row            — insert that variable
       Click outside        — close
   - Menu position is derived from the *actual* caret pixel position using a
     hidden mirror div (see helpers/caretPosition.ts) and translated into
     viewport-fixed coordinates so it works inside transformed / scrolled
     parents.
   ──────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { inputClass } from './primitives';
import { VariableMentionMenu } from './VariableMentionMenu';
import { getCaretCoordinates } from './helpers/caretPosition';

/* ─────────────────────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────────────────────── */

export type VariableAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  type?: 'input' | 'textarea';
  placeholder?: string;
  className?: string;
  /** Rows hint for the textarea variant. */
  rows?: number;
  /** Disable spell-check (useful for code / JSON fields). */
  spellCheck?: boolean;
  /** Optional aria-label for screen readers. */
  'aria-label'?: string;
  /**
   * Invoked when the user creates a new variable via the "+ Create variable"
   * affordance in the dropdown.  Must return the created Variable so the
   * component can insert it immediately.
   */
  onCreateVariable?: (name: string) => Variable;
  /**
   * Receives the underlying <input> / <textarea> DOM node so callers can
   * perform direct selection manipulation (toolbar actions, focus, etc.).
   * Called with `null` on unmount.
   */
  inputRef?: (node: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Trigger parsing
   ──────────────────────────────────────────────────────────────────────────── */

interface TriggerMatch {
  /** Absolute index of the opening `{{` in the value string. */
  startIndex: number;
  /** Current filter text entered after the `{{`. */
  query: string;
}

/** Returns the active trigger (if any) given the text before the caret. */
function findActiveTrigger(textBeforeCaret: string): TriggerMatch | null {
  // Find the last unmatched `{{` preceding the caret.
  const openIndex = textBeforeCaret.lastIndexOf('{{');
  if (openIndex === -1) return null;

  const afterOpen = textBeforeCaret.slice(openIndex + 2);

  // Close the trigger once we encounter a closing `}}` or any character that
  // can't be part of a variable name.  Allow letters, digits, underscore,
  // dot, and dash — matches common Typebot variable naming.
  if (afterOpen.includes('}}')) return null;
  if (!/^[\w.\-]*$/.test(afterOpen)) return null;

  return { startIndex: openIndex, query: afterOpen };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export function VariableAutocompleteInput({
  value,
  onChange,
  variables,
  type = 'input',
  placeholder,
  className,
  rows = 4,
  spellCheck,
  'aria-label': ariaLabel,
  onCreateVariable,
  inputRef: externalInputRef,
}: VariableAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const assignRef = useCallback(
    (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
      externalInputRef?.(node);
    },
    [externalInputRef],
  );
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── Trigger state ────────────────────────────────────────────────────── */

  const [trigger, setTrigger] = useState<TriggerMatch | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  const isOpen = trigger !== null;

  /* ── Filtered variable list ───────────────────────────────────────────── */

  const filteredVariables = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [trigger, variables]);

  // Reset active index whenever the filtered set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.query, variables.length]);

  /* ── Core trigger detection on every change ───────────────────────────── */

  const recomputeTrigger = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const caret = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, caret);
    const match = findActiveTrigger(before);

    setTrigger(match);

    if (match) {
      // Compute pixel position of the caret and translate to viewport.
      const rect = el.getBoundingClientRect();
      const caretCoords = getCaretCoordinates(el);
      setMenuPos({
        top: rect.top + caretCoords.top + caretCoords.height + 4,
        left: rect.left + caretCoords.left,
      });
    } else {
      setMenuPos(null);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Defer so the element reflects the new value + caret before we measure.
      requestAnimationFrame(recomputeTrigger);
    },
    [onChange, recomputeTrigger],
  );

  const handleSelect = useCallback(() => {
    // Caret may have moved to a position that closes the trigger.
    recomputeTrigger();
  }, [recomputeTrigger]);

  /* ── Close helpers ───────────────────────────────────────────────────── */

  const closeMenu = useCallback(() => {
    setTrigger(null);
    setMenuPos(null);
  }, []);

  /* ── Click-outside handler ───────────────────────────────────────────── */

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      closeMenu();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, closeMenu]);

  /* ── Reposition on scroll / resize while open ────────────────────────── */

  useLayoutEffect(() => {
    if (!isOpen) return;

    const onLayoutChange = () => recomputeTrigger();
    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
    };
  }, [isOpen, recomputeTrigger]);

  /* ── Insertion helpers ───────────────────────────────────────────────── */

  const insertVariable = useCallback(
    (variable: Variable) => {
      const el = inputRef.current;
      if (!el || !trigger) return;

      const caret = el.selectionEnd ?? el.value.length;
      const before = el.value.slice(0, trigger.startIndex);
      const after = el.value.slice(caret);
      const insertion = `{{${variable.name}}}`;
      const nextValue = `${before}${insertion}${after}`;
      onChange(nextValue);

      const nextCaret = before.length + insertion.length;
      // Restore focus + caret after React re-renders the value.
      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(nextCaret, nextCaret);
      });

      closeMenu();
    },
    [trigger, onChange, closeMenu],
  );

  const handleCreateVariable = useCallback(
    (name: string) => {
      if (!onCreateVariable) return;
      const created = onCreateVariable(name);
      insertVariable(created);
    },
    [onCreateVariable, insertVariable],
  );

  /* ── Keyboard navigation ─────────────────────────────────────────────── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!isOpen) return;

      const hasMatches = filteredVariables.length > 0;

      switch (e.key) {
        case 'ArrowDown': {
          if (!hasMatches) return;
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filteredVariables.length);
          return;
        }
        case 'ArrowUp': {
          if (!hasMatches) return;
          e.preventDefault();
          setActiveIndex(
            (i) => (i - 1 + filteredVariables.length) % filteredVariables.length,
          );
          return;
        }
        case 'Enter':
        case 'Tab': {
          if (hasMatches) {
            e.preventDefault();
            const picked = filteredVariables[activeIndex];
            if (picked) insertVariable(picked);
            return;
          }
          // No matches → allow "Create" shortcut on Enter if trigger has text.
          if (
            e.key === 'Enter' &&
            onCreateVariable &&
            trigger?.query.trim()
          ) {
            e.preventDefault();
            handleCreateVariable(trigger.query.trim());
          }
          return;
        }
        case 'Escape': {
          e.preventDefault();
          closeMenu();
          return;
        }
      }
    },
    [
      isOpen,
      filteredVariables,
      activeIndex,
      insertVariable,
      closeMenu,
      onCreateVariable,
      trigger,
      handleCreateVariable,
    ],
  );

  /* ── Render ──────────────────────────────────────────────────────────── */

  const sharedProps = {
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onSelect: handleSelect,
    onClick: handleSelect,
    placeholder,
    spellCheck,
    'aria-label': ariaLabel,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox' as const,
  };

  return (
    <>
      {type === 'textarea' ? (
        <textarea
          ref={assignRef}
          rows={rows}
          className={cn(inputClass, 'resize-y', className)}
          {...sharedProps}
        />
      ) : (
        <input
          ref={assignRef}
          type="text"
          className={cn(inputClass, className)}
          {...sharedProps}
        />
      )}

      {isOpen && menuPos && (
        <VariableMentionMenu
          ref={menuRef}
          variables={filteredVariables}
          activeIndex={activeIndex}
          onSelect={insertVariable}
          onCreate={onCreateVariable ? handleCreateVariable : undefined}
          onHoverIndex={setActiveIndex}
          query={trigger?.query ?? ''}
          position={menuPos}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helper exported for callers that don't want to manage createId themselves
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Convenience factory that creates a new {@link Variable} with a fresh id.
 * Use this inside `onCreateVariable` when wiring the component into a panel.
 */
export function makeNewVariable(name: string): Variable {
  return { id: createId(), name };
}
