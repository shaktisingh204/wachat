import { Suspense } from 'react';
import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit automation page — server wrapper that loads the automation by id
 * and passes it as `initialData` to `<AutomationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getAutomationById } from '@/app/actions/crm-automations.actions';

import { AutomationForm } from '../../_components/automation-form';
import { LoaderCircle } from 'lucide-react';

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

    return (
        <Suspense fallback={
            <EntityDetailShell
                eyebrow="AUTOMATION"
                title="Loading..."
                back={{ href: `${BASE}/${automationId}`, label: 'Back to detail' }}
            >
                <div className="flex h-32 items-center justify-center">
                    <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                </div>
            </EntityDetailShell>
        }>
            <AutomationEditor automationId={automationId} />
        </Suspense>
    );
}

async function AutomationEditor({ automationId }: { automationId: string }) {
    const automation = await getAutomationById(automationId);
    if (!automation) notFound();

    return (
        <EntityDetailShell
            eyebrow="AUTOMATION"
            title={`Edit · ${automation.name}`}
            back={{ href: `${BASE}/${automationId}`, label: 'Back to detail' }}
        >
            <AutomationForm initialData={automation} />
        </EntityDetailShell>
    );
}
