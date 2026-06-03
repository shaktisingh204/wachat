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
import { useParams } from 'next/navigation';
import {
  Plus,
  Search,
  AlertTriangle,
  Database,
  Loader2,
  Table2,
  Columns3,
  Star,
  X,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton, TwentyChip } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import '@/components/sabcrm/twenty/twenty-activity.css';
import './bulk-bar.css';
import {
  SabcrmViewBar,
  EMPTY_VIEW_STATE,
  viewStateToEngineFilters,
  type ViewState,
} from './view-bar';
import { SabcrmBulkBar } from './bulk-bar';
import { SabcrmPagination } from './pagination';
import './pagination.css';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
  groupSabcrmRecordsTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
} from '@/app/actions/sabcrm-twenty.actions';
import {
  bulkDeleteRecordsTw,
  bulkUpdateRecordsTw,
} from '@/app/actions/sabcrm-bulk.actions';
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
}: TableViewProps) {
  const allSelected = records.length > 0 && records.every((r) => selected.has(r.id));
  const someSelected = records.some((r) => selected.has(r.id));

  return (
    <div className="st-table-wrap">
      <table className="st-table">
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
            {columns.map((col) => {
              const sortable = SORTABLE_HEADER.has(col.type);
              const active = sortBy === col.key;
              if (!sortable) {
                return <th key={col.key}>{col.label}</th>;
              }
              return (
                <th
                  key={col.key}
                  aria-sort={
                    active
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
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
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isFav = favorites.has(record.id);
            const isSelected = selected.has(record.id);
            return (
            <tr
              key={record.id}
              className={`st-row${isSelected ? ' is-selected' : ''}`}
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
            );
          })}
        </tbody>
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
}

function BoardView({ object, groupByField, groups, previewFields }: BoardViewProps) {
  const optionFor = (value: string | null) =>
    value === null
      ? undefined
      : groupByField.options?.find((o) => o.value === value);

  return (
    <div className="st-board">
      {groups.map((group) => {
        const opt = optionFor(group.value);
        const label = opt?.label ?? group.value ?? 'Ungrouped';
        return (
          <div className="st-board__col" key={group.value ?? '__ungrouped__'}>
            <div className="st-board__head">
              <TwentyChip label={label} color={chipColor(opt?.color)} />
              <span className="st-board__count">{group.records.length}</span>
            </div>
            <div className="st-board__body">
              {group.records.length === 0 ? (
                <div className="st-board__empty">Nothing here</div>
              ) : (
                group.records.map((record) => (
                  <Link
                    key={record.id}
                    href={`/sabcrm/${object.slug}/${record.id}`}
                    className="st-card"
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
                ))
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

  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [groups, setGroups] = React.useState<SabcrmRecordTwGroup[]>([]);
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

  // Multi-select state for bulk actions (set of recordIds).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkUpdating, setBulkUpdating] = React.useState(false);

  // Reset transient state when the object changes.
  React.useEffect(() => {
    setSearchInput('');
    setSearch('');
    setView('table');
    setViewState(EMPTY_VIEW_STATE);
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
  // resolved object changes (the Fields popover then mutates this set).
  React.useEffect(() => {
    if (!object) return;
    const defaults = object.fields.filter((f) => f.inTable).map((f) => f.key);
    setVisibleColumns(new Set(defaults.length ? defaults : object.fields.slice(0, 5).map((f) => f.key)));
  }, [object]);

  const toggleColumn = React.useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const columns = React.useMemo(
    () =>
      object ? object.fields.filter((f) => visibleColumns.has(f.key)) : [],
    [object, visibleColumns],
  );
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
        records.length > 0 && records.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(records.map((r) => r.id));
    });
  }, [records]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

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
    : records.length === 0;

  const hasActiveQuery =
    !!search || viewState.filters.length > 0 || !!viewState.sortBy;

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
        <div className="st-toolbar__spacer" />
        {!loadingData && !grouped && (
          <span className="st-count">
            {total} {total === 1 ? object.labelSingular.toLowerCase() : object.labelPlural.toLowerCase()}
          </span>
        )}
        {canBoard && (
          <div className="st-viewswitch" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-pressed={view === 'table'}
              className={`st-viewswitch__btn${view === 'table' ? ' active' : ''}`}
              onClick={() => setView('table')}
            >
              <Table2 size={14} />
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-pressed={view === 'board'}
              className={`st-viewswitch__btn${view === 'board' ? ' active' : ''}`}
              onClick={() => setView('board')}
            >
              <Columns3 size={14} />
              Board
            </button>
          </div>
        )}
      </div>

      <SabcrmViewBar
        object={object}
        state={viewState}
        onStateChange={setViewState}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onSetColumns={(keys) => setVisibleColumns(new Set(keys))}
        projectId={activeProjectId}
        refreshTick={refreshTick}
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
        />
      ) : (
        <>
          <TableView
            object={object}
            columns={columns}
            labelField={labelField}
            records={records}
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
          />
          <SabcrmPagination
            page={page}
            limit={limit}
            total={total}
            pageCount={records.length}
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
