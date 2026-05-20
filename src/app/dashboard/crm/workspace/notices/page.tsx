/**
 * Notices — list page (§1D.1 bar).
 *
 * Pre-fetches notices, notice views and KPIs server-side, then hands off
 * to the client list for filtering / bulk actions / export.
 */

import {
    getNotices,
    getNoticeViewsForUser,
    getNoticeKpis,
} from '@/app/actions/worksuite/knowledge.actions';
import { NoticesListClient } from './_components/notices-list-client';
import type { WsNotice, WsNoticeView } from '@/lib/worksuite/knowledge-types';

export const dynamic = 'force-dynamic';

export default async function NoticesPage() {
    const [notices, views, kpis] = await Promise.all([
        getNotices(),
        getNoticeViewsForUser(),
        getNoticeKpis(),
    ]);
    // hrList + serialize() converts _id from ObjectId to string at runtime.
    const ns = notices as unknown as (WsNotice & { _id: string })[];
    const vs = views as unknown as WsNoticeView[];
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NoticesListClient
                initialNotices={ns}
                initialViews={vs}
                initialKpis={kpis}
            />
        </div>
    );
}
