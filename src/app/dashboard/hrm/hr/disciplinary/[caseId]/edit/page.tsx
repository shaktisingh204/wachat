import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { loadLiveDocument, saveLiveDocument } from '@/app/actions/crm-live-documents.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/disciplinary';

export default async function EditDisciplinaryPage({
    params,
}: {
    params: Promise<{ caseId: string }>;
}) {
    const { caseId } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await loadLiveDocument('disciplinary_letter', caseId);
    if (!doc) notFound();

    return (
        <LiveDocumentEditor
            documentType="disciplinary_letter"
            initialData={doc as Record<string, unknown>}
            saveAction={saveLiveDocument}
            backHref={BASE}
        />
    );
}
