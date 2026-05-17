/**
 * Announcements — list page (§1B W7).
 *
 * Server component that pre-fetches via the Rust-backed action then hands
 * off to the client list for filtering/sorting/delete. Permission checks
 * live in the actions; this page renders an empty list on guard failure.
 */

import { getAnnouncements } from '@/app/actions/crm-announcements.actions';
import { AnnouncementsListClient } from './_components/announcements-list-client';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
    const { items } = await getAnnouncements();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AnnouncementsListClient initialItems={items} />
        </div>
    );
}
