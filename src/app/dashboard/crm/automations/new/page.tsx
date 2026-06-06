import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Mail, ShoppingCart, Plus } from 'lucide-react';

/**
 * New automation page — server wrapper around `<AutomationForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';

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

    if (!params.template) {
        return (
            <EntityDetailShell
                eyebrow="AUTOMATION"
                title="Choose a Template"
                back={{ href: '/dashboard/crm/automations', label: 'Automations' }}
            >
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="?template=blank" className="block h-full">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardHeader>
                                <div className="h-10 w-10 rounded-lg bg-[var(--st-bg-muted)] flex items-center justify-center mb-4 group-hover:bg-[var(--st-text)]/10 transition-colors">
                                    <Plus className="h-5 w-5 text-[var(--st-text)] group-hover:text-[var(--st-text)]" />
                                </div>
                                <CardTitle>Blank Automation</CardTitle>
                                <CardDescription>Start from scratch and build your own custom automation flow.</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>

                    <Link href="?template=tpl-new-lead-welcome" className="block h-full">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardHeader>
                                <div className="h-10 w-10 rounded-lg bg-[var(--st-bg-muted)] flex items-center justify-center mb-4 group-hover:bg-[var(--st-bg-muted)] transition-colors">
                                    <Mail className="h-5 w-5 text-[var(--st-text)]" />
                                </div>
                                <CardTitle>New Lead Welcome Sequence</CardTitle>
                                <CardDescription>Automatically sends a welcome email and WhatsApp message when a new lead is tagged.</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>

                    <Link href="?template=tpl-abandoned-cart" className="block h-full">
                        <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardHeader>
                                <div className="h-10 w-10 rounded-lg bg-[var(--st-bg-muted)] flex items-center justify-center mb-4 group-hover:bg-[var(--st-bg-muted)] transition-colors">
                                    <ShoppingCart className="h-5 w-5 text-[var(--st-text)]" />
                                </div>
                                <CardTitle>Abandoned Cart Recovery</CardTitle>
                                <CardDescription>Sends a reminder email to customers who left items in their cart.</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                </div>
            </EntityDetailShell>
        );
    }

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
            title={params.template === 'blank' ? "New Automation" : "Template Automation"}
            back={{ href: '/dashboard/crm/automations/new', label: 'Templates' }}
        >
            <AutomationForm initialData={initialData} />
        </EntityDetailShell>
    );
}
