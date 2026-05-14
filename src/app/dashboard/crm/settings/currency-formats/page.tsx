'use client';

/**
 * Currency Formats settings — §1D.4 bar:
 *  - KPI strip (Total · Front-symbol · Back-symbol)
 *  - Search across position / separators
 *  - Filter chips by symbol position
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog with `currency` entity picker
 */

import * as React from 'react';
import { Hash, AlignLeft, AlignRight } from 'lucide-react';

import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getCurrencyFormatSettings,
    saveCurrencyFormatSetting,
    deleteCurrencyFormatSetting,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsCurrencyFormatSetting } from '@/lib/worksuite/module-settings-types';

type Row = WsCurrencyFormatSetting & { _id: string };
type Filter = 'all' | 'front' | 'back' | 'front-space' | 'back-space';

export default function CurrencyFormatsPage() {
    const [filter, setFilter] = React.useState<Filter>('all');

    const getAll = React.useCallback(async () => {
        const list = (await getCurrencyFormatSettings()) as Row[];
        if (filter !== 'all') return list.filter((r) => r.position === filter);
        return list;
    }, [filter]);

    return (
        <SettingsEntityShell<Row>
            title="Currency Formats"
            subtitle="Per-currency display rules — symbol position, separators, and decimal precision."
            singular="Format"
            getAllAction={getAll}
            saveAction={saveCurrencyFormatSetting}
            deleteAction={deleteCurrencyFormatSetting}
            csvFilename="currency-formats"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <Hash className="h-4 w-4" />,
                    filterKey: 'all',
                    active: filter === 'all',
                },
                {
                    label: 'Front symbol',
                    value: all.filter((r) => r.position?.startsWith('front')).length,
                    icon: <AlignLeft className="h-4 w-4" />,
                    filterKey: 'front',
                    active: filter === 'front',
                },
                {
                    label: 'Back symbol',
                    value: all.filter((r) => r.position?.startsWith('back')).length,
                    icon: <AlignRight className="h-4 w-4" />,
                    filterKey: 'back',
                    active: filter === 'back',
                },
            ]}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'front', label: 'Front ($1)', active: filter === 'front' },
                { key: 'back', label: 'Back (1$)', active: filter === 'back' },
                {
                    key: 'front-space',
                    label: 'Front + space',
                    active: filter === 'front-space',
                },
                {
                    key: 'back-space',
                    label: 'Back + space',
                    active: filter === 'back-space',
                },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                { key: 'currency_id', label: 'Currency' },
                { key: 'position', label: 'Position', render: (r) => r.position ?? '—' },
                {
                    key: 'decimal_separator',
                    label: 'Decimal',
                    render: (r) => r.decimal_separator ?? '—',
                },
                {
                    key: 'thousand_separator',
                    label: 'Thousand',
                    render: (r) => r.thousand_separator ?? '—',
                },
                {
                    key: 'no_of_decimal',
                    label: 'Digits',
                    render: (r) =>
                        r.no_of_decimal ?? r.decimal_digits ?? '—',
                },
            ]}
            fields={[
                {
                    name: 'currency_id',
                    label: 'Currency',
                    type: 'entity',
                    entity: 'currency',
                    required: true,
                },
                {
                    name: 'position',
                    label: 'Symbol Position',
                    type: 'select',
                    defaultValue: 'front',
                    options: [
                        { value: 'front', label: 'Front ($1)' },
                        { value: 'back', label: 'Back (1$)' },
                        { value: 'front-space', label: 'Front with space ($ 1)' },
                        { value: 'back-space', label: 'Back with space (1 $)' },
                    ],
                },
                {
                    name: 'decimal_separator',
                    label: 'Decimal Separator',
                    defaultValue: '.',
                },
                {
                    name: 'thousand_separator',
                    label: 'Thousand Separator',
                    defaultValue: ',',
                },
                {
                    name: 'decimal_digits',
                    label: 'Decimal Digits',
                    type: 'number',
                    defaultValue: '2',
                },
                {
                    name: 'no_of_decimal',
                    label: 'No. of Decimal',
                    type: 'number',
                    defaultValue: '2',
                },
            ]}
        />
    );
}
