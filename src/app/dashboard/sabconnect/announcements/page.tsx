/**
 * Announcements, list page (§1B W7).
 *
 * Server component that pre-fetches announcements + KPIs in parallel,
 * then hands off to the client list for filtering, bulk actions, and export.
 */

import {
    getAnnouncements,
    getAnnouncementKpis,
} from '@/app/actions/crm-announcements.actions';
import { AnnouncementsListClient } from './_components/announcements-list-client';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
    const [{ items }, kpis] = await Promise.all([
        getAnnouncements(),
        getAnnouncementKpis(),
    ]);
    return (
        <div className="ui20 flex w-full flex-col gap-6 p-4 md:p-6">
            <AnnouncementsListClient initialItems={items} initialKpis={kpis} />
        </div>
    );
}
