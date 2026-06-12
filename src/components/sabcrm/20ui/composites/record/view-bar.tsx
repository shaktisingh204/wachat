'use client';

/**
 * ViewBar — the slim (~40px) toolbar row above a record surface
 * (RecordSurface composite, 20ui).
 *
 * One controlled strip that owns NO data semantics of its own — every
 * control is `value` in / `onChange` out:
 *
 *   - saved-view switcher (select / rename / delete / "Save view as…")
 *   - view-type segmented control (table | board | calendar | map | timeline)
 *   - Filter button + active-count badge → {@link FilterBuilder} in a popover
 *     (draft state lives HERE; `pruneFilterGroup` runs before commit, per the
 *     FilterBuilder contract)
 *   - Sort popover — ordered multi-sort (field + asc/desc, add/remove/reorder)
 *   - Group-by select (only SELECT-type fields are offered)
 *   - collapsible quick-search input
 *   - density toggle (comfortable | compact)
 *   - a `trailing` slot for host actions (e.g. "New record")
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel —
 * self-cycle), icons rendered via the primitives' own `IconProp` plumbing,
 * styling rides `--st-*` / `--u-*` tokens (see view-bar.css) so dark mode is
 * free.
 */

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  GanttChart,
  Kanban,
  ListFilter,
  ListTodo,
  Map as MapIcon,
  Pencil,
  Plus,
  Rows3,
  Rows4,
  Search,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react';

import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import { Button, IconButton } from '../../button';
import { Badge } from '../../badge';
import { Input } from '../../field';
import { Select, type SelectOption } from '../../select';
import { SegmentedControl, type SegmentedItem } from '../../segmented';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '../../popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../dropdown';
import { cn } from '../lib/cn';
import {
  FilterBuilder,
  EMPTY_FILTER_GROUP,
  countConditions,
  defaultCondition,
  filterableFields,
  pruneFilterGroup,
  type FilterGroup,
} from './filter-builder';

import './view-bar.css';

/* ------------------------------------------------------------------ types */

/**
 * The record presentations the segmented control can switch between.
 * `queue` is a PRESENTATION of a saved view (its filters scope the queue,
 * its multi-sort is the priority order) — it is never a persisted `kind`.
 */
export type RecordViewType =
  | 'table'
  | 'board'
  | 'calendar'
  | 'map'
  | 'timeline'
  | 'queue';

/** One entry in the ordered multi-sort list (primary first). */
export interface ViewSort {
  /** `FieldMetadata.key` of the sorted field. */
  fieldKey: string;
  dir: 'asc' | 'desc';
}

/** Row-density modes (mirrors the grid's `.st-density-compact` flag). */
export type ViewDensity = 'comfortable' | 'compact';

/**
 * Minimal client-side saved-view shape consumed by the switcher.
 *
 * Defined here because `sabcrm-views.actions.ts` exposes only the Rust wire
 * document ({@link import('@/lib/rust-client/sabcrm-views').SabcrmRustView}),
 * which carries server-only baggage (projectId, timestamps) and untyped
 * `filters`. Hosts map wire views into this shape (and back on save).
 */
export interface SavedView {
  id: string;
  name: string;
  /** Optional persisted state — hosts apply these when a view is selected. */
  viewType?: RecordViewType;
  filters?: FilterGroup;
  sorts?: ViewSort[];
  groupBy?: string | null;
  isDefault?: boolean;
}

/** Patch shape for {@link ViewBarProps.onUpdateView} (rename today). */
export type SavedViewPatch = Partial<Omit<SavedView, 'id'>>;

export interface ViewBarProps {
  /** Drives labels / accessible names. */
  object: ObjectMetadata;
  /** Field metadata of the active object (feeds filter / sort / group-by). */
  fields: FieldMetadata[];

  /** Canonical filter tree (FilterBuilder's root group). */
  filters: FilterGroup;
  /** Fired with the PRUNED next tree when the user applies / clears. */
  onFiltersChange: (next: FilterGroup) => void;
  /**
   * NL → filter-tree translator. When set, the Filter popover shows an
   * "Ask AI" row; results land in the DRAFT for review, never auto-applied.
   */
  onNlFilter?: (query: string) => Promise<
    | { ok: true; group: FilterGroup; unresolved?: string }
    | { ok: false; error: string }
  >;

  /** Ordered multi-sort (primary first). */
  sorts: ViewSort[];
  onSortsChange: (next: ViewSort[]) => void;

  /** Key of the SELECT field grouped by, or null. */
  groupBy: string | null;
  onGroupByChange: (next: string | null) => void;

  /** Saved views for the switcher. Omit to hide the switcher dropdown. */
  savedViews?: SavedView[];
  activeViewId?: string | null;
  onSelectView?: (id: string) => void;
  /** "Save view as…" — host snapshots the current state under `name`. */
  onSaveView?: (name: string) => void;
  /** Rename (and future patches) of an existing view. */
  onUpdateView?: (id: string, patch: SavedViewPatch) => void;
  onDeleteView?: (id: string) => void;

  /** Active presentation. */
  view: RecordViewType;
  onViewTypeChange: (view: RecordViewType) => void;
  /** Presentations offered. Defaults to all five. */
  availableViews?: RecordViewType[];

  searchQuery: string;
  onSearchQueryChange: (query: string) => void;

  density: ViewDensity;
  onDensityChange: (density: ViewDensity) => void;

  /** Host slot rendered at the far right (e.g. a "New record" button). */
  trailing?: React.ReactNode;
  className?: string;
}

/* -------------------------------------------------------------- constants */

const VIEW_TYPE_META: Record<
  RecordViewType,
  { label: string; icon: SegmentedItem['icon'] }
> = {
  table: { label: 'Table', icon: Table2 },
  board: { label: 'Board', icon: Kanban },
  calendar: { label: 'Calendar', icon: Calendar },
  map: { label: 'Map', icon: MapIcon },
  timeline: { label: 'Timeline', icon: GanttChart },
  queue: { label: 'Queue', icon: ListTodo },
};

const ALL_VIEW_TYPES: RecordViewType[] = [
  'table',
  'board',
  'calendar',
  'map',
  'timeline',
  'queue',
];

const SORT_DIR_ITEMS: ReadonlyArray<SegmentedItem<'asc' | 'desc'>> = [
  { value: 'asc', label: 'Asc', icon: ArrowUp },
  { value: 'desc', label: 'Desc', icon: ArrowDown },
];

/* ----------------------------------------------------- saved-view switcher */

type NamingState =
  | { mode: 'create' }
  | { mode: 'rename'; id: string }
  | null;

function ViewSwitcher({
  object,
  savedViews,
  activeViewId,
  onSelectView,
  onSaveView,
  onUpdateView,
  onDeleteView,
}: Pick<
  ViewBarProps,
  | 'object'
  | 'savedViews'
  | 'activeViewId'
  | 'onSelectView'
  | 'onSaveView'
  | 'onUpdateView'
  | 'onDeleteView'
>): React.JSX.Element {
  const views = savedViews ?? [];
  const active = views.find((v) => v.id === activeViewId) ?? null;

  const [naming, setNaming] = React.useState<NamingState>(null);
  const [nameDraft, setNameDraft] = React.useState('');

  const beginCreate = (): void => {
    setNameDraft('');
    setNaming({ mode: 'create' });
  };
  const beginRename = (): void => {
    if (!active) return;
    setNameDraft(active.name);
    setNaming({ mode: 'rename', id: active.id });
  };

  const submitName = (e: React.FormEvent): void => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || !naming) return;
    if (naming.mode === 'create') onSaveView?.(name);
    else onUpdateView?.(naming.id, { name });
    setNaming(null);
  };

  return (
    <Popover
      open={naming != null}
      onOpenChange={(open) => {
        if (!open) setNaming(null);
      }}
    >
      <DropdownMenu>
        <PopoverAnchor asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="vb-view-trigger"
              iconLeft={Bookmark}
              iconRight={ChevronDown}
            >
              {active?.name ?? `All ${object.labelPlural.toLowerCase()}`}
            </Button>
          </DropdownMenuTrigger>
        </PopoverAnchor>
        <DropdownMenuContent align="start" className="vb-view-menu">
          <DropdownMenuLabel>Views</DropdownMenuLabel>
          {views.length === 0 ? (
            <DropdownMenuItem disabled inset>
              No saved views
            </DropdownMenuItem>
          ) : (
            <DropdownMenuRadioGroup
              value={activeViewId ?? ''}
              onValueChange={(id) => {
                if (id) onSelectView?.(id);
              }}
            >
              {views.map((v) => (
                <DropdownMenuRadioItem key={v.id} value={v.id}>
                  <span className="vb-view-menu__name">{v.name}</span>
                  {v.isDefault ? (
                    <span className="vb-view-menu__default">Default</span>
                  ) : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          {onSaveView ? (
            <DropdownMenuItem iconLeft={Plus} onSelect={beginCreate}>
              Save view as…
            </DropdownMenuItem>
          ) : null}
          {onUpdateView ? (
            <DropdownMenuItem
              iconLeft={Pencil}
              disabled={!active}
              onSelect={beginRename}
            >
              Rename view…
            </DropdownMenuItem>
          ) : null}
          {onDeleteView ? (
            <DropdownMenuItem
              variant="danger"
              iconLeft={Trash2}
              disabled={!active}
              onSelect={() => {
                if (active) onDeleteView(active.id);
              }}
            >
              Delete view
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PopoverContent align="start" className="vb-pop">
        <form className="vb-name-form" onSubmit={submitName}>
          <p className="vb-pop__title">
            {naming?.mode === 'rename' ? 'Rename view' : 'Save view as'}
          </p>
          <Input
            inputSize="sm"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="View name"
            aria-label="View name"
          />
          <div className="vb-pop__foot">
            <Button size="sm" variant="ghost" onClick={() => setNaming(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!nameDraft.trim()}
            >
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------------------------------------------- filter popover */

function FilterControl({
  fields,
  filters,
  onFiltersChange,
  onNlFilter,
}: Pick<
  ViewBarProps,
  'fields' | 'filters' | 'onFiltersChange' | 'onNlFilter'
>): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<FilterGroup>(filters);

  // Ask-AI (NL → draft) row state. Results only ever land in the DRAFT — the
  // user reviews the generated tree and commits through the same Apply path.
  const [nlQuery, setNlQuery] = React.useState('');
  const [nlBusy, setNlBusy] = React.useState(false);
  const [nlError, setNlError] = React.useState<string | null>(null);
  const [nlNote, setNlNote] = React.useState<string | null>(null);

  const activeCount = countConditions(filters);

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      // Seed the draft from the committed tree; an empty tree opens with one
      // ready-to-edit condition so the panel is never a dead end.
      setDraft(
        filters.conditions.length > 0
          ? filters
          : { op: 'and', conditions: [defaultCondition(fields)] },
      );
      setNlQuery('');
      setNlError(null);
      setNlNote(null);
    }
    setOpen(next);
  };

  const apply = (): void => {
    onFiltersChange(pruneFilterGroup(draft));
    setOpen(false);
  };

  const clear = (): void => {
    onFiltersChange(EMPTY_FILTER_GROUP);
    setOpen(false);
  };

  const submitNl = async (): Promise<void> => {
    if (!onNlFilter) return;
    const q = nlQuery.trim();
    if (!q || nlBusy) return;
    setNlBusy(true);
    setNlError(null);
    setNlNote(null);
    try {
      const res = await onNlFilter(q);
      if (res.ok) {
        setDraft(res.group);
        setNlNote(res.unresolved ?? null);
      } else {
        setNlError(res.error);
      }
    } catch {
      setNlError('Could not generate a filter.');
    } finally {
      setNlBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" iconLeft={ListFilter}>
          Filter
          {activeCount > 0 ? (
            <Badge tone="accent" className="vb-count">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="vb-pop vb-pop--filter">
        {onNlFilter ? (
          <div className="vb-nl">
            <div className="vb-nl__row">
              <Input
                className="vb-nl__input"
                inputSize="sm"
                value={nlQuery}
                placeholder="Describe a filter…"
                aria-label="Describe a filter"
                disabled={nlBusy}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submitNl();
                  }
                }}
              />
              <IconButton
                label="Generate filter"
                icon={Sparkles}
                size="sm"
                disabled={nlBusy || nlQuery.trim() === ''}
                aria-busy={nlBusy || undefined}
                onClick={() => void submitNl()}
              />
            </div>
            {nlBusy ? (
              <p className="vb-nl__note" role="status">
                Generating filter…
              </p>
            ) : null}
            {nlError ? (
              <p className="vb-nl__error" role="alert">
                {nlError}
              </p>
            ) : null}
            {!nlBusy && nlNote ? (
              <p className="vb-nl__note">Could not express: {nlNote}</p>
            ) : null}
          </div>
        ) : null}
        <FilterBuilder fields={fields} value={draft} onChange={setDraft} />
        <div className="vb-pop__foot">
          <Button
            size="sm"
            variant="ghost"
            disabled={activeCount === 0 && countConditions(draft) === 0}
            onClick={clear}
          >
            Clear
          </Button>
          <Button size="sm" variant="primary" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------- sort popover */

function SortControl({
  fields,
  sorts,
  onSortsChange,
}: Pick<ViewBarProps, 'fields' | 'sorts' | 'onSortsChange'>): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const sortable = React.useMemo(() => filterableFields(fields), [fields]);
  const used = new Set(sorts.map((s) => s.fieldKey));
  const firstUnused = sortable.find((f) => !used.has(f.key));

  const replace = (idx: number, next: ViewSort): void =>
    onSortsChange(sorts.map((s, i) => (i === idx ? next : s)));

  const remove = (idx: number): void =>
    onSortsChange(sorts.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= sorts.length) return;
    const next = [...sorts];
    const a = next[idx];
    const b = next[target];
    if (!a || !b) return;
    next[idx] = b;
    next[target] = a;
    onSortsChange(next);
  };

  const add = (): void => {
    if (!firstUnused) return;
    onSortsChange([...sorts, { fieldKey: firstUnused.key, dir: 'asc' }]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" iconLeft={ArrowUpDown}>
          Sort
          {sorts.length > 0 ? (
            <Badge tone="accent" className="vb-count">
              {sorts.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="vb-pop vb-pop--sort">
        <p className="vb-pop__title">Sort by</p>
        {sorts.length === 0 ? (
          <p className="vb-pop__empty">No sorts applied.</p>
        ) : (
          <div className="vb-sort">
            {sorts.map((sort, idx) => {
              // Each row may pick any sortable field not claimed by another row.
              const options: SelectOption[] = sortable
                .filter((f) => f.key === sort.fieldKey || !used.has(f.key))
                .map((f) => ({ value: f.key, label: f.label }));
              return (
                <div className="vb-sort__row" key={`${sort.fieldKey}-${idx}`}>
                  <span className="vb-sort__lead" aria-hidden="true">
                    {idx === 0 ? 'Sort by' : 'then by'}
                  </span>
                  <Select
                    className="vb-sort__field"
                    size="sm"
                    value={sort.fieldKey}
                    onChange={(v) => {
                      if (v) replace(idx, { ...sort, fieldKey: v });
                    }}
                    options={options}
                    searchable={options.length > 8}
                    aria-label={`Sort field ${idx + 1}`}
                  />
                  <SegmentedControl
                    size="sm"
                    items={SORT_DIR_ITEMS}
                    value={sort.dir}
                    onChange={(dir) => replace(idx, { ...sort, dir })}
                    aria-label={`Sort direction ${idx + 1}`}
                  />
                  <span className="vb-sort__order">
                    <IconButton
                      label="Move sort up"
                      icon={ChevronUp}
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    />
                    <IconButton
                      label="Move sort down"
                      icon={ChevronDown}
                      size="sm"
                      disabled={idx === sorts.length - 1}
                      onClick={() => move(idx, 1)}
                    />
                  </span>
                  <IconButton
                    label="Remove sort"
                    icon={X}
                    size="sm"
                    onClick={() => remove(idx)}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="vb-pop__foot vb-pop__foot--between">
          <Button
            size="sm"
            variant="ghost"
            iconLeft={Plus}
            disabled={!firstUnused}
            onClick={add}
          >
            Add sort
          </Button>
          {sorts.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => onSortsChange([])}>
              Clear all
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------ quick search */

function QuickSearch({
  object,
  searchQuery,
  onSearchQueryChange,
}: Pick<
  ViewBarProps,
  'object' | 'searchQuery' | 'onSearchQueryChange'
>): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(searchQuery !== '');
  const open = expanded || searchQuery !== '';

  if (!open) {
    return (
      <IconButton
        label={`Search ${object.labelPlural.toLowerCase()}`}
        icon={Search}
        size="sm"
        onClick={() => setExpanded(true)}
      />
    );
  }

  return (
    <Input
      className="vb-search"
      inputSize="sm"
      iconLeft={Search}
      autoFocus
      value={searchQuery}
      placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
      aria-label={`Search ${object.labelPlural.toLowerCase()}`}
      onChange={(e) => onSearchQueryChange(e.target.value)}
      onBlur={() => {
        if (searchQuery === '') setExpanded(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onSearchQueryChange('');
          setExpanded(false);
        }
      }}
    />
  );
}

/* ---------------------------------------------------------------- ViewBar */

export function ViewBar({
  object,
  fields,
  filters,
  onFiltersChange,
  onNlFilter,
  sorts,
  onSortsChange,
  groupBy,
  onGroupByChange,
  savedViews,
  activeViewId,
  onSelectView,
  onSaveView,
  onUpdateView,
  onDeleteView,
  view,
  onViewTypeChange,
  availableViews,
  searchQuery,
  onSearchQueryChange,
  density,
  onDensityChange,
  trailing,
  className,
}: ViewBarProps): React.JSX.Element {
  const viewTypeItems = React.useMemo<SegmentedItem<RecordViewType>[]>(
    () =>
      (availableViews ?? ALL_VIEW_TYPES).map((v) => ({
        value: v,
        // Icon-only segments: SegmentedControl falls back to the value for
        // `aria-label`, which reads naturally here ("table", "board", …).
        label: '',
        icon: VIEW_TYPE_META[v].icon,
      })),
    [availableViews],
  );

  const groupOptions = React.useMemo<SelectOption[]>(
    () =>
      fields
        .filter((f) => f.type === 'SELECT')
        .map((f) => ({ value: f.key, label: f.label })),
    [fields],
  );

  const compact = density === 'compact';
  const showSwitcher = Boolean(savedViews || onSelectView || onSaveView);

  return (
    <div
      className={cn('vb', className)}
      role="toolbar"
      aria-label={`${object.labelPlural} view controls`}
      aria-orientation="horizontal"
    >
      {showSwitcher ? (
        <>
          <ViewSwitcher
            object={object}
            savedViews={savedViews}
            activeViewId={activeViewId}
            onSelectView={onSelectView}
            onSaveView={onSaveView}
            onUpdateView={onUpdateView}
            onDeleteView={onDeleteView}
          />
          <span className="vb__divider" aria-hidden="true" />
        </>
      ) : null}

      <SegmentedControl
        size="sm"
        items={viewTypeItems}
        value={view}
        onChange={onViewTypeChange}
        aria-label="View type"
      />

      <span className="vb__spacer" />

      <FilterControl
        fields={fields}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onNlFilter={onNlFilter}
      />
      <SortControl fields={fields} sorts={sorts} onSortsChange={onSortsChange} />

      {groupOptions.length > 0 ? (
        <Select
          className="vb-group"
          size="sm"
          value={groupBy}
          onChange={onGroupByChange}
          options={groupOptions}
          placeholder="Group"
          clearable
          aria-label="Group by"
        />
      ) : null}

      <span className="vb__divider" aria-hidden="true" />

      <QuickSearch
        object={object}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
      />

      <IconButton
        label={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
        icon={compact ? Rows4 : Rows3}
        size="sm"
        aria-pressed={compact}
        onClick={() => onDensityChange(compact ? 'comfortable' : 'compact')}
      />

      {trailing != null ? (
        <>
          <span className="vb__divider" aria-hidden="true" />
          <div className="vb__trailing">{trailing}</div>
        </>
      ) : null}
    </div>
  );
}

export default ViewBar;
