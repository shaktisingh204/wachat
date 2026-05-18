import {
  redirect } from 'next/navigation';

/**
 * New estimate request — server wrapper around `<EstimateRequestForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { EstimateRequestForm } from '../_components/estimate-request-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimate-requests';

export default async function NewEstimateRequestPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="ESTIMATE REQUEST"
            title="New estimate request"
            back={{ href: BASE, label: 'Estimate Requests' }}
        >
            <EstimateRequestForm />
        </EntityDetailShell>
    );
}
