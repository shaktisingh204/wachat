import { redirect } from 'next/navigation';

/**
 * New bank reconciliation — server wrapper around `<ReconciliationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { ReconciliationForm } from '../_components/reconciliation-form';

export const dynamic = 'force-dynamic';

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
