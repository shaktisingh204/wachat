import { getAnnouncementKpis } from '@/app/actions/crm-announcements.actions';
import { NewAnnouncementClient } from './_components/new-announcement-client';

/**
 * New announcement — form page (§1B W7).
 *
 * Enhanced with summary dashboard and quick actions.
 */

export const dynamic = 'force-dynamic';

export default async function NewAnnouncementPage() {
    const kpis = await getAnnouncementKpis();

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NewAnnouncementClient initialKpis={kpis} />
        </div>
    );
}
