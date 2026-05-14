'use client';

/**
 * Unit Types settings — §1D.4 bar:
 *  - KPI strip (Total · With short name · Distinct codes)
 *  - Search across name / short
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 */

import * as React from 'react';
import { Ruler, Hash, Type } from 'lucide-react';

import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getUnitTypes,
    saveUnitType,
    deleteUnitType,
} from '@/app/actions/worksuite/meta.actions';
import type { WsUnitType } from '@/lib/worksuite/meta-types';

type Row = WsUnitType & { _id: string };

export default function UnitTypesPage() {
    return (
        <SettingsEntityShell<Row>
            title="Unit Types"
            subtitle="Measurement units used when issuing invoices, orders, and stock entries."
            singular="Unit"
            getAllAction={getUnitTypes as () => Promise<Row[]>}
            saveAction={saveUnitType}
            deleteAction={deleteUnitType}
            csvFilename="unit-types"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <Ruler className="h-4 w-4" />,
                },
                {
                    label: 'With short name',
                    value: all.filter((u) => (u.short_name || '').trim().length).length,
                    icon: <Type className="h-4 w-4" />,
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
            columns={[
                { key: 'unit_name', label: 'Name' },
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
