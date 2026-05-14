/**
 * Notices — list page (§1D.1 bar).
 *
 * TODO 1D.1: bulk Send / Mark-all-read — deferred until bulk server
 * actions are wired (currently only single-row delete + per-user
 * markNoticeViewed exist).
 */

import { NoticesListClient } from './_components/notices-list-client';

export const dynamic = 'force-dynamic';

export default function NoticesPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NoticesListClient />
        </div>
    );
}
