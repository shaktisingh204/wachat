import { Suspense } from 'react';
import { Wallet } from 'lucide-react';
import { NewExpenseForm } from './new-expense-form';
import { CrmPageHeader } from '../../../_components/crm-page-header';

export default async function NewExpensePage() {
    return (
        <div className="flex flex-col gap-6 max-w-2xl">
            <CrmPageHeader
                title="Record Expense"
                subtitle="Add a new expense entry."
                icon={Wallet}
            />
            <Suspense fallback={<div className="text-[13px] text-clay-ink-muted">Loading...</div>}>
                <NewExpenseForm />
            </Suspense>
        </div>
    );
}
