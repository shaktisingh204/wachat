'use client';

/**
 * 20ui — ActionSearchBar.
 *
 * A single-line search input that ranks and lists "actions" as the user types,
 * then runs the chosen one. Lighter than the full `Command` palette: it lives
 * inline in a header or hero, reveals a results panel under the field, and
 * supports keyboard navigation end to end (ArrowDown / ArrowUp to move, Enter to
 * run, Escape to dismiss, Home / End to jump).
 *
 * Ranking is a small built-in scorer (exact > prefix > word-boundary >
 * subsequence > substring), so the most relevant action floats to the top. Pass
 * `filter` to override matching entirely. Actions may carry a `group`, in which
 * case the panel renders labelled sections (groups keep their first-seen order).
 *
 * Accessibility (fixing-accessibility): the field is an ARIA 1.2 combobox that
 * controls a `role="listbox"`; rows are `role="option"` with a stable
 * `aria-activedescendant` pointing at the highlighted one, so screen readers
 * announce the active action while focus stays in the input. The clear button is
 * an icon-only control with an accessible name; the leading magnifier is
 * decorative. Outside-click and Escape both dismiss; the visible focus ring is
 * the shared `--u-focus-ring`.
 *
 * Motion (emil-design-eng): the panel scale-ins from the top edge with
 * transform + opacity only, under 250ms on `--u-ease-out`; the highlight bar and
 * press feedback are transform/colour only. A `prefers-reduced-motion` block in
 * actionsearchbar.css collapses the entrance to a fade.
 *
 *   <ActionSearchBar
 *     actions={[
 *       { id: 'new-lead', label: 'Create lead', icon: <Plus />, shortcut: 'C', group: 'Create', onRun: openLead },
 *       { id: 'import',    label: 'Import contacts', icon: <Upload />, group: 'Data', onRun: openImport },
 *     ]}
 *     placeholder="Search actions..."
 *     onRun={(a) => track(a.id)}
 *   />
 */

import * as React from 'react';
import { Search, X } from 'lucide-react';

import './actionsearchbar.css';

/** A runnable action surfaced by the search bar. */
export interface Action {
  /** Stable identity — also used as the option's DOM id base. */
  id: string;
  /** What the user reads + what we rank against. */
  label: string;
  /** Decorative leading glyph (rendered `aria-hidden`); pass a lucide icon element. */
  icon?: React.ReactNode;
  /** Right-aligned keyboard hint, e.g. "C" or "Cmd N". */
  shortcut?: React.ReactNode;
  /** Invoked when the action is chosen (Enter or click). */
  onRun: () => void;
  /** Optional section heading; ungrouped actions render in a leading unlabelled block. */
  group?: string;
  /** Extra searchable terms / aliases the label does not cover. */
  keywords?: string;
}

export interface ActionSearchBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** The pool of actions to rank and list. */
  actions: Action[];
  /** Placeholder for the empty field. */
  placeholder?: string;
  /** Fired after an action's own `onRun`, with the chosen action. */
  onRun?: (action: Action) => void;
  /** Override matching. Return a score (higher = better, <= 0 = filtered out), or a boolean. */
  filter?: (action: Action, query: string) => number | boolean;
  /** Shown in the panel when a non-empty query matches nothing. */
  emptyHint?: React.ReactNode;
  /** Trailing hint glyph shown while the field is empty (e.g. a "/" shortcut). */
  hint?: React.ReactNode;
}

/* A flat, render-ready row: either a section heading or a runnable option. */
type Row =
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'option'; key: string; index: number; action: Action };

/**
 * Score `query` against `action`'s label + keywords. Returns 0 when there is no
 * match so the caller can drop it. Higher is more relevant; the tiers keep
 * results intuitive (an exact / prefix hit always beats a buried substring).
 */
function scoreAction(action: Action, query: string): number {
  const q = query.toLowerCase();
  const haystacks = [action.label, action.keywords]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  let best = 0;
  for (const text of haystacks) {
    if (text === q) {
      best = Math.max(best, 100);
      continue;
    }
    if (text.startsWith(q)) {
      best = Math.max(best, 80);
      continue;
    }
    // Word-boundary prefix: query starts one of the words.
    if (text.split(/\s+/).some((w) => w.startsWith(q))) {
      best = Math.max(best, 60);
      continue;
    }
    const at = text.indexOf(q);
    if (at >= 0) {
      // Substring — closer to the front scores a touch higher.
      best = Math.max(best, 40 - Math.min(at, 20));
      continue;
    }
    if (isSubsequence(q, text)) {
      best = Math.max(best, 20);
    }
  }
  return best;
}

/** Whether every char of `needle` appears in `hay` in order (fuzzy match). */
function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j += 1) {
    if (hay[j] === needle[i]) i += 1;
  }
  return i === needle.length;
}

export const ActionSearchBar = React.forwardRef<HTMLInputElement, ActionSearchBarProps>(
  function ActionSearchBar(
    {
      actions,
      placeholder = 'Search actions...',
      onRun,
      filter,
      emptyHint = 'No matching actions.',
      hint,
      className,
      ...rest
    },
    forwardedRef,
  ) {
    const [query, setQuery] = React.useState('');
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(0);

    const reactId = React.useId();
    const listboxId = `${reactId}-listbox`;
    const optionId = (index: number) => `${reactId}-opt-${index}`;

    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const innerInputRef = React.useRef<HTMLInputElement | null>(null);
    // Bridge the forwarded ref so callers can focus the field while we keep our
    // own handle for internal focus management.
    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerInputRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    /* ----- Rank into a flat option list (stable ordering) ----- */
    const options = React.useMemo<Action[]>(() => {
      const q = query.trim();
      if (!q) {
        // Empty query: show everything in author order.
        return actions;
      }
      const scored = actions
        .map((action, i) => {
          let score: number;
          if (filter) {
            const r = filter(action, q);
            score = typeof r === 'boolean' ? (r ? 1 : 0) : r;
          } else {
            score = scoreAction(action, q);
          }
          return { action, score, i };
        })
        .filter((entry) => entry.score > 0);

      // Sort by score desc, then by original index for a deterministic tie-break.
      scored.sort((a, b) => b.score - a.score || a.i - b.i);
      return scored.map((entry) => entry.action);
    }, [actions, query, filter]);

    /* ----- Flatten into headings + options, preserving group order ----- */
    const rows = React.useMemo<Row[]>(() => {
      const result: Row[] = [];
      const seen = new Set<string>();
      let optionIndex = 0;
      for (const action of options) {
        const group = action.group;
        if (group && !seen.has(group)) {
          seen.add(group);
          result.push({ kind: 'heading', key: `h:${group}`, label: group });
        }
        result.push({
          kind: 'option',
          key: action.id,
          index: optionIndex,
          action,
        });
        optionIndex += 1;
      }
      return result;
    }, [options]);

    const count = options.length;

    // Keep the active index in range whenever the result set changes. Reset to
    // the top so a new query always highlights the best match.
    React.useEffect(() => {
      setActive(0);
    }, [query]);
    React.useEffect(() => {
      if (active > count - 1) setActive(count > 0 ? count - 1 : 0);
    }, [count, active]);

    /* ----- Outside-click + Escape dismissal ----- */
    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    // Scroll the active row into view as the highlight moves via the keyboard.
    React.useEffect(() => {
      if (!open || count === 0) return;
      const el = document.getElementById(optionId(active));
      el?.scrollIntoView({ block: 'nearest' });
      // optionId is stable for the lifetime of the component (closes over reactId).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, open, count]);

    const runAt = React.useCallback(
      (index: number) => {
        const action = options[index];
        if (!action) return;
        action.onRun();
        onRun?.(action);
        setOpen(false);
        setQuery('');
      },
      [options, onRun],
    );

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          if (count > 0) setActive((i) => (i + 1) % count);
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          if (count > 0) setActive((i) => (i - 1 + count) % count);
          break;
        case 'Home':
          if (open && count > 0) {
            event.preventDefault();
            setActive(0);
          }
          break;
        case 'End':
          if (open && count > 0) {
            event.preventDefault();
            setActive(count - 1);
          }
          break;
        case 'Enter':
          if (open && count > 0) {
            event.preventDefault();
            runAt(active);
          }
          break;
        case 'Escape':
          // First Escape closes the panel; a second (panel already closed)
          // clears the query.
          if (open) {
            event.preventDefault();
            setOpen(false);
          } else if (query) {
            event.preventDefault();
            setQuery('');
          }
          break;
        default:
          break;
      }
    };

    const showPanel = open;
    const showEmpty = query.trim().length > 0 && count === 0;

    return (
      <div
        ref={rootRef}
        className={['u-asb', className].filter(Boolean).join(' ')}
        data-open={showPanel || undefined}
        {...rest}
      >
        {/* ARIA 1.2 combobox: the input is the combobox, the panel is its listbox. */}
        <div className="u-asb__field" data-active={showPanel || undefined}>
          <Search className="u-asb__lead" size={16} aria-hidden="true" />
          <input
            ref={setInputRef}
            type="text"
            role="combobox"
            className="u-asb__input"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-expanded={showPanel}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              showPanel && count > 0 ? optionId(active) : undefined
            }
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button
              type="button"
              className="u-asb__clear"
              aria-label="Clear search"
              // Prevent the input losing focus before we clear.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                setActive(0);
                innerInputRef.current?.focus();
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : hint ? (
            <span className="u-asb__hint" aria-hidden="true">
              {hint}
            </span>
          ) : null}
        </div>

        {showPanel ? (
          <div className="u-asb__panel" role="presentation">
            {/* The listbox always exists while open so aria-controls resolves;
                an empty-state note sits beside it (not inside) for a clean a11y tree. */}
            <ul id={listboxId} role="listbox" className="u-asb__list" aria-label="Actions">
              {rows.map((row) =>
                row.kind === 'heading' ? (
                  <li
                    key={row.key}
                    role="presentation"
                    className="u-asb__heading"
                  >
                    {row.label}
                  </li>
                ) : (
                  <li
                    key={row.key}
                    id={optionId(row.index)}
                    role="option"
                    aria-selected={row.index === active}
                    className="u-asb__option"
                    data-active={row.index === active || undefined}
                    // Keep focus in the input; pointerenter just moves the highlight.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(row.index)}
                    onClick={() => runAt(row.index)}
                  >
                    {row.action.icon ? (
                      <span className="u-asb__option-icon" aria-hidden="true">
                        {row.action.icon}
                      </span>
                    ) : (
                      <span className="u-asb__option-icon" aria-hidden="true" />
                    )}
                    <span className="u-asb__option-label">{row.action.label}</span>
                    {row.action.shortcut != null ? (
                      <span className="u-asb__option-shortcut" aria-hidden="true">
                        {row.action.shortcut}
                      </span>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
            {showEmpty ? (
              <p className="u-asb__empty">{emptyHint}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

export default ActionSearchBar;
