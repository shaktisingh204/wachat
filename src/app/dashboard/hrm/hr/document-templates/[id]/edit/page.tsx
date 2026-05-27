import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { loadLiveDocument, saveLiveDocument } from '@/app/actions/crm-live-documents.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/document-templates';

export default async function EditDocumentTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await loadLiveDocument('document_template', id);
    if (!doc) notFound();

    return (
        <LiveDocumentEditor
            documentType="document_template"
            initialData={doc as Record<string, unknown>}
            saveAction={saveLiveDocument}
            backHref={BASE}
        />
    );
}
