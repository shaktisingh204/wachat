import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit email template page — server wrapper that loads the template
 * and passes it as `initialData` to `<EmailTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getEmailTemplateById } from '@/app/actions/crm-email-templates.actions';

import { EmailTemplateForm } from '../../_components/email-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/settings/email-templates';

export default async function EditEmailTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: templateId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const template = await getEmailTemplateById(templateId);
    if (!template) notFound();

    return (
        <EntityDetailShell
            eyebrow="EMAIL TEMPLATE"
            title={`Edit · ${template.name}`}
            back={{ href: `${BASE}/${templateId}`, label: template.name }}
        >
            <EmailTemplateForm initialData={template} />
        </EntityDetailShell>
    );
}
