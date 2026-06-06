'use client';

import { Badge, Button, useToast } from '@/components/sabcrm/20ui';
import {
  useTransition } from 'react';
import { MapPin,
  Star,
  Building,
  Globe } from 'lucide-react';

/**
 * Company Addresses settings — §1D.4 bar:
 *  - KPI strip (Total · Office · Default · Distinct countries)
 *  - Search across address/city/postal
 *  - Filter chips by address type
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog with country/state/city cascade picker
 *  - Inline "Set default" per row
 */

import * as React from 'react';

import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getCompanyAddresses,
    saveCompanyAddress,
    deleteCompanyAddress,
    setDefaultCompanyAddress,
} from '@/app/actions/worksuite/company.actions';
import type { WsCompanyAddress } from '@/lib/worksuite/company-types';

type Row = WsCompanyAddress & { _id: string };
type Filter = 'all' | 'office' | 'branch' | 'warehouse' | 'billing' | 'shipping';

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
    const { toast } = useToast();
    if (isDefault) {
        return <Badge variant="success">Default</Badge>;
    }
    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
                start(async () => {
                    const r = await setDefaultCompanyAddress(id);
                    if (r.success) {
                        toast({ title: 'Default address updated.' });
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
            className="text-[12px] text-[var(--st-text-secondary)]"
        >
            <Star className="h-3.5 w-3.5" /> Set default
        </Button>
    );
}

export default function CompanyAddressesPage() {
    const [filter, setFilter] = React.useState<Filter>('all');
    const [refreshKey, setRefreshKey] = React.useState(0);

    const getAll = React.useCallback(async () => {
        const list = (await getCompanyAddresses()) as Row[];
        if (filter !== 'all') return list.filter((a) => (a.type || 'office') === filter);
        return list;
    }, [filter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <SettingsEntityShell<Row>
            title="Company Addresses"
            subtitle="Offices, branches, warehouses, and billing/shipping endpoints."
            singular="Address"
            getAllAction={getAll}
            saveAction={saveCompanyAddress}
            deleteAction={deleteCompanyAddress}
            csvFilename="company-addresses"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <MapPin className="h-4 w-4" />,
                    filterKey: 'all',
                    active: filter === 'all',
                },
                {
                    label: 'Offices',
                    value: all.filter((a) => (a.type || 'office') === 'office').length,
                    icon: <Building className="h-4 w-4" />,
                    filterKey: 'office',
                    active: filter === 'office',
                },
                {
                    label: 'Default',
                    value: all.filter((a) => a.is_default).length,
                    icon: <Star className="h-4 w-4" />,
                },
                {
                    label: 'Countries',
                    value: new Set(all.map((a) => String(a.country_id || '')).filter(Boolean))
                        .size,
                    icon: <Globe className="h-4 w-4" />,
                },
            ]}
            onKpiClick={(k) => setFilter(k as Filter)}
            filterChips={[
                { key: 'all', label: 'All', active: filter === 'all' },
                { key: 'office', label: 'Office', active: filter === 'office' },
                { key: 'branch', label: 'Branch', active: filter === 'branch' },
                { key: 'warehouse', label: 'Warehouse', active: filter === 'warehouse' },
                { key: 'billing', label: 'Billing', active: filter === 'billing' },
                { key: 'shipping', label: 'Shipping', active: filter === 'shipping' },
            ]}
            onFilterChange={(k) => setFilter(k as Filter)}
            columns={[
                {
                    key: 'type',
                    label: 'Type',
                    render: (row) => (
                        <Badge variant="default">{row.type || 'office'}</Badge>
                    ),
                },
                { key: 'address', label: 'Address' },
                { key: 'city', label: 'City' },
                { key: 'country_id', label: 'Country' },
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
                    name: 'type',
                    label: 'Type',
                    type: 'select',
                    required: true,
                    defaultValue: 'office',
                    options: [
                        { value: 'office', label: 'Office' },
                        { value: 'branch', label: 'Branch' },
                        { value: 'warehouse', label: 'Warehouse' },
                        { value: 'billing', label: 'Billing' },
                        { value: 'shipping', label: 'Shipping' },
                    ],
                },
                {
                    name: 'address',
                    label: 'Address',
                    type: 'textarea',
                    required: true,
                    fullWidth: true,
                },
                {
                    name: 'country_id',
                    label: 'Country',
                    type: 'entity',
                    entity: 'country',
                },
                {
                    name: 'state',
                    label: 'State',
                    type: 'entity',
                    entity: 'state',
                    cascadeFilterFrom: (siblings) =>
                        siblings.country_id ? { country: siblings.country_id } : undefined,
                },
                {
                    name: 'city',
                    label: 'City',
                    type: 'entity',
                    entity: 'city',
                    cascadeFilterFrom: (siblings) =>
                        siblings.state
                            ? { state: siblings.state }
                            : siblings.country_id
                              ? { country: siblings.country_id }
                              : undefined,
                },
                { name: 'postal_code', label: 'Postal Code' },
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
