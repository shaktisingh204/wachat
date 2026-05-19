'use client';

import { ZoruBadge } from '@/components/zoruui';
import { Flag, Star, CheckCircle2 } from 'lucide-react';

/**
 * Project Statuses settings — §1D.4 bar:
 *  - KPI strip (Total · Default · Final/terminal)
 *  - Search across name/slug
 *  - Filter chips: All / Active (non-final) / Final
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog with color input
 */

import * as React from 'react';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getProjectStatusSettings,
    saveProjectStatusSetting,
    deleteProjectStatusSetting,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsProjectStatusSetting } from '@/lib/worksuite/module-settings-types';

type Row = WsProjectStatusSetting & { _id: string };
type Filter = 'all' | 'active' | 'final';

export default function ProjectStatusesPage() {
    const [filter, setFilter] = React.useState<Filter>('all');

    const getAll = React.useCallback(async () => {
        const list = (await getProjectStatusSettings()) as Row[];
        if (filter === 'final') return list.filter((r) => r.is_final);
        if (filter === 'active') return list.filter((r) => !r.is_final);
        return list;
    }, [filter]);

    return (
        <SettingsEntityShell<Row>
            title="Project Statuses"
            subtitle="Available status options that classify projects across boards and reports."
            singular="Status"
            getAllAction={getAll}
            saveAction={saveProjectStatusSetting}
            deleteAction={deleteProjectStatusSetting}
            csvFilename="project-statuses"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <Flag className="h-4 w-4" />,
                    filterKey: 'all',
                    active: filter === 'all',
                },
                {
                    label: 'Active',
                    value: all.filter((s) => !s.is_final).length,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    filterKey: 'active',
                    active: filter === 'active',
                },
                {
                    label: 'Default',
                    value: all.filter((s) => s.is_default).length,
                    icon: <Star className="h-4 w-4" />,
                },
            ]}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'active', label: 'Active', active: filter === 'active' },
                { key: 'final', label: 'Terminal', active: filter === 'final' },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                {
                    key: 'status_name',
                    label: 'Name',
                    render: (row) => (
                        <RowDrawer
                            label={
                                <span className="inline-flex items-center gap-2">
                                    {row.color ? (
                                        <span
                                            className="inline-block h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: row.color }}
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {row.status_name}
                                </span>
                            }
                            subtitle={row.slug || undefined}
                            title={`Project Status · ${row.status_name}`}
                            description="Read-only status details. Use the row Edit action to modify."
                        >
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">Slug</div>
                                    <div className="font-mono">{row.slug || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Color</div>
                                    <div className="font-mono">{row.color || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Order</div>
                                    <div>{row.priority != null ? String(row.priority) : '—'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Terminal</div>
                                    <div>{row.is_final ? 'Yes' : 'No'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Default</div>
                                    <div>{row.is_default ? 'Yes' : 'No'}</div>
                                </div>
                            </div>
                        </RowDrawer>
                    ),
                },
                { key: 'slug', label: 'Slug' },
                {
                    key: 'color',
                    label: 'Color',
                    render: (row) =>
                        row.color ? (
                            <span className="inline-flex items-center gap-2">
                                <span
                                    className="inline-block h-4 w-4 rounded-full border border-zoru-line"
                                    style={{ backgroundColor: row.color }}
                                />
                                <span className="text-[12px] text-zoru-ink-muted">
                                    {row.color}
                                </span>
                            </span>
                        ) : (
                            '—'
                        ),
                },
                {
                    key: 'priority',
                    label: 'Order',
                    render: (row) => (row.priority != null ? String(row.priority) : '—'),
                },
                {
                    key: 'is_final',
                    label: 'Final',
                    render: (row) => (
                        <ZoruBadge variant={row.is_final ? 'warning' : 'ghost'}>
                            {row.is_final ? 'Yes' : 'No'}
                        </ZoruBadge>
                    ),
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
                {
                    name: 'status_name',
                    label: 'Status Name',
                    required: true,
                    placeholder: 'In Progress',
                },
                { name: 'slug', label: 'Slug', placeholder: 'in-progress' },
                {
                    name: 'color',
                    label: 'Color',
                    type: 'color',
                    defaultValue: '#F59E0B',
                },
                {
                    name: 'priority',
                    label: 'Sort Priority',
                    type: 'number',
                    defaultValue: '10',
                },
                {
                    name: 'is_final',
                    label: 'Terminal State',
                    type: 'select',
                    defaultValue: 'no',
                    options: [
                        { value: 'no', label: 'No' },
                        { value: 'yes', label: 'Yes' },
                    ],
                },
                {
                    name: 'is_default',
                    label: 'Default Status',
                    type: 'select',
                    defaultValue: 'no',
                    options: [
                        { value: 'no', label: 'No' },
                        { value: 'yes', label: 'Yes' },
                    ],
                },
            ]}
        />
    );
}
