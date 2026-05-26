/**
 * Knowledge Base — list page (§1D.1 bar).
 *
 * Server entry; hands off to `<KbListClient>` which owns the KPI strip,
 * 6 filters, 10-column table or category-tree view, bulk actions, and
 * delete dialog. Data is fetched client-side in the shell to keep the
 * server payload small.
 */

import { KbListClient } from './_components/kb-list-client';

export const dynamic = 'force-dynamic';

export default function KnowledgeBasePage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <KbListClient />
        </div>
    );
}
