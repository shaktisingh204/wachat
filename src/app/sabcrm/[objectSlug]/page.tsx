'use client';

/**
 * SabCRM — Twenty-faithful record INDEX (`/sabcrm/[objectSlug]`).
 *
 * One metadata-driven screen renders every object in Twenty's visual language
 * (the `.st-*` utility classes + the `@/components/sabcrm/twenty` kit — NO
 * ZoruUI here on purpose). It resolves the object's metadata, then exposes:
 *
 *   - TABLE view — every `inTable` field is a column; the `isLabel` field links
 *     to the record detail; SELECT cells render as TwentyChips; text/number/
 *     select cells are inline-editable (optimistic, persisted via the Rust
 *     engine through `updateSabcrmRecordTw`).
 *   - BOARD view — kanban columns from `groupSabcrmRecordsTw`, offered only when
 *     the object declares `board.groupByField`.
 *   - Debounced free-text search (server-side `q`).
 *   - A Twenty-style "New" dialog with the object's required + inTable fields.
 *
 * Every data call is a gated server action returning an `ActionResult`; the
 * Rust engine may be DOWN, so the error branch renders an inline banner and the
 * page degrades to empty/error states — it never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  AlertTriangle,
  Database,
  Loader2,
  Star,
  X,
  Check,
  Tag as TagIcon,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import '@/components/sabcrm/twenty/twenty-activity.css';
import './bulk-bar.css';
import './kanban-dnd.css';
import './record-tags.css';
import {
  SabcrmViewBar,
  EMPTY_VIEW_STATE,
  viewStateToEngineFilters,
  countConditions,
  type ViewState,
} from './view-bar';
import { SabcrmBulkBar } from './bulk-bar';
import { SabcrmPagination } from './pagination';
import './pagination.css';
import './column-reorder.css';
import './table-extras.css';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
  groupSabcrmRecordsTw,
  aggregateSabcrmRecordsTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
} from '@/app/actions/sabcrm-twenty.actions';
import {
  bulkDeleteRecordsTw,
  bulkUpdateRecordsTw,
} from '@/app/actions/sabcrm-bulk.actions';
import { listTagsTw } from '@/app/actions/sabcrm-tags.actions';
import type { SabcrmRustTag } from '@/app/actions/sabcrm-tags.actions.types';
import type {
  SabcrmRustRecord,
  SabcrmRecordTwGroup,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default page size — must be one of {@link PAGE_SIZE_OPTIONS}. */
const PAGE_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

/** Column-resize clamps (px) — keep columns grabbable but never collapsed. */
const COL_MIN_WIDTH = 80;
const COL_MAX_WIDTH = 640;

/**
 * Column types a header click may sort by. Mirrors the view bar's
 * `queryableFields` rule (relations + files are not sortable server-side), so
 * header sorting and the Sort popover always agree on what's clickable.
 */
const SORTABLE_HEADER: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>([
  'TEXT',
  'EMAIL',
  'PHONE',
  'LINK',
  'NUMBER',
  'CURRENCY',
  'RATING',
  'SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
]);

type ViewKind = 'table' | 'board';

/** Field types that support quick inline editing in a table cell. */
const INLINE_EDITABLE: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'NUMBER', 'CURRENCY', 'RATING', 'SELECT']);

/** Field types we can run numeric sum/avg over for group-by aggregations. */
const NUMERIC_FIELD: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['NUMBER', 'CURRENCY', 'RATING']);

/**
 * One per-group aggregation bucket returned by `aggregateSabcrmRecordsTw`.
 * The action is added in parallel; this is the shape the table footer/header
 * stats are coded against. Extra fields the action may include are ignored.
 */
interface SabcrmAggregateBucket {
  /** SELECT option value for the bucket, or `null` for the ungrouped one. */
  value: string | null;
  count: number;
  /** Present only when a numeric `metricField` was supplied. */
  sum?: number | null;
  avg?: number | null;
}

/** Result envelope of `aggregateSabcrmRecordsTw`. */
interface SabcrmAggregateResult {
  buckets: SabcrmAggregateBucket[];
  /** Grand totals across all buckets (count + optional numeric roll-ups). */
  total: { count: number; sum?: number | null; avg?: number | null };
}

/** Aggregation metric the page can request. */
type AggregateMetric = 'count' | 'sum' | 'avg';

/** Format a numeric stat value compactly (tabular, no trailing noise). */
function fmtStat(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

/** Resolve a record's display label from the object's `isLabel` field. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
}

/** A SELECT option color token → an inline CSS color (best-effort). */
function chipColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  // `--zoru-*` token → CSS var reference; falls back gracefully if undefined.
  if (color.startsWith('--')) return `var(${color})`;
  return undefined;
}

/** Coerce an input string back into the field's stored value type. */
function coerceInput(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Record tags (per-record labels stored on `data.__tags`: string[] of tag ids)
// ---------------------------------------------------------------------------

/** The reserved record-data key the applied tag-id list lives under. */
const TAGS_KEY = '__tags';

/** Read a record's applied tag ids (defensive against bad/legacy shapes). */
function recordTagIds(record: SabcrmRustRecord): string[] {
  const raw = record.data[TAGS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

interface TagPickerCellProps {
  /** All workspace tag definitions ({ id, name, color }). */
  tags: SabcrmRustTag[];
  /** Tag ids currently applied to this record. */
  appliedIds: string[];
  /** Toggle one tag id on/off for this record (page persists optimistically). */
  onToggle: (tagId: string, next: boolean) => void;
  /** Loading flag — disables the "+" while the tag list is still resolving. */
  tagsLoading: boolean;
}

/**
 * One table cell rendering a record's applied tags as colored chips plus a "+"
 * that opens a checklist popover toggling every workspace tag on the record.
 * Self-contained (open/close + outside-click); the actual persistence lives in
 * the page so it can be optimistic with rollback.
 */
function TagPickerCell({ tags, appliedIds, onToggle, tagsLoading }: TagPickerCellProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const tagById = React.useMemo(
    () => new Map(tags.map((t) => [t.id, t] as const)),
    [tags],
  );
  const appliedSet = React.useMemo(() => new Set(appliedIds), [appliedIds]);

  // Only render chips for ids that still resolve to a live tag definition.
  const appliedTags = React.useMemo(
    () =>
      appliedIds
        .map((id) => tagById.get(id))
        .filter((t): t is SabcrmRustTag => !!t),
    [appliedIds, tagById],
  );

  // Close on outside click / Escape while the popover is open.
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasTags = appliedTags.length > 0;

  return (
    <span
      className="stg-cell"
      // The cell's click affordances must never bubble into row selection /
      // keyboard-cursor parking or the link navigation.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {appliedTags.map((t) => (
        <span
          className="stg-chip"
          key={t.id}
          title={t.name}
          style={t.color ? { borderColor: 'transparent' } : undefined}
        >
          <span
            className="stg-chip__dot"
            style={chipColor(t.color) ? { background: chipColor(t.color) } : undefined}
            aria-hidden="true"
          />
          <span className="stg-chip__label">{t.name}</span>
          <button
            type="button"
            className="stg-chip__x"
            aria-label={`Remove tag ${t.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(t.id, false);
            }}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <span className="stg-anchor" ref={ref}>
        <button
          type="button"
          className={`stg-add${hasTags ? '' : ' stg-add--empty'}${open ? ' is-open' : ''}`}
          aria-label="Add tag"
          aria-haspopup="true"
          aria-expanded={open}
          disabled={tagsLoading}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <Plus size={12} />
        </button>

        {open && (
          <div className="stg-pop stg-pop--right" role="menu" aria-label="Toggle tags">
            <p className="stg-pop__title">Tags</p>
            {tags.length === 0 ? (
              <div className="stg-pop__empty">No tags defined yet.</div>
            ) : (
              <div className="stg-pop__list">
                {tags.map((t) => {
                  const applied = appliedSet.has(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      role="menuitemcheckbox"
                      aria-checked={applied}
                      className={`stg-opt${applied ? ' is-applied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(t.id, !applied);
                      }}
                    >
                      <span className="stg-opt__check" aria-hidden="true">
                        {applied ? <Check size={13} /> : null}
                      </span>
                      <span
                        className="stg-opt__dot"
                        style={
                          chipColor(t.color)
                            ? { background: chipColor(t.color) }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                      <span className="stg-opt__label">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </span>
    </span>
  );
}

interface TagFilterControlProps {
  tags: SabcrmRustTag[];
  /** Currently-selected filter tag id, or `null` for "all rows". */
  value: string | null;
  onChange: (tagId: string | null) => void;
}

/** Toolbar "Tag" filter — pick one tag to narrow the table to rows carrying it. */
function TagFilterControl({ tags, value, onChange }: TagFilterControlProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = tags.find((t) => t.id === value) ?? null;

  return (
    <div className="stg-filter" ref={ref}>
      <button
        type="button"
        className={`stg-filter__btn${open ? ' is-open' : ''}${
          active ? ' is-active' : ''
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Filter by tag"
      >
        {active && chipColor(active.color) ? (
          <span
            className="stg-filter__dot"
            style={{ background: chipColor(active.color) }}
            aria-hidden="true"
          />
        ) : (
          <TagIcon size={14} aria-hidden="true" />
        )}
        {active ? active.name : 'Tag'}
      </button>

      {open && (
        <div className="stg-filter__pop" role="menu" aria-label="Filter by tag">
          <p className="stg-pop__title">Filter by tag</p>
          {tags.length === 0 ? (
            <div className="stg-pop__empty">No tags defined yet.</div>
          ) : (
            <div className="stg-pop__list">
              {tags.map((t) => {
                const isSel = t.id === value;
                return (
                  <button
                    type="button"
                    key={t.id}
                    role="menuitemradio"
                    aria-checked={isSel}
                    className={`stg-opt${isSel ? ' is-applied' : ''}`}
                    onClick={() => {
                      onChange(isSel ? null : t.id);
                      setOpen(false);
                    }}
                  >
                    <span className="stg-opt__check" aria-hidden="true">
                      {isSel ? <Check size={13} /> : null}
                    </span>
                    <span
                      className="stg-opt__dot"
                      style={
                        chipColor(t.color) ? { background: chipColor(t.color) } : undefined
                      }
                      aria-hidden="true"
                    />
                    <span className="stg-opt__label">{t.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {value && (
            <div className="stg-pop__row stg-filter__clear">
              <TwentyButton variant="secondary" onClick={() => { onChange(null); setOpen(false); }}>
                Clear tag filter
              </TwentyButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable table cell
// ---------------------------------------------------------------------------

interface EditableCellProps {
  field: FieldMetadata;
  value: unknown;
  onCommit: (value: unknown) => void;
}

function EditableCell({ field, value, onCommit }: EditableCellProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const beginEdit = React.useCallback(() => {
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  }, [value]);

  const commit = React.useCallback(
    (next: string) => {
      setEditing(false);
      const coerced = coerceInput(field, next);
      if (coerced !== value) onCommit(coerced);
    },
    [field, value, onCommit],
  );

  if (!editing) {
    return (
      <span
        className="st-cell-editable"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          beginEdit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            beginEdit();
          }
        }}
      >
        <TwentyFieldValue field={field} value={value} />
      </span>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <select
        className="st-cell-select"
        autoFocus
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => commit(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="st-cell-input"
      autoFocus
      type={
        field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING'
          ? 'number'
          : 'text'
      }
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Aggregation stat pills (group header + footer total)
// ---------------------------------------------------------------------------

interface StatPillsProps {
  count: number;
  sum?: number | null;
  avg?: number | null;
  /** Label of the numeric field the sum/avg run over (omitted when none). */
  metricLabel?: string;
  loading?: boolean;
}

/** Render count + (optional numeric) sum/avg as a row of Twenty-style pills. */
function StatPills({ count, sum, avg, metricLabel, loading }: StatPillsProps) {
  return (
    <span className="stx-stats">
      <span className={`stx-stat${loading ? ' stx-stat--loading' : ''}`}>
        <span className="stx-stat__k">Count</span>
        <span className="stx-stat__v">{loading ? '…' : fmtStat(count)}</span>
      </span>
      {metricLabel && sum !== undefined && sum !== null && (
        <span className={`stx-stat${loading ? ' stx-stat--loading' : ''}`}>
          <span className="stx-stat__k">{`Sum ${metricLabel}`}</span>
          <span className="stx-stat__v">{loading ? '…' : fmtStat(sum)}</span>
        </span>
      )}
      {metricLabel && avg !== undefined && avg !== null && (
        <span className={`stx-stat${loading ? ' stx-stat--loading' : ''}`}>
          <span className="stx-stat__k">{`Avg ${metricLabel}`}</span>
          <span className="stx-stat__v">{loading ? '…' : fmtStat(avg)}</span>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

interface TableViewProps {
  object: ObjectMetadata;
  columns: FieldMetadata[];
  labelField: FieldMetadata | undefined;
  records: SabcrmRustRecord[];
  onEdit: (recordId: string, key: string, value: unknown) => void;
  favorites: ReadonlySet<string>;
  favBusy: ReadonlySet<string>;
  onToggleFavorite: (recordId: string) => void;
  selected: ReadonlySet<string>;
  onToggleSelect: (recordId: string) => void;
  onToggleSelectAll: () => void;
  /** Active sort field key, or `null` when unsorted (shared with the view bar). */
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  /** Cycle a column's sort: asc → desc → clear. */
  onSortColumn: (key: string) => void;
  /**
   * Reorder: move the dragged column so it lands immediately before
   * `targetKey` (or at the end when `targetKey` is `null`). The page owns the
   * order array; this just reports the intent.
   */
  onReorderColumn: (sourceKey: string, targetKey: string | null) => void;
  /** Per-column explicit widths (px), keyed by field key. Empty = auto. */
  columnWidths: Readonly<Record<string, number>>;
  /** Commit a resized column width (px, already clamped by the handle). */
  onResizeColumn: (key: string, width: number) => void;

  // ---- Keyboard navigation (owned by the page) ---------------------------
  /** Index of the keyboard-highlighted row, or `null` when none is active. */
  activeRow: number | null;
  /** Focusable wrapper ref + key handler the page binds for ↑/↓/j/k/Enter/x. */
  tableRef: React.RefObject<HTMLDivElement | null>;
  onTableKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Set the active row (e.g. clicking a row body parks the cursor on it). */
  onSetActiveRow: (index: number | null) => void;

  // ---- Group-by aggregations (owned by the page) -------------------------
  /** The active group-by field, or `undefined` for a flat table. */
  groupField?: FieldMetadata;
  /** Numeric field the sum/avg metric runs over, if any. */
  metricField?: FieldMetadata;
  /** Per-group + total aggregates; `null` while loading / unavailable. */
  aggregate: SabcrmAggregateResult | null;
  aggregateLoading: boolean;

  // ---- Record tags (owned by the page) -----------------------------------
  /** Workspace tag definitions ({ id, name, color }) for the picker. */
  tags: SabcrmRustTag[];
  /** Still resolving the tag list — disables the per-row "+". */
  tagsLoading: boolean;
  /** Toggle a tag id on/off for a record (page persists optimistically). */
  onToggleTag: (recordId: string, tagId: string, next: boolean) => void;
}

/** Where a drag currently wants to drop, relative to a hovered header. */
interface ColDropTarget {
  key: string;
  edge: 'before' | 'after';
}

function TableView({
  object,
  columns,
  labelField,
  records,
  onEdit,
  favorites,
  favBusy,
  onToggleFavorite,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  sortBy,
  sortDir,
  onSortColumn,
  onReorderColumn,
  columnWidths,
  onResizeColumn,
  activeRow,
  tableRef,
  onTableKeyDown,
  onSetActiveRow,
  groupField,
  metricField,
  aggregate,
  aggregateLoading,
  tags,
  tagsLoading,
  onToggleTag,
}: TableViewProps) {
  const allSelected = records.length > 0 && records.every((r) => selected.has(r.id));
  const someSelected = records.some((r) => selected.has(r.id));

  // Total span of every data column (used by full-width group / footer cells:
  // the selection + favorite + tags leading columns plus one per visible
  // column). Keep in sync with the leading <th>/<td> count below.
  const colSpan = columns.length + 3;

  // When a group-by field is active we render an inline stat band before the
  // first row of each new group value. Resolve a label for each group value.
  const groupLabelFor = React.useCallback(
    (value: unknown): string => {
      if (!groupField) return '';
      if (value === null || value === undefined || value === '') return 'Ungrouped';
      const opt = groupField.options?.find((o) => o.value === String(value));
      return opt?.label ?? String(value);
    },
    [groupField],
  );

  // Map a group value → its aggregate bucket (count/sum/avg) for the header.
  const bucketFor = React.useCallback(
    (value: unknown): SabcrmAggregateBucket | undefined => {
      if (!aggregate) return undefined;
      const v = value === undefined || value === '' ? null : value;
      return aggregate.buckets.find(
        (b) => (b.value ?? null) === (v === null ? null : String(v)),
      );
    },
    [aggregate],
  );

  // The header column currently being dragged, and where it would drop. React
  // state is the real channel; `dataTransfer` carries a plain-text fallback.
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<ColDropTarget | null>(null);

  // Live column-resize gesture (pointer-driven). `null` when not resizing.
  const [resizing, setResizing] = React.useState<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // The label/first column stays pinned — it carries the record link and must
  // not be dragged out of the leading slot (Twenty keeps it fixed too).
  const pinnedKey = labelField
    ? labelField.key
    : columns.length > 0
      ? columns[0].key
      : null;

  const endDrag = React.useCallback(() => {
    setDragKey(null);
    setDropTarget(null);
  }, []);

  const handleColDrop = React.useCallback(() => {
    if (!dragKey || !dropTarget) return endDrag();
    if (dragKey !== dropTarget.key) {
      // Resolve "after the hovered column" to "before the next column" so the
      // page only ever reasons about an insert-before target (null = append).
      const idx = columns.findIndex((c) => c.key === dropTarget.key);
      const targetKey =
        dropTarget.edge === 'before'
          ? dropTarget.key
          : (columns[idx + 1]?.key ?? null);
      if (targetKey !== dragKey) onReorderColumn(dragKey, targetKey);
    }
    endDrag();
  }, [dragKey, dropTarget, columns, onReorderColumn, endDrag]);

  // ---- Column resize (native pointer drag) --------------------------------
  // Bind move/up listeners on the window while a handle is held so the gesture
  // survives the pointer leaving the thin handle strip.
  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(
        COL_MIN_WIDTH,
        Math.min(COL_MAX_WIDTH, Math.round(resizing.startWidth + delta)),
      );
      onResizeColumn(resizing.key, next);
    };
    const onUp = () => setResizing(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [resizing, onResizeColumn]);

  const beginResize = React.useCallback(
    (e: React.PointerEvent, col: FieldMetadata) => {
      e.preventDefault();
      e.stopPropagation();
      const th = (e.currentTarget as HTMLElement).closest('th');
      const startWidth =
        columnWidths[col.key] ?? th?.getBoundingClientRect().width ?? COL_MIN_WIDTH;
      setResizing({ key: col.key, startX: e.clientX, startWidth: Math.round(startWidth) });
    },
    [columnWidths],
  );

  const hasWidths = Object.keys(columnWidths).length > 0;

  return (
    <div
      ref={tableRef}
      className={`st-table-wrap stx-table-focus${resizing ? ' is-col-resizing' : ''}`}
      tabIndex={0}
      role="grid"
      aria-label="Records — use arrow keys to navigate, Enter to open"
      aria-rowcount={records.length}
      onKeyDown={onTableKeyDown}
    >
      <table className={`st-table${hasWidths ? ' st-table--fixed' : ''}`}>
        {hasWidths && (
          <colgroup>
            {/* selection + favorite + tags columns keep their fixed widths */}
            <col style={{ width: 36 }} />
            <col style={{ width: 32 }} />
            <col style={{ width: 160 }} />
            {columns.map((col) => (
              <col
                key={col.key}
                style={
                  columnWidths[col.key]
                    ? { width: columnWidths[col.key] }
                    : undefined
                }
              />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            <th className="st-checkbox-cell">
              <input
                type="checkbox"
                className="st-checkbox"
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={onToggleSelectAll}
              />
            </th>
            <th aria-label="Favorite" style={{ width: 32 }} />
            <th className="stg-th" style={{ width: 160 }}>
              Tags
            </th>
            {columns.map((col) => {
              const sortable = SORTABLE_HEADER.has(col.type);
              const active = sortBy === col.key;
              const pinned = col.key === pinnedKey;
              const draggable = !pinned && !resizing;

              const isDragging = dragKey === col.key;
              const isDropBefore =
                dropTarget?.key === col.key && dropTarget.edge === 'before';
              const isDropAfter =
                dropTarget?.key === col.key && dropTarget.edge === 'after';

              const thClass = [
                'st-th-drag',
                isDragging ? 'is-dragging' : '',
                isDropBefore ? 'is-drop-before' : '',
                isDropAfter ? 'is-drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ');

              // Decide the drop edge from the pointer position within the th:
              // left half → drop before this column, right half → after it.
              const computeEdge = (e: React.DragEvent): 'before' | 'after' => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                return e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';
              };

              const dndProps = dragKey
                ? {
                    onDragOver: (e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      // Never offer to drop onto the pinned slot's leading edge.
                      const edge =
                        pinned ? 'after' : computeEdge(e);
                      if (
                        dropTarget?.key !== col.key ||
                        dropTarget.edge !== edge
                      ) {
                        setDropTarget({ key: col.key, edge });
                      }
                    },
                    onDrop: (e: React.DragEvent) => {
                      e.preventDefault();
                      handleColDrop();
                    },
                  }
                : {};

              // Inner content: the existing sort button (sortable cols) or a
              // plain label (everything else), wrapped in the grab surface.
              const inner = sortable ? (
                <button
                  type="button"
                  className={`st-th-sort${active ? ' is-active' : ''}`}
                  onClick={() => onSortColumn(col.key)}
                  title={`Sort by ${col.label}`}
                >
                  {col.label}
                  {active ? (
                    <span className="st-th-sort__ind" aria-hidden="true">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  ) : (
                    <span
                      className="st-th-sort__ind st-th-sort__ind--idle"
                      aria-hidden="true"
                    >
                      ▲
                    </span>
                  )}
                </button>
              ) : (
                <span>{col.label}</span>
              );

              return (
                <th
                  key={col.key}
                  className={thClass}
                  aria-sort={
                    sortable
                      ? active
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  {...dndProps}
                >
                  <span
                    className="st-th-drag__grip"
                    draggable={draggable}
                    onDragStart={
                      draggable
                        ? (e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', col.key);
                            setDragKey(col.key);
                            setDropTarget(null);
                          }
                        : undefined
                    }
                    onDragEnd={draggable ? endDrag : undefined}
                  >
                    {draggable && (
                      <span
                        className="st-th-drag__dots"
                        aria-hidden="true"
                        title="Drag to reorder"
                      />
                    )}
                    {inner}
                  </span>
                  {/* Resize handle on the trailing edge. */}
                  <span
                    className={`st-th-resize${
                      resizing?.key === col.key ? ' is-resizing' : ''
                    }`}
                    aria-hidden="true"
                    title="Drag to resize"
                    onPointerDown={(e) => beginResize(e, col)}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIndex) => {
            const isFav = favorites.has(record.id);
            const isSelected = selected.has(record.id);
            const isActive = activeRow === rowIndex;

            // Group-by header band: emitted before the first record of each new
            // group value (records arrive pre-grouped from the engine when a
            // group-by is active). Carries the group's count/sum/avg stats.
            const groupValue = groupField ? record.data[groupField.key] : undefined;
            const prevValue =
              groupField && rowIndex > 0
                ? records[rowIndex - 1].data[groupField.key]
                : undefined;
            const startsGroup =
              !!groupField &&
              (rowIndex === 0 ||
                String(groupValue ?? '') !== String(prevValue ?? ''));
            const bucket = startsGroup ? bucketFor(groupValue) : undefined;

            return (
            <React.Fragment key={record.id}>
            {startsGroup && groupField && (
              <tr className="st-row stx-group-row" aria-hidden="true">
                <td colSpan={colSpan}>
                  <span className="stx-group-cell">
                    <span className="stx-group-cell__label">
                      {groupLabelFor(groupValue)}
                    </span>
                    <StatPills
                      count={bucket?.count ?? 0}
                      sum={bucket?.sum}
                      avg={bucket?.avg}
                      metricLabel={metricField?.label}
                      loading={aggregateLoading}
                    />
                  </span>
                </td>
              </tr>
            )}
            <tr
              className={`st-row${isSelected ? ' is-selected' : ''}${
                isActive ? ' stx-row--active' : ''
              }`}
              aria-rowindex={rowIndex + 1}
              aria-selected={isSelected}
              onMouseDown={() => onSetActiveRow(rowIndex)}
            >
              <td className="st-checkbox-cell">
                <input
                  type="checkbox"
                  className="st-checkbox st-checkbox--row"
                  aria-label={isSelected ? 'Deselect row' : 'Select row'}
                  checked={isSelected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(record.id)}
                />
              </td>
              <td style={{ width: 32 }}>
                <button
                  type="button"
                  className={`st-star st-star--row${isFav ? ' active' : ''}`}
                  disabled={favBusy.has(record.id)}
                  aria-pressed={isFav}
                  aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFavorite(record.id);
                  }}
                >
                  <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </td>
              <td className="stg-th">
                <TagPickerCell
                  tags={tags}
                  appliedIds={recordTagIds(record)}
                  tagsLoading={tagsLoading}
                  onToggle={(tagId, next) => onToggleTag(record.id, tagId, next)}
                />
              </td>
              {columns.map((col) => {
                const isFirst = labelField
                  ? col.key === labelField.key
                  : col === columns[0];
                const value = record.data[col.key];
                if (isFirst) {
                  return (
                    <td key={col.key}>
                      <Link
                        href={`/sabcrm/${object.slug}/${record.id}`}
                        className="st-cell-link"
                      >
                        {recordLabel(object, record)}
                      </Link>
                    </td>
                  );
                }
                if (INLINE_EDITABLE.has(col.type)) {
                  return (
                    <td key={col.key}>
                      <EditableCell
                        field={col}
                        value={value}
                        onCommit={(v) => onEdit(record.id, col.key, v)}
                      />
                    </td>
                  );
                }
                return (
                  <td key={col.key}>
                    <TwentyFieldValue field={col} value={value} />
                  </td>
                );
              })}
            </tr>
            </React.Fragment>
            );
          })}
        </tbody>
        {/* Footer total row — always shown for the current (page) record set.
            When an aggregate is available it carries the grand totals; it falls
            back to the in-view record count otherwise. */}
        {records.length > 0 && (
          <tfoot>
            <tr className="st-row stx-foot-row">
              <td colSpan={colSpan}>
                <span className="stx-foot-cell">
                  <span className="stx-foot-cell__label">Total</span>
                  <StatPills
                    count={aggregate?.total.count ?? records.length}
                    sum={aggregate?.total.sum}
                    avg={aggregate?.total.avg}
                    metricLabel={metricField?.label}
                    loading={aggregateLoading}
                  />
                </span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board view
// ---------------------------------------------------------------------------

interface BoardViewProps {
  object: ObjectMetadata;
  groupByField: FieldMetadata;
  groups: SabcrmRecordTwGroup[];
  previewFields: FieldMetadata[];
  /**
   * Drop a card onto a different column → set its group field to
   * `targetValue` (the target column's SELECT option value, or `null` for the
   * "Ungrouped" bucket). The page owns the optimistic move + persistence +
   * rollback; this just reports the intent.
   */
  onMoveCard: (recordId: string, fromValue: string | null, targetValue: string | null) => void;
  /** Records mid-flight to the engine — rendered with the "saving" ring. */
  savingIds: ReadonlySet<string>;
}

/** Stable key for a board column (the SELECT value, or a sentinel for null). */
const UNGROUPED_KEY = '__ungrouped__';
const colKey = (value: string | null): string => value ?? UNGROUPED_KEY;

/** What `dataTransfer` carries during a card drag (also kept in React state). */
interface DragPayload {
  recordId: string;
  fromValue: string | null;
}

function BoardView({
  object,
  groupByField,
  groups,
  previewFields,
  onMoveCard,
  savingIds,
}: BoardViewProps) {
  const optionFor = (value: string | null) =>
    value === null
      ? undefined
      : groupByField.options?.find((o) => o.value === value);

  // The card being dragged (drives the source "ghost" style + drop routing)
  // and the column currently hovered (drives the drop-target highlight).
  const [drag, setDrag] = React.useState<DragPayload | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  const endDrag = React.useCallback(() => {
    setDrag(null);
    setOverKey(null);
  }, []);

  const handleDrop = React.useCallback(
    (targetValue: string | null) => {
      if (!drag) return endDrag();
      // Same column → no-op (avoids a pointless write + reorder churn).
      if (drag.fromValue !== targetValue) {
        onMoveCard(drag.recordId, drag.fromValue, targetValue);
      }
      endDrag();
    },
    [drag, onMoveCard, endDrag],
  );

  return (
    <div className="st-board">
      {groups.map((group) => {
        const opt = optionFor(group.value);
        const label = opt?.label ?? group.value ?? 'Ungrouped';
        const key = colKey(group.value);
        const isOver = drag !== null && overKey === key && drag.fromValue !== group.value;
        const isCandidate = drag !== null && drag.fromValue !== group.value;
        return (
          <div
            className={`st-board__col st-board__col--dnd${
              isCandidate ? ' st-board__col--drop-candidate' : ''
            }`}
            key={key}
          >
            <div className="st-board__head">
              <TwentyChip label={label} color={chipColor(opt?.color)} />
              <span className="st-board__count">{group.records.length}</span>
            </div>
            <div
              className={`st-board__body st-board__body--dnd${
                isOver ? ' st-board__body--drop-active' : ''
              }`}
              onDragOver={(e) => {
                // Without preventDefault the browser refuses the drop.
                if (!drag) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overKey !== key) setOverKey(key);
              }}
              onDragEnter={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOverKey(key);
              }}
              onDragLeave={(e) => {
                // Only clear when the pointer truly leaves the column body,
                // not when crossing between child cards inside it.
                if (
                  e.relatedTarget instanceof Node &&
                  e.currentTarget.contains(e.relatedTarget)
                ) {
                  return;
                }
                if (overKey === key) setOverKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(group.value);
              }}
            >
              {group.records.length === 0 ? (
                <div className="st-board__empty">
                  {isOver ? 'Drop here' : 'Nothing here'}
                </div>
              ) : (
                group.records.map((record) => {
                  const isDragging = drag?.recordId === record.id;
                  const isSaving = savingIds.has(record.id);
                  return (
                    <Link
                      key={record.id}
                      href={`/sabcrm/${object.slug}/${record.id}`}
                      className={`st-card st-card--draggable${
                        isDragging ? ' st-card--dragging' : ''
                      }${isSaving ? ' st-card--saving' : ''}`}
                      draggable={!isSaving}
                      onDragStart={(e) => {
                        const payload: DragPayload = {
                          recordId: record.id,
                          fromValue: group.value,
                        };
                        e.dataTransfer.effectAllowed = 'move';
                        // Plain-text fallback so external/native targets see
                        // something sane; React state is the real channel.
                        e.dataTransfer.setData('text/plain', record.id);
                        setDrag(payload);
                        setOverKey(null);
                      }}
                      onDragEnd={endDrag}
                      // A drag must not also fire the link navigation.
                      onClick={(e) => {
                        if (drag) e.preventDefault();
                      }}
                    >
                      <div className="st-card__title">
                        {recordLabel(object, record)}
                      </div>
                      {previewFields.map((f) => {
                        const v = record.data[f.key];
                        if (v === null || v === undefined || v === '') return null;
                        return (
                          <div key={f.key} className="st-card__meta">
                            <TwentyFieldValue field={f} value={v} />
                          </div>
                        );
                      })}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create dialog (metadata-driven)
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  object: ObjectMetadata;
  projectId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/** Fields the user may fill on create — system + relation fields are skipped. */
function creatableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => !f.system && f.type !== 'RELATION' && (f.required || f.inTable),
  );
}

function CreateDialog({ object, projectId, onClose, onCreated }: CreateDialogProps) {
  const fields = React.useMemo(() => creatableFields(object), [object]);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setValue = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== '') payload[k] = v;
    }

    const res = await createSabcrmRecordTw(
      object.slug,
      payload,
      projectId ?? undefined,
    );
    setSaving(false);
    if (res.ok) {
      onCreated();
      onClose();
    } else {
      setError(res.error);
    }
  };

  const renderInput = (field: FieldMetadata) => {
    const raw = values[field.key];
    if (field.type === 'BOOLEAN') {
      return (
        <label className="st-checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(raw)}
            onChange={(e) => setValue(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }
    if (field.type === 'SELECT') {
      return (
        <select
          className="st-select"
          value={raw !== undefined ? String(raw) : ''}
          onChange={(e) => setValue(field.key, e.target.value)}
        >
          <option value="">{`Select ${field.label.toLowerCase()}`}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    const inputType =
      field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING'
        ? 'number'
        : field.type === 'DATE'
          ? 'date'
          : field.type === 'DATE_TIME'
            ? 'datetime-local'
            : field.type === 'EMAIL'
              ? 'email'
              : field.type === 'PHONE'
                ? 'tel'
                : field.type === 'LINK'
                  ? 'url'
                  : 'text';
    return (
      <input
        className="st-input"
        type={inputType}
        required={field.required}
        value={raw !== undefined ? String(raw) : ''}
        placeholder={field.type === 'LINK' ? 'https://' : field.description}
        onChange={(e) =>
          setValue(
            field.key,
            inputType === 'number'
              ? e.target.value === ''
                ? ''
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    );
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`New ${object.labelSingular}`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">New {object.labelSingular}</h2>
            <button
              type="button"
              className="st-dialog__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="st-dialog__body">
            {fields.map((field) => (
              <div className="st-field" key={field.key}>
                {field.type !== 'BOOLEAN' && (
                  <span className="st-field__label">
                    {field.label}
                    {field.required && <span className="st-field__req">*</span>}
                  </span>
                )}
                {renderInput(field)}
              </div>
            ))}
            {error && (
              <div className="st-banner">
                <AlertTriangle className="st-banner__icon" size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button type="submit" className="st-btn st-btn--primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              Create {object.labelSingular}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / empty / error
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTwentyIndexPage(): React.JSX.Element {
  const params = useParams<{ objectSlug: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const router = useRouter();
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  const [view, setView] = React.useState<ViewKind>('table');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  // View-bar query state (filters / sort / group) + visible-column set.
  const [viewState, setViewState] = React.useState<ViewState>(EMPTY_VIEW_STATE);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(
    new Set(),
  );
  // Explicit left-to-right order of the visible columns (field keys). This is
  // what drag-reorder mutates; it's also the order persisted into a saved
  // view's `fields` list. Keys not present fall back to metadata order.
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);
  // Per-column explicit widths (px) keyed by field key, set via the header
  // resize handle. Empty ⇒ the table auto-sizes (default Twenty behavior).
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(
    {},
  );

  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [groups, setGroups] = React.useState<SabcrmRecordTwGroup[]>([]);
  // Board cards currently persisting a column move (drives the "saving" ring).
  const [movingCards, setMovingCards] = React.useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);

  // Pagination state for the flat table view. `total` is the server-reported
  // count for the active query, used to derive the last page and the footer.
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<number>(PAGE_LIMIT);
  const [total, setTotal] = React.useState(0);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Favorites for this object (set of recordIds), loaded once per page.
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [favBusy, setFavBusy] = React.useState<Set<string>>(new Set());

  // Workspace tag definitions ({ id, name, color }), loaded once per project.
  // Applied tags live on each record at `data.__tags` (string[] of tag ids).
  const [tags, setTags] = React.useState<SabcrmRustTag[]>([]);
  const [tagsLoading, setTagsLoading] = React.useState(true);
  // Toolbar "Tag" filter: the selected tag id to narrow rows to, or null.
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  // Multi-select state for bulk actions (set of recordIds).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkUpdating, setBulkUpdating] = React.useState(false);

  // Keyboard navigation: the highlighted row index (null = no active cursor)
  // and a focusable wrapper ref the table grid lives in.
  const [activeRow, setActiveRow] = React.useState<number | null>(null);
  const tableRef = React.useRef<HTMLDivElement | null>(null);

  // Group-by aggregations (count + optional numeric sum/avg) for the table
  // header/footer stats. `null` while loading or when the engine is unavailable
  // — the footer then falls back to the in-view record count.
  const [aggregate, setAggregate] = React.useState<SabcrmAggregateResult | null>(
    null,
  );
  const [aggregateLoading, setAggregateLoading] = React.useState(false);

  // Reset transient state when the object changes.
  React.useEffect(() => {
    setSearchInput('');
    setSearch('');
    setView('table');
    setViewState(EMPTY_VIEW_STATE);
    setTagFilter(null);
  }, [objectSlug]);

  // Selection must not leak across object / filter / search / view changes —
  // the underlying record set is different, so stale ids would be meaningless.
  React.useEffect(() => {
    setSelected(new Set());
  }, [objectSlug, search, viewState, view, refreshTick]);

  // Any change to the query window's shape (object / search / filters / sort /
  // group / page-size) invalidates the current page index — snap back to 1.
  React.useEffect(() => {
    setPage(1);
  }, [objectSlug, search, viewState, view, limit]);

  // Seed visible columns from the object's `inTable` fields whenever the
  // resolved object changes (the Fields popover then mutates this set). The
  // explicit order + any per-column widths reset to the metadata default.
  React.useEffect(() => {
    if (!object) return;
    const defaults = object.fields.filter((f) => f.inTable).map((f) => f.key);
    const keys = defaults.length
      ? defaults
      : object.fields.slice(0, 5).map((f) => f.key);
    setVisibleColumns(new Set(keys));
    setColumnOrder(keys);
    setColumnWidths({});
  }, [object]);

  const toggleColumn = React.useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // Keep the order list in sync: newly shown columns append to the end,
    // hidden ones are dropped (re-showing puts them last — matches Twenty).
    setColumnOrder((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  // Replace the whole visible set + order (saved-view restore, or the Fields
  // popover's "set all"). The incoming array order is authoritative.
  const setColumns = React.useCallback((keys: string[]) => {
    setVisibleColumns(new Set(keys));
    setColumnOrder(keys);
  }, []);

  // Drag-reorder: lift `sourceKey` and re-insert it immediately before
  // `targetKey` (or append when `targetKey` is null). Mutating `columnOrder`
  // re-derives `columns`; if a view is active the next save persists this order
  // through the view bar's `fields: Array.from(visibleColumns)` contract, which
  // we keep aligned to `columnOrder` below.
  const handleReorderColumn = React.useCallback(
    (sourceKey: string, targetKey: string | null) => {
      setColumnOrder((prev) => {
        if (!prev.includes(sourceKey)) return prev;
        const without = prev.filter((k) => k !== sourceKey);
        if (targetKey === null) return [...without, sourceKey];
        const idx = without.indexOf(targetKey);
        if (idx < 0) return [...without, sourceKey];
        return [...without.slice(0, idx), sourceKey, ...without.slice(idx)];
      });
    },
    [],
  );

  // Commit a resized column width (already clamped by the handle).
  const handleResizeColumn = React.useCallback((key: string, width: number) => {
    setColumnWidths((prev) =>
      prev[key] === width ? prev : { ...prev, [key]: width },
    );
  }, []);

  // Debounce search input.
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load object metadata.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObject(true);
    setObjectError(null);
    (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObject(null);
      } else {
        setObject(res.data.find((o) => o.slug === objectSlug) ?? null);
      }
      setLoadingObject(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  const boardField = React.useMemo<FieldMetadata | undefined>(() => {
    if (!object?.board?.groupByField) return undefined;
    return object.fields.find((f) => f.key === object.board?.groupByField);
  }, [object]);

  const canBoard = !!boardField && boardField.type === 'SELECT';

  // If board view is no longer valid, fall back to table.
  React.useEffect(() => {
    if (view === 'board' && !canBoard) setView('table');
  }, [view, canBoard]);

  // The field the records are bucketed by: the view-bar "Group by" wins; the
  // object's board toggle is the fallback. Either way it must be a SELECT.
  const groupField = React.useMemo<FieldMetadata | undefined>(() => {
    if (viewState.groupBy) {
      const f = object?.fields.find((x) => x.key === viewState.groupBy);
      return f && f.type === 'SELECT' ? f : undefined;
    }
    if (view === 'board' && boardField) return boardField;
    return undefined;
  }, [viewState.groupBy, view, boardField, object]);

  const grouped = !!groupField;

  // The numeric field the sum/avg aggregation runs over: prefer a non-system
  // NUMBER/CURRENCY/RATING field. Absent ⇒ aggregations report count only.
  const metricField = React.useMemo<FieldMetadata | undefined>(
    () =>
      object?.fields.find((f) => !f.system && NUMERIC_FIELD.has(f.type)),
    [object],
  );

  // Group-by field active via the view bar (independent of the board toggle):
  // this is what drives the table's per-group header stats + footer roll-ups.
  const aggGroupField = React.useMemo<FieldMetadata | undefined>(() => {
    if (!viewState.groupBy) return undefined;
    const f = object?.fields.find((x) => x.key === viewState.groupBy);
    return f && f.type === 'SELECT' ? f : undefined;
  }, [viewState.groupBy, object]);

  // Load per-group + total aggregates (count, and sum/avg over `metricField`)
  // whenever a group-by is active. Degrades silently: on error or a missing
  // action the table footer falls back to the in-view record count.
  React.useEffect(() => {
    if (!objectSlug || !aggGroupField) {
      setAggregate(null);
      setAggregateLoading(false);
      return;
    }
    let cancelled = false;
    setAggregateLoading(true);

    const metric: AggregateMetric = metricField ? 'sum' : 'count';
    (async () => {
      try {
        const res = await aggregateSabcrmRecordsTw(
          objectSlug,
          {
            groupByField: aggGroupField.key,
            metric,
            metricField: metricField?.key,
          },
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (res && res.ok) {
          setAggregate(res.data as SabcrmAggregateResult);
        } else {
          setAggregate(null);
        }
      } catch {
        if (!cancelled) setAggregate(null);
      } finally {
        if (!cancelled) setAggregateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, aggGroupField, metricField, activeProjectId, refreshTick]);

  // Load records / board whenever the query changes.
  React.useEffect(() => {
    if (!object || !objectSlug) return;
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);

    const engineFilters = viewStateToEngineFilters(viewState);
    const hasFilters = Object.keys(engineFilters).length > 0;

    (async () => {
      if (grouped && groupField) {
        const res = await groupSabcrmRecordsTw(
          objectSlug,
          groupField.key,
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (!res.ok) {
          setDataError(res.error);
          setGroups([]);
        } else {
          setGroups(res.data.groups);
        }
      } else {
        const res = await listSabcrmRecordsTw(
          objectSlug,
          {
            q: search || undefined,
            page,
            limit,
            sortBy: viewState.sortBy ?? undefined,
            sortDir: viewState.sortBy ? viewState.sortDir : undefined,
            filters: hasFilters ? engineFilters : undefined,
          },
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (!res.ok) {
          setDataError(res.error);
          setRecords([]);
          setTotal(0);
        } else {
          setRecords(res.data.records);
          setTotal(res.data.total);
        }
      }
      setLoadingData(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    object,
    objectSlug,
    grouped,
    groupField,
    search,
    viewState,
    page,
    limit,
    activeProjectId,
    refreshTick,
  ]);

  // Visible columns in their explicit drag-order. `columnOrder` drives the
  // sequence; any visible field missing from it (e.g. a freshly-restored saved
  // view, or metadata drift) is appended in its original metadata order so a
  // column never silently vanishes.
  const columns = React.useMemo(() => {
    if (!object) return [];
    const byKey = new Map(object.fields.map((f) => [f.key, f] as const));
    const seen = new Set<string>();
    const ordered: FieldMetadata[] = [];
    for (const key of columnOrder) {
      if (!visibleColumns.has(key)) continue;
      const field = byKey.get(key);
      if (field && !seen.has(key)) {
        ordered.push(field);
        seen.add(key);
      }
    }
    for (const field of object.fields) {
      if (visibleColumns.has(field.key) && !seen.has(field.key)) {
        ordered.push(field);
        seen.add(field.key);
      }
    }
    return ordered;
  }, [object, visibleColumns, columnOrder]);
  // An order-preserving view of the visible columns. The view bar persists
  // saved-view `fields` via `Array.from(visibleColumns)`, so feeding it a Set
  // whose iteration order is the drag-order makes column reordering durable in
  // saved views — not just local component state.
  const orderedVisibleColumns = React.useMemo(
    () => new Set(columns.map((c) => c.key)),
    [columns],
  );
  // Client-side "Tag" filter: narrow the loaded page to records carrying the
  // chosen tag id on `data.__tags`. The engine filter is string-based, so a
  // client filter over the loaded page is the faithful behavior here. When no
  // tag is selected this is the identity of `records`.
  const visibleRecords = React.useMemo(() => {
    if (!tagFilter) return records;
    return records.filter((r) => recordTagIds(r).includes(tagFilter));
  }, [records, tagFilter]);

  const labelField = React.useMemo(
    () => object?.fields.find((f) => f.isLabel),
    [object],
  );
  const previewFields = React.useMemo(
    () =>
      object
        ? object.fields
            .filter((f) => f.inTable && !f.isLabel && f.type !== 'RELATION')
            .slice(0, 2)
        : [],
    [object],
  );

  // Optimistic inline edit → persist via the Rust engine.
  const handleEdit = React.useCallback(
    async (recordId: string, key: string, value: unknown) => {
      const prev = records;
      setRecords((rs) =>
        rs.map((r) =>
          r.id === recordId ? { ...r, data: { ...r.data, [key]: value } } : r,
        ),
      );
      const res = await updateSabcrmRecordTw(
        objectSlug,
        recordId,
        { [key]: value },
        activeProjectId ?? undefined,
      );
      if (!res.ok) {
        // Roll back + surface the error.
        setRecords(prev);
        setDataError(res.error);
      } else {
        setRecords((rs) => rs.map((r) => (r.id === recordId ? res.data : r)));
      }
    },
    [records, objectSlug, activeProjectId],
  );

  // Board drag-and-drop: move a card to another column = set its group field
  // to the target column's value. Optimistic (the card jumps columns in local
  // `groups` immediately), persisted via the Rust engine, rolled back on error
  // into the existing `dataError` banner.
  const handleMoveCard = React.useCallback(
    async (recordId: string, fromValue: string | null, targetValue: string | null) => {
      if (!groupField) return;
      if (fromValue === targetValue) return;
      if (movingCards.has(recordId)) return;

      const key = groupField.key;
      const prevGroups = groups;

      // Locate + lift the record out of its source column.
      let moved: SabcrmRustRecord | undefined;
      for (const g of prevGroups) {
        if (g.value === fromValue) {
          moved = g.records.find((r) => r.id === recordId);
          break;
        }
      }
      if (!moved) return;
      const updated: SabcrmRustRecord = {
        ...moved,
        data: { ...moved.data, [key]: targetValue },
      };

      // Optimistic reshuffle: drop from source, append to target.
      setGroups((gs) =>
        gs.map((g) => {
          if (g.value === fromValue) {
            return { ...g, records: g.records.filter((r) => r.id !== recordId) };
          }
          if (g.value === targetValue) {
            return { ...g, records: [...g.records, updated] };
          }
          return g;
        }),
      );
      setMovingCards((m) => new Set(m).add(recordId));
      setDataError(null);

      const res = await updateSabcrmRecordTw(
        objectSlug,
        recordId,
        { [key]: targetValue },
        activeProjectId ?? undefined,
      );

      setMovingCards((m) => {
        const n = new Set(m);
        n.delete(recordId);
        return n;
      });

      if (!res.ok) {
        // Roll back to the pre-drag grouping + surface the engine error.
        setGroups(prevGroups);
        setDataError(res.error);
        return;
      }
      // Reconcile the target card with the engine's canonical record.
      setGroups((gs) =>
        gs.map((g) =>
          g.value === targetValue
            ? {
                ...g,
                records: g.records.map((r) => (r.id === recordId ? res.data : r)),
              }
            : g,
        ),
      );
    },
    [groupField, groups, movingCards, objectSlug, activeProjectId],
  );

  const handleCreated = React.useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  // Header-click sort cycle: asc → desc → clear (and asc when switching column).
  // Writes the shared view-bar sort state so the Sort popover + pill stay in
  // sync; the list effect re-runs and the page reset effect snaps to page 1.
  const handleSortColumn = React.useCallback((key: string) => {
    setViewState((prev) => {
      if (prev.sortBy !== key) {
        return { ...prev, sortBy: key, sortDir: 'asc' };
      }
      if (prev.sortDir === 'asc') {
        return { ...prev, sortDir: 'desc' };
      }
      return { ...prev, sortBy: null, sortDir: 'asc' };
    });
  }, []);

  // Load the caller's favorites once per object/project (graceful on failure).
  React.useEffect(() => {
    if (!objectSlug) return;
    let cancelled = false;
    (async () => {
      const res = await listSabcrmFavoritesTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (res.ok) {
        setFavorites(
          new Set(
            res.data
              .filter((f) => f.object === objectSlug)
              .map((f) => f.recordId),
          ),
        );
      } else {
        setFavorites(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  // Load the workspace tag definitions once per project (graceful on failure).
  React.useEffect(() => {
    let cancelled = false;
    setTagsLoading(true);
    (async () => {
      const res = await listTagsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      setTags(res.ok ? res.data : []);
      setTagsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Optimistic apply/remove of a tag on a record. Persists the full new
  // `__tags` id list via the existing record-update action; rolls back the
  // local record (and surfaces the engine error) on failure.
  const handleToggleTag = React.useCallback(
    async (recordId: string, tagId: string, next: boolean) => {
      const prev = records;
      const target = prev.find((r) => r.id === recordId);
      if (!target) return;

      const current = recordTagIds(target);
      const has = current.includes(tagId);
      if (next === has) return; // already in the desired state — no write

      const nextIds = next
        ? [...current, tagId]
        : current.filter((id) => id !== tagId);

      // Optimistic local update.
      setRecords((rs) =>
        rs.map((r) =>
          r.id === recordId
            ? { ...r, data: { ...r.data, [TAGS_KEY]: nextIds } }
            : r,
        ),
      );
      setDataError(null);

      const res = await updateSabcrmRecordTw(
        objectSlug,
        recordId,
        { [TAGS_KEY]: nextIds },
        activeProjectId ?? undefined,
      );

      if (!res.ok) {
        setRecords(prev); // rollback
        setDataError(res.error);
        return;
      }
      // Reconcile with the engine's canonical record.
      setRecords((rs) => rs.map((r) => (r.id === recordId ? res.data : r)));
    },
    [records, objectSlug, activeProjectId],
  );

  // Optimistic favorite toggle with rollback on error.
  const handleToggleFavorite = React.useCallback(
    async (recordId: string) => {
      if (favBusy.has(recordId)) return;
      const wasFav = favorites.has(recordId);
      const next = !wasFav;

      setFavBusy((b) => new Set(b).add(recordId));
      setFavorites((f) => {
        const n = new Set(f);
        if (next) n.add(recordId);
        else n.delete(recordId);
        return n;
      });

      const res = next
        ? await addSabcrmFavoriteTw(objectSlug, recordId, activeProjectId ?? undefined)
        : await removeSabcrmFavoriteTw(
            objectSlug,
            recordId,
            activeProjectId ?? undefined,
          );

      if (!res.ok) {
        // Rollback.
        setFavorites((f) => {
          const n = new Set(f);
          if (wasFav) n.add(recordId);
          else n.delete(recordId);
          return n;
        });
        setDataError(res.error);
      }
      setFavBusy((b) => {
        const n = new Set(b);
        n.delete(recordId);
        return n;
      });
    },
    [favBusy, favorites, objectSlug, activeProjectId],
  );

  // ---- Selection ----------------------------------------------------------

  const toggleSelect = React.useCallback((recordId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }, []);

  const toggleSelectAll = React.useCallback(() => {
    setSelected((prev) => {
      const allSelected =
        visibleRecords.length > 0 && visibleRecords.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(visibleRecords.map((r) => r.id));
    });
  }, [visibleRecords]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  // ---- Keyboard navigation ------------------------------------------------

  // The active-row cursor only makes sense for the current record window, so
  // reset it whenever that window changes (object / page / filters / view).
  React.useEffect(() => {
    setActiveRow(null);
  }, [objectSlug, search, viewState, view, page, limit, refreshTick, tagFilter]);

  const onSetActiveRow = React.useCallback((index: number | null) => {
    setActiveRow(index);
  }, []);

  // ↑/↓ (or k/j) move the cursor, Enter opens the row, x toggles its checkbox,
  // Esc clears. Typing in a cell input/select/textarea is never hijacked, and
  // modifier-chorded keys fall through to the browser / inline-edit shortcuts.
  const handleTableKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (visibleRecords.length === 0) return;

      const last = visibleRecords.length - 1;
      const moveTo = (next: number) => {
        e.preventDefault();
        const clamped = Math.max(0, Math.min(last, next));
        setActiveRow(clamped);
        // Keep the highlighted row in view as the cursor walks the list.
        const wrap = tableRef.current;
        const row = wrap?.querySelectorAll<HTMLTableRowElement>(
          'tbody tr.st-row:not(.stx-group-row)',
        )[clamped];
        row?.scrollIntoView({ block: 'nearest' });
      };

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          moveTo(activeRow === null ? 0 : activeRow + 1);
          break;
        case 'ArrowUp':
        case 'k':
          moveTo(activeRow === null ? 0 : activeRow - 1);
          break;
        case 'Enter': {
          if (activeRow === null) return;
          const rec = visibleRecords[activeRow];
          if (rec) {
            e.preventDefault();
            router.push(`/sabcrm/${objectSlug}/${rec.id}`);
          }
          break;
        }
        case 'x':
        case 'X': {
          if (activeRow === null) return;
          const rec = visibleRecords[activeRow];
          if (rec) {
            e.preventDefault();
            toggleSelect(rec.id);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          setActiveRow(null);
          clearSelection();
          break;
        default:
          break;
      }
    },
    [visibleRecords, activeRow, router, objectSlug, toggleSelect, clearSelection],
  );

  // The first SELECT field is what we offer for bulk-edit (e.g. stage/status).
  const bulkEditField = React.useMemo<FieldMetadata | undefined>(
    () =>
      object?.fields.find(
        (f) =>
          f.type === 'SELECT' &&
          !f.system &&
          (f.options?.length ?? 0) > 0,
      ),
    [object],
  );

  // Bulk delete: optimistic removal of the selected rows, rollback on error.
  const handleBulkDelete = React.useCallback(async () => {
    if (bulkDeleting) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const prev = records;
    const idSet = new Set(ids);
    setBulkDeleting(true);
    setDataError(null);
    setRecords((rs) => rs.filter((r) => !idSet.has(r.id)));

    const res = await bulkDeleteRecordsTw(
      objectSlug,
      ids,
      activeProjectId ?? undefined,
    );
    setBulkDeleting(false);

    if (!res.ok) {
      setRecords(prev); // rollback
      setDataError(res.error);
      return;
    }
    setSelected(new Set());
    setRefreshTick((t) => t + 1);
  }, [bulkDeleting, selected, records, objectSlug, activeProjectId]);

  // Bulk set a SELECT field on every selected record; optimistic, rollback on
  // error. Clears the selection on success.
  const handleBulkSet = React.useCallback(
    async (value: string) => {
      if (bulkUpdating || !bulkEditField) return;
      const ids = Array.from(selected);
      if (ids.length === 0) return;

      const key = bulkEditField.key;
      const prev = records;
      const idSet = new Set(ids);
      setBulkUpdating(true);
      setDataError(null);
      setRecords((rs) =>
        rs.map((r) =>
          idSet.has(r.id) ? { ...r, data: { ...r.data, [key]: value } } : r,
        ),
      );

      const res = await bulkUpdateRecordsTw(
        objectSlug,
        ids,
        { [key]: value },
        activeProjectId ?? undefined,
      );
      setBulkUpdating(false);

      if (!res.ok) {
        setRecords(prev); // rollback
        setDataError(res.error);
        return;
      }
      setSelected(new Set());
      setRefreshTick((t) => t + 1);
    },
    [
      bulkUpdating,
      bulkEditField,
      selected,
      records,
      objectSlug,
      activeProjectId,
    ],
  );

  // ---- Render -------------------------------------------------------------

  if (loadingObject) {
    return (
      <div className="st-page">
        <div className="st-skeleton" style={{ height: 28, width: 180, marginBottom: 20 }} />
        <TableSkeleton />
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="st-page">
        <ErrorBanner message={objectError} />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="st-page">
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Object not found</h2>
          <p className="st-empty__desc">
            No CRM object matches “{objectSlug}”. It may have been removed or you
            may not have access.
          </p>
          <TwentyButton variant="secondary">
            <Link href="/sabcrm" style={{ color: 'inherit', textDecoration: 'none' }}>
              Back to SabCRM
            </Link>
          </TwentyButton>
        </div>
      </div>
    );
  }

  const isEmpty = grouped
    ? groups.every((g) => g.records.length === 0)
    : visibleRecords.length === 0;

  const hasActiveQuery =
    !!search ||
    countConditions(viewState.filters) > 0 ||
    !!viewState.sortBy ||
    !!tagFilter;

  return (
    <div className="st-page">
      <TwentyPageHeader
        title={object.labelPlural}
        actions={
          <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New {object.labelSingular}
          </TwentyButton>
        }
      />

      <div className="st-toolbar">
        <div className="st-search">
          <Search className="st-search__icon" size={15} aria-hidden="true" />
          <input
            className="st-search__input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
            aria-label={`Search ${object.labelPlural}`}
          />
        </div>
        {!grouped && (
          <TagFilterControl
            tags={tags}
            value={tagFilter}
            onChange={setTagFilter}
          />
        )}
        <div className="st-toolbar__spacer" />
        {!loadingData && !grouped && (
          <span className="st-count">
            {total} {total === 1 ? object.labelSingular.toLowerCase() : object.labelPlural.toLowerCase()}
          </span>
        )}
      </div>

      <SabcrmViewBar
        object={object}
        state={viewState}
        onStateChange={setViewState}
        visibleColumns={orderedVisibleColumns}
        onToggleColumn={toggleColumn}
        onSetColumns={setColumns}
        projectId={activeProjectId}
        refreshTick={refreshTick}
        viewKind={view}
        onViewKindChange={setView}
        canBoard={canBoard}
        calendarHref={`/sabcrm/calendar?object=${encodeURIComponent(objectSlug)}`}
      />

      {dataError && <ErrorBanner message={dataError} />}

      {loadingData ? (
        <TableSkeleton />
      ) : isEmpty ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">
            {hasActiveQuery
              ? `No matching ${object.labelPlural.toLowerCase()}`
              : `No ${object.labelPlural.toLowerCase()} yet`}
          </h2>
          <p className="st-empty__desc">
            {hasActiveQuery
              ? 'Try a different search term or adjust your filters.'
              : `Create your first ${object.labelSingular.toLowerCase()} to get started.`}
          </p>
          {!hasActiveQuery && (
            <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              New {object.labelSingular}
            </TwentyButton>
          )}
        </div>
      ) : grouped && groupField ? (
        <BoardView
          object={object}
          groupByField={groupField}
          groups={groups}
          previewFields={previewFields}
          onMoveCard={handleMoveCard}
          savingIds={movingCards}
        />
      ) : (
        <>
          <div className="stx-kbd-hint" role="note">
            <span className="stx-kbd">↑</span>
            <span className="stx-kbd">↓</span>
            <span>to navigate</span>
            <span className="stx-kbd">↵</span>
            <span>open</span>
            <span className="stx-kbd">x</span>
            <span>select</span>
            <span className="stx-kbd">esc</span>
            <span>clear</span>
          </div>
          <TableView
            object={object}
            columns={columns}
            labelField={labelField}
            records={visibleRecords}
            onEdit={handleEdit}
            favorites={favorites}
            favBusy={favBusy}
            onToggleFavorite={handleToggleFavorite}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            sortBy={viewState.sortBy}
            sortDir={viewState.sortDir}
            onSortColumn={handleSortColumn}
            onReorderColumn={handleReorderColumn}
            columnWidths={columnWidths}
            onResizeColumn={handleResizeColumn}
            activeRow={activeRow}
            tableRef={tableRef}
            onTableKeyDown={handleTableKeyDown}
            onSetActiveRow={onSetActiveRow}
            groupField={aggGroupField}
            metricField={metricField}
            aggregate={aggregate}
            aggregateLoading={aggregateLoading}
            tags={tags}
            tagsLoading={tagsLoading}
            onToggleTag={handleToggleTag}
          />
          <SabcrmPagination
            page={page}
            limit={limit}
            total={total}
            pageCount={visibleRecords.length}
            singular={object.labelSingular.toLowerCase()}
            plural={object.labelPlural.toLowerCase()}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      )}

      {/* Selection bar — only meaningful in the flat table view. */}
      {!grouped && (
        <SabcrmBulkBar
          count={selected.size}
          editField={bulkEditField}
          deleting={bulkDeleting}
          updating={bulkUpdating}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
          onBulkSet={handleBulkSet}
        />
      )}

      {createOpen && (
        <CreateDialog
          object={object}
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
