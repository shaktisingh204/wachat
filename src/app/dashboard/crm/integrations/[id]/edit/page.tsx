import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Webhook } from 'lucide-react';

/**
 * Edit integration page — loads the doc by id and passes it to
 * `<IntegrationForm />`. Credentials are stripped server-side; the form
 * displays an empty credentials box and only overwrites secrets when
 * the operator types a fresh JSON payload.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getIntegrationById } from '@/app/actions/crm-integrations.actions';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Integrations', href: BASE },
                    { label: integration.name, href: `${BASE}/${id}/edit` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${integration.name}`}
                subtitle="Update connection settings. Credentials stay hidden — leave blank to keep current."
                icon={Webhook}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <IntegrationForm initialData={integration} />
        </div>
    );
}
