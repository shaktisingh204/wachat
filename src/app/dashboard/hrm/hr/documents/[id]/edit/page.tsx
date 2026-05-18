import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit document page — server wrapper that loads the document by id and
 * passes it as `initialData` to `<DocumentForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Edit · ${doc.name}`}
            subtitle="Update document fields. Changes are revalidated immediately."
        >
            <DocumentForm initialData={doc} />
        </EntityListShell>
    );
}
