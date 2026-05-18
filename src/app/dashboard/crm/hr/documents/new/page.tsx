import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * New document page — server wrapper around `<DocumentForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { DocumentForm } from '../_components/document-form';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/crm/hr' },
                    { label: 'Documents', href: '/dashboard/crm/hr/documents' },
                    { label: 'New' },
                ]}
                title="New Document"
                subtitle="Track a new HR document — contracts, IDs, certifications and more."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/hr/documents">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <DocumentForm />
        </div>
    );
}
