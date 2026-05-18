import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileCode } from 'lucide-react';

/**
 * New document template page — server wrapper around `<DocumentTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { DocumentTemplateForm } from '../_components/document-template-form';

export const dynamic = 'force-dynamic';

export default async function NewDocumentTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Document templates',
                        href: '/dashboard/hrm/hr/document-templates',
                    },
                    { label: 'New' },
                ]}
                title="New Document Template"
                subtitle="Author a reusable HR document template with placeholder variables."
                icon={FileCode}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/document-templates">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <DocumentTemplateForm />
        </div>
    );
}
