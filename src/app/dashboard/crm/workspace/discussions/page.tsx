/**
 * Discussions — list page (§1D.1 bar).
 *
 * Pre-fetches discussions, categories and KPIs server-side, passes them
 * to the client list. Reply counts are fetched lazily client-side since
 * they require per-discussion sub-queries.
 */

import {
    getDiscussions,
    getDiscussionCategories,
    getDiscussionKpis,
} from '@/app/actions/worksuite/knowledge.actions';
import { DiscussionsListClient } from './_components/discussions-list-client';
import type { WsDiscussion, WsDiscussionCategory } from '@/lib/worksuite/knowledge-types';

export const dynamic = 'force-dynamic';

export default async function DiscussionsPage() {
    const [discussions, categories, kpis] = await Promise.all([
        getDiscussions(),
        getDiscussionCategories(),
        getDiscussionKpis(),
    ]);
    // hrList + serialize() converts _id from ObjectId to string at runtime.
    const ds = discussions as unknown as (WsDiscussion & { _id: string })[];
    const cs = categories as unknown as (WsDiscussionCategory & { _id: string })[];
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <DiscussionsListClient
                initialDiscussions={ds}
                initialCategories={cs}
                initialKpis={kpis}
            />
        </div>
    );
}
