'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   VariableMentionMenu — the floating dropdown rendered when a user types "{{"
   inside a text input.

   Responsibilities:
   - Render a scrollable list of variables (or a "No variables" empty state).
   - Highlight the currently keyboard-focused item.
   - Report selection / create-variable events upwards.

   Keyboard events are owned by the parent so they can be handled on the *input*
   element itself (otherwise the dropdown would need to steal focus, which
   breaks the typing flow).  This menu only surfaces its internal state via
   props/callbacks.
   ──────────────────────────────────────────────────────────────────────────── */

import { forwardRef, useEffect, useRef } from 'react';
import { LuPlus, LuBraces } from 'react-icons/lu';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

/* Single-character glyph hint for each variable type, mirroring VariableSelect. */
const TYPE_GLYPHS: Record<string, string> = {
  text: 'T',
  number: '#',
  boolean: '?',
  object: '{}',
};

function typeGlyph(v: Variable): string | null {
  const vt = (v as Variable & { varType?: string }).varType;
  return vt ? (TYPE_GLYPHS[vt] ?? null) : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────────────────────── */

export interface VariableMentionMenuProps {
  /** Pre-filtered list of variables that match the user's query. */
  variables: Variable[];
  /** Index of the currently keyboard-focused row. */
  activeIndex: number;
  /** Invoked when a variable is chosen (click or keyboard). */
  onSelect: (variable: Variable) => void;
  /** Invoked when the empty-state create affordance is clicked. */
  onCreate?: (name: string) => void;
  /** The raw filter text (after `{{`), used for the "Create variable" label. */
  query: string;
  /**
   * Viewport position (px) for the menu top-left.  `undefined` keeps the menu
   * unpositioned (useful for Storybook / tests).
   */
  position?: { top: number; left: number } | undefined;
  /** Called whenever the user hovers a row — lets parent sync activeIndex. */
  onHoverIndex?: (index: number) => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export const VariableMentionMenu = forwardRef<
  HTMLDivElement,
  VariableMentionMenuProps
>(function VariableMentionMenu(
  { variables, activeIndex, onSelect, onCreate, query, position, onHoverIndex },
  ref,
) {
  const listRef = useRef<HTMLUListElement>(null);

  /* Keep the active row scrolled into view when navigating with keyboard. */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const hasMatches = variables.length > 0;
  const trimmedQuery = query.trim();
  const canCreate = Boolean(onCreate) && trimmedQuery.length > 0;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Variables"
      // Fixed positioning so the menu floats above transforms / scroll
      // containers that might otherwise clip it.
      style={
        position
          ? { position: 'fixed', top: position.top, left: position.left }
          : undefined
      }
      className={cn(
        'z-[100] min-w-[200px] max-w-[280px]',
        'rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)]',
        'shadow-lg overflow-hidden',
      )}
    >
      {hasMatches ? (
        <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
          {variables.map((v, i) => {
            const isActive = i === activeIndex;
            const glyph = typeGlyph(v);
            return (
              <li
                key={v.id}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // Prevent the input from losing focus before we insert.
                  e.preventDefault();
                  onSelect(v);
                }}
                onMouseEnter={() => onHoverIndex?.(i)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 text-[12px] cursor-pointer select-none',
                  'transition-colors',
                  isActive
                    ? 'bg-[#f76808] text-white'
                    : 'text-[var(--gray-12)] hover:bg-[var(--gray-3)]',
                )}
              >
                {glyph ? (
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold font-mono',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--gray-3)] text-[var(--gray-9)]',
                    )}
                  >
                    {glyph}
                  </span>
                ) : (
                  <LuBraces
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isActive ? 'text-white/80' : 'text-[var(--gray-8)]',
                    )}
                    strokeWidth={1.8}
                  />
                )}
                <span className="font-mono truncate">{v.name}</span>
                {v.isSessionVariable && (
                  <span
                    className={cn(
                      'ml-auto text-[9.5px] uppercase tracking-wide shrink-0',
                      isActive ? 'text-white/70' : 'text-[var(--gray-8)]',
                    )}
                  >
                    session
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-2.5 py-2 text-[11.5px] text-[var(--gray-9)]">
          No variables
        </div>
      )}

      {canCreate && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onCreate?.(trimmedQuery);
          }}
          className={cn(
            'flex w-full items-center gap-1.5 border-t border-[var(--gray-4)]',
            'px-2.5 py-1.5 text-[11.5px] text-[var(--gray-10)]',
            'hover:bg-[#f76808]/10 hover:text-[#f76808] transition-colors',
          )}
        >
          <LuPlus className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          <span className="truncate">
            Create variable&nbsp;
            <span className="font-mono text-[#f76808]">
              {`{{${trimmedQuery}}}`}
            </span>
          </span>
        </button>
      )}
    </div>
  );
});
