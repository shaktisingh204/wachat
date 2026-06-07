'use client';

/* -----------------------------------------------------------------------------
   VariableMentionMenu - the floating dropdown rendered when a user types "{{"
   inside a text input.

   Responsibilities:
   - Render a scrollable list of variables (or a "No variables" empty state).
   - Highlight the currently keyboard-focused item.
   - Report selection / create-variable events upwards.

   Keyboard events are owned by the parent so they can be handled on the *input*
   element itself (otherwise the dropdown would need to steal focus, which
   breaks the typing flow). This menu only surfaces its internal state via
   props/callbacks.
   -------------------------------------------------------------------------- */

import { forwardRef, useEffect, useRef } from 'react';
import { Plus, Braces } from 'lucide-react';
import type { Variable } from '@/lib/sabflow/types';
import { Badge, Button, EmptyState, cn } from '@/components/sabcrm/20ui';

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

/* -----------------------------------------------------------------------------
   Props
   -------------------------------------------------------------------------- */

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
   * Viewport position (px) for the menu top-left. `undefined` keeps the menu
   * unpositioned (useful for Storybook / tests).
   */
  position?: { top: number; left: number } | undefined;
  /** Called whenever the user hovers a row - lets parent sync activeIndex. */
  onHoverIndex?: (index: number) => void;
}

/* -----------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

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
      // containers that might otherwise clip it. Coordinates are computed at
      // runtime from the caret position, so this stays an inline style.
      style={
        position
          ? { position: 'fixed', top: position.top, left: position.left }
          : undefined
      }
      className={cn(
        'z-[100] min-w-[200px] max-w-[280px] overflow-hidden',
        'rounded-[var(--st-radius)] border border-[var(--st-border)]',
        'bg-[var(--st-bg)] shadow-lg',
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
                  'flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 text-[12px]',
                  'transition-colors',
                  isActive
                    ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                    : 'text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]',
                )}
              >
                {glyph ? (
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[9.5px] font-semibold',
                      isActive
                        ? 'bg-[var(--st-bg)] text-[var(--st-accent)]'
                        : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]',
                    )}
                  >
                    {glyph}
                  </span>
                ) : (
                  <Braces
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isActive ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-tertiary)]',
                    )}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate font-mono">{v.name}</span>
                {v.isSessionVariable && (
                  <Badge tone={isActive ? 'accent' : 'neutral'} kind="soft" className="ml-auto shrink-0">
                    session
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          size="sm"
          icon={Braces}
          title="No variables"
          className="px-3 py-3"
        />
      )}

      {canCreate && (
        <div className="border-t border-[var(--st-border)] p-1">
          <Button
            variant="ghost"
            size="sm"
            block
            iconLeft={Plus}
            onMouseDown={(e) => {
              // Keep input focus so the caret stays put while we create.
              e.preventDefault();
              onCreate?.(trimmedQuery);
            }}
            className="justify-start"
          >
            <span className="truncate">
              Create variable{' '}
              <span className="font-mono text-[var(--st-accent)]">
                {`{{${trimmedQuery}}}`}
              </span>
            </span>
          </Button>
        </div>
      )}
    </div>
  );
});
