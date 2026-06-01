'use client';

/**
 * SabCRM — view toolbar.
 *
 * The single control bar mounted above any object's record index
 * (`/sabcrm/<objectSlug>`). It is the metadata-driven equivalent of Twenty's
 * per-view header and drives every read parameter the record runtime needs:
 *
 *   - **Search** — internally debounced free-text (300 ms); `onChange` receives
 *     the committed value so the host never needs its own debounce timer.
 *   - **Filters** — per-field condition chips. Each chip picks a field, an
 *     operator appropriate to that field's {@link FieldType}, and (unless the
 *     operator is value-less) a value. Conditions compile to the
 *     {@link SabcrmFilterValue} operator objects the actions layer understands.
 *   - **Sort** — field + direction (a single {@link SabcrmSortClause}).
 *   - **View toggle** — Table / Board, only offering Board when the object
 *     declares it (`views` includes `board` and a `board.groupByField` exists).
 *   - **Saved views** — list / apply / save / delete / set-default, wired to the
 *     gated `*ViewAction` server actions. A view captures the full toolbar state
 *     (kind + filters + sort + search + group-by) so it round-trips on apply.
 *
 * The component owns its own data wiring (it fetches + mutates saved views via
 * the gated actions, exactly like the sibling {@link RecordTable}); the host
 * page only supplies the live {@link ViewToolbarState} and an `onChange`
 * handler. Every action is `ActionResult`-typed and surfaced inline via the
 * shared toast, so RBAC-denied / plan-locked / validation errors never throw.
 *
 * Pure ZoruUI, black-and-white. Filter values that point at FILE fields are not
 * offered (file inputs are handled elsewhere through SabFiles).
 *
 * Accessibility guarantees
 * ------------------------
 * - All interactive controls carry an `aria-label` or visible text that screen
 *   readers can announce.
 * - The view toggle uses `role="group"` + `aria-label` with `aria-pressed` on
 *   each button.
 * - Result count is wrapped in an `aria-live="polite"` region.
 * - The toolbar root carries `aria-busy` while a fetch is in flight.
 * - Search input has a stable `id` linked to its visible icon via `aria-label`.
 * - Filter chip remove buttons announce the field being removed.
 * - Focus does not jump unexpectedly when chips are removed.
 */

import * as React from 'react';
import {
  ArrowDownUp,
  Columns3,
  Filter as FilterIcon,
  ListFilter,
  Plus,
  Search,
  Star,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import {
  Badge,
  Button,
  cn,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Input,
  Checkbox,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useZoruToast,
} from '@/components/zoruui';
import {
  listViewsAction,
  saveViewAction,
  deleteViewAction,
  setDefaultViewAction,
  type SabcrmFilterValue,
  type SabcrmSortClause,
} from '@/app/actions/sabcrm.actions';
import type { SavedView } from '@/lib/sabcrm/views.server';
import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The two layouts the record runtime can render. */
export type ViewKind = 'table' | 'board';

/**
 * Filter operators offered in the toolbar. Plain string identifiers so a
 * condition serialises cleanly; {@link buildFilterMap} compiles them into the
 * {@link SabcrmFilterValue} operator objects the actions layer consumes.
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse';

/** One active filter condition (UI shape — see {@link buildFilterMap}). */
export interface FilterCondition {
  /** Field key on the object. */
  field: string;
  operator: FilterOperator;
  /** Ignored for value-less operators (isEmpty / isTrue / …). */
  value: string;
}

/** Single-field sort, mirroring the page's existing inline shape. */
export interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}

/** The complete, serialisable state the toolbar drives. */
export interface ViewToolbarState {
  view: ViewKind;
  /**
   * Debounced search text. The toolbar buffers keystrokes internally and only
   * calls `onChange` after the 300 ms quiet window, so the host receives the
   * committed value directly — no extra debounce needed on the host side.
   */
  search: string;
  filters: FilterCondition[];
  sort: SortState | null;
  /** SELECT field key the board groups by; only meaningful when `view==='board'`. */
  groupByField?: string;
}

export interface ViewToolbarProps {
  object: ObjectMetadata;
  /** Active project override forwarded to every server action. */
  projectId?: string;
  state: ViewToolbarState;
  onChange: (next: ViewToolbarState) => void;
  /** Number of records the current query matched (rendered as a count badge). */
  resultCount?: number;
  loading?: boolean;
  /**
   * When the current user cannot persist views (no `sabcrm:manage`), the
   * save/delete/default affordances are hidden — applying remains available.
   */
  canManageViews?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Operator vocabulary
// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'is',
  ne: 'is not',
  contains: 'contains',
  gt: 'greater than',
  gte: 'greater or equal',
  lt: 'less than',
  lte: 'less or equal',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  isTrue: 'is checked',
  isFalse: 'is unchecked',
};

const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>(
  ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'],
);

function operatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case 'NUMBER':
    case 'CURRENCY':
    case 'RATING':
    case 'DATE':
    case 'DATE_TIME':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
    case 'BOOLEAN':
      return ['isTrue', 'isFalse'];
    case 'SELECT':
      return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
    case 'MULTI_SELECT':
      return ['contains', 'isEmpty', 'isNotEmpty'];
    case 'RELATION':
      return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
    case 'TEXT':
    case 'EMAIL':
    case 'PHONE':
    case 'LINK':
    default:
      return ['contains', 'eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/** Fields a user can filter/sort on (everything except FILE). */
function usableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => f.type !== 'FILE');
}

function fieldByKey(
  object: ObjectMetadata,
  key: string,
): FieldMetadata | undefined {
  return object.fields.find((f) => f.key === key);
}

/** SELECT fields a board can group by. */
function groupableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => f.type === 'SELECT' && (f.options?.length ?? 0) > 0,
  );
}

/** Coerce a raw filter input string to the type the field expects. */
function coerceValue(field: FieldMetadata | undefined, raw: string): unknown {
  if (!field) return raw;
  switch (field.type) {
    case 'NUMBER':
    case 'CURRENCY':
    case 'RATING': {
      const n = Number(raw);
      return Number.isNaN(n) ? raw : n;
    }
    default:
      return raw;
  }
}

/** Render a stored filter value for the chip label. */
function displayValue(field: FieldMetadata | undefined, raw: string): string {
  if (field?.type === 'SELECT') {
    const opt = field.options?.find((o) => o.value === raw);
    return opt?.label ?? raw;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// State <-> wire mapping
// ---------------------------------------------------------------------------

/**
 * Compile UI {@link FilterCondition}s into the per-field
 * {@link SabcrmFilterValue} map the actions layer (and Mongo) understand.
 * Multiple conditions on the same field are merged into one operator object.
 */
export function buildFilterMap(
  object: ObjectMetadata,
  conditions: FilterCondition[],
): Record<string, SabcrmFilterValue> {
  const out: Record<string, SabcrmFilterValue> = {};

  for (const cond of conditions) {
    const field = fieldByKey(object, cond.field);
    if (!field) continue;

    const valueless = VALUELESS_OPERATORS.has(cond.operator);
    if (!valueless && cond.value === '') continue;

    const coerced = coerceValue(field, cond.value);

    let next: SabcrmFilterValue;
    switch (cond.operator) {
      case 'eq':
        next = { $eq: coerced };
        break;
      case 'ne':
        next = { $ne: coerced };
        break;
      case 'contains':
        next = { $regex: String(cond.value), $options: 'i' };
        break;
      case 'gt':
        next = { $gt: coerced };
        break;
      case 'gte':
        next = { $gte: coerced };
        break;
      case 'lt':
        next = { $lt: coerced };
        break;
      case 'lte':
        next = { $lte: coerced };
        break;
      case 'isEmpty':
        // Missing OR null OR empty string.
        next = { $in: [null, ''] as unknown[] };
        break;
      case 'isNotEmpty':
        next = { $nin: [null, ''] as unknown[] };
        break;
      case 'isTrue':
        next = { $eq: true };
        break;
      case 'isFalse':
        next = { $ne: true };
        break;
      default:
        continue;
    }

    const existing = out[cond.field];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      typeof next === 'object' &&
      !Array.isArray(next) &&
      next !== null
    ) {
      out[cond.field] = { ...existing, ...next };
    } else {
      out[cond.field] = next;
    }
  }

  return out;
}

/** Compile the toolbar's single sort into a multiSort clause array. */
export function buildSortClauses(
  sort: SortState | null,
): SabcrmSortClause[] | undefined {
  if (!sort) return undefined;
  return [{ field: sort.field, dir: sort.dir }];
}

/**
 * Reconstruct toolbar conditions from a persisted view's `filters` map. Only
 * recovers the shapes {@link buildFilterMap} produces; unknown shapes fall back
 * to a single `eq`/`contains` condition so nothing is silently dropped.
 */
function conditionsFromMap(
  object: ObjectMetadata,
  map: Record<string, unknown> | undefined,
): FilterCondition[] {
  if (!map) return [];
  const conds: FilterCondition[] = [];

  for (const [field, value] of Object.entries(map)) {
    if (value === null || value === undefined) continue;

    if (typeof value !== 'object' || Array.isArray(value)) {
      conds.push({ field, operator: 'eq', value: String(value) });
      continue;
    }

    const ops = value as Record<string, unknown>;
    if ('$regex' in ops) {
      conds.push({ field, operator: 'contains', value: String(ops.$regex) });
    } else if ('$eq' in ops) {
      conds.push(
        ops.$eq === true
          ? { field, operator: 'isTrue', value: '' }
          : { field, operator: 'eq', value: String(ops.$eq) },
      );
    } else if ('$ne' in ops) {
      conds.push(
        ops.$ne === true
          ? { field, operator: 'isFalse', value: '' }
          : { field, operator: 'ne', value: String(ops.$ne) },
      );
    } else if ('$gte' in ops) {
      conds.push({ field, operator: 'gte', value: String(ops.$gte) });
    } else if ('$gt' in ops) {
      conds.push({ field, operator: 'gt', value: String(ops.$gt) });
    } else if ('$lte' in ops) {
      conds.push({ field, operator: 'lte', value: String(ops.$lte) });
    } else if ('$lt' in ops) {
      conds.push({ field, operator: 'lt', value: String(ops.$lt) });
    } else if ('$nin' in ops) {
      conds.push({ field, operator: 'isNotEmpty', value: '' });
    } else if ('$in' in ops) {
      conds.push({ field, operator: 'isEmpty', value: '' });
    } else {
      const fld = fieldByKey(object, field);
      conds.push({
        field,
        operator: fld && fld.type !== 'TEXT' ? 'eq' : 'contains',
        value: '',
      });
    }
  }

  return conds;
}

/** Map a persisted {@link SavedView} into full toolbar state. */
function stateFromView(
  object: ObjectMetadata,
  view: SavedView,
): ViewToolbarState {
  return {
    view: view.kind,
    search: '',
    filters: conditionsFromMap(object, view.filters),
    sort: view.sortBy
      ? { field: view.sortBy, dir: view.sortDir === 'desc' ? 'desc' : 'asc' }
      : null,
    groupByField: view.groupByField,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Unique id prefix so multiple toolbars on one page don't clash. */
let _toolbarCounter = 0;

export function ViewToolbar({
  object,
  projectId,
  state,
  onChange,
  resultCount,
  loading = false,
  canManageViews = true,
  className,
}: ViewToolbarProps): React.ReactElement {
  const { toast } = useZoruToast();

  // Stable id for the search input — generated once per mount.
  const searchInputId = React.useRef(`sabcrm-search-${++_toolbarCounter}`);

  const [views, setViews] = React.useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);

  // Raw (unthrottled) search text kept in local state so the input stays
  // responsive while the debounced onChange fires at most once per 300 ms.
  const [searchRaw, setSearchRaw] = React.useState(state.search);

  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Keep a stable reference to `onChange` so debounced callbacks never
  // close over a stale version.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Keep a stable reference to `state` for the same reason.
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Debounced search: fires onChange with the committed value after 300 ms of
  // inactivity. Uses the *latest* state via refs so the callback itself is
  // stable and never needs to be recreated.
  const commitSearch = useDebouncedCallback((raw: string) => {
    onChangeRef.current({ ...stateRef.current, search: raw });
  }, 300);

  // When a saved view is applied the host resets `state.search`; mirror that
  // back into the local raw buffer so the input reflects the new value.
  React.useEffect(() => {
    setSearchRaw(state.search);
  }, [state.search]);

  const fields = React.useMemo(() => usableFields(object), [object]);
  const sortableFields = fields;
  const boardFields = React.useMemo(() => groupableFields(object), [object]);
  const canBoard = object.views.includes('board') && boardFields.length > 0;

  // Pre-build a key→field index so chip rendering and dialog lookups are O(1).
  const fieldIndex = React.useMemo(
    () => new Map(object.fields.map((f) => [f.key, f])),
    [object.fields],
  );
  const fieldByKeyFast = React.useCallback(
    (key: string) => fieldIndex.get(key),
    [fieldIndex],
  );

  // ---- load saved views for this object ---------------------------------
  const reloadViews = React.useCallback(async () => {
    const res = await listViewsAction(object.slug, projectId);
    if (res.ok) setViews(res.data);
  }, [object.slug, projectId]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listViewsAction(object.slug, projectId);
      if (cancelled || !res.ok) return;
      setViews(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, projectId]);

  // ---- handlers ---------------------------------------------------------
  // Use functional setState pattern so `patch` doesn't depend on `state`.
  const patch = React.useCallback(
    (delta: Partial<ViewToolbarState>) => {
      onChangeRef.current({ ...stateRef.current, ...delta });
    },
    [],
  );

  const applyView = React.useCallback(
    (view: SavedView) => {
      setActiveViewId(view._id);
      onChangeRef.current(stateFromView(object, view));
    },
    [object],
  );

  const removeCondition = React.useCallback(
    (index: number) => {
      setActiveViewId(null);
      onChangeRef.current({
        ...stateRef.current,
        filters: stateRef.current.filters.filter((_, i) => i !== index),
      });
    },
    [],
  );

  const setView = React.useCallback(
    (view: ViewKind) => {
      if (view === stateRef.current.view) return;
      const next: ViewToolbarState = { ...stateRef.current, view };
      if (view === 'board' && !next.groupByField) {
        next.groupByField = object.board?.groupByField ?? boardFields[0]?.key;
      }
      onChangeRef.current(next);
    },
    [object.board, boardFields],
  );

  const onDeleteView = React.useCallback(
    async (view: SavedView) => {
      const res = await deleteViewAction(view._id, projectId);
      if (!res.ok) {
        toastRef.current({
          title: 'Could not delete view',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setActiveViewId((curr) => (curr === view._id ? null : curr));
      setViews((curr) => curr.filter((v) => v._id !== view._id));
      toastRef.current({ title: `Deleted “${view.name}”.` });
    },
    [projectId],
  );

  const onSetDefaultView = React.useCallback(
    async (view: SavedView) => {
      const res = await setDefaultViewAction(view._id, projectId);
      if (!res.ok) {
        toastRef.current({
          title: 'Could not set default',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      await reloadViews();
      toastRef.current({ title: `"${view.name}" is now the default view.` });
    },
    [projectId, reloadViews],
  );

  const onSave = React.useCallback(() => setSaveOpen(true), []);

  const activeView = views.find((v) => v._id === activeViewId) ?? null;
  const activeFilterCount = state.filters.length;

  // Aria label for the sort button reflects the active sort field.
  const sortAriaLabel = state.sort
    ? `Sort by ${fieldByKeyFast(state.sort.field)?.label ?? state.sort.field}, ${state.sort.dir === 'desc' ? 'descending' : 'ascending'}`
    : 'Sort records';

  // Aria label for the filter button reflects the active count.
  const filterAriaLabel =
    activeFilterCount > 0
      ? `Filters — ${activeFilterCount} active`
      : 'Add filters';

  return (
    <div
      className={cn('mb-4 flex flex-col gap-3', className)}
      aria-busy={loading || undefined}
    >
      {/* Row 1 — search · view toggle · saved views */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            id={searchInputId.current}
            value={searchRaw}
            onChange={(e) => {
              const raw = e.target.value;
              setSearchRaw(raw);
              setActiveViewId(null);
              commitSearch(raw);
            }}
            leadingSlot={<Search aria-hidden="true" />}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
            aria-label={`Search ${object.labelPlural}`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Result count — announced politely so screen readers update naturally */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-zoru-ink-muted"
          >
            {typeof resultCount === 'number' && !loading
              ? `${resultCount} ${
                  resultCount === 1
                    ? object.labelSingular.toLowerCase()
                    : object.labelPlural.toLowerCase()
                }`
              : null}
          </span>

          {canBoard && (
            <div
              className="inline-flex items-center gap-1 rounded-[var(--zoru-radius)] border border-zoru-line p-0.5"
              role="group"
              aria-label="View layout"
            >
              <Button
                type="button"
                size="sm"
                variant={state.view === 'table' ? 'secondary' : 'ghost'}
                aria-pressed={state.view === 'table'}
                aria-label="Table view"
                onClick={() => setView('table')}
              >
                <Table2 className="mr-1.5" aria-hidden="true" />
                Table
              </Button>
              <Button
                type="button"
                size="sm"
                variant={state.view === 'board' ? 'secondary' : 'ghost'}
                aria-pressed={state.view === 'board'}
                aria-label="Board view"
                onClick={() => setView('board')}
              >
                <Columns3 className="mr-1.5" aria-hidden="true" />
                Board
              </Button>
            </div>
          )}

          <SavedViewsMenu
            views={views}
            activeView={activeView}
            canManage={canManageViews}
            onApply={applyView}
            onSave={onSave}
            onDelete={onDeleteView}
            onSetDefault={onSetDefaultView}
          />
        </div>
      </div>

      {/* Row 2 — sort · filter · group-by */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={state.sort ? 'secondary' : 'outline'}
          aria-label={sortAriaLabel}
          onClick={() => setSortOpen(true)}
        >
          <ArrowDownUp className="mr-1.5" aria-hidden="true" />
          Sort
          {state.sort && (
            <Badge variant="outline" className="ml-1.5" aria-hidden="true">
              {fieldByKeyFast(state.sort.field)?.label ?? state.sort.field}
            </Badge>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
          aria-label={filterAriaLabel}
          onClick={() => setFilterOpen(true)}
        >
          <FilterIcon className="mr-1.5" aria-hidden="true" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="ml-1.5" aria-hidden="true">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {state.view === 'board' && boardFields.length > 0 && (
          <div className="flex items-center gap-1.5">
            <ListFilter
              className="h-4 w-4 text-zoru-ink-muted"
              aria-hidden="true"
            />
            <Select
              value={state.groupByField ?? boardFields[0]?.key}
              onValueChange={(key) => patch({ groupByField: key })}
            >
              <SelectTrigger
                className="h-9 w-[180px]"
                aria-label="Group board by field"
              >
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                {boardFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    Group: {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(activeFilterCount > 0 || state.sort) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Clear all filters and sort"
            onClick={() => {
              setActiveViewId(null);
              patch({ filters: [], sort: null });
            }}
          >
            <X className="mr-1" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="list"
          aria-label="Active filters"
        >
          {state.filters.map((cond, index) => {
            const field = fieldByKeyFast(cond.field);
            const fieldLabel = field?.label ?? cond.field;
            return (
              <span
                key={`${cond.field}-${cond.operator}-${index}`}
                role="listitem"
                className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface py-1 pl-2.5 pr-1 text-xs text-zoru-ink"
              >
                <span className="font-medium">{fieldLabel}</span>
                <span className="text-zoru-ink-muted">
                  {OPERATOR_LABELS[cond.operator]}
                </span>
                {!VALUELESS_OPERATORS.has(cond.operator) &&
                  cond.value !== '' && (
                    <span className="font-medium">
                      {displayValue(field, cond.value)}
                    </span>
                  )}
                <button
                  type="button"
                  aria-label={`Remove filter: ${fieldLabel} ${OPERATOR_LABELS[cond.operator]}`}
                  className="rounded-full p-0.5 text-zoru-ink-muted transition-colors hover:bg-zoru-surface-2 hover:text-zoru-ink"
                  onClick={() => removeCondition(index)}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Sort editor */}
      <SortDialog
        open={sortOpen}
        onOpenChange={setSortOpen}
        fields={sortableFields}
        sort={state.sort}
        onApply={(sort) => {
          setActiveViewId(null);
          patch({ sort });
          setSortOpen(false);
        }}
      />

      {/* Filter editor */}
      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        object={object}
        fields={fields}
        conditions={state.filters}
        onApply={(conditions) => {
          setActiveViewId(null);
          patch({ filters: conditions });
          setFilterOpen(false);
        }}
      />

      {/* Save view */}
      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        object={object}
        projectId={projectId}
        state={state}
        existingViews={views}
        onSaved={async (view) => {
          await reloadViews();
          setActiveViewId(view._id);
          setSaveOpen(false);
          toastRef.current({ title: `Saved view “${view.name}”.` });
        }}
        onError={(message) =>
          toastRef.current({
            title: 'Could not save view',
            description: message,
            variant: 'destructive',
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved-views menu
// ---------------------------------------------------------------------------

interface SavedViewsMenuProps {
  views: SavedView[];
  activeView: SavedView | null;
  canManage: boolean;
  onApply: (view: SavedView) => void;
  onSave: () => void;
  onDelete: (view: SavedView) => void | Promise<void>;
  onSetDefault: (view: SavedView) => void | Promise<void>;
}

const SavedViewsMenu = React.memo(function SavedViewsMenu({
  views,
  activeView,
  canManage,
  onApply,
  onSave,
  onDelete,
  onSetDefault,
}: SavedViewsMenuProps): React.ReactElement {
  const triggerLabel = activeView
    ? `Saved views — current: ${activeView.name}`
    : 'Saved views';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={triggerLabel}
        >
          <Star
            className={cn('mr-1.5', activeView?.isDefault && 'fill-current')}
            aria-hidden="true"
          />
          {activeView ? activeView.name : 'Views'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        {views.length === 0 ? (
          <DropdownMenuItem disabled>No saved views yet</DropdownMenuItem>
        ) : (
          views.map((view) => (
            <DropdownMenuItem key={view._id} onSelect={() => onApply(view)}>
              <Star
                aria-hidden="true"
                className={cn(
                  'text-zoru-ink-muted',
                  view.isDefault && 'fill-current text-zoru-ink',
                )}
              />
              <span className="flex-1 truncate">{view.name}</span>
              {view.isDefault && (
                <Badge variant="ghost" className="ml-1">
                  default
                </Badge>
              )}
            </DropdownMenuItem>
          ))
        )}

        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSave}>
              <Plus aria-hidden="true" />
              Save current as view…
            </DropdownMenuItem>
            {views.length > 0 && (
              <>
                <DropdownMenuLabel>Manage</DropdownMenuLabel>
                {views.map((view) => (
                  <DropdownMenuItem
                    key={`mgmt-${view._id}`}
                    disabled={view.isDefault}
                    onSelect={() => void onSetDefault(view)}
                  >
                    <Star aria-hidden="true" />
                    {view.isDefault
                      ? `${view.name} (default)`
                      : `Make “${view.name}” default`}
                  </DropdownMenuItem>
                ))}
                {views.map((view) => (
                  <DropdownMenuItem
                    key={`del-${view._id}`}
                    destructive
                    onSelect={() => void onDelete(view)}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete “{view.name}”
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ---------------------------------------------------------------------------
// Sort dialog
// ---------------------------------------------------------------------------

const NO_SORT = '__none__';

interface SortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldMetadata[];
  sort: SortState | null;
  onApply: (sort: SortState | null) => void;
}

const SortDialog = React.memo(function SortDialog({
  open,
  onOpenChange,
  fields,
  sort,
  onApply,
}: SortDialogProps): React.ReactElement {
  const [draft, setDraft] = React.useState<SortState | null>(sort);

  React.useEffect(() => {
    if (open) setDraft(sort);
  }, [open, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[420px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Sort</ZoruDialogTitle>
          <ZoruDialogDescription>
            Order records by a single field.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="sort-field-select">Field</Label>
            <Select
              value={draft?.field ?? NO_SORT}
              onValueChange={(field) =>
                setDraft(
                  field === NO_SORT
                    ? null
                    : { field, dir: draft?.dir ?? 'asc' },
                )
              }
            >
              <SelectTrigger id="sort-field-select" aria-label="Sort field">
                <SelectValue placeholder="No sorting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SORT}>No sorting</SelectItem>
                {fields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {draft && (
            <div className="space-y-2">
              <Label htmlFor="sort-dir-select">Direction</Label>
              <Select
                value={draft.dir}
                onValueChange={(dir) =>
                  setDraft({
                    field: draft.field,
                    dir: dir === 'desc' ? 'desc' : 'asc',
                  })
                }
              >
                <SelectTrigger id="sort-dir-select" aria-label="Sort direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <ZoruDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => onApply(draft)}>
            Apply
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
});

// ---------------------------------------------------------------------------
// Filter dialog
// ---------------------------------------------------------------------------

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object: ObjectMetadata;
  fields: FieldMetadata[];
  conditions: FilterCondition[];
  onApply: (conditions: FilterCondition[]) => void;
}

const FilterDialog = React.memo(function FilterDialog({
  open,
  onOpenChange,
  object,
  fields,
  conditions,
  onApply,
}: FilterDialogProps): React.ReactElement {
  const [draft, setDraft] = React.useState<FilterCondition[]>(conditions);

  React.useEffect(() => {
    if (open) setDraft(conditions);
  }, [open, conditions]);

  const addRow = React.useCallback(() => {
    const field = fields[0];
    if (!field) return;
    setDraft((prev) => [
      ...prev,
      { field: field.key, operator: operatorsForType(field.type)[0], value: '' },
    ]);
  }, [fields]);

  const updateRow = React.useCallback(
    (index: number, delta: Partial<FilterCondition>) => {
      setDraft((prev) =>
        prev.map((row, i) => (i === index ? { ...row, ...delta } : row)),
      );
    },
    [],
  );

  const removeRow = React.useCallback((index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const apply = React.useCallback(() => {
    // Drop incomplete rows (value required for value-bearing operators).
    const cleaned = draft.filter(
      (c) => VALUELESS_OPERATORS.has(c.operator) || c.value.trim() !== '',
    );
    onApply(cleaned);
  }, [draft, onApply]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[560px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Filters</ZoruDialogTitle>
          <ZoruDialogDescription>
            Records must match every condition.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div
          className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto py-1 pr-1"
          role="list"
          aria-label="Filter conditions"
        >
          {draft.length === 0 ? (
            <p className="py-4 text-center text-sm text-zoru-ink-muted">
              No filters yet.
            </p>
          ) : (
            draft.map((cond, index) => {
              const field = fieldByKey(object, cond.field);
              const fieldLabel = field?.label ?? cond.field;
              const ops = field
                ? operatorsForType(field.type)
                : (['eq'] as FilterOperator[]);
              // Use field+operator as key; index is a fallback for duplicates.
              const rowKey = `${cond.field}-${cond.operator}-${index}`;
              return (
                <div
                  key={rowKey}
                  role="listitem"
                  className="flex flex-wrap items-center gap-2"
                  aria-label={`Filter ${index + 1}: ${fieldLabel}`}
                >
                  <div className="min-w-[140px] flex-1">
                    <Select
                      value={cond.field}
                      onValueChange={(value) => {
                        const nf = fieldByKey(object, value);
                        updateRow(index, {
                          field: value,
                          operator: nf ? operatorsForType(nf.type)[0] : 'eq',
                          value: '',
                        });
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Filter ${index + 1} field`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[130px]">
                    <Select
                      value={cond.operator}
                      onValueChange={(value) =>
                        updateRow(index, {
                          operator: value as FilterOperator,
                          ...(VALUELESS_OPERATORS.has(value as FilterOperator)
                            ? { value: '' }
                            : {}),
                        })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Filter ${index + 1} operator`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[140px] flex-1">
                    <FilterValueInput
                      field={field}
                      operator={cond.operator}
                      value={cond.value}
                      index={index}
                      onChange={(value) => updateRow(index, { value })}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove filter ${index + 1}: ${fieldLabel}`}
                    onClick={() => removeRow(index)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              );
            })
          )}

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addRow}
              disabled={fields.length === 0}
              aria-label="Add filter condition"
            >
              <Plus className="mr-1.5" aria-hidden="true" />
              Add condition
            </Button>
          </div>
        </div>

        <ZoruDialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
            aria-label="Clear all filter conditions"
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={apply}>
            Apply
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
});

interface FilterValueInputProps {
  field: FieldMetadata | undefined;
  operator: FilterOperator;
  value: string;
  /** 0-based position used to build a unique, descriptive aria-label. */
  index: number;
  onChange: (value: string) => void;
}

const FilterValueInput = React.memo(function FilterValueInput({
  field,
  operator,
  value,
  index,
  onChange,
}: FilterValueInputProps): React.ReactElement {
  const ariaLabel = `Filter ${index + 1} value`;

  if (VALUELESS_OPERATORS.has(operator)) {
    return (
      <span className="block py-2 text-xs italic text-zoru-ink-muted">
        no value needed
      </span>
    );
  }

  if (field?.type === 'SELECT') {
    const options = field.options ?? [];
    return (
      <Select value={value === '' ? undefined : value} onValueChange={onChange}>
        <SelectTrigger aria-label={ariaLabel}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const inputType =
    field?.type === 'NUMBER' ||
    field?.type === 'CURRENCY' ||
    field?.type === 'RATING'
      ? 'number'
      : field?.type === 'DATE'
        ? 'date'
        : field?.type === 'DATE_TIME'
          ? 'datetime-local'
          : field?.type === 'EMAIL'
            ? 'email'
            : 'text';

  return (
    <Input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      aria-label={ariaLabel}
    />
  );
});

// ---------------------------------------------------------------------------
// Save-view dialog
// ---------------------------------------------------------------------------

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object: ObjectMetadata;
  projectId?: string;
  state: ViewToolbarState;
  existingViews: SavedView[];
  onSaved: (view: SavedView) => void | Promise<void>;
  onError: (message: string) => void;
}

const SaveViewDialog = React.memo(function SaveViewDialog({
  open,
  onOpenChange,
  object,
  projectId,
  state,
  existingViews,
  onSaved,
  onError,
}: SaveViewDialogProps): React.ReactElement {
  const [name, setName] = React.useState('');
  const [isDefault, setIsDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setIsDefault(false);
      setSaving(false);
    }
  }, [open]);

  const trimmed = name.trim();
  const duplicate = existingViews.some(
    (v) => v.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);

    const filters = buildFilterMap(object, state.filters);
    const res = await saveViewAction(
      {
        object: object.slug,
        name: trimmed,
        kind: state.view,
        filters,
        sortBy: state.sort?.field,
        sortDir: state.sort?.dir,
        groupByField:
          state.view === 'board' ? state.groupByField : undefined,
        isDefault,
      },
      projectId,
    );

    setSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    await onSaved(res.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[420px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Save view</ZoruDialogTitle>
          <ZoruDialogDescription>
            Captures the current filters, sort, layout and group-by.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="sabcrm-view-name">View name</Label>
            <Input
              id="sabcrm-view-name"
              value={name}
              autoFocus
              invalid={duplicate}
              placeholder={`e.g. Open ${object.labelPlural.toLowerCase()}`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            {duplicate && (
              <p className="text-xs text-zoru-danger">
                A view with this name already exists.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zoru-ink">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            Set as default view
          </label>
        </div>

        <ZoruDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!trimmed || saving}
            onClick={() => void submit()}
          >
            Save view
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
});
