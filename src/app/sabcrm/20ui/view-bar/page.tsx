'use client';

/**
 * /sabcrm/20ui/view-bar — ViewBar + FilterBuilder QA showcase.
 *
 * Drives the full ViewBar API over a fake field set covering every major
 * field type, with two fake saved views and a live JSON preview of the
 * emitted state. QA:
 *
 *   1. Saved views — switch between "Hot pipeline" / "Renewals this year"
 *      (each applies its snapshot), rename, delete, "Save view as…".
 *   2. View types — table | board | calendar | map | timeline segments.
 *   3. Filter — open the popover, build a nested AND/OR tree (note the
 *      per-type operators + value editors), Apply prunes half-typed rows.
 *   4. Sort — multi-sort with add / remove / reorder + direction toggles.
 *   5. Group by — only the SELECT-type fields (Stage, Tier) are offered.
 *   6. Quick search — collapsed icon expands to an input; Escape clears.
 *   7. Density — toggles comfortable | compact.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';

import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import {
  ViewBar,
  type SavedView,
  type ViewSort,
  type ViewDensity,
  type RecordViewType,
} from '@/components/sabcrm/20ui/composites/record/view-bar';
import {
  EMPTY_FILTER_GROUP,
  countConditions,
  type FilterGroup,
} from '@/components/sabcrm/20ui/composites/record/filter-builder';
import { Button } from '@/components/sabcrm/20ui/button';

/* ----------------------------------------------------------- fake schema */

const DEMO_FIELDS: FieldMetadata[] = [
  { key: 'name', label: 'Name', type: 'TEXT', isLabel: true, inTable: true },
  { key: 'email', label: 'Email', type: 'EMAIL', inTable: true },
  { key: 'phone', label: 'Phone', type: 'PHONE' },
  { key: 'website', label: 'Website', type: 'LINK' },
  { key: 'employees', label: 'Employees', type: 'NUMBER', inTable: true },
  { key: 'arr', label: 'ARR', type: 'CURRENCY', inTable: true },
  { key: 'rating', label: 'Rating', type: 'RATING' },
  {
    key: 'stage',
    label: 'Stage',
    type: 'SELECT',
    inTable: true,
    options: [
      { value: 'lead', label: 'Lead' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'won', label: 'Won' },
      { value: 'lost', label: 'Lost' },
    ],
  },
  {
    key: 'tier',
    label: 'Tier',
    type: 'SELECT',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'enterprise', label: 'Enterprise' },
    ],
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'MULTI_SELECT',
    options: [
      { value: 'inbound', label: 'Inbound' },
      { value: 'outbound', label: 'Outbound' },
      { value: 'partner', label: 'Partner' },
    ],
  },
  { key: 'renewal', label: 'Renewal', type: 'DATE', inTable: true },
  { key: 'lastTouch', label: 'Last touch', type: 'DATE_TIME' },
  { key: 'active', label: 'Active', type: 'BOOLEAN', inTable: true },
  // Excluded from filter/sort by filterableFields (RELATION / FILE):
  {
    key: 'owner',
    label: 'Owner',
    type: 'RELATION',
    relation: { targetObject: 'people', kind: 'MANY_TO_ONE' },
  },
  { key: 'contract', label: 'Contract', type: 'FILE' },
];

const DEMO_OBJECT: ObjectMetadata = {
  slug: 'companies',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  icon: 'Building2',
  fields: DEMO_FIELDS,
  views: ['table', 'board'],
};

/* ------------------------------------------------------- fake saved views */

const VIEW_HOT_PIPELINE: SavedView = {
  id: 'view_hot_pipeline',
  name: 'Hot pipeline',
  isDefault: true,
  viewType: 'board',
  filters: {
    op: 'and',
    conditions: [
      { fieldKey: 'active', op: 'eq', value: 'true' },
      {
        op: 'or',
        conditions: [
          { fieldKey: 'stage', op: 'eq', value: 'qualified' },
          { fieldKey: 'stage', op: 'eq', value: 'proposal' },
        ],
      },
    ],
  },
  sorts: [
    { fieldKey: 'arr', dir: 'desc' },
    { fieldKey: 'rating', dir: 'desc' },
  ],
  groupBy: 'stage',
};

const VIEW_RENEWALS: SavedView = {
  id: 'view_renewals',
  name: 'Renewals this year',
  viewType: 'table',
  filters: {
    op: 'and',
    conditions: [
      { fieldKey: 'renewal', op: 'gte', value: '2026-01-01' },
      { fieldKey: 'renewal', op: 'lte', value: '2026-12-31' },
    ],
  },
  sorts: [{ fieldKey: 'renewal', dir: 'asc' }],
  groupBy: null,
};

/* ------------------------------------------------------------------ page */

export default function ViewBarShowcasePage(): React.JSX.Element {
  const [savedViews, setSavedViews] = React.useState<SavedView[]>([
    VIEW_HOT_PIPELINE,
    VIEW_RENEWALS,
  ]);
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState<FilterGroup>(EMPTY_FILTER_GROUP);
  const [sorts, setSorts] = React.useState<ViewSort[]>([]);
  const [groupBy, setGroupBy] = React.useState<string | null>(null);
  const [view, setView] = React.useState<RecordViewType>('table');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [density, setDensity] = React.useState<ViewDensity>('comfortable');

  /** Applying a saved view = adopting its persisted snapshot. */
  const handleSelectView = React.useCallback(
    (id: string) => {
      setActiveViewId(id);
      const v = savedViews.find((sv) => sv.id === id);
      if (!v) return;
      setFilters(v.filters ?? EMPTY_FILTER_GROUP);
      setSorts(v.sorts ?? []);
      setGroupBy(v.groupBy ?? null);
      if (v.viewType) setView(v.viewType);
    },
    [savedViews],
  );

  /** "Save view as…" snapshots the CURRENT bar state under `name`. */
  const handleSaveView = React.useCallback(
    (name: string) => {
      const id = `view_${Date.now()}`;
      setSavedViews((prev) => [
        ...prev,
        { id, name, viewType: view, filters, sorts, groupBy },
      ]);
      setActiveViewId(id);
    },
    [view, filters, sorts, groupBy],
  );

  const handleUpdateView = React.useCallback(
    (id: string, patch: Partial<Omit<SavedView, 'id'>>) => {
      setSavedViews((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      );
    },
    [],
  );

  const handleDeleteView = React.useCallback((id: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    setActiveViewId((prev) => (prev === id ? null : prev));
  }, []);

  const emitted = {
    activeViewId,
    view,
    filters,
    activeFilterCount: countConditions(filters),
    sorts,
    groupBy,
    searchQuery,
    density,
    savedViews: savedViews.map((v) => ({ id: v.id, name: v.name })),
  };

  return (
    <div
      className="20ui"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--st-space-4)',
        padding: 'var(--st-space-5)',
        fontFamily: 'var(--st-font)',
        color: 'var(--st-text)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          ViewBar showcase
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--st-font-size-sm)',
            color: 'var(--st-text-secondary)',
          }}
        >
          Saved views, view-type segments, the FilterBuilder popover (nested
          AND/OR, per-type operators), multi-sort, group-by (SELECT fields
          only), quick search and density — all controlled; the JSON below is
          exactly what the bar emits.
        </p>
      </header>

      <div
        style={{
          border: '1px solid var(--st-border)',
          borderRadius: 'var(--st-radius-lg)',
          background: 'var(--st-bg)',
          padding: '0 var(--st-space-3)',
        }}
      >
        <ViewBar
          object={DEMO_OBJECT}
          fields={DEMO_FIELDS}
          filters={filters}
          onFiltersChange={setFilters}
          sorts={sorts}
          onSortsChange={setSorts}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          savedViews={savedViews}
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          onSaveView={handleSaveView}
          onUpdateView={handleUpdateView}
          onDeleteView={handleDeleteView}
          view={view}
          onViewTypeChange={setView}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          density={density}
          onDensityChange={setDensity}
          trailing={
            <Button size="sm" variant="primary" iconLeft={Plus}>
              New company
            </Button>
          }
        />
      </div>

      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--st-space-2)' }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--st-font-size-sm)',
            fontWeight: 600,
            color: 'var(--st-text-secondary)',
          }}
        >
          Emitted state
        </h2>
        <pre
          style={{
            margin: 0,
            padding: 'var(--st-space-3)',
            border: '1px solid var(--st-border)',
            borderRadius: 'var(--st-radius-lg)',
            background: 'var(--st-bg-secondary)',
            fontSize: 12,
            lineHeight: 1.6,
            overflow: 'auto',
            maxHeight: 480,
          }}
        >
          {JSON.stringify(emitted, null, 2)}
        </pre>
      </section>
    </div>
  );
}
