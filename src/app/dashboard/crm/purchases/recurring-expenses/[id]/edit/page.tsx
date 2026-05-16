/**
 * Edit recurring expense — `/dashboard/crm/purchases/recurring-expenses/[id]/edit`.
 *
 * Server wrapper that hydrates the existing schedule via
 * `getRecurringExpenseById` and passes it as `initialData` to the shared
 * `<RecurringExpenseForm />` (re-used from the Create flow). The form
 * submits PATCH semantics because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { Repeat } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getRecurringExpenseById } from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringExpense } from '@/lib/worksuite/billing-types';

import { RecurringExpenseForm } from '../../_components/recurring-expense-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/purchases/recurring-expenses';

export default async function EditRecurringExpensePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const doc = (await getRecurringExpenseById(id)) as unknown as
        | (WsRecurringExpense & { _id: string | unknown })
        | null;

    if (!doc) notFound();

    const title = doc.name || 'Recurring expense';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${title}`}
                subtitle="Update the schedule's vendor, amount, recurrence, and status."
                icon={Repeat}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Purchases', href: '/dashboard/crm/purchases' },
                    {
                        label: 'Recurring Expenses',
                        href: BASE,
                    },
                    { label: title, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
            />
            <RecurringExpenseForm initialData={doc} />
        </div>
    );
}
