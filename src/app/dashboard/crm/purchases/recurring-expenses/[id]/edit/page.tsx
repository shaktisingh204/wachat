/**
 * Edit recurring expense — `/dashboard/crm/purchases/recurring-expenses/[id]/edit`.
 *
 * Server wrapper that hydrates the existing schedule via
 * `getRecurringExpenseById` and passes it as `initialData` to the shared
 * `<RecurringExpenseForm />` (re-used from the Create flow). The form
 * submits PATCH semantics because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Edit · ${title}`}
            subtitle="Update the schedule's vendor, amount, recurrence, and status."
        >
            <RecurringExpenseForm initialData={doc} />
        </EntityListShell>
    );
}
