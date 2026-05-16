/**
 * Create recurring expense — `/dashboard/crm/purchases/recurring-expenses/new`.
 *
 * Server wrapper around `<RecurringExpenseForm />`. The form is large
 * enough that a dialog would feel cramped, so we render the page chrome
 * here and hand off to the shared client form (also used by Edit).
 */

import { Repeat } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { RecurringExpenseForm } from '../_components/recurring-expense-form';

export const dynamic = 'force-dynamic';

export default function NewRecurringExpensePage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New recurring expense"
                subtitle="Schedule an expense to record automatically."
                icon={Repeat}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Purchases', href: '/dashboard/crm/purchases' },
                    {
                        label: 'Recurring Expenses',
                        href: '/dashboard/crm/purchases/recurring-expenses',
                    },
                    { label: 'New' },
                ]}
            />
            <RecurringExpenseForm />
        </div>
    );
}
