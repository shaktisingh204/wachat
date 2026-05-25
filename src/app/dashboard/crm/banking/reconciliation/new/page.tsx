import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

/**
 * New bank reconciliation — server wrapper around `<ReconciliationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { ReconciliationForm } from '../_components/reconciliation-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'New Reconciliation | Banking',
    description: 'Create a new bank reconciliation record',
};

const BASE = '/dashboard/crm/banking/reconciliation';

export default async function NewReconciliationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="RECONCILIATION"
            title="New Reconciliation"
            back={{ href: BASE, label: 'Reconciliation' }}
        >
            <ReconciliationForm />
        </EntityDetailShell>
    );
}
