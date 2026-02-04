'use server';

import { Suspense } from 'react';
import { NewExpenseForm } from './new-expense-form';

export default async function NewExpensePage() {
    return (
        <div className="max-w-2xl mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Record Expense</h1>
            <Suspense fallback={<div>Loading...</div>}>
                <NewExpenseForm />
            </Suspense>
        </div>
    );
}
