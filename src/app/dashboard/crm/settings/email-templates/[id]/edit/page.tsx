import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Mail } from 'lucide-react';

/**
 * Edit email template page — server wrapper that loads the template
 * and passes it as `initialData` to `<EmailTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Settings', href: '/dashboard/crm/settings' },
                    { label: 'Email Templates', href: BASE },
                    { label: template.name, href: `${BASE}/${templateId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${template.name}`}
                subtitle="Update subject, body, merge variables and publishing status."
                icon={Mail}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${templateId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <EmailTemplateForm initialData={template} />
        </div>
    );
}
