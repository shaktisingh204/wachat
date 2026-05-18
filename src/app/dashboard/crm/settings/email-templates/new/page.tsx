import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';

/**
 * New email template page — server wrapper around `<EmailTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { EmailTemplateForm } from '../_components/email-template-form';

export const dynamic = 'force-dynamic';

export default async function NewEmailTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Settings', href: '/dashboard/crm/settings' },
                    {
                        label: 'Email Templates',
                        href: '/dashboard/crm/settings/email-templates',
                    },
                    { label: 'New' },
                ]}
                title="New email template"
                subtitle="Reusable subject + body for transactional or marketing email."
                icon={Mail}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/settings/email-templates">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <EmailTemplateForm />
        </div>
    );
}
