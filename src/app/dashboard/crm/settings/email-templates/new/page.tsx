import { redirect } from 'next/navigation';

/**
 * New email template page — server wrapper around `<EmailTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { EmailTemplateForm } from '../_components/email-template-form';

export const dynamic = 'force-dynamic';

export default async function NewEmailTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="EMAIL TEMPLATE"
            title="New email template"
            back={{
                href: '/dashboard/crm/settings/email-templates',
                label: 'Email Templates',
            }}
        >
            <EmailTemplateForm />
        </EntityDetailShell>
    );
}
