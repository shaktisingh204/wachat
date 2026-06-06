import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { Suspense } from 'react';

/**
 * Edit reconciliation — server wrapper around `<ReconciliationForm
 * initialData={...} />`. Strips the `statement: <url>` line out of the
 * notes blob so it can be re-rendered as a SabFile chip.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { getSession } from '@/app/actions/user.actions';
import { getReconciliationById } from '@/app/actions/crm-reconciliation.actions';
import type { CrmReconciliationDoc } from '@/lib/rust-client/crm-reconciliation';

import { ReconciliationForm } from '../../_components/reconciliation-form';

export const metadata: Metadata = {
    title: 'Edit Reconciliation | SabNode',
    description: 'Edit an existing reconciliation',
};

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

function FormSkeleton() {
    return (
        <div className="rounded-xl border bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-sm p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="flex justify-between pt-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
            </div>
        </div>
    );
}

async function EditFormContent({ id }: { id: string }) {
    const fetched = await getReconciliationById(id);
    if (!fetched) notFound();
    const { recon, statementUrl } = splitStatement(fetched);

    return (
        <ReconciliationForm
            initialData={recon}
            initialStatementUrl={statementUrl}
        />
    );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditReconciliationPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title="Edit reconciliation"
            back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
        >
            <Suspense fallback={<FormSkeleton />}>
                <EditFormContent id={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
