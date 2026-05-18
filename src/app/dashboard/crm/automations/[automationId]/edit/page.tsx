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
        <EntityDetailShell
            eyebrow="AUTOMATION"
            title={`Edit · ${automation.name}`}
            back={{ href: `${BASE}/${automationId}`, label: 'Back to detail' }}
        >
            <AutomationForm initialData={automation} />
        </EntityDetailShell>
    );
}
