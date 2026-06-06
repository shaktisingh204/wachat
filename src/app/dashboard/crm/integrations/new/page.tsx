import { redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * New integration page — server wrapper around `<IntegrationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { WaterLoader } from '@/components/sabcrm/20ui';

import { IntegrationForm } from '../_components/integration-form';

export const dynamic = 'force-dynamic';

export default async function NewIntegrationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="INTEGRATION"
            title="New custom integration"
            back={{ href: '/dashboard/crm/integrations', label: 'Integrations' }}
        >
            <Suspense fallback={<div className="flex h-64 items-center justify-center"><WaterLoader /></div>}>
                <IntegrationForm />
            </Suspense>
        </EntityDetailShell>
    );
}
