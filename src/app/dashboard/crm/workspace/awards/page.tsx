/**
 * Awards — list page (§1D.1 bar).
 *
 * Pre-fetches award programs, appreciations and KPIs server-side,
 * passes them to the client list as initial data.
 */

import {
    getAwards,
    getAppreciations,
    getAwardKpis,
} from '@/app/actions/worksuite/knowledge.actions';
import { AwardsListClient } from './_components/awards-list-client';
import type { WsAward, WsAppreciation } from '@/lib/worksuite/knowledge-types';

export const dynamic = 'force-dynamic';

export default async function AwardsPage() {
    const [awards, appreciations, kpis] = await Promise.all([
        getAwards(),
        getAppreciations(),
        getAwardKpis(),
    ]);
    // hrList + serialize() converts _id from ObjectId to string at runtime.
    const aw = awards as unknown as (WsAward & { _id: string })[];
    const ap = appreciations as unknown as (WsAppreciation & { _id: string })[];
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AwardsListClient
                initialAwards={aw}
                initialAppreciations={ap}
                initialKpis={kpis}
            />
        </div>
    );
}
