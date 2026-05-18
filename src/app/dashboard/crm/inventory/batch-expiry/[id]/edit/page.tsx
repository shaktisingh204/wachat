import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit batch — server wrapper that loads + passes to <BatchExpiryForm />.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { getCrmItemBatchById } from '@/app/actions/crm-item-batches.actions';
import { BatchExpiryForm } from '../../_components/batch-expiry-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';

export default async function EditBatchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const batch = await getCrmItemBatchById(id);
    if (!batch) notFound();

    return (
        <EntityDetailShell
            eyebrow="BATCH"
            title={`Edit · ${batch.batchNumber}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
        >
            <BatchExpiryForm initialData={batch} />
        </EntityDetailShell>
    );
}
