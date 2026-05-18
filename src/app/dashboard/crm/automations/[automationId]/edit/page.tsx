import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Zap } from 'lucide-react';

/**
 * Edit automation page — server wrapper that loads the automation by id
 * and passes it as `initialData` to `<AutomationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getAutomationById } from '@/app/actions/crm-automations.actions';

import { AutomationForm } from '../../_components/automation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/automations';

export default async function EditAutomationPage({
    params,
}: {
    params: Promise<{ automationId: string }>;
}) {
    const { automationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const automation = await getAutomationById(automationId);
    if (!automation) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Automations', href: BASE },
                    { label: automation.name, href: `${BASE}/${automationId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${automation.name}`}
                subtitle="Update trigger, conditions and node sequence."
                icon={Zap}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${automationId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <AutomationForm initialData={automation} />
        </div>
    );
}
