import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';

/**
 * Edit integration page — loads the doc by id and passes it to
 * `<IntegrationForm />`. Credentials are stripped server-side; the form
 * displays an empty credentials box and only overwrites secrets when
 * the operator types a fresh JSON payload.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getIntegrationById } from '@/app/actions/crm-integrations.actions';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

import { IntegrationForm } from '../../_components/integration-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/integrations';

export default async function EditIntegrationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const integration = await getIntegrationById(id);
    if (!integration) notFound();

    return (
        <EntityDetailShell
            eyebrow="INTEGRATION"
            title={`Edit · ${integration.name}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
        >
            <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-md" />}>
                <IntegrationForm initialData={integration} />
            </Suspense>
        </EntityDetailShell>
    );
}
