import {
    getDocuments,
    getDocumentKpis,
} from '@/app/actions/crm-documents.actions';
import { DocumentsListClient } from './_components/documents-list-client';

export const dynamic = 'force-dynamic';

export default async function WorkspaceDocumentsPage() {
    const [documentsRes, kpis] = await Promise.all([
        getDocuments({ limit: 200 }),
        getDocumentKpis(),
    ]);

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <DocumentsListClient initialDocuments={documentsRes.items ?? []} initialKpis={kpis} />
        </div>
    );
}
