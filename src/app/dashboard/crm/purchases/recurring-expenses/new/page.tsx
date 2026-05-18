/**
 * Create recurring expense — `/dashboard/crm/purchases/recurring-expenses/new`.
 *
 * Server wrapper around `<RecurringExpenseForm />`. The form is large
 * enough that a dialog would feel cramped, so we render the page chrome
 * here and hand off to the shared client form (also used by Edit).
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RecurringExpenseForm } from '../_components/recurring-expense-form';

export const dynamic = 'force-dynamic';

export default function NewRecurringExpensePage() {
    return (
        <EntityListShell title="New recurring expense" subtitle="Schedule an expense to record automatically.">
            <RecurringExpenseForm />
        </EntityListShell>
    );
}
