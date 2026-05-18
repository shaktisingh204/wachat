import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';

/**
 * New automation page — server wrapper around `<AutomationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { AutomationForm } from '../_components/automation-form';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Automations', href: '/dashboard/crm/automations' },
                    { label: 'New' },
                ]}
                title="New Automation"
                subtitle="Pick a trigger, list the actions to run, and save."
                icon={Zap}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/automations">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <AutomationForm />
        </div>
    );
}
