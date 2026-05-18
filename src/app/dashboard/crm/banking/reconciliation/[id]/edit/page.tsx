import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  GitCompare } from 'lucide-react';

/**
 * Edit reconciliation — server wrapper around `<ReconciliationForm
 * initialData={...} />`. Strips the `statement: <url>` line out of the
 * notes blob so it can be re-rendered as a SabFile chip.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getReconciliationById } from '@/app/actions/crm-reconciliation.actions';
import type { CrmReconciliationDoc } from '@/lib/rust-client/crm-reconciliation';

import { ReconciliationForm } from '../../_components/reconciliation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/reconciliation';

function splitStatement(
    recon: CrmReconciliationDoc,
): { recon: CrmReconciliationDoc; statementUrl?: string } {
    const notes = recon.notes ?? '';
    const m = notes.match(/(^|\n)statement:\s*(\S+)\s*$/);
    if (!m) return { recon };
    const url = m[2];
    const rest = notes.replace(/(^|\n)statement:\s*\S+\s*$/, '').trim();
    return {
        recon: { ...recon, notes: rest || undefined },
        statementUrl: url,
    };
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditReconciliationPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const fetched = await getReconciliationById(id);
    if (!fetched) notFound();
    const { recon, statementUrl } = splitStatement(fetched);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Reconciliation', href: BASE },
                    { label: 'Detail', href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title="Edit reconciliation"
                subtitle="Update balances, counts or notes."
                icon={GitCompare}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <ReconciliationForm
                initialData={recon}
                initialStatementUrl={statementUrl}
            />
        </div>
    );
}
