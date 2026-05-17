'use client';

/**
 * Vendor Types settings — client island.
 *
 * Wraps `<SettingsEntityShell>` with the field schema, column schema,
 * KPI strip and CSV export filename for vendor-type rows.
 */

import * as React from 'react';
import { CheckCircle2, Archive, Tags } from 'lucide-react';

import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteCrmVendorTypeRow,
    getCrmVendorTypeRows,
    saveCrmVendorTypeRow,
    type CrmVendorTypeRow,
} from '@/app/actions/crm-vendor-types.actions';

const STATUS_TONE: Record<string, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

export function VendorTypesPageClient() {
    return (
        <SettingsEntityShell<CrmVendorTypeRow>
            title="Vendor Types"
            subtitle="Classification master for CRM vendors."
            singular="Vendor type"
            csvFilename="vendor-types"
            getAllAction={getCrmVendorTypeRows}
            saveAction={saveCrmVendorTypeRow}
            deleteAction={deleteCrmVendorTypeRow}
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <Tags className="h-4 w-4" />,
                },
                {
                    label: 'Active',
                    value: all.filter((t) => t.isActive).length,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                },
                {
                    label: 'Archived',
                    value: all.filter((t) => !t.isActive).length,
                    icon: <Archive className="h-4 w-4" />,
                },
            ]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                {
                    key: 'status',
                    label: 'Status',
                    render: (row) => (
                        <StatusPill
                            label={row.status === 'active' ? 'Active' : 'Archived'}
                            tone={STATUS_TONE[row.status] ?? 'neutral'}
                        />
                    ),
                },
                { key: 'description', label: 'Description' },
            ]}
            fields={[
                {
                    name: 'name',
                    label: 'Type name',
                    required: true,
                    placeholder: 'Goods Supplier',
                },
                {
                    name: 'code',
                    label: 'Short code',
                    placeholder: 'GS',
                    help: 'Optional uppercase code used in reports / exports.',
                },
                {
                    name: 'description',
                    label: 'Description',
                    type: 'textarea',
                    fullWidth: true,
                    placeholder: 'When to use this vendor type.',
                },
                {
                    name: 'status',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: 'active', label: 'Active' },
                        { value: 'archived', label: 'Archived' },
                    ],
                    defaultValue: 'active',
                },
            ]}
        />
    );
}
