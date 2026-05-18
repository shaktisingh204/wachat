import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit estimate request — server wrapper.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getEstimateRequestById } from '@/app/actions/crm-estimate-requests.actions';

import { EstimateRequestForm } from '../../_components/estimate-request-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimate-requests';

export default async function EditEstimateRequestPage({
    params,
}: {
    params: Promise<{ requestId: string }>;
}) {
    const { requestId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const request = await getEstimateRequestById(requestId);
    if (!request) notFound();

    const customerName =
        (request.customerName as string | undefined) || 'Estimate request';

    return (
        <EntityDetailShell
            eyebrow="ESTIMATE REQUEST"
            title={`Edit · ${customerName}`}
            back={{ href: `${BASE}/${requestId}`, label: 'Estimate Request' }}
        >
            <EstimateRequestForm
                initialData={request as Record<string, unknown>}
            />
        </EntityDetailShell>
    );
}
