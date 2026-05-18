import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Webhook } from 'lucide-react';

/**
 * New integration page — server wrapper around `<IntegrationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { IntegrationForm } from '../_components/integration-form';

export const dynamic = 'force-dynamic';

export default async function NewIntegrationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Integrations', href: '/dashboard/crm/integrations' },
                    { label: 'New' },
                ]}
                title="New custom integration"
                subtitle="Wire up a webhook, third-party API key, or provider-specific credential."
                icon={Webhook}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/integrations">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <IntegrationForm />
        </div>
    );
}
