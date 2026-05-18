import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileText } from 'lucide-react';

/**
 * Edit document page — server wrapper that loads the document by id and
 * passes it as `initialData` to `<DocumentForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getDocumentById } from '@/app/actions/crm-documents.actions';

import { DocumentForm } from '../../_components/document-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/documents';

export default async function EditDocumentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: documentId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await getDocumentById(documentId);
    if (!doc) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Documents', href: BASE },
                    { label: doc.name, href: `${BASE}/${documentId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${doc.name}`}
                subtitle="Update document fields. Changes are revalidated immediately."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${documentId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <DocumentForm initialData={doc} />
        </div>
    );
}
