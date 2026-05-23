import { redirect } from 'next/navigation';

/**
 * New automation page — server wrapper around `<AutomationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { AutomationForm } from '../_components/automation-form';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage({
    searchParams
}: {
    searchParams: Promise<{ template?: string }>
}) {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const params = await searchParams;
    let initialData = undefined;

    if (params.template) {
        if (params.template === 'tpl-new-lead-welcome') {
            initialData = {
                name: 'New Lead Welcome Sequence',
                description: 'Automatically sends a welcome email + WhatsApp message when a new lead is tagged.',
                nodes: [
                    { id: 'trigger', type: 'trigger_tag_added', data: { conditions: 'tag=new_lead' }, position: { x: 0, y: 0 } },
                    { id: 'action-1', type: 'action_send_email', data: { label: 'Send Welcome Email', to: '{{contact.email}}', templateId: 'welcome-1' }, position: { x: 0, y: 100 } },
                    { id: 'action-2', type: 'action_webhook', data: { label: 'Send WhatsApp (Webhook)', url: 'https://example.com/whatsapp' }, position: { x: 0, y: 200 } }
                ]
            } as any;
        } else if (params.template === 'tpl-abandoned-cart') {
             initialData = {
                name: 'Abandoned Cart Recovery',
                description: 'Sends a reminder email to customers who left items in their cart.',
                nodes: [
                    { id: 'trigger', type: 'trigger_status_changed', data: { conditions: 'status=abandoned' }, position: { x: 0, y: 0 } },
                    { id: 'delay-1', type: 'delay', data: { label: 'Wait 1 hour', duration: '1h' }, position: { x: 0, y: 100 } },
                    { id: 'action-1', type: 'action_send_email', data: { label: 'Cart Reminder Email', to: '{{contact.email}}' }, position: { x: 0, y: 200 } }
                ]
            } as any;
        }
    }

    return (
        <EntityDetailShell
            eyebrow="AUTOMATION"
            title="New Automation"
            back={{ href: '/dashboard/crm/automations', label: 'Automations' }}
        >
            <AutomationForm initialData={initialData} />
        </EntityDetailShell>
    );
}
