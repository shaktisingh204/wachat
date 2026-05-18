import { redirect } from 'next/navigation';

/**
 * New automation page — server wrapper around `<AutomationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { AutomationForm } from '../_components/automation-form';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="AUTOMATION"
            title="New Automation"
            back={{ href: '/dashboard/crm/automations', label: 'Automations' }}
        >
            <AutomationForm />
        </EntityDetailShell>
    );
}
