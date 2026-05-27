import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getCreditNoteById, saveCreditNote } from '@/app/actions/crm-credit-notes.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/credit-notes';

export default async function EditCreditNotePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const note = await getCreditNoteById(id);
    if (!note) notFound();

    return (
        <LiveDocumentEditor
            documentType="credit_note"
            initialData={note as Record<string, unknown>}
            saveAction={saveCreditNote}
            backHref={BASE}
        />
    );
}
