'use client';

/**
 * Currencies settings — §1D.4 (settings list) bar:
 *  - KPI strip (Total · Default · Crypto · Fiat)
 *  - Search across code/name/symbol
 *  - Filter chips by default / crypto / fiat
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - Inline "Set default" per row
 */

import * as React from 'react';
import { useTransition } from 'react';
import { CircleDollarSign, Bitcoin, Star } from 'lucide-react';

import { ZoruBadge, ZoruButton, useZoruToast } from '@/components/zoruui';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getCurrencies,
    saveCurrency,
    deleteCurrency,
    setDefaultCurrency,
} from '@/app/actions/worksuite/company.actions';
import type { WsCurrency } from '@/lib/worksuite/company-types';

type Row = WsCurrency & { _id: string };
type Filter = 'all' | 'default' | 'crypto' | 'fiat';

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
                    const r = await setDefaultCurrency(id);
                    if (r.success) {
                        toast({ title: 'Default currency updated.' });
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

export default function CurrenciesPage() {
    const [filter, setFilter] = React.useState<Filter>('all');
    const [refreshKey, setRefreshKey] = React.useState(0);

    const getAll = React.useCallback(async () => {
        const list = (await getCurrencies()) as Row[];
        if (filter === 'default') return list.filter((c) => c.default);
        if (filter === 'crypto') return list.filter((c) => c.is_cryptocurrency);
        if (filter === 'fiat') return list.filter((c) => !c.is_cryptocurrency);
        return list;
    }, [filter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <SettingsEntityShell<Row>
            title="Currencies"
            subtitle="Available currencies, symbols, exchange rates, and formatting preferences."
            singular="Currency"
            getAllAction={getAll}
            saveAction={saveCurrency}
            deleteAction={deleteCurrency}
            csvFilename="currencies"
            kpis={(rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <CircleDollarSign className="h-4 w-4" />,
                    filterKey: 'all',
                    active: filter === 'all',
                },
                {
                    label: 'Default',
                    value: all.filter((c) => c.default).length,
                    icon: <Star className="h-4 w-4" />,
                    filterKey: 'default',
                    active: filter === 'default',
                },
                {
                    label: 'Crypto',
                    value: all.filter((c) => c.is_cryptocurrency).length,
                    icon: <Bitcoin className="h-4 w-4" />,
                    filterKey: 'crypto',
                    active: filter === 'crypto',
                },
            ]}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'default', label: 'Default only', active: filter === 'default' },
                { key: 'crypto', label: 'Crypto', active: filter === 'crypto' },
                { key: 'fiat', label: 'Fiat', active: filter === 'fiat' },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'symbol', label: 'Symbol' },
                {
                    key: 'exchange_rate',
                    label: 'Rate',
                    render: (row) =>
                        row.exchange_rate != null ? String(row.exchange_rate) : '—',
                },
                {
                    key: 'is_cryptocurrency',
                    label: 'Crypto',
                    render: (row) => (
                        <ZoruBadge variant={row.is_cryptocurrency ? 'warning' : 'ghost'}>
                            {row.is_cryptocurrency ? 'Yes' : 'No'}
                        </ZoruBadge>
                    ),
                },
                {
                    key: 'default',
                    label: 'Default',
                    exportable: false,
                    render: (row) => (
                        <SetDefaultButton
                            id={String(row._id)}
                            isDefault={Boolean(row.default)}
                            onAfter={() => setRefreshKey((k) => k + 1)}
                        />
                    ),
                },
            ]}
            fields={[
                {
                    name: 'code',
                    label: 'Code (ISO 4217)',
                    required: true,
                    placeholder: 'USD',
                },
                { name: 'name', label: 'Name', required: true, placeholder: 'US Dollar' },
                { name: 'symbol', label: 'Symbol', placeholder: '$' },
                { name: 'exchange_rate', label: 'Exchange Rate', type: 'number' },
                { name: 'usd_price', label: 'USD Price', type: 'number' },
                {
                    name: 'is_cryptocurrency',
                    label: 'Cryptocurrency',
                    type: 'select',
                    options: [
                        { value: 'no', label: 'No' },
                        { value: 'yes', label: 'Yes' },
                    ],
                    defaultValue: 'no',
                },
                { name: 'decimal_separator', label: 'Decimal Separator', placeholder: '.' },
                {
                    name: 'thousand_separator',
                    label: 'Thousand Separator',
                    placeholder: ',',
                },
                {
                    name: 'decimal_digits',
                    label: 'Decimal Digits',
                    type: 'number',
                    defaultValue: '2',
                },
                {
                    name: 'currency_position',
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
                    name: 'default',
                    label: 'Default Currency',
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
