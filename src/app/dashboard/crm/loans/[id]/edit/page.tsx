/**
 * Edit Loan — server wrapper that fetches by id and hands the doc
 * to the client form. Mirrors `accounts/[accountId]/edit/page.tsx`.
 */

import { notFound } from 'next/navigation';

import { getLoanById } from '@/app/actions/crm-loans.actions';
import { EditLoanForm } from './edit-loan-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditLoanPage({ params }: PageProps) {
    const { id } = await params;
    const loan = await getLoanById(id);
    if (!loan) notFound();
    return <EditLoanForm loan={loan} loanId={id} />;
}
