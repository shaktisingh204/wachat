'use client';

import { ZoruBadge } from '@/components/zoruui';
import { Percent, Star, BarChart3, TrendingUp } from 'lucide-react';

/**
 * Taxes settings — §1D.4 bar:
 *  - KPI strip (Total · Default · Avg rate · Highest)
 *  - Search across name
 *  - Filter chips: All / Default
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 */

import * as React from 'react';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import { getTaxes, saveTax, deleteTax } from '@/app/actions/worksuite/meta.actions';
import type { WsTax } from '@/lib/worksuite/meta-types';

type Row = WsTax & { _id: string };
type Filter = 'all' | 'default';

export default function TaxesPage() {
    const [filter, setFilter] = React.useState<Filter>('all');

    const getAll = React.useCallback(async () => {
        const list = (await getTaxes()) as Row[];
        if (filter === 'default') return list.filter((t) => t.is_default);
        return list;
    }, [filter]);

    return (
        <SettingsEntityShell<Row>
            title="Taxes"
            subtitle="Tax codes and rates applied across invoices, estimates, and orders."
            singular="Tax"
            getAllAction={getAll}
            saveAction={saveTax}
            deleteAction={deleteTax}
            csvFilename="taxes"
            kpis={(_rows, all) => {
                const rates = all
                    .map((t) => Number(t.rate_percent))
                    .filter((n) => !Number.isNaN(n));
                const avg = rates.length
                    ? (rates.reduce((s, n) => s + n, 0) / rates.length).toFixed(1)
                    : '0';
                const max = rates.length ? Math.max(...rates) : 0;
                return [
                    {
                        label: 'Total',
                        value: all.length,
                        icon: <Percent className="h-4 w-4" />,
                        filterKey: 'all',
                        active: filter === 'all',
                    },
                    {
                        label: 'Default',
                        value: all.filter((t) => t.is_default).length,
                        icon: <Star className="h-4 w-4" />,
                        filterKey: 'default',
                        active: filter === 'default',
                    },
                    {
                        label: 'Avg rate',
                        value: `${avg}%`,
                        icon: <BarChart3 className="h-4 w-4" />,
                    },
                    {
                        label: 'Highest',
                        value: `${max}%`,
                        icon: <TrendingUp className="h-4 w-4" />,
                    },
                ];
            }}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'default', label: 'Default only', active: filter === 'default' },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                {
                    key: 'tax_name',
                    label: 'Name',
                    render: (row) => (
                        <RowDrawer
                            label={row.tax_name}
                            subtitle={`${Number(row.rate_percent ?? 0)}%${row.is_default ? ' · default' : ''}`}
                            title={`Tax · ${row.tax_name}`}
                            description="Read-only tax details. Use the row Edit action to modify."
                        >
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">Rate</div>
                                    <div className="font-mono">{Number(row.rate_percent ?? 0)}%</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Default</div>
                                    <div>{row.is_default ? 'Yes' : 'No'}</div>
                                </div>
                            </div>
                        </RowDrawer>
                    ),
                },
                {
                    key: 'rate_percent',
                    label: 'Rate',
                    render: (row) => `${Number(row.rate_percent ?? 0)}%`,
                },
                {
                    key: 'is_default',
                    label: 'Default',
                    render: (row) => (
                        <ZoruBadge variant={row.is_default ? 'success' : 'ghost'}>
                            {row.is_default ? 'Yes' : 'No'}
                        </ZoruBadge>
                    ),
                },
            ]}
            fields={[
                { name: 'tax_name', label: 'Tax name', required: true },
                {
                    name: 'rate_percent',
                    label: 'Rate (%)',
                    type: 'number',
                    required: true,
                    placeholder: '18',
                },
                {
                    name: 'is_default',
                    label: 'Default',
                    type: 'select',
                    options: [
                        { value: 'false', label: 'No' },
                        { value: 'true', label: 'Yes' },
                    ],
                    defaultValue: 'false',
                },
            ]}
        />
    );
}
