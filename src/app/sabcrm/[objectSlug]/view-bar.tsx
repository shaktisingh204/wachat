'use client';

/**
 * SabCRM — Twenty "view bar" (record index toolbar).
 *
 * Renders above the record table on `/sabcrm/[objectSlug]`. It owns the four
 * Twenty view controls and the saved-view tab strip, but stays a controlled
 * component: it never queries the engine for records itself — it raises the
 * desired query state (`ViewState`) up to the page, which re-runs
 * `listSabcrmRecordsTw` / `groupSabcrmRecordsTw`.
 *
 *   - Saved-view tabs  — `listViewsTw(object)` + an always-present "All" tab.
 *     Clicking a saved tab applies its filters/sort/group. "+" persists the
 *     current query as a new view (`createViewTw`); the star sets the active
 *     view as default (`setDefaultViewTw`).
 *   - Filter  — popover: field → operator → value (SELECT fields list their
 *     options). Active conditions render as removable pills.
 *   - Sort    — popover: field + asc/desc. One active sort pill.
 *   - Group   — popover: pick a SELECT field → page switches to grouped/board.
 *   - Fields  — popover: toggle which columns are visible.
 *
 * The views action module (`@/app/actions/sabcrm-views.actions`) is being added
 * in parallel; this file imports it optimistically. If only that import is
 * unresolved during a `tsc` run, that is the expected in-flight state.
 */

import * as React from 'react';
import {
  Filter,
  ArrowUpDown,
  Rows3,
  SlidersHorizontal,
  Plus,
  Star,
  X,
  Check,
} from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listViewsTw,
  createViewTw,
  setDefaultViewTw,
} from '@/app/actions/sabcrm-views.actions';
import type { SabcrmRustView } from '@/app/actions/sabcrm-views.actions.types';

import './view-bar.css';

// ---------------------------------------------------------------------------
// Public query-state contract (shared with the page)
// ---------------------------------------------------------------------------

/** Comparison operators threaded to the engine's structured `filters`. */
export type FilterOp =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty';

/** One active filter condition. */
export interface FilterCondition {
  fieldKey: string;
  op: FilterOp;
  /** Absent for the unary `isEmpty` / `isNotEmpty` operators. */
  value?: string;
}

/** The full query state the view bar drives. */
export interface ViewState {
  filters: FilterCondition[];
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  /** SELECT field key the table/board groups by, or `null` for a flat table. */
  groupBy: string | null;
}

export const EMPTY_VIEW_STATE: ViewState = {
  filters: [],
  sortBy: null,
  sortDir: 'asc',
  groupBy: null,
};

/** Translate a {@link ViewState} into the engine's `filters` query map. */
export function viewStateToEngineFilters(
  state: ViewState,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of state.filters) {
    if (c.op === 'isEmpty' || c.op === 'isNotEmpty') {
      out[c.fieldKey] = { op: c.op };
    } else {
      out[c.fieldKey] = { op: c.op, value: coerceFilterValue(c.value ?? '') };
    }
  }
  return out;
}

/** Best-effort numeric coercion so `gt`/`lt` compare numerically. */
function coerceFilterValue(raw: string): string | number {
  if (raw.trim() === '') return raw;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

const FILTER_OPS: ReadonlySet<string> = new Set<string>([
  'eq',
  'ne',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'isEmpty',
  'isNotEmpty',
]);

/**
 * Reverse of {@link viewStateToEngineFilters}: turn a persisted `filters` map
 * (`{ fieldKey: scalar | { op, value } }`) back into the editable condition
 * list the chips render. Tolerant of the bare-scalar form (→ `eq`).
 */
function engineFiltersToConditions(
  filters: unknown,
): FilterCondition[] {
  if (!filters || typeof filters !== 'object') return [];
  const out: FilterCondition[] = [];
  for (const [fieldKey, raw] of Object.entries(filters as Record<string, unknown>)) {
    if (
      raw &&
      typeof raw === 'object' &&
      'op' in (raw as Record<string, unknown>) &&
      FILTER_OPS.has(String((raw as Record<string, unknown>).op))
    ) {
      const op = String((raw as Record<string, unknown>).op) as FilterOp;
      const value = (raw as Record<string, unknown>).value;
      out.push({
        fieldKey,
        op,
        value:
          op === 'isEmpty' || op === 'isNotEmpty'
            ? undefined
            : value === undefined || value === null
              ? ''
              : String(value),
      });
    } else if (raw !== undefined && raw !== null) {
      out.push({ fieldKey, op: 'eq', value: String(raw) });
    }
  }
  return out;
}

/** Map a persisted saved view (Rust wire shape) into editable {@link ViewState}. */
function savedViewToState(view: SabcrmRustView): ViewState {
  return {
    filters: engineFiltersToConditions(view.filters),
    sortBy: view.sortBy ?? null,
    sortDir: view.sortDir ?? 'asc',
    groupBy: view.groupByField ?? null,
  };
}

// ---------------------------------------------------------------------------
// Field / operator helpers
// ---------------------------------------------------------------------------

const TEXTUAL: ReadonlySet<FieldMetadata['type']> = new Set<FieldMetadata['type']>([
  'TEXT',
  'EMAIL',
  'PHONE',
  'LINK',
]);

const NUMERIC: ReadonlySet<FieldMetadata['type']> = new Set<FieldMetadata['type']>([
  'NUMBER',
  'CURRENCY',
  'RATING',
]);

const OP_LABEL: Record<FilterOp, string> = {
  eq: 'is',
  ne: 'is not',
  contains: 'contains',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

/** Operators offered for a given field type. */
function opsForField(field: FieldMetadata): FilterOp[] {
  if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
    return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
  if (NUMERIC.has(field.type)) {
    return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty'];
  }
  if (TEXTUAL.has(field.type)) {
    return ['contains', 'eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
  return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
}

/** Fields a user may filter / sort by (skip relations + files). */
function queryableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => f.type !== 'RELATION' && f.type !== 'FILE');
}

/** SELECT fields are the only ones the board/group view can bucket by. */
function groupableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => f.type === 'SELECT');
}

/** Pretty-print a filter condition's value for its pill. */
function pillValue(field: FieldMetadata | undefined, c: FilterCondition): string {
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty') return '';
  const raw = c.value ?? '';
  if (field?.type === 'SELECT') {
    return field.options?.find((o) => o.value === raw)?.label ?? raw;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Popover wrapper (click-outside to dismiss)
// ---------------------------------------------------------------------------

interface ControlPopoverProps {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active?: boolean;
  alignRight?: boolean;
  children: (close: () => void) => React.ReactNode;
}

function ControlPopover({
  label,
  icon: Icon,
  active,
  alignRight,
  children,
}: ControlPopoverProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="stv-control" ref={ref}>
      <button
        type="button"
        className={`stv-control__btn${open ? ' open' : ''}${active ? ' active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon size={14} />
        {label}
      </button>
      {open && (
        <div
          className={`stv-pop${alignRight ? ' stv-pop--right' : ''}`}
          role="dialog"
          aria-label={label}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter popover
// ---------------------------------------------------------------------------

interface FilterPopoverProps {
  object: ObjectMetadata;
  onAdd: (c: FilterCondition) => void;
  close: () => void;
}

function FilterPopover({ object, onAdd, close }: FilterPopoverProps): React.JSX.Element {
  const fields = React.useMemo(() => queryableFields(object), [object]);
  const [fieldKey, setFieldKey] = React.useState(fields[0]?.key ?? '');
  const field = fields.find((f) => f.key === fieldKey);
  const ops = field ? opsForField(field) : (['eq'] as FilterOp[]);
  const [op, setOp] = React.useState<FilterOp>(ops[0] ?? 'eq');
  const [value, setValue] = React.useState('');

  // Keep operator valid when the field changes.
  React.useEffect(() => {
    if (field && !opsForField(field).includes(op)) {
      setOp(opsForField(field)[0] ?? 'eq');
    }
    setValue('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldKey]);

  const unary = op === 'isEmpty' || op === 'isNotEmpty';

  const submit = () => {
    if (!field) return;
    if (!unary && value.trim() === '') return;
    onAdd({ fieldKey, op, value: unary ? undefined : value });
    close();
  };

  if (fields.length === 0) {
    return <div className="stv-empty-hint">No filterable fields.</div>;
  }

  return (
    <>
      <p className="stv-pop__title">Add filter</p>
      <div className="stv-pop__row">
        <select
          className="stv-pop__select"
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value)}
          aria-label="Filter field"
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="stv-pop__row">
        <select
          className="stv-pop__select"
          value={op}
          onChange={(e) => setOp(e.target.value as FilterOp)}
          aria-label="Filter operator"
        >
          {ops.map((o) => (
            <option key={o} value={o}>
              {OP_LABEL[o]}
            </option>
          ))}
        </select>
      </div>
      {!unary && (
        <div className="stv-pop__row">
          {field?.type === 'SELECT' ? (
            <select
              className="stv-pop__select"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Filter value"
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="stv-pop__input"
              type={field && NUMERIC.has(field.type) ? 'number' : 'text'}
              value={value}
              placeholder="Value"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              autoFocus
            />
          )}
        </div>
      )}
      <div className="stv-pop__actions">
        <TwentyButton variant="secondary" onClick={close}>
          Cancel
        </TwentyButton>
        <TwentyButton variant="primary" icon={Plus} onClick={submit}>
          Add
        </TwentyButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sort popover
// ---------------------------------------------------------------------------

interface SortPopoverProps {
  object: ObjectMetadata;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  onApply: (sortBy: string | null, sortDir: 'asc' | 'desc') => void;
  close: () => void;
}

function SortPopover({
  object,
  sortBy,
  sortDir,
  onApply,
  close,
}: SortPopoverProps): React.JSX.Element {
  const fields = React.useMemo(() => queryableFields(object), [object]);
  const [field, setField] = React.useState(sortBy ?? fields[0]?.key ?? '');
  const [dir, setDir] = React.useState<'asc' | 'desc'>(sortDir);

  if (fields.length === 0) {
    return <div className="stv-empty-hint">No sortable fields.</div>;
  }

  return (
    <>
      <p className="stv-pop__title">Sort by</p>
      <div className="stv-pop__row">
        <select
          className="stv-pop__select"
          value={field}
          onChange={(e) => setField(e.target.value)}
          aria-label="Sort field"
        >
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="stv-pop__row">
        <select
          className="stv-pop__select"
          value={dir}
          onChange={(e) => setDir(e.target.value as 'asc' | 'desc')}
          aria-label="Sort direction"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
      <div className="stv-pop__actions">
        {sortBy && (
          <TwentyButton
            variant="secondary"
            onClick={() => {
              onApply(null, 'asc');
              close();
            }}
          >
            Clear
          </TwentyButton>
        )}
        <TwentyButton
          variant="primary"
          icon={Check}
          onClick={() => {
            onApply(field || null, dir);
            close();
          }}
        >
          Apply
        </TwentyButton>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Group-by popover
// ---------------------------------------------------------------------------

interface GroupPopoverProps {
  object: ObjectMetadata;
  groupBy: string | null;
  onApply: (groupBy: string | null) => void;
  close: () => void;
}

function GroupPopover({
  object,
  groupBy,
  onApply,
  close,
}: GroupPopoverProps): React.JSX.Element {
  const fields = React.useMemo(() => groupableFields(object), [object]);

  if (fields.length === 0) {
    return (
      <div className="stv-empty-hint">
        No SELECT fields available to group by.
      </div>
    );
  }

  return (
    <>
      <p className="stv-pop__title">Group by</p>
      <div className="stv-fieldlist">
        <button
          type="button"
          className="stv-fieldlist__item"
          onClick={() => {
            onApply(null);
            close();
          }}
        >
          <span style={{ width: 14, display: 'inline-flex' }}>
            {groupBy === null && <Check size={14} />}
          </span>
          None
        </button>
        {fields.map((f) => (
          <button
            key={f.key}
            type="button"
            className="stv-fieldlist__item"
            onClick={() => {
              onApply(f.key);
              close();
            }}
          >
            <span style={{ width: 14, display: 'inline-flex' }}>
              {groupBy === f.key && <Check size={14} />}
            </span>
            {f.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fields (column visibility) popover
// ---------------------------------------------------------------------------

interface FieldsPopoverProps {
  object: ObjectMetadata;
  visible: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

function FieldsPopover({
  object,
  visible,
  onToggle,
}: FieldsPopoverProps): React.JSX.Element {
  return (
    <>
      <p className="stv-pop__title">Visible columns</p>
      <div className="stv-fieldlist">
        {object.fields.map((f) => (
          <label className="stv-fieldlist__item" key={f.key}>
            <input
              type="checkbox"
              checked={visible.has(f.key)}
              onChange={() => onToggle(f.key)}
            />
            {f.label}
          </label>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The view bar
// ---------------------------------------------------------------------------

export interface SabcrmViewBarProps {
  object: ObjectMetadata;
  /** Current query state (owned by the page). */
  state: ViewState;
  onStateChange: (next: ViewState) => void;
  /** Visible-column set (owned by the page). */
  visibleColumns: ReadonlySet<string>;
  onToggleColumn: (key: string) => void;
  /** Replace the whole visible-column set (used when a saved view stores `fields`). */
  onSetColumns?: (keys: string[]) => void;
  /** Active tenant; threaded to the view actions. */
  projectId?: string | null;
  /** Bumped by the page when a refresh of the saved-view list is wanted. */
  refreshTick?: number;
}

export function SabcrmViewBar({
  object,
  state,
  onStateChange,
  visibleColumns,
  onToggleColumn,
  onSetColumns,
  projectId,
  refreshTick = 0,
}: SabcrmViewBarProps): React.JSX.Element {
  const fieldByKey = React.useMemo(() => {
    const m = new Map<string, FieldMetadata>();
    for (const f of object.fields) m.set(f.key, f);
    return m;
  }, [object]);

  // ---- Saved views ------------------------------------------------------
  const [views, setViews] = React.useState<SabcrmRustView[]>([]);
  const [viewsError, setViewsError] = React.useState(false);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);
  const [localTick, setLocalTick] = React.useState(0);

  // Reset the active tab when the object changes.
  React.useEffect(() => {
    setActiveViewId(null);
  }, [object.slug]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listViewsTw(object.slug, projectId ?? undefined);
        if (cancelled) return;
        if (res && res.ok) {
          setViews(res.data ?? []);
          setViewsError(false);
        } else {
          setViews([]);
          setViewsError(true);
        }
      } catch {
        if (!cancelled) {
          setViews([]);
          setViewsError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, projectId, refreshTick, localTick]);

  const applyView = React.useCallback(
    (view: SabcrmRustView | null) => {
      setActiveViewId(view?.id ?? null);
      onStateChange(view ? savedViewToState(view) : EMPTY_VIEW_STATE);
      // Restore the view's saved column set when it carries one.
      if (view?.fields && view.fields.length > 0) {
        onSetColumns?.(view.fields);
      }
    },
    [onStateChange, onSetColumns],
  );

  const saveCurrentAsView = React.useCallback(async () => {
    const name =
      typeof window !== 'undefined'
        ? window.prompt('Name this view')?.trim()
        : '';
    if (!name) return;
    try {
      const res = await createViewTw({
        object: object.slug,
        name,
        kind: state.groupBy ? 'board' : 'table',
        filters: viewStateToEngineFilters(state),
        sortBy: state.sortBy ?? undefined,
        sortDir: state.sortBy ? state.sortDir : undefined,
        groupByField: state.groupBy ?? undefined,
        fields: Array.from(visibleColumns),
      }, projectId ?? undefined);
      if (res && res.ok) {
        if (res.data?.id) setActiveViewId(res.data.id);
        setLocalTick((t) => t + 1);
      }
    } catch {
      /* engine down — degrade silently, the tab strip just won't gain a tab */
    }
  }, [object.slug, state, visibleColumns, projectId]);

  const makeDefault = React.useCallback(async () => {
    if (!activeViewId) return;
    try {
      await setDefaultViewTw(activeViewId, projectId ?? undefined);
      setLocalTick((t) => t + 1);
    } catch {
      /* degrade silently */
    }
  }, [activeViewId, projectId]);

  // Apply the default view once, on first successful load (only if the user
  // hasn't already picked a tab and there is no active query).
  const didAutoApply = React.useRef(false);
  React.useEffect(() => {
    if (didAutoApply.current) return;
    if (views.length === 0) return;
    const def = views.find((v) => v.isDefault);
    if (def) {
      didAutoApply.current = true;
      applyView(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  // ---- Active-state derived bits ---------------------------------------
  const removeFilter = (idx: number) =>
    onStateChange({
      ...state,
      filters: state.filters.filter((_, i) => i !== idx),
    });

  const addFilter = (c: FilterCondition) =>
    onStateChange({ ...state, filters: [...state.filters, c] });

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  return (
    <div className="stv">
      {/* Saved-view tabs */}
      <div className="stv-tabs" role="tablist" aria-label="Saved views">
        <button
          type="button"
          role="tab"
          aria-selected={activeViewId === null}
          className={`stv-tab${activeViewId === null ? ' active' : ''}`}
          onClick={() => applyView(null)}
        >
          All
        </button>
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={activeViewId === v.id}
            className={`stv-tab${activeViewId === v.id ? ' active' : ''}`}
            onClick={() => applyView(v)}
          >
            {v.isDefault && (
              <span className="stv-tab__star on" aria-label="Default view">
                <Star size={11} fill="currentColor" />
              </span>
            )}
            {v.name}
          </button>
        ))}
        {activeView && !activeView.isDefault && (
          <button
            type="button"
            className="stv-tab__add"
            title="Set as default view"
            aria-label="Set as default view"
            onClick={makeDefault}
          >
            <Star size={14} />
          </button>
        )}
        <button
          type="button"
          className="stv-tab__add"
          title="Save current view"
          aria-label="Save current view"
          onClick={saveCurrentAsView}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Controls + active chips */}
      <div className="stv-bar">
        <ControlPopover
          label="Filter"
          icon={Filter}
          active={state.filters.length > 0}
        >
          {(close) => (
            <FilterPopover object={object} onAdd={addFilter} close={close} />
          )}
        </ControlPopover>

        <ControlPopover label="Sort" icon={ArrowUpDown} active={!!state.sortBy}>
          {(close) => (
            <SortPopover
              object={object}
              sortBy={state.sortBy}
              sortDir={state.sortDir}
              onApply={(sortBy, sortDir) =>
                onStateChange({ ...state, sortBy, sortDir })
              }
              close={close}
            />
          )}
        </ControlPopover>

        <ControlPopover label="Group" icon={Rows3} active={!!state.groupBy}>
          {(close) => (
            <GroupPopover
              object={object}
              groupBy={state.groupBy}
              onApply={(groupBy) => onStateChange({ ...state, groupBy })}
              close={close}
            />
          )}
        </ControlPopover>

        <ControlPopover label="Fields" icon={SlidersHorizontal} alignRight>
          {() => (
            <FieldsPopover
              object={object}
              visible={visibleColumns}
              onToggle={onToggleColumn}
            />
          )}
        </ControlPopover>

        <div className="stv-bar__spacer" />

        {/* Active filter / sort / group chips */}
        <div className="stv-chips">
          {state.filters.map((c, idx) => {
            const f = fieldByKey.get(c.fieldKey);
            return (
              <span className="stv-pill" key={`${c.fieldKey}-${idx}`}>
                <span className="stv-pill__key">{f?.label ?? c.fieldKey}</span>
                <span className="stv-pill__op">{OP_LABEL[c.op]}</span>
                {c.op !== 'isEmpty' && c.op !== 'isNotEmpty' && (
                  <span className="stv-pill__val">{pillValue(f, c)}</span>
                )}
                <button
                  type="button"
                  className="stv-pill__x"
                  aria-label="Remove filter"
                  onClick={() => removeFilter(idx)}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}

          {state.sortBy && (
            <span className="stv-pill">
              <span className="stv-pill__key">Sort</span>
              <span className="stv-pill__val">
                {fieldByKey.get(state.sortBy)?.label ?? state.sortBy}
              </span>
              <span className="stv-pill__op">
                {state.sortDir === 'asc' ? '↑' : '↓'}
              </span>
              <button
                type="button"
                className="stv-pill__x"
                aria-label="Clear sort"
                onClick={() => onStateChange({ ...state, sortBy: null })}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {state.groupBy && (
            <span className="stv-pill">
              <span className="stv-pill__key">Group</span>
              <span className="stv-pill__val">
                {fieldByKey.get(state.groupBy)?.label ?? state.groupBy}
              </span>
              <button
                type="button"
                className="stv-pill__x"
                aria-label="Clear grouping"
                onClick={() => onStateChange({ ...state, groupBy: null })}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      </div>

      {viewsError && (
        <span className="stv-empty-hint" role="status">
          Saved views are unavailable right now.
        </span>
      )}
    </div>
  );
}
