import {
  redirect } from 'next/navigation';

/**
 * New batch — server wrapper that gates auth and renders <BatchExpiryForm />.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { BatchExpiryForm } from '../_components/batch-expiry-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';

export default async function NewBatchPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="BATCH"
            title="New batch"
            back={{ href: BASE, label: 'Back to list' }}
        >
            <BatchExpiryForm />
        </EntityDetailShell>
    );
}
