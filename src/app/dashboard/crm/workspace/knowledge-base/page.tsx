/**
 * Internal Knowledge Base — list page (§1D.1 bar).
 *
 * TODO 1D.1: Most-viewed / Helpful % tiles deferred until the internal
 * KB schema gains `viewCount` and `helpfulYes`/`helpfulNo` fields.
 */

import { KbInternalListClient } from './_components/kb-internal-list-client';

export const dynamic = 'force-dynamic';

export default function KnowledgeBasePage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <KbInternalListClient />
        </div>
    );
}
