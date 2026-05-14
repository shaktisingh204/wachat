/**
 * Awards — list page (§1D.1 bar).
 *
 * TODO 1D.1: nominations / winners are derived from the appreciations
 * collection; explicit voting + program-period server actions are
 * deferred until those schema fields land.
 */

import { AwardsListClient } from './_components/awards-list-client';

export const dynamic = 'force-dynamic';

export default function AwardsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AwardsListClient />
        </div>
    );
}
