/**
 * Discussions — list page (§1D.1 bar).
 */

import { DiscussionsListClient } from './_components/discussions-list-client';

export const dynamic = 'force-dynamic';

export default function DiscussionsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <DiscussionsListClient />
        </div>
    );
}
