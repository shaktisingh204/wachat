'use client';

/**
 * 20ui — TagPicker.
 *
 * Multi-select tags with inline create, a per-tag colour dot, and a read-only
 * mode. The trigger shows the current selection as removable, colour-tinted
 * chips; clicking it opens a Popover (composed from `./popover`) with a search
 * box and an ARIA `listbox` of options. Each option carries a checkmark + colour
 * dot; when `onCreate` is set and the query matches nothing, a "Create '<query>'"
 * row appears at the foot of the list.
 *
 * Built to the four standing skills:
 *  · emil-design-eng — transform/opacity-only motion, scale-on-press chips,
 *    < 250ms, with a prefers-reduced-motion block (see tagpicker.css + the
 *    Popover's own entrance).
 *  · fixing-accessibility — native <button>/<input>; a real listbox/option
 *    model with `aria-activedescendant`, `aria-selected`, `aria-multiselectable`;
 *    icon-only remove buttons get aria-label; the colour dot is aria-hidden;
 *    visible focus ring; Escape/outside-click handled by the Popover.
 *  · design-taste-frontend — one accent, one radius, calm surface; demo strings
 *    live only in comments; zero em-dashes in visible UI text.
 *  · systematic-debugging — active index is clamped against the live filtered
 *    list every render (no stale closures); the listbox ref scrolls the active
 *    row into view via an effect that re-runs on the active id, not a timer.
 *
 *   const TAGS = [
 *     { id: 'vip',    label: 'VIP',       color: '#f43f5e' },
 *     { id: 'warm',   label: 'Warm lead', color: '#f97316' },
 *     { id: 'churn',  label: 'At risk',   color: '#8b5cf6' },
 *   ];
 *   <TagPicker
 *     options={TAGS}
 *     value={selected}
 *     onChange={(ids) => setSelected(ids)}
 *     onCreate={(label) => createTag(label)}
 *     placeholder="Add tags"
 *   />
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';

import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Spinner } from './loading';
import './tagpicker.css';

/** A selectable tag: a stable id, a human label, and a concrete colour. */
export interface TagOption {
  id: string;
  label: string;
  /** Any CSS colour (hex/rgb/var). Drives the dot + chip tint. */
  color?: string;
}

/** `value` may be passed as bare ids or as full tag objects; both normalise. */
export type TagValue = string | TagOption;

export interface TagPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** All selectable tags, e.g. the current workspace's tag library. */
  options: TagOption[];
  /** Selected tags as ids or objects. */
  value?: TagValue[];
  /**
   * Fires on every selection change with the next id list AND the resolved
   * tag objects (handy when the caller stores whole tags, not just ids).
   */
  onChange?: (ids: string[], tags: TagOption[]) => void;
  /**
   * Persist a brand-new tag from the typed label. Return (or resolve to) the
   * created tag to have it appended + auto-selected; return nothing/`null` to
   * abort. May be sync or async. Omit to hide the "Create" row entirely.
   */
  onCreate?: (label: string) => TagOption | null | undefined | Promise<TagOption | null | undefined>;
  /** Hide create + the remove affordances (display-only multi-select). */
  readOnly?: boolean;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Empty-trigger hint. No em-dashes in visible UI text. */
  placeholder?: string;
  /** Search-box hint inside the popover. */
  searchPlaceholder?: string;
  /** Accessible name for the trigger (defaults to the placeholder). */
  'aria-label'?: string;
}

const DEFAULT_DOT = 'var(--st-text-tertiary)';

/** Resolve mixed id|object selection to a clean id list. */
function toIds(value: TagValue[]): string[] {
  const out: string[] = [];
  for (const v of value) {
    const id = typeof v === 'string' ? v : v?.id;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

let pickerSeq = 0;

export const TagPicker = React.forwardRef<HTMLDivElement, TagPickerProps>(function TagPicker(
  {
    options,
    value = [],
    onChange,
    onCreate,
    readOnly = false,
    disabled = false,
    placeholder = 'Add tags',
    searchPlaceholder = 'Search tags',
    className,
    id,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  const listRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  // Track the latest in-flight create so a stale resolution can't re-add a tag
  // after the popover state has moved on.
  const createToken = React.useRef(0);

  // Stable ids for ARIA wiring (one instance per mounted picker).
  const uid = React.useRef<string>('');
  if (!uid.current) uid.current = `u-tagpicker-${++pickerSeq}`;
  const listboxId = `${uid.current}-listbox`;
  const baseId = id ?? uid.current;

  const selectedIds = React.useMemo(() => toIds(value), [value]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const byId = React.useMemo(() => {
    const m = new Map<string, TagOption>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  // Selected chips, in the caller's selection order. Unknown ids are skipped so
  // a removed/renamed tag can't crash the trigger.
  const selectedTags = React.useMemo(
    () => selectedIds.map((tid) => byId.get(tid)).filter((t): t is TagOption => Boolean(t)),
    [selectedIds, byId],
  );

  const q = query.trim();
  const qLower = q.toLowerCase();

  const filtered = React.useMemo(() => {
    if (!qLower) return options;
    return options.filter((o) => o.label.toLowerCase().includes(qLower));
  }, [options, qLower]);

  // Show "Create" only when typing something with no exact (case-insensitive)
  // label match and a create handler is wired in non-read-only mode.
  const exactMatch = React.useMemo(
    () => options.some((o) => o.label.trim().toLowerCase() === qLower),
    [options, qLower],
  );
  const canCreate = !readOnly && !!onCreate && q.length > 0 && !exactMatch;

  // The flat keyboard list = filtered options, then the optional create row.
  const rowCount = filtered.length + (canCreate ? 1 : 0);
  const createIndex = canCreate ? filtered.length : -1;

  // Clamp the active index against the live row count every render so it never
  // points past the end after the query narrows the list (off-by-one guard).
  const safeActive = rowCount === 0 ? -1 : Math.min(activeIndex, rowCount - 1);
  const activeId = safeActive < 0 ? undefined : `${uid.current}-opt-${safeActive}`;

  // Reset transient state whenever the popover closes.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  // When the active row changes via the keyboard, keep it in view. Runs on the
  // active index (not a timer), so there is nothing to clean up.
  React.useEffect(() => {
    if (!open || safeActive < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${safeActive}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, safeActive]);

  const emit = React.useCallback(
    (nextIds: string[]) => {
      const tags = nextIds.map((tid) => byId.get(tid)).filter((t): t is TagOption => Boolean(t));
      onChange?.(nextIds, tags);
    },
    [byId, onChange],
  );

  const toggle = React.useCallback(
    (tid: string) => {
      const next = selectedSet.has(tid)
        ? selectedIds.filter((x) => x !== tid)
        : [...selectedIds, tid];
      emit(next);
    },
    [selectedSet, selectedIds, emit],
  );

  const remove = React.useCallback(
    (tid: string) => {
      if (!selectedSet.has(tid)) return;
      emit(selectedIds.filter((x) => x !== tid));
    },
    [selectedSet, selectedIds, emit],
  );

  const runCreate = React.useCallback(async () => {
    if (!onCreate || !q || creating) return;
    const token = ++createToken.current;
    setCreating(true);
    try {
      const created = await onCreate(q);
      // Ignore if a newer create started or the picker closed meanwhile.
      if (token !== createToken.current) return;
      if (created && created.id) {
        if (!selectedSet.has(created.id)) emit([...selectedIds, created.id]);
        setQuery('');
        setActiveIndex(0);
        // Keep the search focused so the user can keep adding tags.
        searchRef.current?.focus();
      }
    } finally {
      if (token === createToken.current) setCreating(false);
    }
  }, [onCreate, q, creating, selectedSet, selectedIds, emit]);

  const activateRow = React.useCallback(
    (index: number) => {
      if (index < 0) return;
      if (index === createIndex) {
        void runCreate();
        return;
      }
      const opt = filtered[index];
      if (opt) toggle(opt.id);
    },
    [createIndex, runCreate, filtered, toggle],
  );

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (rowCount > 0) setActiveIndex((i) => (i + 1) % rowCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowCount > 0) setActiveIndex((i) => (i - 1 + rowCount) % rowCount);
        break;
      case 'Home':
        if (rowCount > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (rowCount > 0) {
          e.preventDefault();
          setActiveIndex(rowCount - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        activateRow(safeActive);
        break;
      case 'Backspace':
        // Empty search + Backspace pops the last chip (Gmail-style).
        if (q.length === 0 && selectedIds.length > 0 && !readOnly) {
          e.preventDefault();
          remove(selectedIds[selectedIds.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  const triggerLabel = ariaLabel ?? placeholder;
  const isEmpty = selectedTags.length === 0;

  const triggerClass = [
    'u-tagpicker__trigger',
    isEmpty && 'is-empty',
    open && 'is-open',
    readOnly && 'is-readonly',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  /* ---------------------------------------------------------------- chips */

  const chips = (
    <span className="u-tagpicker__chips">
      {isEmpty ? (
        <span className="u-tagpicker__placeholder">{placeholder}</span>
      ) : (
        selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="u-tagpicker__chip"
            style={{ ['--u-chip-color' as string]: tag.color ?? DEFAULT_DOT }}
          >
            <span className="u-tagpicker__chip-dot" aria-hidden="true" />
            <span className="u-tagpicker__chip-label">{tag.label}</span>
            {!readOnly && !disabled ? (
              <button
                type="button"
                className="u-tagpicker__chip-remove"
                aria-label={`Remove ${tag.label}`}
                // Stop the click from re-opening / toggling the trigger.
                onClick={(e) => {
                  e.stopPropagation();
                  remove(tag.id);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <X size={11} aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))
      )}
    </span>
  );

  // Read-only: a plain, non-interactive chip row (no popover, no triggers).
  if (readOnly) {
    return (
      <div
        ref={ref}
        id={baseId}
        className={['u-tagpicker', 'u-tagpicker--readonly', className].filter(Boolean).join(' ')}
        {...rest}
      >
        <div className="u-tagpicker__trigger is-readonly">{chips}</div>
      </div>
    );
  }

  /* ------------------------------------------------------------- editable */

  return (
    <div
      ref={ref}
      id={baseId}
      className={['u-tagpicker', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={triggerClass}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={triggerLabel}
          >
            {chips}
            <ChevronsUpDown
              size={14}
              className="u-tagpicker__caret"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="u-tagpicker__panel"
          // Focus the search box on open; Radix restores focus to the trigger
          // on close. Prevent the default auto-focus jump to the first option.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
        >
          <div className="u-tagpicker__search">
            <Search size={14} className="u-tagpicker__search-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              className="u-tagpicker__search-input"
              value={query}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
            />
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={triggerLabel}
            className="u-tagpicker__list"
          >
            {filtered.length === 0 && !canCreate ? (
              <p className="u-tagpicker__empty">
                {q ? `No tags match "${q}"` : 'No tags yet'}
              </p>
            ) : null}

            {filtered.map((opt, index) => {
              const isSelected = selectedSet.has(opt.id);
              const isActive = index === safeActive;
              return (
                <div
                  key={opt.id}
                  id={`${uid.current}-opt-${index}`}
                  data-row-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    'u-tagpicker__option',
                    isActive && 'is-active',
                    isSelected && 'is-selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  // Pointer move (not enter) keeps the active row tracking the
                  // cursor without fighting keyboard navigation on first paint.
                  onPointerMove={() => {
                    if (safeActive !== index) setActiveIndex(index);
                  }}
                  onClick={() => toggle(opt.id)}
                >
                  <span className="u-tagpicker__check" aria-hidden="true">
                    {isSelected ? <Check size={14} /> : null}
                  </span>
                  <span
                    className="u-tagpicker__dot"
                    style={{ background: opt.color ?? DEFAULT_DOT }}
                    aria-hidden="true"
                  />
                  <span className="u-tagpicker__option-label">{opt.label}</span>
                </div>
              );
            })}

            {canCreate ? (
              <div
                id={`${uid.current}-opt-${createIndex}`}
                data-row-index={createIndex}
                role="option"
                aria-selected={false}
                className={[
                  'u-tagpicker__option',
                  'u-tagpicker__create',
                  safeActive === createIndex && 'is-active',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerMove={() => {
                  if (safeActive !== createIndex) setActiveIndex(createIndex);
                }}
                onClick={() => void runCreate()}
              >
                <span className="u-tagpicker__check" aria-hidden="true">
                  {creating ? <Spinner size={14} label="Creating tag" /> : <Plus size={14} />}
                </span>
                <span className="u-tagpicker__create-label">
                  Create <strong>&ldquo;{q}&rdquo;</strong>
                </span>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

export default TagPicker;
