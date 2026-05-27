import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { loadLiveDocument, saveLiveDocument } from '@/app/actions/crm-live-documents.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/recognition';

export default async function EditRecognitionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await loadLiveDocument('recognition', id);
    if (!doc) notFound();

    return (
        <LiveDocumentEditor
            documentType="recognition"
            initialData={doc as Record<string, unknown>}
            saveAction={saveLiveDocument}
            backHref={BASE}
        />
    );
}
