/**
 * Edit Budget — server wrapper that fetches by id and hands the doc
 * to the client form.
 */

import { notFound } from 'next/navigation';

import { getBudgetById } from '@/app/actions/crm-budgets.actions';
import { EditBudgetForm } from './edit-budget-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditBudgetPage({ params }: PageProps) {
    const { id } = await params;
    const budget = await getBudgetById(id);
    if (!budget) notFound();
    return <EditBudgetForm budget={budget} budgetId={id} />;
}
