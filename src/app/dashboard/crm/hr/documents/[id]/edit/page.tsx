import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit document page — server wrapper that loads the document by id and
 * passes it as `initialData` to `<DocumentForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getDocumentById } from '@/app/actions/crm-documents.actions';

import { DocumentForm } from '../../_components/document-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr/documents';

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
        <EntityDetailShell
            title={`Edit · ${doc.name}`}
            eyebrow="DOCUMENT"
            back={{ href: BASE, label: 'Documents' }}
        >
            <DocumentForm initialData={doc} />
        </EntityDetailShell>
    );
}
