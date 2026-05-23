'use client';

/**
 * Vendor Types settings — client island.
 *
 * Wraps `<SettingsEntityShell>` with the field schema, column schema,
 * KPI strip and CSV export filename for vendor-type rows.
 */

import * as React from 'react';
import { CheckCircle2, Archive, Tags, ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/zoruui';
import { CategoryOrderDialog } from './category-order-dialog';

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
    const [rows, setRows] = React.useState<any[]>([]);
    const [orderOpen, setOrderOpen] = React.useState(false);

    const refresh = React.useCallback(() => {
        getCrmVendorTypeRows().then(r => setRows(r));
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    // Format rows to show hierarchy
    const formattedRows = React.useMemo(() => {
        const map = new Map(rows.map(r => [r._id, r]));
        return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(r => {
            const parent = r.parentId ? map.get(r.parentId) : null;
            return {
                ...r,
                displayName: parent ? `— ${r.name}` : r.name,
                parentName: parent?.name,
            };
        });
    }, [rows]);

    const parentOptions = React.useMemo(() => {
        return rows.map(r => ({ value: r._id, label: r.name }));
    }, [rows]);

    return (
        <>
        <SettingsEntityShell<any>
            title="Vendor Types"
            subtitle="Classification master for CRM vendors."
            singular="Vendor type"
            csvFilename="vendor-types"
            getAllAction={async () => {
                const r = await getCrmVendorTypeRows();
                setRows(r);
                return r;
            }}
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
            extraHeaderActions={
                <Button variant="outline" onClick={() => setOrderOpen(true)}>
                    <ArrowDownUp className="mr-2 h-4 w-4" />
                    Reorder Categories
                </Button>
            }
            columns={[
                { key: 'displayName', label: 'Name' },
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
                {
                    name: 'parentId',
                    label: 'Parent Category',
                    type: 'select',
                    options: parentOptions,
                },
            ]}
        />
        <CategoryOrderDialog items={formattedRows} open={orderOpen} onOpenChange={setOrderOpen} onSaved={refresh} />
        </>
    );
}
