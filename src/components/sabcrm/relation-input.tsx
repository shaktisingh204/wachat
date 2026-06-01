'use client';

/**
 * SabCRM — relation input + relation value.
 *
 * The dedicated, searchable editor and the read-only renderer for
 * {@link FieldType} `RELATION` fields. Both are driven entirely off a
 * {@link FieldMetadata} document and a host-supplied list of candidate
 * records ({@link RelationOption} `{ id, label }`), so adding a custom
 * relation never requires touching this file.
 *
 *   - {@link RelationInput}  — controlled editor. MANY_TO_ONE renders a
 *                              single-select searchable picker; ONE_TO_MANY
 *                              renders a multi-select chip picker. The bound
 *                              value is always normalised to a `string[]` of
 *                              related record ids so the runtime sees one
 *                              consistent shape.
 *   - {@link RelationValue}  — read-only display. Shows each related record's
 *                              resolved label as a chip; when an `href`
 *                              resolver is supplied each chip links through to
 *                              the related record's detail route.
 *
 * This component is purposely self-contained (built on confirmed ZoruUI
 * primitives + a local search box) so the field renderer can delegate the
 * whole RELATION case to it without growing further.
 */

import * as React from 'react';
import { Check, ChevronDown, Minus, Search, X } from 'lucide-react';

import {
  Badge,
  Checkbox,
  Input,
  cn,
} from '@/components/zoruui';
import type { FieldMetadata } from '@/lib/sabcrm/types';

/** A related record id paired with its resolved display label. */
export interface RelationOption {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Value coercion — records may store a relation as a string id, an array of
// ids, or (legacy) an empty value. We always normalise to a `string[]`.
// ---------------------------------------------------------------------------

function toIdArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)))
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string' && value) return [value];
  if (typeof value === 'number') return [String(value)];
  return [];
}

function labelFor(options: RelationOption[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

function filterOptions(
  options: RelationOption[],
  query: string,
): RelationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

// ---------------------------------------------------------------------------
// Read-only display
// ---------------------------------------------------------------------------

export interface RelationValueProps {
  field: FieldMetadata;
  value: unknown;
  /**
   * Resolves a related record id to its display label. Falls back to the id
   * when the host hasn't loaded the related record.
   */
  resolveRelationLabel?: (id: string) => string | undefined;
  /**
   * Resolves a related record id to a detail-route href. When supplied each
   * chip links through; otherwise chips render as plain badges.
   */
  resolveRelationHref?: (id: string) => string | undefined;
  /** Compact single-line rendering for dense table cells. */
  dense?: boolean;
  className?: string;
}

/** Read-only display of a RELATION value: resolved labels as linkable chips. */
export function RelationValue({
  field,
  value,
  resolveRelationLabel,
  resolveRelationHref,
  dense = false,
  className,
}: RelationValueProps): React.ReactElement {
  const ids = toIdArray(value);

  if (ids.length === 0) {
    return (
      <span className="text-zoru-ink-muted/60" aria-label="Empty">
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }

  const targetLabel = field.relation?.targetObject ?? 'record';

  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-1',
        dense && 'flex-nowrap overflow-hidden',
        className,
      )}
    >
      {ids.map((id) => {
        const label = resolveRelationLabel?.(id) ?? id;
        const href = resolveRelationHref?.(id);
        const chip = (
          <Badge
            variant="outline"
            className={cn('max-w-[16rem] font-medium', dense && 'truncate')}
          >
            <span className="truncate">{label}</span>
          </Badge>
        );
        if (!href) {
          return (
            <React.Fragment key={id}>{chip}</React.Fragment>
          );
        }
        return (
          <a
            key={id}
            href={href}
            className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink/30"
            aria-label={`Open ${targetLabel}: ${label}`}
            onClick={(e) => e.stopPropagation()}
          >
            {chip}
          </a>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Editable input
// ---------------------------------------------------------------------------

export interface RelationInputProps {
  field: FieldMetadata;
  value: unknown;
  /** Receives the next value as a normalised `string[]` of related ids. */
  onChange: (value: string[]) => void;
  /** Candidate records to pick from (host-supplied `{ id, label }` pairs). */
  options?: RelationOption[];
  /** Marks the field invalid (e.g. required + empty after a submit attempt). */
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /**
   * The `id` of a sibling element that describes validation errors. Forwarded
   * as `aria-describedby` on the trigger button so screen readers announce the
   * error message when the field is in an invalid state.
   */
  errorId?: string;
  className?: string;
}

/**
 * Controlled editor for a RELATION field. The relation kind decides the
 * cardinality: `MANY_TO_ONE` is single-select, `ONE_TO_MANY` is multi-select.
 * Both share one searchable list UI and emit a normalised `string[]`.
 *
 * Keyboard navigation inside the dropdown:
 *   - Arrow Down / Arrow Up  — move focus between options
 *   - Home / End             — jump to first / last option
 *   - Enter / Space          — toggle the focused option
 *   - Escape                 — close the dropdown
 *   - Tab                    — close and leave the widget
 */
export function RelationInput({
  field,
  value,
  onChange,
  options = [],
  invalid = false,
  disabled = false,
  id,
  errorId,
  className,
}: RelationInputProps): React.ReactElement {
  const isMany = field.relation?.kind === 'ONE_TO_MANY';
  const selected = React.useMemo(() => toIdArray(value), [value]);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const listboxId = React.useId();
  const searchId = React.useId();

  const targetNoun = field.relation?.targetObject
    ? field.relation.targetObject.replace(/s$/, '')
    : field.label.toLowerCase();

  // Close the dropdown on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Reset search query and active index whenever the dropdown closes.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [open]);

  // Scroll the focused option into view whenever activeIndex changes.
  React.useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const filtered = React.useMemo(
    () => filterOptions(options, query),
    [options, query],
  );

  const selectSingle = React.useCallback(
    (oid: string) => {
      onChange(selected[0] === oid ? [] : [oid]);
      setOpen(false);
    },
    [onChange, selected],
  );

  const toggleMany = React.useCallback(
    (oid: string) => {
      onChange(
        selected.includes(oid)
          ? selected.filter((s) => s !== oid)
          : [...selected, oid],
      );
    },
    [onChange, selected],
  );

  const removeOne = React.useCallback(
    (oid: string) => {
      onChange(selected.filter((s) => s !== oid));
    },
    [onChange, selected],
  );

  /** Handles keyboard navigation inside the search input. */
  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            const opt = filtered[activeIndex];
            isMany ? toggleMany(opt.id) : selectSingle(opt.id);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) =>
            filtered.length === 0 ? -1 : Math.min(i + 1, filtered.length - 1),
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(filtered.length > 0 ? 0 : -1);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1);
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'Tab':
          setOpen(false);
          break;
        default:
          // Reset active index when the query changes so the first match
          // is highlighted automatically.
          if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
            setActiveIndex(0);
          }
          break;
      }
    },
    [activeIndex, filtered, isMany, toggleMany, selectSingle],
  );

  // Reset active index when the filtered list changes.
  React.useEffect(() => {
    setActiveIndex((i) => (i >= filtered.length ? filtered.length - 1 : i));
  }, [filtered.length]);

  const invalidRing = invalid
    ? 'border-zoru-danger focus-within:ring-zoru-danger/30'
    : 'border-zoru-line';

  const activeOptionId =
    activeIndex >= 0 && activeIndex < filtered.length
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  // -------------------------------------------------------------------------
  // Trigger summary (collapsed state)
  // -------------------------------------------------------------------------
  const triggerLabel = (() => {
    if (selected.length === 0) {
      return (
        <span className="text-zoru-ink-muted">
          {isMany
            ? `Select ${field.label.toLowerCase()}`
            : `Select a ${targetNoun}`}
        </span>
      );
    }
    if (isMany) {
      return (
        <span className="flex flex-wrap gap-1">
          {selected.map((sid) => (
            <Badge
              key={sid}
              variant="outline"
              className="max-w-[12rem] font-medium"
            >
              <span className="truncate">{labelFor(options, sid)}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${labelFor(options, sid)}`}
                  className="-mr-0.5 ml-0.5 rounded-full p-0.5 text-zoru-ink-muted hover:text-zoru-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOne(sid);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </span>
      );
    }
    return (
      <span className="truncate text-zoru-ink">
        {labelFor(options, selected[0])}
      </span>
    );
  })();

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-describedby={errorId}
        aria-label={id ? undefined : field.label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border bg-zoru-bg px-3 py-1.5 text-left text-sm transition-colors',
          'focus-within:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink/30',
          invalidRing,
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="min-w-0 flex-1">{triggerLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-zoru-ink-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow,0_8px_24px_rgba(0,0,0,0.12))]">
          <div className="border-b border-zoru-line p-1.5">
            <Input
              id={searchId}
              autoFocus
              aria-label={`Search ${field.label}`}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              placeholder={`Search ${field.label.toLowerCase()}…`}
              leadingSlot={<Search aria-hidden="true" />}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          <div
            id={listboxId}
            ref={listRef}
            role="listbox"
            aria-label={field.label}
            aria-multiselectable={isMany}
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-zoru-ink-muted" role="status">
                {options.length === 0
                  ? 'No related records available.'
                  : 'No matches.'}
              </p>
            )}

            {filtered.map((opt, idx) => {
              const on = selected.includes(opt.id);
              const isActive = idx === activeIndex;
              const optId = `${listboxId}-opt-${idx}`;
              return (
                <button
                  key={opt.id}
                  id={optId}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-option-index={idx}
                  onClick={() =>
                    isMany ? toggleMany(opt.id) : selectSingle(opt.id)
                  }
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-zoru-surface',
                    on && 'bg-zoru-surface/60',
                    isActive && 'ring-1 ring-inset ring-zoru-ink/20',
                  )}
                >
                  {isMany ? (
                    <Checkbox
                      checked={on}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                  ) : (
                    <Check
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 shrink-0',
                        on ? 'text-zoru-ink' : 'text-transparent',
                      )}
                    />
                  )}
                  <span className="truncate text-zoru-ink">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {isMany && selected.length > 0 && (
            <div className="flex items-center justify-between border-t border-zoru-line px-2 py-1.5 text-xs text-zoru-ink-muted">
              <span aria-live="polite">
                {selected.length} selected
              </span>
              <button
                type="button"
                className="font-medium text-zoru-ink hover:underline"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
