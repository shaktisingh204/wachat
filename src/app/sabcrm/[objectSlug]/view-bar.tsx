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
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Plus,
  FolderPlus,
  Star,
  X,
  Check,
  Table2,
  Columns3,
  CalendarDays,
  Zap,
  Bookmark,
  Link2,
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
import './advanced-filter.css';
import './table-extras.css';
import './saved-search.css';
import './view-url.css';

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

/** One active filter condition (a leaf in the advanced-filter tree). */
export interface FilterCondition {
  fieldKey: string;
  op: FilterOp;
  /** Absent for the unary `isEmpty` / `isNotEmpty` operators. */
  value?: string;
}

/** Boolean conjunction joining the members of a {@link FilterGroup}. */
export type FilterConjunction = 'and' | 'or';

/**
 * A node in the advanced filter tree — either a leaf {@link FilterCondition}
 * or a nested {@link FilterGroup}. A type guard ({@link isFilterGroup})
 * discriminates the two.
 */
export type FilterNode = FilterCondition | FilterGroup;

/**
 * A condition group: a conjunction (`and`/`or`) over a list of child nodes,
 * each of which is itself a condition or a (nested) sub-group. This is the
 * tree shape emitted to `listSabcrmRecordsTw`'s widened `filters` param:
 * `{ op, conditions: [ { fieldKey, op, value } | <nested group> ] }`.
 */
export interface FilterGroup {
  op: FilterConjunction;
  conditions: FilterNode[];
}

/** Discriminate a {@link FilterGroup} from a leaf {@link FilterCondition}. */
export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (
    typeof (node as FilterGroup).op === 'string' &&
    Array.isArray((node as FilterGroup).conditions)
  );
}

/** The full query state the view bar drives. */
export interface ViewState {
  /**
   * The advanced filter tree (root group). The source of truth for filtering.
   * A single flat AND group of conditions is the common (backwards-compatible)
   * case; nested sub-groups with their own conjunction are also supported.
   */
  filters: FilterGroup;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
  /** SELECT field key the table/board groups by, or `null` for a flat table. */
  groupBy: string | null;
}

/** An empty root group (AND over no conditions). */
export const EMPTY_FILTER_GROUP: FilterGroup = { op: 'and', conditions: [] };

export const EMPTY_VIEW_STATE: ViewState = {
  filters: EMPTY_FILTER_GROUP,
  sortBy: null,
  sortDir: 'asc',
  groupBy: null,
};

/** Total leaf-condition count in a tree (drives the "active" indicator). */
export function countConditions(group: FilterGroup): number {
  let n = 0;
  for (const node of group.conditions) {
    if (isFilterGroup(node)) n += countConditions(node);
    else n += 1;
  }
  return n;
}

/** Whether a tree is a single flat AND group (no nested sub-groups). */
function isFlatAndGroup(group: FilterGroup): boolean {
  return (
    group.op === 'and' && group.conditions.every((c) => !isFilterGroup(c))
  );
}

/** Serialize one leaf condition into the engine's `{ op, value }` shape. */
function conditionToEngine(c: FilterCondition): Record<string, unknown> {
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty') {
    return { op: c.op };
  }
  return { op: c.op, value: coerceFilterValue(c.value ?? '') };
}

/** Serialize a whole tree into the engine's nested `{ op, conditions }` shape. */
function groupToEngineTree(group: FilterGroup): Record<string, unknown> {
  return {
    op: group.op,
    conditions: group.conditions.map((node) =>
      isFilterGroup(node)
        ? groupToEngineTree(node)
        : { field: node.fieldKey, ...conditionToEngine(node) },
    ),
  };
}

/**
 * Translate a {@link ViewState} into the engine's `filters` query value.
 *
 * Backwards-compatible: a single flat AND group serializes to the legacy
 * field-keyed map (`{ fieldKey: { op, value } }`) the engine has always
 * understood. Any nested sub-group, or an OR root, serializes to the widened
 * tree shape (`{ op, conditions: [...] }`) that RUST-A now also accepts.
 */
export function viewStateToEngineFilters(
  state: ViewState,
): Record<string, unknown> {
  const group = state.filters;
  if (isFlatAndGroup(group)) {
    const out: Record<string, unknown> = {};
    for (const node of group.conditions) {
      if (isFilterGroup(node)) continue; // unreachable in a flat group
      out[node.fieldKey] = conditionToEngine(node);
    }
    return out;
  }
  return groupToEngineTree(group);
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

/** Parse one persisted `{ op, value }` (or bare scalar) into a {@link FilterOp}/value. */
function parseLeafOpValue(raw: unknown): { op: FilterOp; value?: string } {
  if (
    raw &&
    typeof raw === 'object' &&
    'op' in (raw as Record<string, unknown>) &&
    FILTER_OPS.has(String((raw as Record<string, unknown>).op))
  ) {
    const op = String((raw as Record<string, unknown>).op) as FilterOp;
    const value = (raw as Record<string, unknown>).value;
    return {
      op,
      value:
        op === 'isEmpty' || op === 'isNotEmpty'
          ? undefined
          : value === undefined || value === null
            ? ''
            : String(value),
    };
  }
  return { op: 'eq', value: raw === undefined || raw === null ? '' : String(raw) };
}

/**
 * Reverse of {@link viewStateToEngineFilters}: turn a persisted `filters`
 * value back into the editable {@link FilterGroup} the builder renders.
 *
 * Accepts BOTH shapes:
 *   - legacy field-keyed map `{ fieldKey: scalar | { op, value } }` → a flat
 *     AND group, and
 *   - the widened tree `{ op, conditions: [...] }` (with `field` on leaves) →
 *     parsed recursively, preserving nested sub-groups.
 */
function engineFiltersToGroup(filters: unknown): FilterGroup {
  if (!filters || typeof filters !== 'object') return { ...EMPTY_FILTER_GROUP };

  const obj = filters as Record<string, unknown>;

  // Tree shape: an explicit conjunction + a `conditions` array.
  if (Array.isArray(obj.conditions) && (obj.op === 'and' || obj.op === 'or')) {
    const conditions: FilterNode[] = [];
    for (const node of obj.conditions as unknown[]) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (Array.isArray(n.conditions)) {
        conditions.push(engineFiltersToGroup(n));
      } else if (typeof n.field === 'string') {
        conditions.push({ fieldKey: n.field, ...parseLeafOpValue(n) });
      }
    }
    return { op: obj.op as FilterConjunction, conditions };
  }

  // Legacy field-keyed map → a flat AND group.
  const conditions: FilterNode[] = [];
  for (const [fieldKey, raw] of Object.entries(obj)) {
    if (raw === undefined || raw === null) continue;
    conditions.push({ fieldKey, ...parseLeafOpValue(raw) });
  }
  return { op: 'and', conditions };
}

/** Map a persisted saved view (Rust wire shape) into editable {@link ViewState}. */
function savedViewToState(view: SabcrmRustView): ViewState {
  return {
    filters: engineFiltersToGroup(view.filters),
    sortBy: view.sortBy ?? null,
    sortDir: view.sortDir ?? 'asc',
    groupBy: view.groupByField ?? null,
  };
}

// ---------------------------------------------------------------------------
// URL view-state codec (Twenty-style shareable URLs)
// ---------------------------------------------------------------------------
//
// The view bar mirrors the dimensions it owns into the page query string so a
// filtered/sorted/grouped view is shareable and survives back/forward:
//
//   ?sort=<field>:<asc|desc>     – active sort (omitted when no sort)
//   &group=<fieldKey>            – group/board field (omitted when flat)
//   &filters=<uri-encoded JSON>  – the engine-shaped filter tree (omitted when empty)
//   &vk=board                    – view kind, only when not the default `table`
//   &view=<savedViewId>          – active saved-view tab (omitted for "All")
//
// A free-text search (`q`) is owned by the page, not the view bar, so it is
// never written here — but it is read on mount and left untouched on every
// rewrite, so the two coexist in one shareable URL.

/** Param keys the view bar owns; any other key (e.g. `q`) is preserved as-is. */
const URL_KEYS = {
  sort: 'sort',
  group: 'group',
  filters: 'filters',
  viewKind: 'vk',
  view: 'view',
} as const;

/** State the view bar mirrors into the URL (ViewState + view-kind + saved view). */
interface UrlViewState {
  state: ViewState;
  viewKind: 'table' | 'board';
  viewId: string | null;
}

/** Encode a ViewState's filter tree into a compact URI-safe string, or `''`. */
function encodeFilters(filters: FilterGroup): string {
  if (countConditions(filters) === 0) return '';
  try {
    return encodeURIComponent(JSON.stringify(viewStateToEngineFilters({
      filters,
      sortBy: null,
      sortDir: 'asc',
      groupBy: null,
    })));
  } catch {
    return '';
  }
}

/** Decode a URI-encoded engine-filter JSON back into an editable FilterGroup. */
function decodeFilters(raw: string | null): FilterGroup | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    const group = engineFiltersToGroup(parsed);
    return countConditions(group) > 0 ? group : null;
  } catch {
    return null;
  }
}

/**
 * Build the params for the view bar's owned keys, layered onto whatever is
 * already in the live query string (so `q` and any unknown params survive).
 * Returns a fresh `URLSearchParams`.
 */
function buildUrlParams(
  base: URLSearchParams,
  { state, viewKind, viewId }: UrlViewState,
): URLSearchParams {
  const next = new URLSearchParams(base);

  // Clear the keys we own, then re-set the active ones.
  for (const key of Object.values(URL_KEYS)) next.delete(key);

  if (state.sortBy) {
    next.set(URL_KEYS.sort, `${state.sortBy}:${state.sortDir}`);
  }
  if (state.groupBy) {
    next.set(URL_KEYS.group, state.groupBy);
  }
  const f = encodeFilters(state.filters);
  if (f) next.set(URL_KEYS.filters, f);

  // Only `board` is worth encoding; `table` is the implicit default.
  if (viewKind === 'board') next.set(URL_KEYS.viewKind, 'board');

  if (viewId) next.set(URL_KEYS.view, viewId);

  return next;
}

/** Stable, order-independent signature of the params we own (dirty-check). */
function ownedSignature(params: URLSearchParams): string {
  return (Object.values(URL_KEYS) as string[])
    .map((k) => `${k}=${params.get(k) ?? ''}`)
    .join('&');
}

/**
 * Read the view-bar dimensions out of a query string. Returns `null` for any
 * dimension absent from the URL so callers can apply only what's present.
 */
function decodeUrlState(params: URLSearchParams): {
  filters: FilterGroup | null;
  sortBy: string | null;
  sortDir: 'asc' | 'desc' | null;
  groupBy: string | null;
  viewKind: 'table' | 'board' | null;
  viewId: string | null;
} {
  const sortRaw = params.get(URL_KEYS.sort);
  let sortBy: string | null = null;
  let sortDir: 'asc' | 'desc' | null = null;
  if (sortRaw) {
    const sep = sortRaw.lastIndexOf(':');
    if (sep > 0) {
      sortBy = sortRaw.slice(0, sep);
      sortDir = sortRaw.slice(sep + 1) === 'desc' ? 'desc' : 'asc';
    } else {
      sortBy = sortRaw;
      sortDir = 'asc';
    }
  }

  const vk = params.get(URL_KEYS.viewKind);

  return {
    filters: decodeFilters(params.get(URL_KEYS.filters)),
    sortBy,
    sortDir,
    groupBy: params.get(URL_KEYS.group) || null,
    viewKind: vk === 'board' ? 'board' : vk === 'table' ? 'table' : null,
    viewId: params.get(URL_KEYS.view) || null,
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
  /** Widen the popover (e.g. for the nested advanced-filter builder). */
  wide?: boolean;
  children: (close: () => void) => React.ReactNode;
}

function ControlPopover({
  label,
  icon: Icon,
  active,
  alignRight,
  wide,
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
          className={`stv-pop${alignRight ? ' stv-pop--right' : ''}${
            wide ? ' stv-pop--wide' : ''
          }`}
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
// Advanced filter builder (nested condition groups with AND/OR)
// ---------------------------------------------------------------------------

/** A fresh condition seeded on the first queryable field + its default op. */
function defaultCondition(object: ObjectMetadata): FilterCondition {
  const field = queryableFields(object)[0];
  if (!field) return { fieldKey: '', op: 'eq', value: '' };
  const op = opsForField(field)[0] ?? 'eq';
  return {
    fieldKey: field.key,
    op,
    value: op === 'isEmpty' || op === 'isNotEmpty' ? undefined : '',
  };
}

/** A fresh empty sub-group (defaults to AND, seeded with one condition). */
function defaultGroup(object: ObjectMetadata): FilterGroup {
  return { op: 'and', conditions: [defaultCondition(object)] };
}

/** Small AND / OR segmented toggle shared by every group header. */
function ConjunctionToggle({
  value,
  onChange,
}: {
  value: FilterConjunction;
  onChange: (next: FilterConjunction) => void;
}): React.JSX.Element {
  return (
    <span className="staf-conj" role="group" aria-label="Match conjunction">
      <button
        type="button"
        className={`staf-conj__btn${value === 'and' ? ' is-active' : ''}`}
        aria-pressed={value === 'and'}
        onClick={() => onChange('and')}
      >
        And
      </button>
      <button
        type="button"
        className={`staf-conj__btn${value === 'or' ? ' is-active' : ''}`}
        aria-pressed={value === 'or'}
        onClick={() => onChange('or')}
      >
        Or
      </button>
    </span>
  );
}

/** One editable condition row: field → operator → (typed) value. */
function ConditionRow({
  fields,
  condition,
  lead,
  onChange,
  onRemove,
}: {
  fields: FieldMetadata[];
  condition: FilterCondition;
  /** Leading label: "Where" for the first row, else the parent conjunction. */
  lead: string;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const field = fields.find((f) => f.key === condition.fieldKey);
  const ops = field ? opsForField(field) : (['eq'] as FilterOp[]);
  const unary = condition.op === 'isEmpty' || condition.op === 'isNotEmpty';

  const setField = (key: string) => {
    const nextField = fields.find((f) => f.key === key);
    const nextOps = nextField ? opsForField(nextField) : (['eq'] as FilterOp[]);
    const nextOp = nextOps.includes(condition.op) ? condition.op : nextOps[0] ?? 'eq';
    const nextUnary = nextOp === 'isEmpty' || nextOp === 'isNotEmpty';
    onChange({ fieldKey: key, op: nextOp, value: nextUnary ? undefined : '' });
  };

  const setOp = (op: FilterOp) => {
    const nextUnary = op === 'isEmpty' || op === 'isNotEmpty';
    onChange({
      fieldKey: condition.fieldKey,
      op,
      value: nextUnary ? undefined : (condition.value ?? ''),
    });
  };

  const setValue = (value: string) =>
    onChange({ fieldKey: condition.fieldKey, op: condition.op, value });

  return (
    <div className="staf-row">
      <span className="staf-row__lead" aria-hidden="true">
        {lead}
      </span>
      <select
        className="staf-select staf-row__field"
        value={condition.fieldKey}
        onChange={(e) => setField(e.target.value)}
        aria-label="Filter field"
      >
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="staf-select staf-row__op"
        value={condition.op}
        onChange={(e) => setOp(e.target.value as FilterOp)}
        aria-label="Filter operator"
      >
        {ops.map((o) => (
          <option key={o} value={o}>
            {OP_LABEL[o]}
          </option>
        ))}
      </select>
      {!unary &&
        (field?.type === 'SELECT' || field?.type === 'MULTI_SELECT' ? (
          <select
            className="staf-select staf-row__value"
            value={condition.value ?? ''}
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
            className="staf-input staf-row__value"
            type={field && NUMERIC.has(field.type) ? 'number' : 'text'}
            value={condition.value ?? ''}
            placeholder="Value"
            onChange={(e) => setValue(e.target.value)}
            aria-label="Filter value"
          />
        ))}
      <button
        type="button"
        className="staf-x"
        aria-label="Remove condition"
        title="Remove condition"
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Recursive group editor: an AND/OR header, each child condition or sub-group,
 * and the "Add condition" / "Add group" affordances. The root renders without
 * the nesting rail / remove button; nested groups render both.
 */
function GroupEditor({
  object,
  fields,
  group,
  depth,
  onChange,
  onRemove,
}: {
  object: ObjectMetadata;
  fields: FieldMetadata[];
  group: FilterGroup;
  depth: number;
  onChange: (next: FilterGroup) => void;
  onRemove?: () => void;
}): React.JSX.Element {
  const conjLabel = group.op === 'and' ? 'And' : 'Or';

  const setConj = (op: FilterConjunction) => onChange({ ...group, op });

  const replaceChild = (idx: number, node: FilterNode) =>
    onChange({
      ...group,
      conditions: group.conditions.map((c, i) => (i === idx ? node : c)),
    });

  const removeChild = (idx: number) =>
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== idx),
    });

  const addCondition = () =>
    onChange({
      ...group,
      conditions: [...group.conditions, defaultCondition(object)],
    });

  const addGroup = () =>
    onChange({
      ...group,
      conditions: [...group.conditions, defaultGroup(object)],
    });

  return (
    <div className={`staf-group${depth > 0 ? ' staf-group--nested' : ''}`}>
      <div className="staf-group__head">
        <ConjunctionToggle value={group.op} onChange={setConj} />
        <span className="staf-group__lead">
          {depth === 0 ? 'Match conditions' : 'Group'}
        </span>
        <span className="staf-group__spacer" />
        {onRemove && (
          <button
            type="button"
            className="staf-x"
            aria-label="Remove group"
            title="Remove group"
            onClick={onRemove}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {group.conditions.length === 0 && (
        <div className="staf-empty">No conditions yet.</div>
      )}

      {group.conditions.map((node, idx) =>
        isFilterGroup(node) ? (
          <GroupEditor
            key={idx}
            object={object}
            fields={fields}
            group={node}
            depth={depth + 1}
            onChange={(next) => replaceChild(idx, next)}
            onRemove={() => removeChild(idx)}
          />
        ) : (
          <ConditionRow
            key={idx}
            fields={fields}
            condition={node}
            lead={idx === 0 ? 'Where' : conjLabel}
            onChange={(next) => replaceChild(idx, next)}
            onRemove={() => removeChild(idx)}
          />
        ),
      )}

      <div className="staf-adds">
        <button type="button" className="staf-add" onClick={addCondition}>
          <Plus size={13} />
          Add condition
        </button>
        {/* Cap nesting at a sensible depth so the rail stays readable. */}
        {depth < 3 && (
          <button type="button" className="staf-add" onClick={addGroup}>
            <FolderPlus size={13} />
            Add group
          </button>
        )}
      </div>
    </div>
  );
}

interface FilterPopoverProps {
  object: ObjectMetadata;
  group: FilterGroup;
  onApply: (group: FilterGroup) => void;
  close: () => void;
}

/**
 * The advanced filter builder, hosted in the Filter popover. Edits a working
 * copy of the root group and commits it on Apply (or clears it). A drained
 * group (no leaf conditions) collapses back to {@link EMPTY_FILTER_GROUP} so
 * the Filter control's "active" state stays honest.
 */
function FilterPopover({
  object,
  group,
  onApply,
  close,
}: FilterPopoverProps): React.JSX.Element {
  const fields = React.useMemo(() => queryableFields(object), [object]);

  // Working copy — seed an empty root with one starter condition so the user
  // lands on an editable row instead of a bare "Add condition" button.
  const [draft, setDraft] = React.useState<FilterGroup>(() =>
    group.conditions.length > 0
      ? group
      : { op: 'and', conditions: [defaultCondition(object)] },
  );

  if (fields.length === 0) {
    return <div className="staf-empty">No filterable fields.</div>;
  }

  // Drop incomplete leaves (no value on a binary op) before committing so a
  // half-typed row never silently filters everything out.
  const prune = (g: FilterGroup): FilterGroup => {
    const conditions: FilterNode[] = [];
    for (const node of g.conditions) {
      if (isFilterGroup(node)) {
        const sub = prune(node);
        if (sub.conditions.length > 0) conditions.push(sub);
      } else {
        const unary = node.op === 'isEmpty' || node.op === 'isNotEmpty';
        if (node.fieldKey && (unary || (node.value ?? '').trim() !== '')) {
          conditions.push(node);
        }
      }
    }
    return { op: g.op, conditions };
  };

  const apply = () => {
    const pruned = prune(draft);
    onApply(pruned.conditions.length > 0 ? pruned : EMPTY_FILTER_GROUP);
    close();
  };

  const clearAll = () => {
    onApply(EMPTY_FILTER_GROUP);
    close();
  };

  return (
    <div className="staf staf--root">
      <p className="stv-pop__title">Advanced filter</p>
      <GroupEditor
        object={object}
        fields={fields}
        group={draft}
        depth={0}
        onChange={setDraft}
      />
      <div className="staf-actions">
        <TwentyButton variant="secondary" onClick={clearAll}>
          Clear all
        </TwentyButton>
        <span className="staf-actions__right">
          <TwentyButton variant="secondary" onClick={close}>
            Cancel
          </TwentyButton>
          <TwentyButton variant="primary" icon={Check} onClick={apply}>
            Apply
          </TwentyButton>
        </span>
      </div>
    </div>
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
  // Twenty's column manager splits fields into a "Visible columns" group
  // (click to hide) and a "Hidden columns" group (click to add) — preserving
  // the object's declared field order within each group.
  const visibleFields = object.fields.filter((f) => visible.has(f.key));
  const hiddenFields = object.fields.filter((f) => !visible.has(f.key));

  return (
    <>
      <p className="stv-pop__title">Visible columns</p>
      <div className="stv-fieldlist">
        {visibleFields.length === 0 ? (
          <div className="stv-empty-hint">No visible columns</div>
        ) : (
          visibleFields.map((f) => (
            <button
              type="button"
              key={f.key}
              className="stv-coltoggle"
              onClick={() => onToggle(f.key)}
              aria-pressed={true}
            >
              <span className="stv-coltoggle__icon" aria-hidden="true">
                <Check size={14} />
              </span>
              <span className="stv-coltoggle__label">{f.label}</span>
              <span className="stv-coltoggle__hint" aria-hidden="true">
                <X size={13} />
              </span>
            </button>
          ))
        )}
      </div>

      {hiddenFields.length > 0 && (
        <>
          <p className="stv-pop__title">Hidden columns</p>
          <div className="stv-fieldlist">
            {hiddenFields.map((f) => (
              <button
                type="button"
                key={f.key}
                className="stv-coltoggle is-hidden"
                onClick={() => onToggle(f.key)}
                aria-pressed={false}
              >
                <span className="stv-coltoggle__icon" aria-hidden="true">
                  <Plus size={14} />
                </span>
                <span className="stv-coltoggle__label">{f.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quick filters (saved searches) — per-object, localStorage-backed
// ---------------------------------------------------------------------------

/**
 * One pinned quick filter: a named snapshot of the filter + sort portion of a
 * {@link ViewState}. Stored locally (per object) so it survives reloads without
 * touching the engine — distinct from server-persisted saved views.
 */
interface QuickFilter {
  id: string;
  name: string;
  filters: FilterGroup;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
}

/** localStorage key scoped to one object slug. */
function quickFilterKey(slug: string): string {
  return `sabcrm.quickFilters.${slug}`;
}

/** Read & validate the pinned quick filters for an object (SSR/parse-safe). */
function readQuickFilters(slug: string): QuickFilter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(quickFilterKey(slug));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: QuickFilter[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.name !== 'string') continue;
      out.push({
        id: o.id,
        name: o.name,
        filters: engineFiltersToGroup(
          // Accept either a stored editable group or an engine-shaped value.
          o.filters && typeof o.filters === 'object'
            ? viewStateToEngineFilters({
                filters: o.filters as FilterGroup,
                sortBy: null,
                sortDir: 'asc',
                groupBy: null,
              })
            : undefined,
        ),
        sortBy: typeof o.sortBy === 'string' ? o.sortBy : null,
        sortDir: o.sortDir === 'desc' ? 'desc' : 'asc',
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Persist the pinned quick filters for an object (best-effort). */
function writeQuickFilters(slug: string, list: QuickFilter[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(quickFilterKey(slug), JSON.stringify(list));
  } catch {
    /* quota / private mode — degrade silently */
  }
}

/**
 * The "Quick filters" row: a strip of pinned filter+sort pills plus a "Save
 * current" affordance. Clicking a pill recalls its snapshot into the live view
 * state via {@link onApply} (which threads through the bar's `onStateChange`),
 * preserving the current `groupBy` so a quick filter never silently changes the
 * table/board layout. Purely local — never queries the engine.
 */
function QuickFilters({
  object,
  state,
  onApply,
  fieldByKey,
}: {
  object: ObjectMetadata;
  state: ViewState;
  onApply: (filters: FilterGroup, sortBy: string | null, sortDir: 'asc' | 'desc') => void;
  fieldByKey: Map<string, FieldMetadata>;
}): React.JSX.Element {
  const slug = object.slug;
  const [items, setItems] = React.useState<QuickFilter[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Hydrate from localStorage on mount / object change.
  React.useEffect(() => {
    setItems(readQuickFilters(slug));
    setActiveId(null);
  }, [slug]);

  // A quick filter "matches" the live state when its filter tree + sort line up.
  const liveKey = React.useMemo(
    () =>
      JSON.stringify({
        f: viewStateToEngineFilters(state),
        s: state.sortBy,
        d: state.sortBy ? state.sortDir : 'asc',
      }),
    [state],
  );

  React.useEffect(() => {
    const hit = items.find(
      (qf) =>
        JSON.stringify({
          f: viewStateToEngineFilters({
            filters: qf.filters,
            sortBy: qf.sortBy,
            sortDir: qf.sortDir,
            groupBy: null,
          }),
          s: qf.sortBy,
          d: qf.sortBy ? qf.sortDir : 'asc',
        }) === liveKey,
    );
    setActiveId(hit?.id ?? null);
  }, [items, liveKey]);

  const hasLiveQuery =
    countConditions(state.filters) > 0 || state.sortBy !== null;

  const saveCurrent = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Name this quick filter')?.trim();
    if (!name) return;
    const qf: QuickFilter = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `qf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: state.filters,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    };
    setItems((prev) => {
      const next = [...prev, qf];
      writeQuickFilters(slug, next);
      return next;
    });
    setActiveId(qf.id);
  }, [slug, state]);

  const removeItem = React.useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((q) => q.id !== id);
        writeQuickFilters(slug, next);
        return next;
      });
      setActiveId((cur) => (cur === id ? null : cur));
    },
    [slug],
  );

  const applyItem = React.useCallback(
    (qf: QuickFilter) => {
      setActiveId(qf.id);
      onApply(qf.filters, qf.sortBy, qf.sortBy ? qf.sortDir : 'asc');
    },
    [onApply],
  );

  // Short human summary for a pill's tooltip ("Status is Open · Sort Name ↑").
  const summarize = React.useCallback(
    (qf: QuickFilter): string => {
      const parts: string[] = [];
      const walk = (g: FilterGroup) => {
        for (const node of g.conditions) {
          if (isFilterGroup(node)) walk(node);
          else {
            const f = fieldByKey.get(node.fieldKey);
            const val = pillValue(f, node);
            parts.push(
              `${f?.label ?? node.fieldKey} ${OP_LABEL[node.op]}${
                val ? ` ${val}` : ''
              }`,
            );
          }
        }
      };
      walk(qf.filters);
      if (qf.sortBy) {
        const f = fieldByKey.get(qf.sortBy);
        parts.push(
          `Sort ${f?.label ?? qf.sortBy} ${qf.sortDir === 'asc' ? '↑' : '↓'}`,
        );
      }
      return parts.length > 0 ? parts.join(' · ') : 'No conditions';
    },
    [fieldByKey],
  );

  // Nothing to show and nothing to save → render the row only when relevant.
  if (items.length === 0 && !hasLiveQuery) {
    return <></>;
  }

  return (
    <div className="stqf" role="group" aria-label="Quick filters">
      <span className="stqf__label">
        <Zap size={12} />
        Quick filters
      </span>

      {items.map((qf) => {
        const count = countConditions(qf.filters);
        return (
          <span
            key={qf.id}
            className={`stqf-pill${activeId === qf.id ? ' is-active' : ''}`}
          >
            <button
              type="button"
              className="stqf-pill__apply"
              title={summarize(qf)}
              aria-pressed={activeId === qf.id}
              onClick={() => applyItem(qf)}
            >
              <span className="stqf-pill__icon">
                <Bookmark size={12} />
              </span>
              <span className="stqf-pill__name">{qf.name}</span>
              {count > 0 && <span className="stqf-pill__count">{count}</span>}
            </button>
            <button
              type="button"
              className="stqf-pill__x"
              aria-label={`Remove quick filter ${qf.name}`}
              title="Remove quick filter"
              onClick={() => removeItem(qf.id)}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}

      <button
        type="button"
        className="stqf-save"
        onClick={saveCurrent}
        disabled={!hasLiveQuery}
        title={
          hasLiveQuery
            ? 'Pin the current filters + sort as a quick filter'
            : 'Add a filter or sort first'
        }
      >
        <Plus size={13} />
        Save current
      </button>
    </div>
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

  // ---- View-type switch (Table / Board / Calendar) -----------------------
  /** The active flat view kind (owned by the page). */
  viewKind?: 'table' | 'board';
  /** Switch between the table and board flat views. */
  onViewKindChange?: (kind: 'table' | 'board') => void;
  /** Whether the Board option is offered (object declares a SELECT group). */
  canBoard?: boolean;
  /** Href for the Calendar view (the existing `/sabcrm/calendar` page). */
  calendarHref?: string;
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
  viewKind = 'table',
  onViewKindChange,
  canBoard = false,
  calendarHref,
}: SabcrmViewBarProps): React.JSX.Element {
  const fieldByKey = React.useMemo(() => {
    const m = new Map<string, FieldMetadata>();
    for (const f of object.fields) m.set(f.key, f);
    return m;
  }, [object]);

  // ---- URL view-state sync (shareable / back-forward) -------------------
  // `useSearchParams` is null during the static-export pass and SSR before
  // hydration, so every read is guarded.
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // ---- URL → state (once, on mount) ------------------------------------
  // Read the shareable view state out of the query string and push the
  // present dimensions up through the page's setters. Runs a single time per
  // object slug; `hydratedFromUrl` then unlocks the state → URL writer below.
  const hydratedFromUrl = React.useRef(false);
  React.useEffect(() => {
    // Re-hydrate when the object changes (its URL belongs to a different table).
    hydratedFromUrl.current = false;
  }, [object.slug]);

  React.useEffect(() => {
    if (hydratedFromUrl.current) return;
    if (typeof window === 'undefined') return;

    // Prefer the router's params; fall back to the live location so a hard
    // navigation that beats the hook still hydrates.
    const params = searchParams
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams(window.location.search);

    const decoded = decodeUrlState(params);
    const hasUrlState =
      decoded.filters !== null ||
      decoded.sortBy !== null ||
      decoded.groupBy !== null ||
      decoded.viewKind !== null ||
      decoded.viewId !== null;

    hydratedFromUrl.current = true;

    if (!hasUrlState) return;

    // The URL is authoritative for this load — don't let the saved-view
    // default-apply clobber a shared link.
    didAutoApply.current = true;

    // Push the merged state up via the existing onChange the view bar uses.
    onStateChange({
      filters: decoded.filters ?? EMPTY_FILTER_GROUP,
      sortBy: decoded.sortBy,
      sortDir: decoded.sortDir ?? 'asc',
      groupBy: decoded.groupBy,
    });

    if (decoded.viewKind && decoded.viewKind !== viewKind) {
      onViewKindChange?.(decoded.viewKind);
    }
    if (decoded.viewId) {
      setActiveViewId(decoded.viewId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.slug, searchParams]);

  // ---- state → URL (after hydration) -----------------------------------
  // Mirror the live filter / sort / group / view-kind / active-view into the
  // query string with a shallow, scroll-free `router.replace`, so the URL is
  // shareable and back/forward restores the view. Other params (notably the
  // page-owned `q` search) are preserved untouched.
  React.useEffect(() => {
    if (!hydratedFromUrl.current) return;
    if (typeof window === 'undefined') return;

    // Read the freshest query string off the live location so a `q` (or any
    // other param) the page set after our hydrate pass is preserved, not the
    // possibly-stale `searchParams` closure.
    const base = new URLSearchParams(window.location.search);

    const next = buildUrlParams(base, {
      state,
      viewKind,
      viewId: activeViewId,
    });

    // Skip the rewrite when nothing we own actually changed (avoids redundant
    // history churn and feedback loops with the hydrate effect).
    if (ownedSignature(next) === ownedSignature(base)) return;

    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, viewKind, activeViewId]);

  // ---- Copy-link affordance --------------------------------------------
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyLink = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Legacy fallback for non-secure contexts.
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }, []);

  // ---- Active-state derived bits ---------------------------------------

  // Commit a whole new root group from the advanced-filter builder.
  const applyFilters = (group: FilterGroup) =>
    onStateChange({ ...state, filters: group });

  // Recall a quick filter: replace the live filter tree + sort in one push,
  // keeping the current grouping/layout intact.
  const applyQuickFilter = React.useCallback(
    (filters: FilterGroup, sortBy: string | null, sortDir: 'asc' | 'desc') => {
      onStateChange({ ...state, filters, sortBy, sortDir });
    },
    [onStateChange, state],
  );

  // A flat, path-addressed view of every leaf condition in the tree — drives
  // the removable pill summary. The `path` is the chain of child indices from
  // the root to the leaf, so a pill's "x" can prune exactly that leaf even when
  // it lives inside a nested sub-group.
  const leafPills = React.useMemo(() => {
    const out: { path: number[]; condition: FilterCondition }[] = [];
    const walk = (group: FilterGroup, prefix: number[]) => {
      group.conditions.forEach((node, idx) => {
        const path = [...prefix, idx];
        if (isFilterGroup(node)) walk(node, path);
        else out.push({ path, condition: node });
      });
    };
    walk(state.filters, []);
    return out;
  }, [state.filters]);

  // Remove the leaf at `path`, then collapse any sub-groups it emptied so the
  // tree never keeps dangling empty groups (which would still read as nested).
  const removeLeafAtPath = (path: number[]) => {
    const prune = (group: FilterGroup, depth: number): FilterGroup => {
      const targetIdx = path[depth];
      const conditions: FilterNode[] = [];
      group.conditions.forEach((node, idx) => {
        if (idx === targetIdx) {
          if (depth === path.length - 1) return; // drop the leaf itself
          if (isFilterGroup(node)) {
            const sub = prune(node, depth + 1);
            if (sub.conditions.length > 0) conditions.push(sub);
            return;
          }
        }
        conditions.push(node);
      });
      return { op: group.op, conditions };
    };
    const next = prune(state.filters, 0);
    applyFilters(next.conditions.length > 0 ? next : EMPTY_FILTER_GROUP);
  };

  const filterCount = countConditions(state.filters);

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

      {/* Quick filters (saved searches) — per-object, localStorage-backed */}
      <QuickFilters
        object={object}
        state={state}
        onApply={applyQuickFilter}
        fieldByKey={fieldByKey}
      />

      {/* Controls + active chips */}
      <div className="stv-bar">
        <ControlPopover label="Filter" icon={Filter} active={filterCount > 0} wide>
          {(close) => (
            <FilterPopover
              object={object}
              group={state.filters}
              onApply={applyFilters}
              close={close}
            />
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

        {/* Twenty consolidates Columns + Group + Copy-link under one "Options"
            dropdown, so the bar reads cleanly as Filter · Sort · Options. */}
        <ControlPopover
          label="Options"
          icon={SlidersHorizontal}
          active={!!state.groupBy}
          alignRight
        >
          {(close) => (
            <div className="stv-options">
              <FieldsPopover
                object={object}
                visible={visibleColumns}
                onToggle={onToggleColumn}
              />
              <div className="stv-pop__sep" />
              <GroupPopover
                object={object}
                groupBy={state.groupBy}
                onApply={(groupBy) => onStateChange({ ...state, groupBy })}
                close={close}
              />
              <div className="stv-pop__sep" />
              <button
                type="button"
                className="stv-coltoggle"
                onClick={() => {
                  copyLink();
                  close();
                }}
              >
                <span className="stv-coltoggle__icon" aria-hidden="true">
                  {copied ? <Check size={14} /> : <Link2 size={14} />}
                </span>
                <span className="stv-coltoggle__label">
                  {copied ? 'Link copied!' : 'Copy link to view'}
                </span>
              </button>
            </div>
          )}
        </ControlPopover>

        {/* View-type switch — Table / Board / Calendar. Board is offered only
            when the object can be grouped; Calendar links to the existing
            `/sabcrm/calendar` page (no inline month needed). */}
        <div className="st-viewswitch" role="tablist" aria-label="View type">
          <button
            type="button"
            role="tab"
            aria-selected={viewKind === 'table'}
            className={`st-viewswitch__btn${viewKind === 'table' ? ' active' : ''}`}
            onClick={() => onViewKindChange?.('table')}
          >
            <Table2 size={14} />
            Table
          </button>
          {canBoard && (
            <button
              type="button"
              role="tab"
              aria-selected={viewKind === 'board'}
              className={`st-viewswitch__btn${viewKind === 'board' ? ' active' : ''}`}
              onClick={() => onViewKindChange?.('board')}
            >
              <Columns3 size={14} />
              Board
            </button>
          )}
          {calendarHref && (
            <Link
              role="tab"
              aria-selected={false}
              className="st-viewswitch__btn"
              href={calendarHref}
            >
              <CalendarDays size={14} />
              Calendar
            </Link>
          )}
        </div>

        <div className="stv-bar__spacer" />

        {/* Active filter / sort / group chips */}
        <div className="stv-chips">
          {leafPills.map(({ path, condition: c }) => {
            const f = fieldByKey.get(c.fieldKey);
            // A leaf inside a sub-group (path length > 1) is part of an
            // advanced/nested filter — flag it so the simple pill still hints
            // at the structure without trying to redraw the whole tree.
            const nested = path.length > 1;
            return (
              <span className="stv-pill" key={path.join('-')}>
                {nested && <span className="stv-pill__op">(…)</span>}
                <span className="stv-pill__key">{f?.label ?? c.fieldKey}</span>
                <span className="stv-pill__op">{OP_LABEL[c.op]}</span>
                {c.op !== 'isEmpty' && c.op !== 'isNotEmpty' && (
                  <span className="stv-pill__val">{pillValue(f, c)}</span>
                )}
                <button
                  type="button"
                  className="stv-pill__x"
                  aria-label="Remove filter"
                  onClick={() => removeLeafAtPath(path)}
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
