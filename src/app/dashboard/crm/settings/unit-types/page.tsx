'use client';

/**
 * Unit Types settings — §1D.4 bar:
 *  - KPI strip (Total · With short name · Distinct codes) — all clickable as filters
 *  - Search across name / short
 *  - Filter chips: All / With short name / Without short name
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on name
 */

import * as React from 'react';
import { Hash, Ruler, Type } from 'lucide-react';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
  getUnitTypes,
  saveUnitType,
  deleteUnitType,
} from '@/app/actions/worksuite/meta.actions';
import type { WsUnitType } from '@/lib/worksuite/meta-types';

type Row = WsUnitType & { _id: string };
type ShortFilter = 'all' | 'with-short' | 'without-short';

export default function UnitTypesPage() {
  const [shortFilter, setShortFilter] = React.useState<ShortFilter>('all');

  const getAll = React.useCallback(async () => {
    const list = (await getUnitTypes()) as Row[];
    if (shortFilter === 'with-short')
      return list.filter((u) => (u.short_name || '').trim().length > 0);
    if (shortFilter === 'without-short')
      return list.filter((u) => !(u.short_name || '').trim().length);
    return list;
  }, [shortFilter]);

  return (
    <SettingsEntityShell<Row>
      title="Unit Types"
      subtitle="Measurement units used when issuing invoices, orders, and stock entries."
      singular="Unit"
      getAllAction={getAll}
      saveAction={saveUnitType}
      deleteAction={deleteUnitType}
      csvFilename="unit-types"
      kpis={(_rows, all) => [
        {
          label: 'Total',
          value: all.length,
          icon: <Ruler className="h-4 w-4" />,
          filterKey: 'all',
          active: shortFilter === 'all',
        },
        {
          label: 'With short name',
          value: all.filter((u) => (u.short_name || '').trim().length).length,
          icon: <Type className="h-4 w-4" />,
          filterKey: 'with-short',
          active: shortFilter === 'with-short',
        },
        {
          label: 'Distinct codes',
          value: new Set(
            all
              .map((u) => (u.short_name || '').toLowerCase().trim())
              .filter(Boolean),
          ).size,
          icon: <Hash className="h-4 w-4" />,
        },
      ]}
      onKpiClick={(k) => setShortFilter(k as ShortFilter)}
      filterChips={[
        { key: 'all', label: 'All', active: shortFilter === 'all' },
        { key: 'with-short', label: 'With short name', active: shortFilter === 'with-short' },
        {
          key: 'without-short',
          label: 'Without short name',
          active: shortFilter === 'without-short',
        },
      ]}
      onFilterChange={(k) => setShortFilter(k as ShortFilter)}
      columns={[
        {
          key: 'unit_name',
          label: 'Name',
          render: (row) => (
            <RowDrawer
              label={row.unit_name}
              subtitle={row.short_name || undefined}
              title={`Unit · ${row.unit_name}`}
              description="Use the row Edit action to change this unit."
            >
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Unit name</div>
                  <div>{row.unit_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Short name</div>
                  <div className="font-mono">{row.short_name || '—'}</div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Edit and delete are available from the row actions.
                </p>
              </div>
            </RowDrawer>
          ),
        },
        { key: 'short_name', label: 'Short' },
      ]}
      fields={[
        {
          name: 'unit_name',
          label: 'Unit name',
          required: true,
          placeholder: 'Kilogram',
        },
        { name: 'short_name', label: 'Short name', placeholder: 'Kg' },
      ]}
    />
  );
}
