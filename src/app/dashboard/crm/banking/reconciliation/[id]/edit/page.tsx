import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit reconciliation — server wrapper around `<ReconciliationForm
 * initialData={...} />`. Strips the `statement: <url>` line out of the
 * notes blob so it can be re-rendered as a SabFile chip.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title="Edit reconciliation"
            back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
        >
            <ReconciliationForm
                initialData={recon}
                initialStatementUrl={statementUrl}
            />
        </EntityDetailShell>
    );
}
