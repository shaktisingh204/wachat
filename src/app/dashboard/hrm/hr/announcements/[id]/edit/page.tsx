import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { loadLiveDocument, saveLiveDocument } from '@/app/actions/crm-live-documents.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/announcements';

export default async function EditAnnouncementPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await loadLiveDocument('announcement', id);
    if (!doc) notFound();

    return (
        <LiveDocumentEditor
            documentType="announcement"
            initialData={doc as Record<string, unknown>}
            saveAction={saveLiveDocument}
            backHref={BASE}
        />
    );
}
