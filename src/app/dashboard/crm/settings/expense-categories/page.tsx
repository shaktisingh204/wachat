'use client';

/**
 * Expense Categories settings — §1D.4 bar:
 *  - KPI strip (Total · With description · Empty)
 *  - Search across name / description
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 */

import * as React from 'react';
import { Tags, FileText, FilePlus } from 'lucide-react';

import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getExpenseCategoriesExt,
    saveExpenseCategoryExt,
    deleteExpenseCategoryExt,
} from '@/app/actions/worksuite/meta.actions';
import type { WsExpenseCategoryExt } from '@/lib/worksuite/meta-types';

type Row = WsExpenseCategoryExt & { _id: string };

export default function ExpenseCategoriesPage() {
    return (
        <SettingsEntityShell<Row>
            title="Expense Categories"
            subtitle="Named buckets used to classify expense records."
            singular="Category"
            getAllAction={getExpenseCategoriesExt as () => Promise<Row[]>}
            saveAction={saveExpenseCategoryExt}
            deleteAction={deleteExpenseCategoryExt}
            csvFilename="expense-categories"
            kpis={(_rows, all) => {
                const described = all.filter(
                    (c) => (c.description || '').trim().length > 0,
                ).length;
                return [
                    {
                        label: 'Total',
                        value: all.length,
                        icon: <Tags className="h-4 w-4" />,
                    },
                    {
                        label: 'With description',
                        value: described,
                        icon: <FileText className="h-4 w-4" />,
                    },
                    {
                        label: 'Empty description',
                        value: all.length - described,
                        icon: <FilePlus className="h-4 w-4" />,
                    },
                ];
            }}
            columns={[
                { key: 'category_name', label: 'Name' },
                { key: 'description', label: 'Description' },
            ]}
            fields={[
                { name: 'category_name', label: 'Category', required: true },
                {
                    name: 'description',
                    label: 'Description',
                    type: 'textarea',
                    fullWidth: true,
                },
            ]}
        />
    );
}
