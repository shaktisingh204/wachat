import { getAnnouncementKpis } from '@/app/actions/crm-announcements.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
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
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Announcements</PageEyebrow>
                    <PageTitle>New announcement</PageTitle>
                    <PageDescription>
                        Compose a new announcement and review your current activity at a glance.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <NewAnnouncementClient initialKpis={kpis} />
        </div>
    );
}
