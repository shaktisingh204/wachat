'use client';

import { Badge, Button, useZoruToast } from '@/components/zoruui';
import {
  useTransition } from 'react';
import { Languages,
  Star,
  ToggleRight } from 'lucide-react';

/**
 * Languages settings — §1D.4 bar:
 *  - KPI strip (Total · Enabled · Default)
 *  - Search across code/name
 *  - Filter chips: All / Enabled / Disabled
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - Inline "Set default" per row
 */

import * as React from 'react';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getLanguages,
    saveLanguage,
    deleteLanguage,
    setDefaultLanguage,
} from '@/app/actions/worksuite/company.actions';
import type { WsLanguageSetting } from '@/lib/worksuite/company-types';

type Row = WsLanguageSetting & { _id: string };
type Filter = 'all' | 'enabled' | 'disabled';

function SetDefaultButton({
    id,
    isDefault,
    onAfter,
}: {
    id: string;
    isDefault: boolean;
    onAfter: () => void;
}) {
    const [pending, start] = useTransition();
    const { toast } = useZoruToast();
    if (isDefault) {
        return <ZoruBadge variant="success">Default</ZoruBadge>;
    }
    return (
        <ZoruButton
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
                start(async () => {
                    const r = await setDefaultLanguage(id);
                    if (r.success) {
                        toast({ title: 'Default language updated.' });
                        onAfter();
                    } else {
                        toast({
                            title: 'Error',
                            description: r.error,
                            variant: 'destructive',
                        });
                    }
                })
            }
            className="text-[12px] text-zoru-ink-muted"
        >
            <Star className="h-3.5 w-3.5" /> Set default
        </ZoruButton>
    );
}

export default function LanguagesPage() {
    const [filter, setFilter] = React.useState<Filter>('all');
    const [refreshKey, setRefreshKey] = React.useState(0);

    const getAll = React.useCallback(async () => {
        const list = (await getLanguages()) as Row[];
        if (filter === 'enabled') return list.filter((l) => l.is_enabled);
        if (filter === 'disabled') return list.filter((l) => !l.is_enabled);
        return list;
    }, [filter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <SettingsEntityShell<Row>
            title="Languages"
            subtitle="Enable languages available for users across the workspace."
            singular="Language"
            getAllAction={getAll}
            saveAction={saveLanguage}
            deleteAction={deleteLanguage}
            csvFilename="languages"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <Languages className="h-4 w-4" />,
                    filterKey: 'all',
                    active: filter === 'all',
                },
                {
                    label: 'Enabled',
                    value: all.filter((l) => l.is_enabled).length,
                    icon: <ToggleRight className="h-4 w-4" />,
                    filterKey: 'enabled',
                    active: filter === 'enabled',
                },
                {
                    label: 'Default',
                    value: all.filter((l) => l.is_default).length,
                    icon: <Star className="h-4 w-4" />,
                },
            ]}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'enabled', label: 'Enabled', active: filter === 'enabled' },
                { key: 'disabled', label: 'Disabled', active: filter === 'disabled' },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                { key: 'language_code', label: 'Code' },
                {
                    key: 'language_name',
                    label: 'Name',
                    render: (row) => (
                        <RowDrawer
                            label={row.language_name}
                            subtitle={row.language_code}
                            title={`Language · ${row.language_name}`}
                            description="Use the row Edit action to change this language."
                        >
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">Code</div>
                                    <div className="font-mono">{row.language_code}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Enabled</div>
                                    <div>{row.is_enabled ? 'Yes' : 'No'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Default</div>
                                    <div>{row.is_default ? 'Yes' : 'No'}</div>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Edit and delete are available from the row actions.
                                </p>
                            </div>
                        </RowDrawer>
                    ),
                },
                {
                    key: 'is_enabled',
                    label: 'Enabled',
                    render: (row) => (
                        <ZoruBadge variant={row.is_enabled ? 'success' : 'ghost'}>
                            {row.is_enabled ? 'Yes' : 'No'}
                        </ZoruBadge>
                    ),
                },
                {
                    key: 'is_default',
                    label: 'Default',
                    exportable: false,
                    render: (row) => (
                        <SetDefaultButton
                            id={String(row._id)}
                            isDefault={Boolean(row.is_default)}
                            onAfter={() => setRefreshKey((k) => k + 1)}
                        />
                    ),
                },
            ]}
            fields={[
                {
                    name: 'language_code',
                    label: 'Language Code (ISO)',
                    required: true,
                    placeholder: 'en',
                },
                {
                    name: 'language_name',
                    label: 'Language Name',
                    required: true,
                    placeholder: 'English',
                },
                {
                    name: 'is_enabled',
                    label: 'Enabled',
                    type: 'select',
                    options: [
                        { value: 'yes', label: 'Yes' },
                        { value: 'no', label: 'No' },
                    ],
                    defaultValue: 'yes',
                },
                {
                    name: 'is_default',
                    label: 'Set as Default',
                    type: 'select',
                    options: [
                        { value: 'no', label: 'No' },
                        { value: 'yes', label: 'Yes' },
                    ],
                    defaultValue: 'no',
                },
            ]}
        />
    );
}
