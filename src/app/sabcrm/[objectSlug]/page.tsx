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
  GitBranch,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import '@/components/sabcrm/twenty/twenty-activity.css';
import './bulk-bar.css';
import './kanban-dnd.css';
import './record-tags.css';
import './pipeline-board.css';
import {
  SabcrmViewBar,
  EMPTY_VIEW_STATE,
  viewStateToEngineFilters,
  countConditions,
  recordMatchesFilters,
  type ViewState,
} from './view-bar';
import { SabcrmBulkBar } from './bulk-bar';
import { SabcrmPagination } from './pagination';
import './pagination.css';
import './column-reorder.css';
import './table-extras.css';
import './virtualization.css';
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
import { listPipelinesTw } from '@/app/actions/sabcrm-pipelines.actions';
import type { SabcrmRustPipeline } from '@/lib/rust-client/sabcrm-pipelines';
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

/* --- Infinite scroll + row windowing (Twenty `record-table/virtualization`) -
 * The flat table can run in two modes (see `TableScrollMode`):
 *   - 'scroll' (default): pages accumulate as you near the bottom; rows far
 *     outside the viewport are not mounted — only a window of them is, padded
 *     by spacer rows so the scrollbar stays truthful (lightweight windowing).
 *   - 'paged': the classic footer pagination (one page at a time).
 */

/** Estimated row height (px) the windowing math assumes. Real rows hover here;
 *  the estimate only needs to be close — over/under-render is absorbed by the
 *  overscan buffer below. */
const EST_ROW_HEIGHT = 33;
/** Extra rows rendered above/below the viewport so fast scrolls never flash
 *  blank before the next scroll-driven recompute lands. */
const WINDOW_OVERSCAN = 12;
/** Distance from the bottom (px) at which we trigger the next-page fetch. */
const INFINITE_THRESHOLD_PX = 320;
/** Capped viewport height (px) for the infinite-scroll table container. */
const INFINITE_VIEWPORT_PX = 560;
/** Below this many loaded rows windowing isn't worth its bookkeeping — render
 *  every row so group bands / short lists behave exactly as before. */
const WINDOW_MIN_ROWS = 60;

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

/** How the flat table loads/renders rows (see the windowing constants above). */
type TableScrollMode = 'scroll' | 'paged';

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
  // `record.data` can be undefined for legacy or freshly-created records —
  // optional-chain so we never throw "reading '__tags' of undefined".
  const raw = record.data?.[TAGS_KEY];
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
  /**
   * Toggle the row at `index`, extending a contiguous range from the last
   * anchor when `shiftKey` is held (Twenty's Shift-click range select).
   */
  onToggleSelectAt: (index: number, shiftKey: boolean) => void;
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

  // ---- Infinite scroll + windowing (owned by the page) -------------------
  /** 'scroll' = infinite append + row windowing; 'paged' = footer pagination. */
  scrollMode: TableScrollMode;
  /** More server pages remain for the current query (drives the sentinel). */
  hasMore: boolean;
  /** A next-page fetch is in flight (drives the sentinel spinner). */
  loadingMore: boolean;
  /** Ask the page to fetch + append the next page (scroll trigger or button). */
  onLoadMore: () => void;
  /**
   * Whether lightweight row-windowing is permitted right now. We disable it
   * while a group-by band is active (the bands break a uniform row height) and
   * for short lists — append-on-scroll then carries the feature on its own.
   */
  windowingEnabled: boolean;
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
  onToggleSelectAt,
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
  scrollMode,
  hasMore,
  loadingMore,
  onLoadMore,
  windowingEnabled,
}: TableViewProps) {
  const allSelected = records.length > 0 && records.every((r) => selected.has(r.id));
  const someSelected = records.some((r) => selected.has(r.id));

  // ---- Lightweight row windowing -----------------------------------------
  // In 'scroll' mode (and only when `windowingEnabled`) we render just the
  // band of rows near the viewport, padding the table with two spacer rows
  // that reserve the height of the off-screen rows above/below. The scroll
  // container is the `.st-table-wrap` itself (it gets `.stv-scroll`).
  const infinite = scrollMode === 'scroll';
  const doWindow =
    infinite && windowingEnabled && records.length >= WINDOW_MIN_ROWS;

  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(INFINITE_VIEWPORT_PX);

  // Track the viewport's scroll + size so the window recomputes as the user
  // scrolls. Also fires the near-bottom fetch trigger for infinite append.
  React.useEffect(() => {
    if (!infinite) return;
    const el = tableRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrollTop(el.scrollTop);
      setViewportH(el.clientHeight || INFINITE_VIEWPORT_PX);
      // Near-bottom → ask for the next page.
      if (
        hasMore &&
        !loadingMore &&
        el.scrollHeight - el.scrollTop - el.clientHeight < INFINITE_THRESHOLD_PX
      ) {
        onLoadMore();
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(read);
    };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
    // tableRef is stable; re-bind when mode/data length/paging flags change.
  }, [infinite, hasMore, loadingMore, onLoadMore, tableRef, records.length]);

  // Resolve the first..last row window plus the spacer heights around it.
  const total = records.length;
  const { startRow, endRow, padTop, padBottom } = React.useMemo(() => {
    if (!doWindow) {
      return { startRow: 0, endRow: total, padTop: 0, padBottom: 0 };
    }
    // Subtract a header allowance so the first rows aren't trimmed too eagerly.
    const first = Math.max(
      0,
      Math.floor(scrollTop / EST_ROW_HEIGHT) - WINDOW_OVERSCAN,
    );
    const visibleCount =
      Math.ceil(viewportH / EST_ROW_HEIGHT) + WINDOW_OVERSCAN * 2;
    const last = Math.min(total, first + visibleCount);
    return {
      startRow: first,
      endRow: last,
      padTop: first * EST_ROW_HEIGHT,
      padBottom: (total - last) * EST_ROW_HEIGHT,
    };
  }, [doWindow, scrollTop, viewportH, total]);

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
      className={`st-table-wrap stx-table-focus${
        resizing ? ' is-col-resizing' : ''
      }${infinite ? ' stv-scroll' : ''}`}
      tabIndex={0}
      role="grid"
      aria-label="Records — use arrow keys to navigate, Enter to open"
      aria-rowcount={records.length}
      onKeyDown={onTableKeyDown}
      style={
        infinite
          ? ({
              ['--stv-viewport-h' as string]: `${INFINITE_VIEWPORT_PX}px`,
            } as React.CSSProperties)
          : undefined
      }
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
            <th scope="col" className="st-checkbox-cell">
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
            <th scope="col" aria-label="Favorite" style={{ width: 32 }} />
            <th scope="col" className="stg-th" style={{ width: 160 }}>
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
                  scope="col"
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
          {/* Top spacer reserving the off-screen rows above the window. */}
          {padTop > 0 && (
            <tr
              className="stv-spacer"
              aria-hidden="true"
              style={
                { ['--stv-spacer-h' as string]: `${padTop}px` } as React.CSSProperties
              }
            >
              <td colSpan={colSpan} />
            </tr>
          )}
          {records.slice(startRow, endRow).map((record, sliceIndex) => {
            const rowIndex = startRow + sliceIndex;
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
                  // Drive the toggle from onClick so we can read `shiftKey` for
                  // range select (the change event doesn't carry modifiers).
                  // preventDefault keeps the input fully controlled by state.
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleSelectAt(rowIndex, e.shiftKey);
                  }}
                  // A change can still fire via keyboard (Space) — route it
                  // through the same single-row toggle for accessibility.
                  onChange={() => {}}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      onToggleSelectAt(rowIndex, e.shiftKey);
                    }
                  }}
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
          {/* Bottom spacer reserving the off-screen rows below the window. */}
          {padBottom > 0 && (
            <tr
              className="stv-spacer"
              aria-hidden="true"
              style={
                {
                  ['--stv-spacer-h' as string]: `${padBottom}px`,
                } as React.CSSProperties
              }
            >
              <td colSpan={colSpan} />
            </tr>
          )}
          {/* Infinite-scroll sentinel / load-more affordance. Lives inside the
              scroll viewport so its appearance also marks "near the bottom". */}
          {infinite && (hasMore || loadingMore) && (
            <tr className="stv-spacer" aria-hidden={loadingMore}>
              <td colSpan={colSpan}>
                <div className="stv-sentinel">
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="stv-sentinel__spin" />
                      Loading more…
                    </>
                  ) : (
                    <button
                      type="button"
                      className="stv-loadmore"
                      onClick={onLoadMore}
                    >
                      Load more
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
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

/**
 * One rendered board column. The board can be driven by two sources:
 *
 *   - DEFAULT: the object's SELECT group-by field — one column per SELECT
 *     option (+ an "Ungrouped" bucket). `value` is the SELECT option value the
 *     card's group field is set to when dropped here.
 *   - PIPELINE: a chosen sales pipeline's ordered stages — one column per
 *     stage (label + color), in stage order. `value` is the stage id the
 *     card's stage field is set to when dropped here.
 *
 * Either way a column owns its dropped-into write value (`value`), its display
 * (`label` + optional `color`), and its bucketed records. Header stats (count +
 * optional amount sum) are computed by the page so the same component renders
 * both modes.
 */
interface BoardColumn {
  /** Stable react key for the column. */
  key: string;
  /** The value the card's grouping/stage field is set to on drop here. */
  value: string | null;
  label: string;
  /** Resolved CSS color for the stage dot / chip (pipeline stages carry one). */
  color?: string;
  records: SabcrmRustRecord[];
  /** Summed metric (amount) for this column — present only when a metric
      field exists; rendered as the stage amount pill (opportunities). */
  amount?: number | null;
}

interface BoardViewProps {
  object: ObjectMetadata;
  /** Rendered columns (default group-by OR pipeline stages — see BoardColumn). */
  columns: BoardColumn[];
  previewFields: FieldMetadata[];
  /** When true, render pipeline-stage chrome (colored rail + stage header). */
  pipelineMode: boolean;
  /** Label of the metric field (amount) summed per column, if any. */
  metricLabel?: string;
  /**
   * Drop a card onto a different column → set its group/stage field to
   * `targetValue` (the target column's value, or `null` for the "Ungrouped"
   * bucket). The page owns the optimistic move + persistence + rollback; this
   * just reports the intent.
   */
  onMoveCard: (recordId: string, fromValue: string | null, targetValue: string | null) => void;
  /**
   * Move MANY cards to `targetValue` in one batch (multi-card drag). The page
   * persists with a single `bulkUpdateRecordsTw` and reconciles optimistically.
   * `moves` carries each card's source column so the page can lift them from
   * the right group on rollback.
   */
  onMoveCards: (
    moves: { recordId: string; fromValue: string | null }[],
    targetValue: string | null,
  ) => void;
  /** Records mid-flight to the engine — rendered with the "saving" ring. */
  savingIds: ReadonlySet<string>;
}

/** Stable key for a board column (the SELECT value, or a sentinel for null). */
const UNGROUPED_KEY = '__ungrouped__';
const colKey = (value: string | null): string => value ?? UNGROUPED_KEY;

/** Compact amount formatter for the per-stage sum pill. */
function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** What `dataTransfer` carries during a card drag (also kept in React state). */
interface DragPayload {
  recordId: string;
  fromValue: string | null;
}

function BoardView({
  object,
  columns,
  previewFields,
  pipelineMode,
  metricLabel,
  onMoveCard,
  onMoveCards,
  savingIds,
}: BoardViewProps) {
  // The card being dragged (drives the source "ghost" style + drop routing)
  // and the column currently hovered (drives the drop-target highlight).
  const [drag, setDrag] = React.useState<DragPayload | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  // ---- Multi-card selection ----------------------------------------------
  // Cmd/Ctrl-click toggles a card; Shift-click range-selects within the same
  // column; a marquee drag on empty board space rubber-band selects. Dragging
  // any selected card moves the WHOLE selection. A plain click still navigates.
  const [selectedCards, setSelectedCards] = React.useState<Set<string>>(
    () => new Set(),
  );
  // Anchor for shift-range selection (last single-clicked card id).
  const [anchorId, setAnchorId] = React.useState<string | null>(null);

  // Flatten the board's cards in column/visual order — the ordering used for
  // shift-range selection and to resolve the marquee hit-test deterministically.
  const flatOrder = React.useMemo(() => {
    const ids: string[] = [];
    for (const col of columns) for (const r of col.records) ids.push(r.id);
    return ids;
  }, [columns]);

  // Drop stale ids if the board's record set changes underneath us.
  React.useEffect(() => {
    setSelectedCards((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(flatOrder);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [flatOrder]);

  const clearCardSelection = React.useCallback(() => {
    setSelectedCards(new Set());
    setAnchorId(null);
  }, []);

  // Map each record id → its column value, so a multi-drag knows each card's
  // source column (needed for the optimistic lift + rollback).
  const fromValueById = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const col of columns) for (const r of col.records) m.set(r.id, col.value);
    return m;
  }, [columns]);

  // Click handler for a card: resolves modifier-click selection semantics and
  // returns whether navigation should be suppressed (true = selection action).
  const handleCardClick = React.useCallback(
    (recordId: string, e: React.MouseEvent): boolean => {
      // Toggle one card.
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        setSelectedCards((prev) => {
          const next = new Set(prev);
          if (next.has(recordId)) next.delete(recordId);
          else next.add(recordId);
          return next;
        });
        setAnchorId(recordId);
        return true;
      }
      // Range select from the anchor across the flattened order.
      if (e.shiftKey) {
        e.preventDefault();
        const from = anchorId ?? recordId;
        const a = flatOrder.indexOf(from);
        const b = flatOrder.indexOf(recordId);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          setSelectedCards((prev) => {
            const next = new Set(prev);
            for (let i = lo; i <= hi; i++) next.add(flatOrder[i]);
            return next;
          });
        }
        return true;
      }
      // Plain click on a multi-selection card: keep the selection, let the link
      // navigate (Twenty opens the clicked card). A plain click elsewhere is a
      // navigation too; selection is reset by the marquee/empty-space handler.
      return false;
    },
    [anchorId, flatOrder],
  );

  const endDrag = React.useCallback(() => {
    setDrag(null);
    setOverKey(null);
  }, []);

  const handleDrop = React.useCallback(
    (targetValue: string | null) => {
      if (!drag) return endDrag();
      // If the dragged card is part of a multi-selection (size > 1), move the
      // whole selection in one batch; otherwise fall back to the single move.
      const isMulti = selectedCards.has(drag.recordId) && selectedCards.size > 1;
      if (isMulti) {
        const moves = Array.from(selectedCards)
          // Don't re-write cards already in the target column.
          .filter((id) => (fromValueById.get(id) ?? null) !== targetValue)
          .map((id) => ({ recordId: id, fromValue: fromValueById.get(id) ?? null }));
        if (moves.length > 0) onMoveCards(moves, targetValue);
      } else if (drag.fromValue !== targetValue) {
        onMoveCard(drag.recordId, drag.fromValue, targetValue);
      }
      endDrag();
    },
    [drag, selectedCards, fromValueById, onMoveCard, onMoveCards, endDrag],
  );

  // ---- Marquee (rubber-band) selection -----------------------------------
  const boardRef = React.useRef<HTMLDivElement | null>(null);
  const [marquee, setMarquee] = React.useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  // Whether a marquee gesture is currently active (vs. just a stray click).
  const marqueeActive = React.useRef(false);
  // Selection captured at marquee start (additive when Shift/Cmd held).
  const marqueeBase = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      marqueeActive.current = true;
      const x1 = e.clientX;
      const y1 = e.clientY;
      setMarquee((m) => (m ? { ...m, x1, y1 } : m));
      // Hit-test every mounted card against the marquee rect (viewport coords).
      const root = boardRef.current;
      if (!root) return;
      const minX = Math.min(marquee.x0, x1);
      const maxX = Math.max(marquee.x0, x1);
      const minY = Math.min(marquee.y0, y1);
      const maxY = Math.max(marquee.y0, y1);
      const hits = new Set(marqueeBase.current);
      root
        .querySelectorAll<HTMLElement>('[data-stv-card-id]')
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          const intersects =
            r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY;
          if (intersects) {
            const id = el.getAttribute('data-stv-card-id');
            if (id) hits.add(id);
          }
        });
      setSelectedCards(hits);
    };
    const onUp = () => {
      setMarquee(null);
      // A click without movement clears the selection (empty-space click).
      if (!marqueeActive.current) {
        setSelectedCards(marqueeBase.current);
      }
      marqueeActive.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [marquee]);

  // Start a marquee only when the pointer goes down on empty board space (not
  // on a card, header, or scrollbar) with the primary button.
  const onBoardPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Ignore presses that land on a card / interactive element.
      if (target.closest('[data-stv-card-id]') || target.closest('a, button, input, select'))
        return;
      marqueeActive.current = false;
      marqueeBase.current =
        e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selectedCards) : new Set();
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) setSelectedCards(new Set());
      setAnchorId(null);
      setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
    },
    [selectedCards],
  );

  // Track the cursor during a multi-card drag to position the counter chip.
  const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const multiDragCount =
    drag && selectedCards.has(drag.recordId) && selectedCards.size > 1
      ? selectedCards.size
      : 0;

  const selectionCount = selectedCards.size;

  return (
    <>
      {selectionCount > 1 && (
        <div className="stv-board-bar" role="status" aria-live="polite">
          <span className="stv-board-bar__count">{selectionCount} selected</span>
          <button
            type="button"
            className="stv-board-bar__btn"
            onClick={clearCardSelection}
          >
            Clear
          </button>
          <span style={{ opacity: 0.8 }}>Drag any selected card to move all</span>
        </div>
      )}
      <div className="stv-board-hint" role="note">
        <span className="stx-kbd">click</span>
        <span>open</span>
        <span className="stx-kbd">⌘/ctrl-click</span>
        <span>multi-select</span>
        <span className="stx-kbd">shift-click</span>
        <span>range</span>
        <span className="stx-kbd">drag empty</span>
        <span>marquee</span>
      </div>
      <div
        className="st-board stv-board"
        ref={boardRef}
        onPointerDown={onBoardPointerDown}
      >
      {columns.map((column) => {
        const group = column;
        const label = column.label;
        const key = column.key;
        const isOver = drag !== null && overKey === key && drag.fromValue !== column.value;
        const isCandidate = drag !== null && drag.fromValue !== column.value;
        const hasAmount =
          column.amount !== undefined && column.amount !== null;
        return (
          <div
            className={`st-board__col st-board__col--dnd${
              isCandidate ? ' st-board__col--drop-candidate' : ''
            }${pipelineMode ? ' stpb-col' : ''}`}
            key={key}
            style={
              pipelineMode && column.color
                ? ({ ['--stpb-stage-color' as string]: column.color } as React.CSSProperties)
                : undefined
            }
          >
            {pipelineMode ? (
              <div className="stpb-head">
                <span className="stpb-head__name">
                  <span className="stpb-head__dot" aria-hidden="true" />
                  <span className="stpb-head__label" title={label}>
                    {label}
                  </span>
                </span>
                <span className="stpb-head__stats">
                  {hasAmount && (
                    <span
                      className="stpb-head__amount"
                      title={metricLabel ? `Sum of ${metricLabel}` : 'Sum'}
                    >
                      {fmtAmount(column.amount)}
                    </span>
                  )}
                  <span className="stpb-head__count">{column.records.length}</span>
                </span>
              </div>
            ) : (
              <div className="st-board__head">
                <TwentyChip label={label} color={column.color} />
                <span className="st-board__count">{column.records.length}</span>
              </div>
            )}
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
                  const isSelected = selectedCards.has(record.id);
                  // Visual role while a multi-selection is being dragged: the
                  // grabbed card is the "primary", the rest are "members".
                  const inDraggedSet =
                    drag !== null &&
                    selectedCards.has(drag.recordId) &&
                    selectedCards.size > 1 &&
                    isSelected;
                  const isDragPrimary = inDraggedSet && isDragging;
                  const isDragMember = inDraggedSet && !isDragging;
                  return (
                    <Link
                      key={record.id}
                      href={`/sabcrm/${object.slug}/${record.id}`}
                      data-stv-card-id={record.id}
                      className={`st-card st-card--draggable${
                        isDragging ? ' st-card--dragging' : ''
                      }${isSaving ? ' st-card--saving' : ''}${
                        isSelected ? ' stv-card--selected' : ''
                      }${isDragPrimary ? ' stv-card--drag-primary' : ''}${
                        isDragMember ? ' stv-card--drag-member' : ''
                      }`}
                      aria-selected={isSelected}
                      draggable={!isSaving}
                      onDragStart={(e) => {
                        // If the grabbed card isn't in the current selection,
                        // the drag is a single-card move — collapse selection
                        // to just it so the multi-path doesn't fire by mistake.
                        if (!selectedCards.has(record.id)) {
                          setSelectedCards(new Set([record.id]));
                          setAnchorId(record.id);
                        }
                        const payload: DragPayload = {
                          recordId: record.id,
                          fromValue: group.value,
                        };
                        e.dataTransfer.effectAllowed = 'move';
                        // Plain-text fallback so external/native targets see
                        // something sane; React state is the real channel.
                        e.dataTransfer.setData('text/plain', record.id);
                        setDrag(payload);
                        setDragPos({ x: e.clientX, y: e.clientY });
                        setOverKey(null);
                      }}
                      onDrag={(e) => {
                        // clientX/Y is 0 on the final drag event in some
                        // browsers — guard so the chip doesn't jump to origin.
                        if (e.clientX || e.clientY)
                          setDragPos({ x: e.clientX, y: e.clientY });
                      }}
                      onDragEnd={() => {
                        endDrag();
                        setDragPos(null);
                      }}
                      // A drag must not also fire the link navigation; modifier
                      // clicks are selection actions (also suppress navigation).
                      onClick={(e) => {
                        if (drag) {
                          e.preventDefault();
                          return;
                        }
                        if (handleCardClick(record.id, e)) return;
                        // Plain click → navigation proceeds; record the anchor.
                        setAnchorId(record.id);
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

      {/* Rubber-band marquee rectangle (fixed/viewport coords). */}
      {marquee && marqueeActive.current && (
        <div
          className="stv-marquee"
          aria-hidden="true"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}

      {/* Multi-card drag counter chip near the cursor. */}
      {multiDragCount > 0 && dragPos && (
        <div
          className="stv-dragcount"
          aria-hidden="true"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {multiDragCount} cards
        </div>
      )}
    </>
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
    <div
      className="st-table-wrap"
      style={{ padding: 'var(--st-space-3)' }}
      role="status"
      aria-busy="true"
      aria-label="Loading records"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" aria-hidden="true" />
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

  // Flat-table load strategy. 'scroll' (default) accumulates pages on scroll
  // with row windowing; 'paged' is the classic footer pagination. The toggle
  // lives above the table.
  const [scrollMode, setScrollMode] = React.useState<TableScrollMode>('scroll');
  // A next-page append is in flight (distinct from the initial-load skeleton).
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Favorites for this object (set of recordIds), loaded once per page.
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [favBusy, setFavBusy] = React.useState<Set<string>>(new Set());

  // Sales pipelines whose `object` matches this slug, loaded once per project.
  // When the user picks one, the board columns become that pipeline's ordered
  // stages (label + color) instead of the default SELECT-field grouping.
  const [pipelines, setPipelines] = React.useState<SabcrmRustPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(
    null,
  );

  // Workspace tag definitions ({ id, name, color }), loaded once per project.
  // Applied tags live on each record at `data.__tags` (string[] of tag ids).
  const [tags, setTags] = React.useState<SabcrmRustTag[]>([]);
  const [tagsLoading, setTagsLoading] = React.useState(true);
  // Toolbar "Tag" filter: the selected tag id to narrow rows to, or null.
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  // Multi-select state for bulk actions (set of recordIds).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  // Anchor row index for Shift-click / Shift-keyboard range selection. The
  // anchor is the last single-toggled row; a subsequent Shift action fills the
  // contiguous range between it and the new row (Twenty's range-select model).
  const selectionAnchor = React.useRef<number | null>(null);
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
    setSelectedPipelineId(null);
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
    const aggFilters = viewStateToEngineFilters(viewState);
    const hasAggFilters = Object.keys(aggFilters).length > 0;
    (async () => {
      try {
        const res = await aggregateSabcrmRecordsTw(
          objectSlug,
          {
            groupByField: aggGroupField.key,
            metric,
            metricField: metricField?.key,
            filters: hasAggFilters ? aggFilters : undefined,
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
  }, [objectSlug, aggGroupField, metricField, viewState, activeProjectId, refreshTick]);

  // Load records / board whenever the query changes.
  React.useEffect(() => {
    if (!object || !objectSlug) return;
    let cancelled = false;
    // In scroll mode, fetching page > 1 is an APPEND — don't flash the
    // skeleton over the rows already on screen; show the inline sentinel
    // spinner instead. Page 1 (or paged mode) is a fresh load.
    const isAppend = !grouped && scrollMode === 'scroll' && page > 1;
    if (isAppend) setLoadingMore(true);
    else setLoadingData(true);
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
          if (!isAppend) {
            setRecords([]);
            setTotal(0);
          }
        } else if (isAppend) {
          // Append the next page, de-duping by id so an overlapping window or
          // a concurrent refetch never doubles a row.
          setRecords((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            const fresh = res.data.records.filter((r) => !seen.has(r.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          setTotal(res.data.total);
        } else {
          setRecords(res.data.records);
          setTotal(res.data.total);
        }
      }
      if (isAppend) setLoadingMore(false);
      else setLoadingData(false);
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
    scrollMode,
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

  // Infinite-scroll bookkeeping. In 'scroll' mode `records` accumulates across
  // pages, so more remain whenever fewer have loaded than the server-reported
  // total. A tag filter is a client-side narrowing on already-loaded rows, so
  // it doesn't change whether the SERVER has more to give.
  const hasMore =
    scrollMode === 'scroll' && !grouped && records.length < total;

  // Ask for the next page (scroll trigger or the "Load more" button). Guarded
  // so overlapping triggers can't stack page bumps while a fetch is in flight.
  const loadMore = React.useCallback(() => {
    if (loadingMore || loadingData) return;
    if (records.length >= total) return;
    setPage((p) => p + 1);
  }, [loadingMore, loadingData, records.length, total]);

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

  // Pipelines targeting THIS object — these are the ones offered in the board
  // "Pipeline" selector. A pipeline matches when `pipeline.object === slug`.
  // Declared here (above `handleMoveCard`) so the board move handler can read
  // `pipelineActive` without hitting a temporal-dead-zone reference.
  const objectPipelines = React.useMemo(
    () => pipelines.filter((p) => p.object === objectSlug),
    [pipelines, objectSlug],
  );

  // The chosen pipeline (if any). Defaults to none — the board then keeps its
  // default SELECT-field grouping. If the selected id no longer resolves (e.g.
  // the pipeline was deleted), this is `null` and the board falls back.
  const selectedPipeline = React.useMemo(
    () =>
      selectedPipelineId
        ? objectPipelines.find((p) => p.id === selectedPipelineId) ?? null
        : null,
    [objectPipelines, selectedPipelineId],
  );

  // A pipeline is only ACTIVE on the board when one is chosen AND we're in
  // board view AND we have a stage field to bucket/persist on. (We reuse the
  // board's group-by SELECT field as the record's stage field.)
  const pipelineActive = !!selectedPipeline && view === 'board' && !!boardField;

  // Board drag-and-drop: move a card to another column = set its group/stage
  // field to the target column's value. Optimistic (the card jumps columns
  // immediately), persisted via the Rust engine, rolled back on error into the
  // existing `dataError` banner.
  //
  // Two modes share this path:
  //   - PIPELINE: columns are pipeline stages; `targetValue` is a STAGE ID. The
  //     buckets are derived from each record's stage-field value, so we just
  //     rewrite that field on the record wherever it lives in `groups` and let
  //     `boardColumns` re-bucket it into the target stage column.
  //   - DEFAULT: columns are engine `groups`; we lift the card from its source
  //     group and append it to the target group (original behavior).
  const handleMoveCard = React.useCallback(
    async (recordId: string, fromValue: string | null, targetValue: string | null) => {
      if (!groupField) return;
      if (fromValue === targetValue) return;
      if (movingCards.has(recordId)) return;

      const key = groupField.key;
      const prevGroups = groups;

      if (pipelineActive) {
        // Find the card anywhere in the (flattened) groups and confirm it still
        // resolves; the stage field is rewritten in place so `boardColumns`
        // re-derives the new stage column on the next render.
        const exists = prevGroups.some((g) =>
          g.records.some((r) => r.id === recordId),
        );
        if (!exists) return;

        setGroups((gs) =>
          gs.map((g) => ({
            ...g,
            records: g.records.map((r) =>
              r.id === recordId
                ? { ...r, data: { ...r.data, [key]: targetValue } }
                : r,
            ),
          })),
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
          setGroups(prevGroups);
          setDataError(res.error);
          return;
        }
        // Reconcile the moved card with the engine's canonical record.
        setGroups((gs) =>
          gs.map((g) => ({
            ...g,
            records: g.records.map((r) => (r.id === recordId ? res.data : r)),
          })),
        );
        return;
      }

      // ---- Default group-by reshuffle (unchanged) --------------------------
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
    [groupField, groups, movingCards, objectSlug, activeProjectId, pipelineActive],
  );

  // Batch move (multi-card drag): set every supplied record's group/stage
  // field to `targetValue` in ONE `bulkUpdateRecordsTw`. Optimistic — the
  // cards jump columns immediately — with rollback of the whole `groups`
  // snapshot on error. Works for both pipeline and default group-by boards:
  // pipeline mode rewrites the field in place (boardColumns re-buckets),
  // default mode lifts each card from its source group into the target group.
  const handleMoveCards = React.useCallback(
    async (
      moves: { recordId: string; fromValue: string | null }[],
      targetValue: string | null,
    ) => {
      if (!groupField || moves.length === 0) return;
      // Skip cards already saving or already in the target column.
      const filtered = moves.filter(
        (m) => m.fromValue !== targetValue && !movingCards.has(m.recordId),
      );
      if (filtered.length === 0) return;

      const key = groupField.key;
      const ids = filtered.map((m) => m.recordId);
      const idSet = new Set(ids);
      const prevGroups = groups;

      // Optimistic update of the grouped board state.
      if (pipelineActive) {
        // Rewrite the stage field on each moved card wherever it lives; the
        // board re-buckets on the next render.
        setGroups((gs) =>
          gs.map((g) => ({
            ...g,
            records: g.records.map((r) =>
              idSet.has(r.id)
                ? { ...r, data: { ...r.data, [key]: targetValue } }
                : r,
            ),
          })),
        );
      } else {
        // Lift each moved card out of its source group and append (rewritten)
        // to the target group.
        const liftedById = new Map<string, SabcrmRustRecord>();
        for (const g of prevGroups) {
          for (const r of g.records) {
            if (idSet.has(r.id)) {
              liftedById.set(r.id, {
                ...r,
                data: { ...r.data, [key]: targetValue },
              });
            }
          }
        }
        setGroups((gs) =>
          gs.map((g) => {
            if (g.value === targetValue) {
              const appended = ids
                .map((id) => liftedById.get(id))
                .filter((r): r is SabcrmRustRecord => !!r);
              return { ...g, records: [...g.records, ...appended] };
            }
            return { ...g, records: g.records.filter((r) => !idSet.has(r.id)) };
          }),
        );
      }

      setMovingCards((m) => {
        const n = new Set(m);
        for (const id of ids) n.add(id);
        return n;
      });
      setDataError(null);

      const res = await bulkUpdateRecordsTw(
        objectSlug,
        ids,
        { [key]: targetValue },
        activeProjectId ?? undefined,
      );

      setMovingCards((m) => {
        const n = new Set(m);
        for (const id of ids) n.delete(id);
        return n;
      });

      if (!res.ok) {
        setGroups(prevGroups); // rollback the whole snapshot
        setDataError(res.error);
        return;
      }
      // Pull canonical records so any server-side derived fields are reflected.
      setRefreshTick((t) => t + 1);
    },
    [groupField, groups, movingCards, objectSlug, activeProjectId, pipelineActive],
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

  // Load the project's sales pipelines once per project (graceful on failure).
  // We keep them all and filter to this object's slug at render time.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listPipelinesTw(activeProjectId ?? undefined);
      if (cancelled) return;
      setPipelines(res.ok ? res.data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Sum a numeric (amount) metric over a record set — used for the per-stage
  // amount pill. Returns null when there's no metric field configured.
  const sumMetric = React.useCallback(
    (recs: SabcrmRustRecord[]): number | null => {
      if (!metricField) return null;
      let total = 0;
      for (const r of recs) {
        const raw = r.data[metricField.key];
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isNaN(n)) total += n;
      }
      return total;
    },
    [metricField],
  );

  // The `group` engine endpoint can't take a filter / search / sort predicate,
  // so the Board (and grouped table) would otherwise ignore the active Filter,
  // search box, and Sort. We narrow + order the fetched groups client-side here
  // with the SAME operator semantics the flat list uses (`recordMatchesFilters`
  // + a free-text scan + the view-bar sort), so every view stays consistent.
  const displayGroups = React.useMemo<SabcrmRecordTwGroup[]>(() => {
    if (!grouped || !object) return groups;

    const hasFilters = countConditions(viewState.filters) > 0;
    const q = search.trim().toLowerCase();
    const sortKey = viewState.sortBy;
    const dir = viewState.sortDir === 'desc' ? -1 : 1;

    // A record matches the free-text query when ANY of its scalar field values
    // contains it (mirrors the engine's `q` across text-ish fields).
    const matchesSearch = (rec: SabcrmRustRecord): boolean => {
      if (!q) return true;
      const data = rec.data ?? {};
      for (const v of Object.values(data)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'object') continue; // skip arrays / nested blobs
        if (String(v).toLowerCase().includes(q)) return true;
      }
      // Fall back to the record's display label too.
      return recordLabel(object, rec).toLowerCase().includes(q);
    };

    const cmp = (a: SabcrmRustRecord, b: SabcrmRustRecord): number => {
      if (!sortKey) return 0;
      const av = a.data?.[sortKey];
      const bv = b.data?.[sortKey];
      // Nulls sort last regardless of direction.
      const an = av === null || av === undefined || av === '';
      const bn = bv === null || bv === undefined || bv === '';
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      const aNum = typeof av === 'number' ? av : Number(av);
      const bNum = typeof bv === 'number' ? bv : Number(bv);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return (aNum - bNum) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    };

    return groups.map((g) => {
      let recs = g.records;
      if (hasFilters) {
        recs = recs.filter((r) => recordMatchesFilters(r.data, viewState.filters));
      }
      if (q) recs = recs.filter(matchesSearch);
      if (sortKey) recs = [...recs].sort(cmp);
      return recs === g.records ? g : { ...g, records: recs };
    });
  }, [grouped, groups, viewState.filters, viewState.sortBy, viewState.sortDir, search, object]);

  // The columns the board renders. Two modes:
  //
  //   - PIPELINE (a pipeline is chosen): one column per stage, in stage order,
  //     carrying the stage's label + color. Records are bucketed by matching
  //     their stage field value (read from `groupField`) to the stage's id OR
  //     label (case-insensitively), so legacy records keyed by label still land
  //     in the right column. Dropping a card writes the STAGE ID.
  //   - DEFAULT (no pipeline): the engine-provided `groups`, mapped 1:1 — the
  //     existing behavior, untouched.
  const boardColumns = React.useMemo<BoardColumn[]>(() => {
    if (pipelineActive && selectedPipeline && groupField) {
      const key = groupField.key;
      // Index every loaded record by its (normalized) stage value so each can
      // be matched to a stage by id or label.
      const norm = (v: unknown): string =>
        v === null || v === undefined ? '' : String(v).trim().toLowerCase();
      const allRecords = displayGroups.flatMap((g) => g.records);
      // Build a lookup from a normalized stage token → stage id, so a record
      // whose field holds either the id or the label resolves to the stage.
      const tokenToStageId = new Map<string, string>();
      for (const stage of selectedPipeline.stages) {
        tokenToStageId.set(norm(stage.id), stage.id);
        tokenToStageId.set(norm(stage.label), stage.id);
      }
      // Bucket records.
      const byStage = new Map<string, SabcrmRustRecord[]>();
      const unbucketed: SabcrmRustRecord[] = [];
      for (const rec of allRecords) {
        const token = norm(rec.data[key]);
        const stageId = token ? tokenToStageId.get(token) : undefined;
        if (stageId) {
          const arr = byStage.get(stageId) ?? [];
          arr.push(rec);
          byStage.set(stageId, arr);
        } else {
          unbucketed.push(rec);
        }
      }

      const cols: BoardColumn[] = selectedPipeline.stages.map((stage) => {
        const recs = byStage.get(stage.id) ?? [];
        return {
          key: `stage:${stage.id}`,
          // Dropping a card here writes the stage id into the stage field.
          value: stage.id,
          label: stage.label,
          color: chipColor(stage.color),
          records: recs,
          amount: sumMetric(recs),
        };
      });
      // Records that don't match any stage get an "Unstaged" bucket so they're
      // never hidden. Dropping into a stage moves them in; this column itself
      // isn't a drop target value (null) — same as the default Ungrouped.
      if (unbucketed.length > 0) {
        cols.push({
          key: UNGROUPED_KEY,
          value: null,
          label: 'Unstaged',
          records: unbucketed,
          amount: sumMetric(unbucketed),
        });
      }
      return cols;
    }

    // Default behavior: map the engine groups 1:1 (no amount pill, no rail).
    return displayGroups.map((group) => {
      const opt =
        group.value === null
          ? undefined
          : groupField?.options?.find((o) => o.value === group.value);
      return {
        key: colKey(group.value),
        value: group.value,
        label: opt?.label ?? group.value ?? 'Ungrouped',
        color: chipColor(opt?.color),
        records: group.records,
      };
    });
  }, [pipelineActive, selectedPipeline, groupField, displayGroups, sumMetric]);

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

  // Toggle one row, optionally extending a contiguous range from the anchor
  // when `shiftKey` is held (Twenty's Shift-click range select). The anchor is
  // the index of the last plain (non-shift) toggle; a Shift toggle fills every
  // row between the anchor and the clicked row to the clicked row's NEXT state.
  const toggleSelectAt = React.useCallback(
    (index: number, shiftKey: boolean) => {
      const rec = visibleRecords[index];
      if (!rec) return;

      if (shiftKey && selectionAnchor.current !== null) {
        const anchor = selectionAnchor.current;
        const lo = Math.min(anchor, index);
        const hi = Math.max(anchor, index);
        setSelected((prev) => {
          // Range select adds the whole span (Twenty selects, never toggles, on
          // a Shift-click range), so the gesture is predictable.
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) {
            const r = visibleRecords[i];
            if (r) next.add(r.id);
          }
          return next;
        });
        // Keep the anchor where it was so successive shift-clicks re-anchor from
        // the same origin (matches native list-box range behavior).
        return;
      }

      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(rec.id)) next.delete(rec.id);
        else next.add(rec.id);
        return next;
      });
      selectionAnchor.current = index;
    },
    [visibleRecords],
  );

  // Toggle a single row by id (keyboard `x`, per-row API). Resolves the row's
  // current index so it can also seed the range-select anchor.
  const toggleSelect = React.useCallback(
    (recordId: string) => {
      const index = visibleRecords.findIndex((r) => r.id === recordId);
      if (index < 0) return;
      toggleSelectAt(index, false);
    },
    [visibleRecords, toggleSelectAt],
  );

  const toggleSelectAll = React.useCallback(() => {
    setSelected((prev) => {
      const allSelected =
        visibleRecords.length > 0 && visibleRecords.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(visibleRecords.map((r) => r.id));
    });
    selectionAnchor.current = null;
  }, [visibleRecords]);

  const clearSelection = React.useCallback(() => {
    setSelected(new Set());
    selectionAnchor.current = null;
  }, []);

  // ---- Keyboard navigation ------------------------------------------------

  // The active-row cursor only makes sense for the current record window, so
  // reset it whenever that window changes (object / page / filters / view).
  React.useEffect(() => {
    setActiveRow(null);
  }, [objectSlug, search, viewState, view, page, limit, refreshTick, tagFilter]);

  const onSetActiveRow = React.useCallback((index: number | null) => {
    setActiveRow(index);
  }, []);

  // ↑/↓ (or k/j) move the cursor, Enter opens the row, x / Space toggles its
  // checkbox, Shift+↑/↓ extends the selection range, Esc clears. Typing in a
  // cell input/select/textarea is never hijacked, and Cmd/Ctrl/Alt-chorded keys
  // fall through to the browser / inline-edit shortcuts. Shift is handled here
  // (range select), so it is intentionally NOT in the early-return guard.
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
        // Shift+Arrow extends the selection from the current cursor to the new
        // row (Twenty's keyboard range select), mirroring Shift-click ranges.
        if (e.shiftKey) {
          const fromIdx = activeRow === null ? clamped : activeRow;
          // Seed the anchor at the gesture's origin if there isn't one yet.
          if (selectionAnchor.current === null) selectionAnchor.current = fromIdx;
          toggleSelectAt(clamped, true);
        }
        setActiveRow(clamped);
        // Keep the highlighted row in view as the cursor walks the list. With
        // row windowing the target row may not be mounted yet — fall back to a
        // pixel-estimate scroll on the viewport so the next render windows it
        // in. (The DOM index lookup is only valid when every row is mounted.)
        const wrap = tableRef.current;
        const rows = wrap?.querySelectorAll<HTMLTableRowElement>(
          'tbody tr.st-row:not(.stx-group-row):not(.stv-spacer)',
        );
        const row = rows?.[clamped];
        if (row) {
          row.scrollIntoView({ block: 'nearest' });
        } else if (wrap) {
          // Windowed + off-screen: nudge the viewport to roughly the row's
          // position so it mounts; the next keypress refines via the DOM path.
          wrap.scrollTo({ top: clamped * EST_ROW_HEIGHT, behavior: 'auto' });
        }
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
        case 'X':
        case ' ': {
          if (activeRow === null) return;
          if (visibleRecords[activeRow]) {
            e.preventDefault();
            // Shift+x / Shift+Space toggles as a range fill from the anchor.
            toggleSelectAt(activeRow, e.shiftKey);
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
    [visibleRecords, activeRow, router, objectSlug, toggleSelectAt, clearSelection],
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

  // Shared engine path for every "$set one field on the selection" bulk action
  // (Set field, Move stage). Applies the patch optimistically, persists via the
  // gated `bulkUpdateRecordsTw`, rolls back + surfaces the error on failure, and
  // clears the selection on success. `patchFor` lets callers derive a per-record
  // patch (e.g. tag-merge needs each record's existing `__tags`).
  const runBulkPatch = React.useCallback(
    async (patchFor: (record: SabcrmRustRecord) => Record<string, unknown>) => {
      if (bulkUpdating) return;
      const ids = Array.from(selected);
      if (ids.length === 0) return;

      const prev = records;
      const idSet = new Set(ids);

      // Build each record's patch up-front so a uniform patch can be sent in one
      // call, while per-record patches (tags) still update the local rows right.
      const patches = new Map<string, Record<string, unknown>>();
      for (const r of prev) {
        if (idSet.has(r.id)) patches.set(r.id, patchFor(r));
      }

      setBulkUpdating(true);
      setDataError(null);
      setRecords((rs) =>
        rs.map((r) =>
          patches.has(r.id)
            ? { ...r, data: { ...r.data, ...patches.get(r.id) } }
            : r,
        ),
      );

      // If every record gets the SAME patch (Set field / Move stage), one bulk
      // call suffices. Tag-merge produces per-record patches, so fall back to a
      // small fan-out of single-record updates in that case.
      const uniform = (() => {
        let json: string | null = null;
        for (const p of patches.values()) {
          const s = JSON.stringify(p);
          if (json === null) json = s;
          else if (json !== s) return null;
        }
        return json !== null ? (JSON.parse(json) as Record<string, unknown>) : null;
      })();

      let ok = true;
      let errMsg = 'Failed to update records.';
      if (uniform) {
        const res = await bulkUpdateRecordsTw(
          objectSlug,
          ids,
          uniform,
          activeProjectId ?? undefined,
        );
        ok = res.ok;
        if (!res.ok) errMsg = res.error;
      } else {
        // Per-record patches: persist each, but stop reporting OK if any fail.
        const results = await Promise.all(
          ids.map((id) =>
            updateSabcrmRecordTw(
              objectSlug,
              id,
              patches.get(id) ?? {},
              activeProjectId ?? undefined,
            ),
          ),
        );
        const firstErr = results.find((r) => !r.ok);
        if (firstErr && !firstErr.ok) {
          ok = false;
          errMsg = firstErr.error;
        }
      }
      setBulkUpdating(false);

      if (!ok) {
        setRecords(prev); // rollback
        setDataError(errMsg);
        return;
      }
      setSelected(new Set());
      selectionAnchor.current = null;
      setRefreshTick((t) => t + 1);
    },
    [bulkUpdating, selected, records, objectSlug, activeProjectId],
  );

  // Bulk set the object's primary SELECT field on every selected record.
  const handleBulkSet = React.useCallback(
    (value: string) => {
      if (!bulkEditField) return;
      const key = bulkEditField.key;
      void runBulkPatch(() => ({ [key]: value }));
    },
    [bulkEditField, runBulkPatch],
  );

  // Bulk move every selected record to a stage (the board group-by SELECT).
  const handleMoveStage = React.useCallback(
    (value: string) => {
      if (!boardField) return;
      const key = boardField.key;
      void runBulkPatch(() => ({ [key]: value }));
    },
    [boardField, runBulkPatch],
  );

  // Bulk add a tag to every selected record — merge the tag id into each
  // record's `__tags` list (skip records that already carry it).
  const handleBulkAddTag = React.useCallback(
    (tagId: string) => {
      void runBulkPatch((record) => {
        const current = recordTagIds(record);
        if (current.includes(tagId)) return {}; // no-op patch (already tagged)
        return { [TAGS_KEY]: [...current, tagId] };
      });
    },
    [runBulkPatch],
  );

  // Export the selected records as a CSV (client-side download — Twenty's
  // record-table export). Columns are the currently-visible table columns plus
  // the record label; values are serialized via the same display coercion the
  // table uses. Degrades to a no-op when nothing is selected.
  const handleExport = React.useCallback(() => {
    if (!object) return;
    const idSet = selected;
    const rows = records.filter((r) => idSet.has(r.id));
    if (rows.length === 0) return;

    const cols = columns;
    const header = ['Name', ...cols.map((c) => c.label)];

    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      let s: string;
      if (Array.isArray(v)) s = v.join('; ');
      else if (typeof v === 'object') s = JSON.stringify(v);
      else s = String(v);
      // RFC-4180 quoting + a leading-formula guard so a value like "=cmd" is
      // never auto-executed by a spreadsheet on open.
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [header.map(esc).join(',')];
    for (const r of rows) {
      const cells = [
        recordLabel(object, r),
        ...cols.map((c) => r.data?.[c.key]),
      ];
      lines.push(cells.map(esc).join(','));
    }

    const csv = '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${object.slug}-selection-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [object, selected, records, columns]);

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
          <span className="st-empty__icon" aria-hidden="true">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Object not found</h2>
          <p className="st-empty__desc">
            No CRM object matches “{objectSlug}”. It may have been removed or you
            may not have access.
          </p>
          <Link
            href="/sabcrm"
            className="st-btn st-btn--secondary"
            style={{ textDecoration: 'none' }}
          >
            Back to SabCRM
          </Link>
        </div>
      </div>
    );
  }

  const isEmpty = grouped
    ? boardColumns.every((c) => c.records.length === 0)
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

      {/* Pipeline selector — board view only, and only when this object has at
          least one sales pipeline. Choosing one makes the board columns the
          pipeline's ordered stages (overriding the default SELECT grouping);
          choosing "None" restores the default board behavior. */}
      {view === 'board' && objectPipelines.length > 0 && (
        <div className="stpb-bar" role="group" aria-label="Pipeline">
          <span className="stpb-bar__label">
            <GitBranch className="stpb-bar__icon" size={14} aria-hidden="true" />
            Pipeline
          </span>
          <select
            className={`stpb-select${selectedPipeline ? ' is-active' : ''}`}
            aria-label="Choose a pipeline for the board"
            value={selectedPipeline?.id ?? ''}
            onChange={(e) =>
              setSelectedPipelineId(e.target.value === '' ? null : e.target.value)
            }
          >
            <option value="">None — default grouping</option>
            {objectPipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
          {selectedPipeline && (
            <>
              <span className="stpb-bar__pill">
                {selectedPipeline.stages.length}{' '}
                {selectedPipeline.stages.length === 1 ? 'stage' : 'stages'}
              </span>
              <button
                type="button"
                className="stpb-bar__clear"
                onClick={() => setSelectedPipelineId(null)}
              >
                <X size={13} aria-hidden="true" />
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {loadingData ? (
        <TableSkeleton />
      ) : isEmpty ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
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
          columns={boardColumns}
          previewFields={previewFields}
          pipelineMode={pipelineActive}
          metricLabel={metricField?.label}
          onMoveCard={handleMoveCard}
          onMoveCards={handleMoveCards}
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
            <span className="stx-kbd">shift-↑↓</span>
            <span>range</span>
            <span className="stx-kbd">esc</span>
            <span>clear</span>
          </div>
          <div className="stv-modebar" role="group" aria-label="Row loading mode">
            <span>Rows:</span>
            <button
              type="button"
              className={`stv-modebar__btn${
                scrollMode === 'scroll' ? ' is-active' : ''
              }`}
              aria-pressed={scrollMode === 'scroll'}
              onClick={() => {
                setScrollMode('scroll');
                setPage(1);
              }}
            >
              Infinite scroll
            </button>
            <button
              type="button"
              className={`stv-modebar__btn${
                scrollMode === 'paged' ? ' is-active' : ''
              }`}
              aria-pressed={scrollMode === 'paged'}
              onClick={() => {
                setScrollMode('paged');
                setPage(1);
              }}
            >
              Pages
            </button>
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
            onToggleSelectAt={toggleSelectAt}
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
            scrollMode={scrollMode}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            windowingEnabled={!aggGroupField}
          />
          {scrollMode === 'paged' ? (
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
          ) : (
            <div className="stv-modebar" aria-live="polite">
              <span>
                Showing {visibleRecords.length} of {total}
              </span>
            </div>
          )}
        </>
      )}

      {/* Selection bar — only meaningful in the flat table view. */}
      {!grouped && (
        <SabcrmBulkBar
          count={selected.size}
          editField={bulkEditField}
          stageField={boardField}
          tags={tags}
          deleting={bulkDeleting}
          updating={bulkUpdating}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
          onBulkSet={handleBulkSet}
          onMoveStage={boardField ? handleMoveStage : undefined}
          onAddTag={tags.length > 0 ? handleBulkAddTag : undefined}
          onExport={handleExport}
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
